import type { Response, NextFunction } from 'express';
import type { DomainRequest } from '../src/framework/contracts';

export const UserRole = { STUDENT: 'student', ADMIN: 'admin' } as const;
export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

export async function authenticate(req: DomainRequest, res: Response, next: NextFunction) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveIdentity } = require('./sessionIdentity');
    const auth = await resolveIdentity(req.headers);
    if (!auth) return res.status(401).json({ error: 'Authentication required' });
    res.setHeader('Cache-Control', 'private, no-store');
    req.user = auth.identity;
    req.auth = auth;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to require a specific role
 * @param {string} role
 */
export function requireRole(role: string) {
  return (req: DomainRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role !== role) {
      return res.status(403).json({
        error: `Insufficient permissions. Required role: ${role}`
      });
    }

    next();
  };
}

/**
 * Middleware to restrict an endpoint to admins or internal service-to-service
 * calls. Internal callers must present the shared INTERNAL_API_SECRET via the
 * `x-internal-secret` header. A normal (non-admin) user session alone is rejected.
 * Fails closed: if INTERNAL_API_SECRET is not configured, only admins pass.
 * Single canonical implementation (SEC-05); callers must not re-implement this.
 */
export function requireInternal(req: DomainRequest, res: Response, next: NextFunction) {
  const user = req.user;
  if (user && (user.role === 'admin' || user.isAdmin === true)) {
    return next();
  }

  const expectedSecret = process.env.INTERNAL_API_SECRET;
  const providedSecret = req.headers && (req.headers['x-internal-secret'] as string);
  if (expectedSecret && providedSecret && providedSecret === expectedSecret) {
    return next();
  }

  return res.status(403).json({ error: 'Forbidden: admin or internal access required' });
}

/**
 * Build the headers required for an internal service-to-service call: the
 * `x-internal-secret` plus an optional propagated Authorization header.
 * Single canonical implementation (SEC-05); callers must not re-implement this.
 */
export function buildInternalHeaders(authorization?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const expectedSecret = process.env.INTERNAL_API_SECRET;
  if (authorization) headers.Cookie = authorization;
  if (expectedSecret) headers['x-internal-secret'] = expectedSecret;
  return headers;
}

/**
 * True when the request is a trusted internal service-to-service call (matching
 * `x-internal-secret`). Internal calls may carry an explicit target userId that
 * differs from the session identity; normal user requests must never be treated as
 * internal.
 */
export function isInternalRequest(req: DomainRequest): boolean {
  const expectedSecret = process.env.INTERNAL_API_SECRET;
  if (!expectedSecret) return false;
  return req.headers['x-internal-secret'] === expectedSecret;
}

module.exports = {
  UserRole,
  authenticate,
  requireRole,
  requireInternal,
  isInternalRequest,
  buildInternalHeaders
};
