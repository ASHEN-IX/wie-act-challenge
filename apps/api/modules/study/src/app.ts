import { publicUploads } from '@ednova/shared/publicUploads';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const taskRoutes = require('./routes/tasks');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const topicRoutes = require('./routes/topics');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sessionRoutes = require('./routes/sessions');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const subjectRoutes = require('./routes/subjects');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const courseRoutes = require('./routes/courses');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const planRoutes = require('./routes/plans');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const learningObjectiveRoutes = require('./routes/learningObjectives');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const competencyRoutes = require('./routes/competencies');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const coachRoutes = require('./routes/coach');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const roomRoutes = require('./routes/rooms');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const institutionRoutes = require('./routes/institutions');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const visualLabRoutes = require('./routes/visualLab');
const nardouchRoutes = require('./routes/nardouch');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  corsMiddleware,
  securityMiddleware,
  loggingMiddleware,
  errorHandler,
  rateLimiter,
  healthCheck,
  requireEnv
} = require('@ednova/shared');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { authenticate } = require('@ednova/shared/auth');

// --- Environment validation (fail-fast on missing secrets) ---
requireEnv(['MONGODB_URI', 'INTERNAL_API_SECRET', 'RABBITMQ_URL'], {
  serviceName: 'study'
});

const app = express();

// Trust proxy so express-rate-limit can correctly parse X-Forwarded-For in Docker
app.set('trust proxy', 1);

// Body parsing middleware with size limits
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Shared middleware
app.use(securityMiddleware());
app.use(corsMiddleware());
app.use(loggingMiddleware);
app.use(rateLimiter());

// Serve uploaded files (subject images) from the service's uploads directory
// SEC-11: dotfiles and directory listings are denied; content sniffing off.
app.use('/uploads', publicUploads(path.join(__dirname, '../uploads')));

// Health check
app.get('/api/v1/health', healthCheck('study'));

// Rate limit file upload endpoints (5 req/min)
const uploadLimiter = rateLimiter(5, 60000);
app.post('/api/v1/study/courses/:courseId/files', uploadLimiter);
app.post('/api/v1/study/subjects', uploadLimiter);

// Protected study routes (require authentication)
app.use('/api/v1/study/tasks', authenticate, taskRoutes);
app.use('/api/v1/study/topics', authenticate, topicRoutes);
app.use('/api/v1/study/sessions', authenticate, sessionRoutes);
app.use('/api/v1/study/subjects', authenticate, subjectRoutes);
app.use('/api/v1/study/courses', authenticate, courseRoutes);
app.use('/api/v1/study/nardouch', authenticate, nardouchRoutes);
app.use('/api/v1/study/plans', authenticate, planRoutes);
app.use('/api/v1/study/learning-objectives', authenticate, learningObjectiveRoutes);
app.use('/api/v1/competencies', authenticate, competencyRoutes);
app.use('/api/v1/coach', authenticate, coachRoutes);
app.use('/api/v1/study/rooms', authenticate, roomRoutes);
app.use('/api/v1/study/institutions', authenticate, institutionRoutes);
app.use('/api/v1/study/visual-lab', authenticate, visualLabRoutes);
// Error handler (must be last)
app.use(errorHandler);

export default app;
module.exports = app;
