/**
 * SEC-12 — Negative authentication regression (real `authenticate` middleware).
 */
process.env.JWT_SECRET = 'sec12-test-secret';
process.env.JWT_REFRESH_SECRET = 'sec12-test-refresh';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.NODE_ENV = 'test';

import express from 'express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createSession } = require('../../../../tests/sessionFixtures');
const jwt = { sign: createSession };
import request from 'supertest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { authenticate } = require('@study-partner/shared/auth');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tasksRouter = require('../routes/tasks');

jest.mock('../models', () => {
  const chain = {
    select: () => chain,
    sort: () => chain,
    lean: () => []
  };
  return {
    Task: {
      find: jest.fn().mockReturnValue(chain),
      findOne: jest.fn(),
      create: jest.fn(),
      deleteOne: jest.fn()
    }
  };
});
jest.mock('@study-partner/shared/moduleClient', () => ({
  post: jest.fn().mockResolvedValue({ data: {} })
}));

const app = express();
app.use(express.json());
app.use('/api/v1/study/tasks', authenticate, tasksRouter);

const bob = { userId: 'user-bob', email: 'bob@test.com', role: 'student', isActive: true };

function token(payload = bob, secret = process.env.JWT_SECRET) {
  return jwt.sign(payload, secret);
}

function expiredToken() {
  return jwt.sign({ ...bob, exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET);
}

describe('SEC-12 negative authentication (real middleware, mounted route)', () => {
  it('rejects a missing token with 401', async () => {
    const res = await request(app).get('/api/v1/study/tasks');
    expect(res.status).toBe(401);
  });

  it('rejects an expired token with 401', async () => {
    const res = await request(app)
      .get('/api/v1/study/tasks')
      .set('Cookie', `mindflow.test_session=${expiredToken()}`);
    expect(res.status).toBe(401);
  });

  it('rejects a token signed with the wrong secret with 401', async () => {
    const res = await request(app)
      .get('/api/v1/study/tasks')
      .set('Cookie', `mindflow.test_session=${token(bob, 'wrong-secret')}`);
    expect(res.status).toBe(401);
  });

  it('rejects a malformed junk token with 401', async () => {
    const res = await request(app)
      .get('/api/v1/study/tasks')
      .set('Cookie', 'mindflow.test_session=not.a.jwt');
    expect(res.status).toBe(401);
  });

  it('rejects a deactivated account (isActive:false) with 401', async () => {
    const res = await request(app)
      .get('/api/v1/study/tasks')
      .set('Cookie', `mindflow.test_session=${token({ ...bob, isActive: false })}`);
    expect(res.status).toBe(401);
  });

  it('accepts a valid token (200)', async () => {
    const res = await request(app)
      .get('/api/v1/study/tasks')
      .set('Cookie', `mindflow.test_session=${token()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tasks');
  });
});
