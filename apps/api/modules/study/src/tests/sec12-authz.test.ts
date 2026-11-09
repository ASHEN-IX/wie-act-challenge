import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response, NextFunction } from 'express';
/**
 * SEC-12 — Cross-user authorization regression.
 */
process.env.JWT_SECRET = 'sec12-authz-secret';
process.env.JWT_REFRESH_SECRET = 'sec12-authz-refresh';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.NODE_ENV = 'test';

import express from 'express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createSession } = require('../../../../tests/sessionFixtures');
const jwt = { sign: createSession };
import request from 'supertest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { authenticate } = require('@ednova/shared/auth');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { errorHandler } = require('@ednova/shared/middleware');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tasksRouter = require('../routes/tasks');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const topicsRouter = require('../routes/topics');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sessionsRouter = require('../routes/coreSessions');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const plansRouter = require('../routes/plans');

jest.mock('../models', () => ({
  Task: { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), deleteOne: jest.fn() },
  Topic: { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), deleteOne: jest.fn() },
  StudySession: { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), deleteOne: jest.fn() },
  StudyPlan: { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), deleteOne: jest.fn() },
  Course: { findOne: jest.fn() },
  Subject: {},
  LearningObjective: {},
  Competency: {}
}));
// The AiJob lookup now goes through the orchestrator model, not a raw collection.
const mockAiJobFindOne = jest.fn();
jest.mock('../../../ai-orchestrator/src/models/AiJob', () => ({
  __esModule: true,
  default: { findOne: (...args: unknown[]) => mockAiJobFindOne(...args) }
}));
jest.mock('@ednova/shared/moduleClient', () => ({
  post: jest.fn().mockResolvedValue({ data: {} })
}));
jest.mock('../utils/gamificationService', () => ({
  processSessionCompletionRewards: jest.fn().mockResolvedValue({}),
  trackAnalyticsEvent: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../services/competencyQueries', () => ({
  getWeakCompetenciesForCourse: jest.fn().mockResolvedValue([])
}));
jest.mock('@ednova/shared/tierGate', () => ({
  tierGate: () => (req: DomainRequest, res: Response, next: NextFunction) => next()
}));
jest.mock('@ednova/shared', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Task, Topic, StudySession, StudyPlan } = require('../models');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const moduleClient = require('@ednova/shared/moduleClient');

const app = express();
app.use(express.json());
app.use('/api/v1/study/tasks', authenticate, tasksRouter);
app.use('/api/v1/study/topics', authenticate, topicsRouter);
app.use('/api/v1/study/sessions', authenticate, sessionsRouter);
app.use('/api/v1/study/plans', authenticate, plansRouter);
app.use(errorHandler);

const userA = { userId: 'user-a', email: 'a@test.com', role: 'student', isActive: true };

function authHeader(u = userA) {
  return { Cookie: `ednova.test_session=${jwt.sign(u, process.env.JWT_SECRET)}` };
}

function renderable(doc: unknown) {
  return { lean: jest.fn().mockResolvedValue(doc) };
}

beforeEach(() => jest.clearAllMocks());

describe('SEC-12 tasks are isolated per user', () => {
  it("GET /tasks/:taskId 404s for another user's task", async () => {
    Task.findOne.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/study/tasks/task-1').set(authHeader(userA));

    expect(res.status).toBe(404);
    expect(Task.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'task-1', userId: 'user-a' })
    );
  });

  it("PUT /tasks/:taskId never mutates another user's task", async () => {
    Task.findOne.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/v1/study/tasks/task-1')
      .set(authHeader(userA))
      .send({ status: 'completed' });

    expect(Task.findOne).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-a' }));
    expect(res.status).toBe(404);
    expect(moduleClient.post).not.toHaveBeenCalled(); // no XP award side-effects
  });
});

describe('SEC-12 topics are isolated per user', () => {
  it("GET /topics/:topicId 404s for another user's topic", async () => {
    Topic.findOne.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/study/topics/topic-1').set(authHeader(userA));

    expect(res.status).toBe(404);
    expect(Topic.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'topic-1', userId: 'user-a' })
    );
  });
});

describe('SEC-12 sessions are isolated per user', () => {
  it("GET /sessions/:sessionId 404s for another user's session", async () => {
    StudySession.findOne.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/study/sessions/session-1').set(authHeader(userA));

    expect(res.status).toBe(404);
    expect(StudySession.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'session-1', userId: 'user-a' })
    );
  });
});

describe('SEC-12 plans are isolated per user', () => {
  const fakeAiJobColl = { findOne: mockAiJobFindOne };
  const OBJECT_ID = '64b000000000000000000001';

  it("GET /plans/:planId 404s for another user's plan", async () => {
    StudyPlan.findOne.mockReturnValue(renderable(null));
    const res = await request(app).get(`/api/v1/study/plans/${OBJECT_ID}`).set(authHeader(userA));

    expect(res.status).toBe(404);
    expect(StudyPlan.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: OBJECT_ID, userId: 'user-a' })
    );
  });

  it('POST /plans/create-status hides jobs when the job belongs to another user', async () => {
    fakeAiJobColl.findOne.mockResolvedValue({
      correlationId: 'job-1',
      userId: 'user-b',
      type: 'study.plan.generate',
      resourceScope: {},
      status: 'COMPLETED',
      result: { task_graph: { goal: 'G', tasks: [] } }
    });
    StudyPlan.create.mockResolvedValue({
      _id: 'plan-new',
      userId: 'user-b',
      createdAt: new Date()
    });

    const res = await request(app)
      .post('/api/v1/study/plans/create-status')
      .set(authHeader(userA))
      .send({ correlationId: 'job-1' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('job not found');
    expect(StudyPlan.create).not.toHaveBeenCalled();
    expect(Task.create).not.toHaveBeenCalled();
  });

  it('POST /plans/create-status 201s when the requester owns the job', async () => {
    fakeAiJobColl.findOne.mockResolvedValue({
      correlationId: 'job-2',
      userId: 'user-a',
      type: 'study.plan.generate',
      resourceScope: {},
      status: 'COMPLETED',
      result: {
        fallbackUsed: false,
        task_graph: {
          goal: 'Learn',
          tasks: [{ title: 'Lesson', difficulty: 0.5, estimated_minutes: 25 }]
        }
      }
    });
    StudyPlan.create.mockResolvedValue({
      _id: 'plan-new',
      ...{ userId: 'user-a', goal: 'Learn' },
      createdAt: new Date()
    });

    const res = await request(app)
      .post('/api/v1/study/plans/create-status')
      .set(authHeader(userA))
      .send({ correlationId: 'job-2' });

    expect(res.status).toBe(201);
    expect(StudyPlan.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-a' }));
    expect(Task.create).toHaveBeenCalled();
  });

  it('POST /plans/create-status denies admin access to private foreign jobs', async () => {
    fakeAiJobColl.findOne.mockResolvedValue({
      correlationId: 'job-3',
      userId: 'user-b',
      type: 'study.plan.generate',
      resourceScope: {},
      status: 'COMPLETED',
      result: { task_graph: { goal: 'G', tasks: [] } }
    });
    StudyPlan.create.mockResolvedValue({
      _id: 'plan-new',
      ...{ userId: 'user-b', goal: 'G' },
      createdAt: new Date()
    });

    const admin = { userId: 'admin-1', email: 'adm@test.com', role: 'admin', isActive: true };
    const res = await request(app)
      .post('/api/v1/study/plans/create-status')
      .set(authHeader(admin))
      .send({ correlationId: 'job-3' });

    expect(res.status).toBe(404);
    expect(StudyPlan.create).not.toHaveBeenCalled();
  });
});
