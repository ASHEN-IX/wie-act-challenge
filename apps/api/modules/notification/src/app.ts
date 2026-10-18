import express from 'express';
import cookieParser from 'cookie-parser';
import notificationRoutes from './routes/notifications';
import chatRoutes from './routes/chat';
import voiceRoutes from './routes/voice';
import {
  corsMiddleware,
  securityMiddleware,
  loggingMiddleware,
  errorHandler,
  rateLimiter,
  healthCheck,
  requireEnv
} from '@study-partner/shared';
import { authenticate } from '@study-partner/shared/auth';

// --- Environment validation (fail-fast on missing secrets) ---
requireEnv(['MONGODB_URI', 'INTERNAL_API_SECRET'], {
  serviceName: 'notification'
});

const app = express();
app.set('trust proxy', 1);

// Body parsing
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Middleware
app.use(securityMiddleware());
app.use(corsMiddleware());
app.use(loggingMiddleware);
app.use(rateLimiter());

// Health check
app.get('/api/v1/health', healthCheck('notification'));

// Notification routes (require authentication)
app.use('/api/v1/notifications', authenticate, notificationRoutes);
app.use('/api/v1/session-chat', authenticate, chatRoutes);
app.use('/api/v1/voice', authenticate, voiceRoutes);

// Error handler (must be last)
app.use(errorHandler);

export default app;
module.exports = app;
