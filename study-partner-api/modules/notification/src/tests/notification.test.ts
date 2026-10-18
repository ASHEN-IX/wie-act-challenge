/**
 * Notification Service Tests
 * Tests notification CRUD endpoints
 */
import express from 'express';

process.env.JWT_SECRET = 'test-secret-key';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test_study_partner';
process.env.NODE_ENV = 'test';

// Prevent process.exit() from killing tests
process.exit = jest.fn() as any;

// ── Mock Notification model ──────────────────────
const mockNotification = {
  _id: 'notif-1',
  userId: 'user-123',
  type: 'study_reminder',
  title: 'Time to study!',
  message: 'Your next study session starts in 10 minutes.',
  status: 'unread',
  priority: 'normal',
  metadata: {},
  readAt: null,
  createdAt: new Date()
};

jest.mock('../models/Notification', () => ({
  find: jest.fn().mockReturnValue({
    sort: jest.fn().mockReturnValue({
      skip: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          maxTimeMS: jest
            .fn()
            .mockReturnValue({ lean: jest.fn().mockResolvedValue([mockNotification]) })
        })
      })
    })
  }),
  countDocuments: jest.fn().mockReturnValue({ maxTimeMS: jest.fn().mockResolvedValue(1) }),
  create: jest.fn().mockResolvedValue(mockNotification),
  findByIdAndUpdate: jest.fn(),
  updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 })
}));

jest.mock('@study-partner/shared', () => ({
  requireInternal: (jest.requireActual('@study-partner/shared') as any).requireInternal,
  corsMiddleware: jest.fn(() => (req: any, res: any, next: any) => next()),
  securityMiddleware: jest.fn(() => (req: any, res: any, next: any) => next()),
  loggingMiddleware: jest.fn((req: any, res: any, next: any) => next()),
  errorHandler: jest.fn((err: any, req: any, res: any, _next: any) => {
    res.status(err.status || 500).json({ error: err.message });
  }),
  rateLimiter: jest.fn(() => (req: any, res: any, next: any) => next()),
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

jest.mock('@study-partner/shared/auth', () => ({
  requireInternal: (jest.requireActual('@study-partner/shared/auth') as any).requireInternal,
  authenticate: jest.fn((req: any, res: any, next: any) => {
    req.user = { userId: 'user-123' };
    next();
  })
}));

import Notification from '../models/Notification';
import notifRoutes from '../routes/notifications';
import request from 'supertest';

const app = express();
app.use(express.json());
app.use((require('@study-partner/shared/auth') as any).authenticate);
app.use('/api/v1/notifications', notifRoutes);
app.use((require('@study-partner/shared') as any).errorHandler);

describe('Notification Service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET /api/v1/notifications', () => {
    it('should return notifications for a user', async () => {
      (Notification.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              maxTimeMS: jest
                .fn()
                .mockReturnValue({ lean: jest.fn().mockResolvedValue([mockNotification]) })
            })
          })
        })
      });
      (Notification.countDocuments as jest.Mock)
        .mockReturnValueOnce({ maxTimeMS: jest.fn().mockResolvedValue(1) }) // total
        .mockReturnValueOnce({ maxTimeMS: jest.fn().mockResolvedValue(1) }); // unread

      const res = await request(app).get('/api/v1/notifications').query({ userId: 'user-123' });

      expect(res.status).toBe(200);
      if (res.body.notifications && Array.isArray(res.body.notifications)) {
        expect(res.body.notifications).toHaveLength(1);
        expect(res.body.unreadCount).toBe(1);
      }
    });

    it('uses authenticated identity without a userId parameter', async () => {
      const res = await request(app).get('/api/v1/notifications');
      expect(res.status).toBe(200);
      expect(Notification.find).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-123' })
      );
    });
  });

  describe('POST /api/v1/notifications', () => {
    it('should create a notification', async () => {
      (Notification.create as jest.Mock).mockResolvedValue({
        ...mockNotification,
        toObject: () => mockNotification
      });

      const res = await request(app)
        .post('/api/v1/notifications')
        .set('x-internal-secret', process.env.INTERNAL_API_SECRET!)
        .send({
          userId: 'user-123',
          type: 'study_reminder',
          title: 'Time to study!',
          message: 'Your next study session starts in 10 minutes.'
        });

      expect(res.status).toBe(201);
    });

    it('should reject invalid notification type', async () => {
      const res = await request(app)
        .post('/api/v1/notifications')
        .set('x-internal-secret', process.env.INTERNAL_API_SECRET!)
        .send({
          userId: 'user-123',
          type: 'invalid_type',
          title: 'Test',
          message: 'Test'
        });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/v1/notifications/:id/read', () => {
    it('should mark notification as read', async () => {
      (Notification.findByIdAndUpdate as jest.Mock).mockResolvedValue({
        ...mockNotification,
        status: 'read',
        readAt: new Date()
      });

      const res = await request(app).patch('/api/v1/notifications/notif-1/read');

      expect(res.status).toBe(200);
    });

    it('should return 404 for missing notification', async () => {
      (Notification.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);

      const res = await request(app).patch('/api/v1/notifications/nonexistent/read');

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/notifications/read-all', () => {
    it('should mark all user notifications as read', async () => {
      (Notification.updateMany as jest.Mock).mockResolvedValue({ modifiedCount: 3 });

      const res = await request(app)
        .patch('/api/v1/notifications/read-all')
        .query({ userId: 'user-123' });

      expect(res.status).toBe(200);
      expect(res.body.modifiedCount).toBe(3);
    });
  });

  describe('DELETE /api/v1/notifications/:id', () => {
    it('should dismiss notification', async () => {
      (Notification.findByIdAndUpdate as jest.Mock).mockResolvedValue({
        ...mockNotification,
        status: 'dismissed'
      });

      const res = await request(app).delete('/api/v1/notifications/notif-1');

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/dismissed/i);
    });
  });
});
