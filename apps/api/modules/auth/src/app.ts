import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import stripeRoutes, { webhookHandler } from './routes/stripe';
import {
  corsMiddleware,
  securityMiddleware,
  loggingMiddleware,
  errorHandler,
  rateLimiter,
  healthCheck,
  requireEnv
} from '@noveris/shared';
import { authenticate } from '@noveris/shared/auth';

// --- Environment validation (fail-fast on missing secrets) ---
requireEnv(['DATABASE_URL'], { serviceName: 'auth' });

// Stripe keys must be provided together (billing enabled) or not at all.
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
if (Boolean(stripeSecretKey) !== Boolean(stripeWebhookSecret)) {
  console.error(
    '[auth][FATAL] STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET must be set together ' +
      '(or both omitted to disable billing).'
  );
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);

// Stripe webhook requires raw body for signature verification.
app.post('/api/v1/auth/stripe/webhook', express.raw({ type: 'application/json' }), webhookHandler);

// Body parsing middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Shared middleware
app.use(securityMiddleware());
app.use(corsMiddleware());
app.use(loggingMiddleware);
app.use(rateLimiter());

// Health check
app.get('/api/v1/health', healthCheck('auth'));

// Better Auth is hosted by Next.js; only domain account/billing/admin routes remain here.
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/auth/stripe', stripeRoutes);

// Admin routes (require authentication + admin role)
app.use('/api/v1/auth/admin', authenticate, adminRoutes);

// Error handler (must be last)
app.use(errorHandler);

export default app;
module.exports = app;
