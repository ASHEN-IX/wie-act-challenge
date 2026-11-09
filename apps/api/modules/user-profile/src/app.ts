import { publicUploads } from '@ednova/shared/publicUploads';
import express from 'express';
import cookieParser from 'cookie-parser';
import profileRoutes from './routes/profile';
import availabilityRoutes from './routes/availability';
import gamificationRoutes from './routes/gamification';
import rankingRoutes from './routes/ranking';
import questRoutes from './routes/quests';
import friendRoutes from './routes/friends';
import {
  corsMiddleware,
  securityMiddleware,
  loggingMiddleware,
  errorHandler,
  rateLimiter,
  healthCheck,
  requireEnv
} from '@ednova/shared';
import { authenticate } from '@ednova/shared/auth';
import path from 'path';

// --- Environment validation (fail-fast on missing secrets) ---
requireEnv(['DATABASE_URL', 'INTERNAL_API_SECRET'], {
  serviceName: 'user-profile'
});

const app = express();

// Trust only one proxy hop (api-gateway) to keep rate-limit IP checks safe.
app.set('trust proxy', 1);

// Body parsing middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Serve static directory for uploads
// SEC-11: dotfiles and directory listings denied; content sniffing off.
app.use('/uploads', publicUploads(path.join(__dirname, '../uploads')));

// Shared middleware
app.use(securityMiddleware());
app.use(corsMiddleware());
app.use(loggingMiddleware);
app.use(rateLimiter());

// Health check
app.get('/api/v1/health', healthCheck('user-profile'));

// Protected profile routes (require authentication)
app.use('/api/v1/users/profile', authenticate, profileRoutes);

// Protected availability routes (require authentication)
app.use('/api/v1/users/availability', authenticate, availabilityRoutes);

// Protected gamification routes (require authentication)
app.use('/api/v1/users/gamification', authenticate, gamificationRoutes);

// Protected ranking routes (require authentication)
app.use('/api/v1/users/gamification/rank', authenticate, rankingRoutes);

// Protected quest routes (require authentication)
app.use('/api/v1/users/quests', authenticate, questRoutes);

// Protected friend routes (require authentication)
app.use('/api/v1/users/friends', authenticate, friendRoutes);

// Error handler (must be last)
app.use(errorHandler);

export default app;
module.exports = app;
