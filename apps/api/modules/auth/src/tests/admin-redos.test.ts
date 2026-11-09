import type { Request, Response, NextFunction } from 'express';
/**
 * SEC-09 — admin user search injection.
 *
 * `GET /admin/users?query=` must treat the admin's search as literal text.
 * The query now reaches PostgreSQL through Prisma's parameterized
 * `contains`, so it can never become a pattern or an operator object; the
 * assertions below pin that contract.
 */
process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test_ednova';
process.env.NODE_ENV = 'test';

jest.mock('../../../../shared/database', () => ({
  prisma: {
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0)
    },
    payment: {
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0)
    }
  },
  toDocument: (row: unknown) => row
}));
jest.mock('../models/User', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
    save: jest.fn(),
    toJSON: jest.fn()
  }
}));
jest.mock('../models/Coupon', () => ({
  __esModule: true,
  default: { findMany: jest.fn().mockResolvedValue([]) }
}));
jest.mock('../models/Payment', () => ({
  __esModule: true,
  default: { findMany: jest.fn(), findById: jest.fn(), countDocuments: jest.fn() }
}));
jest.mock('@ednova/shared/auth', () => ({
  requireRole: () => (req: Request, res: Response, next: NextFunction) => next()
}));

import User from '../models/User';
import { prisma } from '../../../../shared/database';
import adminRoutes from '../routes/admin';
import express from 'express';
import request from 'supertest';

const app = express();
app.use(express.json());
app.use('/', adminRoutes);

describe('SEC-09 admin user search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (User.countDocuments as jest.Mock).mockResolvedValue(0);
  });

  it('passes a pathological regex through as literal text', async () => {
    const evil = '(a+)+$';
    const res = await request(app).get('/users').query({ query: evil });

    expect(res.status).toBe(200);

    const where = (prisma.user.findMany as jest.Mock).mock.calls[0][0].where;
    const emailFilter = where.OR[0].email;

    // The query is a parameter value, never a pattern or an operator document.
    expect(emailFilter.contains).toBe(evil);
    expect(emailFilter.mode).toBe('insensitive');
    expect(Object.keys(emailFilter).sort()).toEqual(['contains', 'mode']);
  });

  it('coerces object-shaped queries so operator injection is neutralized', async () => {
    const res = await request(app)
      .get('/users')
      .query({ query: { $regex: '(a+)+$' } });

    expect(res.status).toBe(200);
    const where = (prisma.user.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.OR[0].email.contains).toBe('[object Object]');
  });

  it('still supports plain substring searches', async () => {
    const res = await request(app).get('/users').query({ query: 'anna' });

    expect(res.status).toBe(200);
    const where = (prisma.user.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.OR[0].email.contains).toBe('anna');
    expect(where.OR[0].email.mode).toBe('insensitive');
  });
});
