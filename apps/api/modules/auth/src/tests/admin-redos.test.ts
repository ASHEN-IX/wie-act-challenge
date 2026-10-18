/**
 * SEC-09 — admin user search ReDoS.
 *
 * `GET /admin/users?query=` previously fed user input directly into Mongo's
 * `$regex`. Crafted patterns (e.g. `(a+)+$`) can stall the query. Since the
 * fix, the admin search query must be treated as literal text (regex
 * metacharacters escaped, input coerced to a string).
 */
process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test_study_partner';
process.env.NODE_ENV = 'test';

jest.mock('../models/User', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
  create: jest.fn()
}));
jest.mock('../models/Coupon', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  create: jest.fn()
}));
jest.mock('../models/Payment', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  aggregate: jest.fn()
}));
jest.mock('@study-partner/shared/auth', () => ({
  requireRole: () => (req: any, res: any, next: any) => next()
}));

import User from '../models/User';
import adminRoutes from '../routes/admin';
import express from 'express';
import request from 'supertest';

const app = express();
app.use(express.json());
app.use('/', adminRoutes);

function mockFindChain(rows: any[]) {
  const chain: any = {
    select: () => chain,
    sort: () => chain,
    skip: () => chain,
    limit: () => chain,
    lean: () => rows
  };
  return chain;
}

describe('SEC-09 admin user search (ReDoS)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (User.find as jest.Mock).mockReturnValue(mockFindChain([]));
    (User.countDocuments as jest.Mock).mockResolvedValue(0);
  });

  it('escapes pathological regex input so it matches literally and quickly', async () => {
    const evil = '(a+)+$';
    const res = await request(app).get('/users').query({ query: evil });

    expect(res.status).toBe(200);

    const filter = (User.find as jest.Mock).mock.calls[0][0];
    const emailRe = filter.$or[0].email.$regex;
    const nameRe = filter.$or[1].name.$regex;

    // Dangerous constructs are gone; the input now matches only as plain text.
    expect(typeof emailRe).toBe('string');
    expect(emailRe).not.toContain('(a+)+');
    expect(emailRe).toContain('\\(');
    expect(new RegExp(emailRe).test('(a+)+$')).toBe(true);
    expect(nameRe).not.toContain('(a+)+');
  });

  it('coerces object-shaped queries so operator injection is neutralized', async () => {
    const res = await request(app)
      .get('/users')
      .query({ query: { $regex: '(a+)+$' } });

    expect(res.status).toBe(200);
    const filter = (User.find as jest.Mock).mock.calls[0][0];
    const emailRe = filter.$or[0].email.$regex;
    expect(emailRe).not.toContain('(a+)+');
  });

  it('still supports plain substring searches', async () => {
    const res = await request(app).get('/users').query({ query: 'anna' });

    expect(res.status).toBe(200);
    const filter = (User.find as jest.Mock).mock.calls[0][0];
    const emailRe = filter.$or[0].email.$regex;
    expect(emailRe).toBe('anna');
    expect(filter.$or[0].email.$options).toBe('i');
  });
});
