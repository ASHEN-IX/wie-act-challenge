import express from 'express';
import request from 'supertest';
import type { DomainRequest } from '../../../../src/framework/contracts';
import type { NextFunction, Response } from 'express';

process.env.JWT_SECRET = 'test-secret-key';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test_ednova';
process.env.NODE_ENV = 'test';

jest.mock('../models', () => ({
  Subject: {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndDelete: jest.fn(),
    create: jest.fn(),
    save: jest.fn()
  },
  Course: {
    countDocuments: jest.fn(),
    deleteMany: jest.fn()
  }
}));

jest.mock('@ednova/shared/moduleClient', () => ({
  post: jest.fn().mockRejectedValue(new Error('reward service unavailable'))
}));

const { Subject } = require('../models');
const subjects = require('../routes/subjects');

const app = express();
app.use(express.json());
app.use(
  '/api/v1/study/subjects',
  (req: DomainRequest, _res: Response, next: NextFunction) => {
    req.user = { userId: 'learner-1', tier: 'vip', role: 'student' };
    next();
  },
  subjects
);

describe('subject creation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates and returns a subject for the current account', async () => {
    Subject.findOne.mockResolvedValue(null);
    Subject.create.mockImplementation(async (data: Record<string, unknown>) => ({
      ...data,
      id: 'subject-new',
      color: '#ff4655'
    }));

    const res = await request(app)
      .post('/api/v1/study/subjects')
      .send({ name: 'Physics', description: 'Mechanics and energy' });

    expect(res.status).toBe(201);
    expect(res.body.subject).toEqual(
      expect.objectContaining({ id: 'subject-new', name: 'Physics' })
    );
    expect(Subject.findOne).toHaveBeenCalledWith({ name: 'Physics', userId: 'learner-1' });
  });

  test('rejects a duplicate subject name for the same account', async () => {
    Subject.findOne.mockResolvedValue({ id: 'existing-subject', name: 'Physics' });

    const res = await request(app).post('/api/v1/study/subjects').send({ name: 'Physics' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });
});
