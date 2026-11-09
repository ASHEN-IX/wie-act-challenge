import express from 'express';
import cookieParser from 'cookie-parser';
import { authenticate } from '@ednova/shared/auth';
import {
  corsMiddleware,
  securityMiddleware,
  loggingMiddleware,
  errorHandler,
  rateLimiter,
  requireEnv
} from '@ednova/shared';
import aiRoutes from './routes/ai';
import jobsRoutes from './routes/jobs';
import evalRoutes from './routes/eval';
import searchRoutes from './routes/search';
import fileUpload from 'express-fileupload';

// --- Environment validation (fail-fast on missing secrets) ---
requireEnv(['DATABASE_URL', 'RABBITMQ_URL'], { serviceName: 'ai-orchestrator' });

const app = express();
app.set('trust proxy', 1);

// Body parsing middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// File upload middleware (for frame analysis proxy)
app.use(fileUpload({ limits: { fileSize: 10 * 1024 * 1024 } }));

// Shared middleware
app.use(securityMiddleware());
app.use(corsMiddleware());
app.use(loggingMiddleware);
app.use(rateLimiter());

// Health check (no DB check for ai-orchestrator)
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'ai-orchestrator',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Stricter rate limit for expensive AI operations (10 req/min)
const aiRateLimiter = rateLimiter(10, 60000);
app.use('/api/v1/ai/ingest', aiRateLimiter);
app.use('/api/v1/ai/plan', aiRateLimiter);
app.use('/api/v1/ai/coach', aiRateLimiter);
app.use('/api/v1/ai/signals', aiRateLimiter);

// Protected AI routes (require authentication)
app.use('/api/v1/ai', authenticate, aiRoutes);

// Async AI job endpoints (F01): create/poll jobs instead of sync LLM waits
app.use('/api/v1/ai', authenticate, jobsRoutes);

// Eval API (F04 / EVAL-09): async Socratic step jobs — the submit is the
// LLM-heavy call so it gets the strict AI rate limit; polling reads stay open.
app.use('/api/v1/eval/step', aiRateLimiter);
app.use('/api/v1/eval', authenticate, evalRoutes);

// Search API (F05 / SEARCH-07): async search jobs — submit is the crawler+LLM
// heavy call so it gets the strict AI rate limit (10 req/min per user, SEARCH-02).
app.use('/api/v1/search/query', aiRateLimiter);
app.use('/api/v1/search', authenticate, searchRoutes);

// Error handler (must be last)
app.use(errorHandler);

export default app;
module.exports = app;
