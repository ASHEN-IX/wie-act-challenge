/**
 * Coach API tests (COACH-10)
 * POST /api/v1/coach/nudge → 202 { jobId }
 * GET  /api/v1/coach/jobs/:jobId → status + nudge
 */

process.env.JWT_SECRET = 'test-secret-key';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test_coach_partner';
process.env.INTERNAL_API_SECRET = 'test-internal-secret';
process.env.RABBITMQ_URL = 'amqp://localhost:5672/%2F';
process.env.NODE_ENV = 'test';

// Prevent process.exit() from killing tests
process.exit = jest.fn() as any;

import mongoose from 'mongoose';

const mockStudySession = {
  _id: 'session-1',
  userId: 'user-123',
  status: 'active',
  subjectId: 'subject-1'
};

// findOne returns a chainable query supporting .sort()
const mockSessionQuery = (result: any) => ({
  sort: jest.fn().mockResolvedValue(result)
});

jest.mock('../models/index', () => ({
  StudySession: {
    findOne: jest.fn().mockReturnValue(mockSessionQuery(mockStudySession)),
    find: jest.fn()
  }
}));

jest.mock('@study-partner/shared/moduleClient', () => ({
  post: jest.fn(),
  get: jest.fn()
}));

jest.mock('../utils/gamificationService', () => ({
  ...jest.requireActual('../utils/gamificationService'),
  fetchGamificationProfile: jest.fn()
}));

import request from 'supertest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const moduleClient = require('@study-partner/shared/moduleClient');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { StudySession } = require('../models/index');
import { fetchGamificationProfile } from '../utils/gamificationService';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createSession: generateToken } = require('../../../../tests/sessionFixtures');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const app = require('../app');

const token = `mindflow.test_session=${generateToken({ userId: 'user-123', role: 'student', tier: 'vip' })}`;

beforeEach(() => {
  jest.clearAllMocks();
  (fetchGamificationProfile as jest.Mock).mockResolvedValue({ stats: { currentStreak: 7 } });
});

