import cors from 'cors';
import helmet from 'helmet';
import rateLimit, { MemoryStore } from 'express-rate-limit';
import type { Store as RateStore } from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import type { DomainRequest } from '../src/framework/contracts';
import type Redis from 'ioredis';
import type { RedisStore as RateRedisStore } from 'rate-limit-redis';

interface HttpError extends Error {
  statusCode?: number;
  status?: number;
}
type RedisCommand = Extract<
  ConstructorParameters<typeof RateRedisStore>[0],
  { sendCommand: unknown }
>['sendCommand'];
// eslint-disable-next-line @typescript-eslint/no-require-imports
const logger = require('./logger');
import { v4 as uuidv4 } from 'uuid';

/**
 * Security headers middleware (helmet)
 */
export function securityMiddleware() {
  return helmet({
    contentSecurityPolicy: false, // Disabled for API-only services
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  });
}

/**
 * CORS middleware configuration
 */
export function corsMiddleware() {
  const allowedOrigins =
    process.env.AUTH_TRUSTED_ORIGINS || process.env.CORS_ORIGIN
      ? (process.env.AUTH_TRUSTED_ORIGINS || process.env.CORS_ORIGIN)!
          .split(',')
          .map((o) => o.trim())
      : ['http://localhost:5173', 'http://localhost:3000'];

  return cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });
}

/**
 * Request logging middleware
 */
export function loggingMiddleware(req: DomainRequest, res: Response, next: NextFunction): void {
  const requestId = uuidv4();
  req.requestId = requestId;

  const startTime = Date.now();

  logger.info(`[${requestId}] ${req.method} ${req.path} - Started`, {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(
      `[${requestId}] ${req.method} ${req.path} - Completed ${res.statusCode} in ${duration}ms`,
      {
        requestId,
        statusCode: res.statusCode,
        duration
      }
    );
  });

  next();
}

/**
 * Error handling middleware
 */
export function errorHandler(
  err: HttpError,
  req: DomainRequest,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId || 'unknown';

  logger.error(`[${requestId}] Error:`, {
    requestId,
    error: err.message,
    stack: err.stack
  });

  const statusCode = err.statusCode || err.status || 500;
  const message = statusCode >= 500 ? 'Internal server error' : err.message || 'Request failed';

  res.status(statusCode).json({
    error: message,
    requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

/**
 * Rate limiting middleware — Redis-backed when REDIS_URL is set, falls back to
 * in-memory otherwise. Keys by authenticated userId when available, otherwise IP.
 */
let redisRateClient: Redis | null = null;
let limiterIndex = 0;

/**
 * Keeps the Redis-backed limiter authoritative while Redis answers, but falls
 * back to per-process counting when it is unreachable. Without this a configured
 * but unavailable Redis turns every request — readiness probes included — into
 * a 500. Counters are separate while degraded, so the fallback stays a subset of
 * the configured limit and never widens it.
 */
class RedisFallbackStore implements RateStore {
  private primary: RateRedisStore;
  private fallback = new MemoryStore();
  private degraded = false;

  constructor(primary: RateRedisStore) {
    this.primary = primary;
  }

  private async attempt<T>(operation: () => Promise<T> | T, alternate: () => Promise<T> | T) {
    if (this.degraded) return alternate();
    try {
      const value = await operation();
      if (this.degraded) {
        this.degraded = false;
        logger.info('Rate limit store recovered');
      }
      return value;
    } catch (error) {
      if (!this.degraded) {
        this.degraded = true;
        logger.warn(
          `Rate limit store unavailable, using local counters: ${(error as Error).message}`
        );
      }
      return alternate();
    }
  }

  async increment(key: string) {
    return this.attempt(
      () => this.primary.increment(key),
      () => this.fallback.increment(key)
    );
  }

  async decrement(key: string) {
    return this.attempt(
      () => this.primary.decrement(key),
      () => this.fallback.decrement(key)
    );
  }

  async resetKey(key: string) {
    return this.attempt(
      () => this.primary.resetKey(key),
      () => this.fallback.resetKey(key)
    );
  }
}

function _getRedisStore(): RateStore | null {
  if (!process.env.REDIS_URL) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Redis: typeof import('ioredis').default = require('ioredis');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { RedisStore }: typeof import('rate-limit-redis') = require('rate-limit-redis');
  if (!redisRateClient) {
    redisRateClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: true
    });
    redisRateClient.on('error', () => {});
  }
  const client = redisRateClient;
  const store = new RedisStore({
    sendCommand: (...args: string[]) =>
      client.call(args[0], ...args.slice(1)) as ReturnType<RedisCommand>,
    prefix: `rl:module:${limiterIndex++}:`
  });
  // Store scripts load before the first request. Observe failures so optional Redis
  // initialization cannot become an unhandled rejection; RedisFallbackStore then
  // serves those requests from local counters until Redis answers again.
  store.incrementScriptSha.catch((error: Error) => logger.warn(error.message));
  store.getScriptSha.catch((error: Error) => logger.warn(error.message));
  return new RedisFallbackStore(store);
}

export async function closeRateLimits(): Promise<void> {
  if (redisRateClient) {
    redisRateClient.disconnect();
    redisRateClient = null;
  }
}

export function rateLimiter(maxRequests: number = 100, windowMs: number = 60000) {
  const store = _getRedisStore();
  const effectiveMax = process.env.NODE_ENV === 'test' ? Math.max(maxRequests, 10000) : maxRequests;
  return rateLimit({
    windowMs,
    max: effectiveMax,
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request) => Reflect.get(req, Symbol.for('mindflow.moduleCall')) === true,
    keyGenerator: (req: DomainRequest) => req.user?.userId || req.ip || 'unknown',
    ...(store ? { store } : {})
  });
}

/**
 * Health check endpoint handler with readiness probe
 */
export function healthCheck(serviceName: string) {
  return async (_req: Request, res: Response): Promise<void> => {
    const health: Record<string, unknown> = {
      status: 'healthy',
      service: serviceName,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };

    // Check MongoDB connection if mongoose is loaded
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState !== 1) {
        health.status = 'degraded';
        health.db = 'disconnected';
      } else {
        health.db = 'connected';
      }
    } catch {
      // No mongoose in this service (e.g., api-gateway)
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  };
}

/**
 * Wrap an async Express route handler so thrown errors are forwarded to
 * the Express error handler instead of becoming unhandled promise rejections.
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => unknown) =>
  (req: Request, res: Response, next: NextFunction): Promise<unknown> =>
    Promise.resolve(fn(req, res, next)).catch(next);

/**
 * INGEST-03: require `multipart/form-data` on upload routes.
 * Refuses anything else with 415 before it can reach multer/parsers.
 */
export function requireMultipart(req: Request, _res: Response, next: NextFunction): void {
  if (req.method === 'POST' || req.method === 'PUT') {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
      const err: HttpError = new Error(
        'Unsupported media type - this endpoint requires multipart/form-data'
      );
      err.statusCode = 415;
      return next(err);
    }
  }
  next();
}

module.exports = {
  closeRateLimits,
  corsMiddleware,
  securityMiddleware,
  loggingMiddleware,
  errorHandler,
  rateLimiter,
  healthCheck,
  asyncHandler,
  requireMultipart
};