describe('POST /api/v1/coach/nudge', () => {
  it('returns 401 for an unauthenticated request (COACH-11 negative)', async () => {
    const res = await request(app).post('/api/v1/coach/nudge').send({ focus_score: 0.5 });

    expect(res.status).toBe(401);
    expect(StudySession.findOne).not.toHaveBeenCalled();
    expect(moduleClient.post).not.toHaveBeenCalled();
  });

  it('returns 202 with jobId when a nudge is scheduled against the active session', async () => {
    StudySession.findOne.mockReturnValue(mockSessionQuery(mockStudySession));
    moduleClient.post.mockResolvedValue({
      data: { jobId: 'job-1', correlationId: 'corr-1' }
    });

    const res = await request(app).post('/api/v1/coach/nudge').set('Cookie', token);

    expect(res.status).toBe(202);
    expect(res.body.status).toBe('processing');
    expect(res.body.jobId).toBe('job-1');
    expect(res.body.correlationId).toBe('corr-1');
    expect(moduleClient.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/ai/jobs'),
      expect.objectContaining({
        type: 'study.coach.nudge',
        payload: expect.objectContaining({ session_id: 'session-1' })
      }),
      expect.anything()
    );
  });

  it('returns 400 when no active session exists for the user', async () => {
    StudySession.findOne.mockReturnValue(mockSessionQuery(null));

    const res = await request(app).post('/api/v1/coach/nudge').set('Cookie', token);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no active study session/i);
    expect(moduleClient.post).not.toHaveBeenCalled();
  });

  it('returns 404 for a session_id that does not belong to the user', async () => {
    StudySession.findOne.mockReturnValue(Promise.resolve(null));

    const res = await request(app)
      .post('/api/v1/coach/nudge')
      .set('Cookie', token)
      .send({ session_id: 'foreign-session' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Session not found');
    expect(moduleClient.post).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid payload (score outside [0,1])', async () => {
    const res = await request(app)
      .post('/api/v1/coach/nudge')
      .set('Cookie', token)
      .send({ focus_score: 2.5 });

    expect(res.status).toBe(400);
    expect(StudySession.findOne).not.toHaveBeenCalled();
    expect(moduleClient.post).not.toHaveBeenCalled();
  });

  it('returns 503 when the orchestrator job bus is unreachable', async () => {
    StudySession.findOne.mockReturnValue(mockSessionQuery(mockStudySession));
    moduleClient.post.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await request(app).post('/api/v1/coach/nudge').set('Cookie', token);

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/unavailable/i);
  });

  it('defaults current_time when not supplied', async () => {
    const posted: any = {};
    moduleClient.post.mockImplementation(async (_url: string, body: any, _opts: any) => {
      Object.assign(posted, body);
      return { data: { jobId: 'job-1', correlationId: 'corr-1' } };
    });

    const res = await request(app).post('/api/v1/coach/nudge').set('Cookie', token);

    expect(res.status).toBe(202);
    expect(posted.payload.current_time).toBeTruthy();
    expect(new Date(posted.payload.current_time).toString()).not.toBe('Invalid Date');
  });

  it('derives bounded session_stats from the active session (COACH-13)', async () => {
    const now = new Date();
    const started = new Date(now.getTime() - 25 * 60 * 1000); // 25 minutes ago
    StudySession.findOne.mockReturnValue(
      mockSessionQuery({
        ...mockStudySession,
        startTime: started,
        taskProgress: {
          currentTaskIndex: 2,
          totalTasks: 4,
          completedTasks: 2
        },
        breakStats: { totalBreaks: 3 }
      })
    );
    const posted: any = {};
    moduleClient.post.mockImplementation(async (_url: string, body: any, _opts: any) => {
      Object.assign(posted, body);
      return { data: { jobId: 'job-1', correlationId: 'corr-1' } };
    });

    const res = await request(app).post('/api/v1/coach/nudge').set('Cookie', token);

    expect(res.status).toBe(202);
    expect(posted.payload.session_stats).toEqual({
      progress_pct: 50,
      minutes_elapsed: 25,
      task_switches: 2,
      break_count: 3,
      current_streak_days: 7
    });
  });

  it('defaults session stats to zeros when the session lacks progress data', async () => {
    StudySession.findOne.mockReturnValue(mockSessionQuery(mockStudySession));
    const posted: any = {};
    moduleClient.post.mockImplementation(async (_url: string, body: any, _opts: any) => {
      Object.assign(posted, body);
      return { data: { jobId: 'job-1', correlationId: 'corr-1' } };
    });

    const res = await request(app).post('/api/v1/coach/nudge').set('Cookie', token);

    expect(res.status).toBe(202);
    expect(posted.payload.session_stats).toEqual({
      progress_pct: 0,
      minutes_elapsed: 0,
      task_switches: 0,
      break_count: 0,
      current_streak_days: 7
    });
  });

  it('uses a zero streak when the gamification lookup fails', async () => {
    (fetchGamificationProfile as jest.Mock).mockResolvedValue(null);
    moduleClient.post.mockResolvedValue({ data: { jobId: 'job-1', correlationId: 'corr-1' } });

    const res = await request(app).post('/api/v1/coach/nudge').set('Cookie', token);

    expect(res.status).toBe(202);
    const { payload } = moduleClient.post.mock.calls[0][1];
    expect(payload.session_stats.current_streak_days).toBe(0);
  });

  it('clamps minutes_elapsed at the 600 bound for long-running sessions', async () => {
    const longAgo = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours
    StudySession.findOne.mockReturnValue(
      mockSessionQuery({ ...mockStudySession, startTime: longAgo })
    );
    moduleClient.post.mockResolvedValue({ data: { jobId: 'job-1', correlationId: 'corr-1' } });

    const res = await request(app).post('/api/v1/coach/nudge').set('Cookie', token);

    expect(res.status).toBe(202);
    const { payload } = moduleClient.post.mock.calls[0][1];
    expect(payload.session_stats.minutes_elapsed).toBe(600);
  });

  it('derives stats from the explicit session document (COACH-13)', async () => {
    StudySession.findOne.mockReturnValue(
      Promise.resolve({
        ...mockStudySession,
        startTime: new Date(Date.now() - 10 * 60 * 1000),
        taskProgress: {
          currentTaskIndex: 1,
          totalTasks: 2,
          completedTasks: 1
        }
      })
    );
    const posted: any = {};
    moduleClient.post.mockImplementation(async (_url: string, body: any, _opts: any) => {
      Object.assign(posted, body);
      return { data: { jobId: 'job-1', correlationId: 'corr-1' } };
    });

    const res = await request(app)
      .post('/api/v1/coach/nudge')
      .set('Cookie', token)
      .send({ session_id: 'session-1' });

    expect(res.status).toBe(202);
    expect(posted.payload.session_stats).toEqual({
      progress_pct: 50,
      minutes_elapsed: 10,
      task_switches: 1,
      break_count: 0,
      current_streak_days: 7
    });
  });
});

describe('GET /api/v1/coach/jobs/:jobId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns job status + nudge result scoped to the owning user', async () => {
    const collectionFindOne = jest.fn().mockResolvedValue({
      jobId: 'job-1',
      userId: 'user-123',
      status: 'COMPLETED',
      result: { nudge: 'TEST_POMODORO', reason: 'test double' },
      fallbackUsed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    jest
      .spyOn(mongoose.connection, 'collection')
      .mockReturnValue({ findOne: collectionFindOne } as any);

    const res = await request(app).get('/api/v1/coach/jobs/job-1').set('Cookie', token);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.result.nudge).toBe('TEST_POMODORO');
    expect(collectionFindOne).toHaveBeenCalledWith({ jobId: 'job-1', userId: 'user-123' });
  });

  it('adds userId scoping so another user cannot read the job', async () => {
    const collectionFindOne = jest.fn().mockResolvedValue(null);
    jest
      .spyOn(mongoose.connection, 'collection')
      .mockReturnValue({ findOne: collectionFindOne } as any);

    const res = await request(app).get('/api/v1/coach/jobs/job-1').set('Cookie', token);

    expect(res.status).toBe(404);
    expect(collectionFindOne).toHaveBeenCalledWith({ jobId: 'job-1', userId: 'user-123' });
  });
});

export { app, mockStudySession };
module.exports = { app, mockStudySession };
