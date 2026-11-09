import assert from 'node:assert/strict';
import type { CourseFixture } from '../../../../tests/courseFixture';
import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response, NextFunction } from 'express';
/**
 * INGEST-07 — ingestion status tracking.
 */

process.env.JWT_SECRET = 'test-secret-key';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test_ednova';
process.env.NODE_ENV = 'test';

import fs from 'fs';
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads', { recursive: true });

const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code): never => {
  throw new Error(`Unexpected process.exit(${code})`);
});
afterAll(() => exitSpy.mockRestore());

jest.mock('@ednova/shared/ai-messaging', () => ({
  consumeAiProgress: jest.fn(),
  consumeIngestResults: jest.fn(),
  closeAiMessaging: jest.fn(),
  publishAiJob: jest.fn()
}));

jest.mock('../services/ingestionJob', () => ({
  INGEST_JOB_TYPE: 'study.ingest.course',
  publishCourseIngestionJob: jest.fn()
}));

// Legacy projection fixtures have no durable operation record. New outbox
// replay/cancel behavior is exercised with real Mongo in final-ingestion-recovery.
jest.mock('../models/CourseIngestionOperation', () => ({
  CourseIngestionOperation: {
    findOne: jest.fn(() => ({ lean: async () => null })),
    updateOne: jest.fn(async () => ({ matchedCount: 1, modifiedCount: 1 }))
  }
}));
jest.mock('../models/index', () => {
  const mockCourse = Object.assign(
    jest.fn().mockImplementation(function (this: CourseFixture, data: object) {
      Object.assign(this, data);
      this._id = 'course-new';
      this.save = jest.fn().mockResolvedValue(true);
      mockCourse.instances.push(this);
    }),
    {
      instances: new Array<CourseFixture>(),
      find: jest.fn(),
      findOne: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 }),
      findById: jest.fn().mockImplementation((id: string) => {
        const value = mockCourse.findOne({ _id: id, userId: 'user-123' });
        const result = Promise.resolve(value) as Promise<unknown> & {
          select: () => Promise<unknown>;
        };
        result.select = () => Promise.resolve(value);
        return result;
      }),
      findOneAndDelete: jest.fn()
    }
  );
  return {
    Course: mockCourse,
    Subject: { findOne: jest.fn() },
    StudySession: {
      findOne: jest.fn(),
      create: jest.fn().mockResolvedValue({ _id: 'session-1' })
    },
    StudyPlan: { findOne: jest.fn() },
    Task: { find: jest.fn() }
  };
});

import {
  startIngestStatusTracker,
  stopIngestStatusTracker,
  handleIngestProgress,
  handleIngestResult,
  buildIngestStatus
} from '../services/ingestStatus';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { consumeAiProgress, consumeIngestResults } = require('@ednova/shared/ai-messaging');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Course } = require('../models/index');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const courseRoutes = require('../routes/courses');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sessionTaskRoutes = require('../routes/sessionTasks');

import express from 'express';
import request from 'supertest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createSession } = require('../../../../tests/sessionFixtures');
const jwt = { sign: createSession };

const app = express();
app.use(express.json());
const fakeAuth = (req: DomainRequest, res: Response, next: NextFunction) => {
  req.user = { userId: 'user-123', tier: 'vip', role: 'student' };
  next();
};
app.use('/api/v1/study/courses', fakeAuth, courseRoutes);
app.use('/api/v1/study/sessions', fakeAuth, sessionTaskRoutes);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { errorHandler } = require('@ednova/shared/middleware');
app.use(errorHandler);

function authHeader() {
  const token = jwt.sign({ userId: 'user-123', role: 'user' }, process.env.JWT_SECRET);
  return { Cookie: `ednova.test_session=${token}` };
}

const BASE = {
  messageId: 'a40ad024-8492-4cb5-a9a7-6ca2d2bc47c9',
  correlationId: '0f8e2d1a-3b4c-4d6e-8f80-91a2b3c4d5e6',
  type: 'study.ingest.course',
  version: '1',
  userId: 'user-123',
  requestId: 'req-ingest',
  timestamp: '2026-08-19T08:00:00Z'
} as const;

const WORKER_COURSE = {
  course_id: '64a000000000000000000001',
  course_title: 'Graph Theory',
  source_files: ['notes.pdf'],
  topics: [
    {
      title: 'Graph Theory',
      subtopics: [
        {
          id: 'sub-1',
          title: 'Graphs 101',
          summary: 'overview',
          key_concepts: ['node', 'edge'],
          definitions: [{ term: 'Graph', definition: 'A set of nodes and edges' }],
          formulas: ['E = V - 1'],
          examples: ['a tree is a graph'],
          learning_objectives: [
            {
              objectiveId: 'obj_graph',
              text: 'Define a graph.',
              bloomLevel: 'remember'
            }
          ],
          tokenized_chunks: ['DROP ME'],
          chunk_embeddings: [[0.1, 0.2]]
        }
      ]
    }
  ]
};

beforeEach(() => {
  jest.clearAllMocks();
  Course.instances = [];
  Course.findOne.mockReset();
});

describe('handleIngestProgress (progress routing key)', () => {
  test('records stage/percentage on the correlated course', async () => {
    const course = {
      _id: '64a000000000000000000001',
      status: 'processing',
      ingestStage: null,
      ingestProgress: 0,
      ingestDetail: '',
      save: jest.fn().mockResolvedValue(true)
    };
    Course.findOne.mockResolvedValue(course);

    await handleIngestProgress({
      ...BASE,
      status: 'progress',
      stage: 'embedding',
      progress: 0.6,
      detail: 'chunking and embedding'
    });

    expect(Course.findOne).toHaveBeenCalledWith({ correlationId: BASE.correlationId });
    expect(course.ingestStage).toBe('embedding');
    expect(course.ingestProgress).toBe(0.6);
    expect(course.ingestDetail).toBe('chunking and embedding');
    expect(Course.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: course._id, correlationId: BASE.correlationId }),
      expect.objectContaining({ $set: expect.any(Object) })
    );
    expect(course.save).not.toHaveBeenCalled();
  });

  test('ignores progress for non-ingest job types', async () => {
    await handleIngestProgress({
      ...BASE,
      type: 'study.eval.step',
      status: 'progress',
      stage: 'parsing'
    });
    expect(Course.findOne).not.toHaveBeenCalled();
  });

  test('acknowledges (accepts) progress for a missing course', async () => {
    Course.findOne.mockResolvedValue(null);
    await expect(
      handleIngestProgress({ ...BASE, status: 'progress', stage: 'parsing', progress: 0.1 })
    ).resolves.toBeUndefined();
  });
});

describe('handleIngestResult (ingest result routing key)', () => {
  test('completes the course and persists the whitelisted course structure', async () => {
    const course: CourseFixture = {
      _id: '64a000000000000000000001',
      status: 'processing',
      ingestStage: 'embedding',
      ingestProgress: 0.6,
      topLevelJunk: 'never stored on completion either',
      set(key: string, value: unknown) {
        Reflect.set(this, key, value);
        return this;
      },
      save: jest.fn().mockResolvedValue(true)
    };
    Course.findOne.mockResolvedValue(course);

    await handleIngestResult({
      ...BASE,
      status: 'completed',
      payload: { courseId: '64a000000000000000000001', status: 'completed', course: WORKER_COURSE }
    });

    expect(course.status).toBe('completed');
    expect(course.ingestProgress).toBe(1);
    expect(course.ingestStage).toBe('indexing');
    expect(course.ingestError).toBe('');
    expect(course.processedAt).toBeInstanceOf(Date);
    expect(course.topics).toHaveLength(1);
    assert.ok(course.topics);
    const sub = course.topics[0].subtopics[0];
    expect(sub.title).toBe('Graphs 101');
    expect(sub.key_concepts).toEqual(['node', 'edge']);
    expect(sub.definitions).toEqual([{ term: 'Graph', definition: 'A set of nodes and edges' }]);
    expect(sub.formulas).toEqual(['E = V - 1']);
    expect(sub.learning_objectives).toEqual([
      {
        id: 'obj_graph',
        statement: 'Define a graph.',
        text: 'Define a graph.',
        bloomLevel: 'remember',
        provenance: 'ai_generated'
      }
    ]);
    expect(Reflect.get(sub, 'tokenized_chunks')).toBeUndefined();
    expect(Reflect.get(sub, 'chunk_embeddings')).toBeUndefined();
    expect(Course.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: course._id, correlationId: BASE.correlationId }),
      expect.objectContaining({ $set: expect.any(Object) })
    );
    expect(course.save).not.toHaveBeenCalled();
  });

  test('completing without a course payload keeps topics untouched', async () => {
    const course = {
      _id: '64a000000000000000000001',
      status: 'processing',
      topics: [{ title: 'old' }],
      save: jest.fn().mockResolvedValue(true)
    };
    Course.findOne.mockResolvedValue(course);

    await handleIngestResult({
      ...BASE,
      status: 'completed',
      payload: { courseId: '64a000000000000000000001' }
    });
    expect(course.status).toBe('completed');
    expect(course.topics).toEqual([{ title: 'old' }]);
  });

  test('fails the course with a sanitized reason', async () => {
    const course: CourseFixture = {
      _id: '64a000000000000000000001',
      status: 'processing',
      ingestStage: null,
      ingestProgress: 0,
      ingestError: '',
      save: jest.fn().mockResolvedValue(true)
    };
    Course.findOne.mockResolvedValue(course);

    await handleIngestResult({
      ...BASE,
      status: 'failed',
      error: 'PDF rejected by the sandbox parser: encrypted'
    });

    expect(course.status).toBe('failed');
    expect(course.ingestError).toMatch(/encrypted/);
    expect(Course.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: course._id, correlationId: BASE.correlationId }),
      expect.objectContaining({ $set: expect.any(Object) })
    );
    expect(course.save).not.toHaveBeenCalled();
  });

  test('ignores results for non-ingest job types', async () => {
    await handleIngestResult({
      ...BASE,
      type: 'study.eval.step',
      status: 'completed',
      payload: {}
    });
    expect(Course.findOne).not.toHaveBeenCalled();
  });
});

describe('startIngestStatusTracker (INGEST-07)', () => {
  test('subscribes to both the progress and ingest-result consumers', async () => {
    consumeAiProgress.mockResolvedValue({ queue: 'ai.results.progress' });
    consumeIngestResults.mockResolvedValue({ queue: 'ai.results.ingest' });

    await startIngestStatusTracker();

    expect(consumeAiProgress).toHaveBeenCalledWith(expect.any(Function));
    expect(consumeIngestResults).toHaveBeenCalledWith(expect.any(Function));
  });

  test('stopIngestStatusTracker closes the shared ai-messaging connection', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { closeAiMessaging } = require('@ednova/shared/ai-messaging');
    stopIngestStatusTracker();
    expect(closeAiMessaging).toHaveBeenCalled();
  });
});

describe('buildIngestStatus (status shape)', () => {
  test('queued → stage "queued", retry null', () => {
    const status = buildIngestStatus({
      _id: '64a000000000000000000001',
      status: 'processing',
      jobId: 'job-1',
      ingestStage: null,
      ingestProgress: 0,
      ingestDetail: '',
      processedAt: null,
      updatedAt: new Date('2026-08-19T00:00:00Z')
    });
    expect(status).toMatchObject({
      courseId: '64a000000000000000000001',
      status: 'processing',
      jobId: 'job-1',
      stage: 'queued',
      progress: 0,
      error: '',
      retry: null
    });
  });

  test('completed → progress 1, no error, no retry', () => {
    const status = buildIngestStatus({
      _id: '64a000000000000000000001',
      status: 'completed',
      ingestStage: 'indexing',
      ingestProgress: 1,
      ingestDetail: 'done',
      processedAt: new Date('2026-08-19T01:00:00Z'),
      updatedAt: new Date('2026-08-19T01:00:00Z')
    });
    expect(status.stage).toBe('indexing');
    expect(status.progress).toBe(1);
    expect(status.error).toBe('');
    expect(status.retry).toBeNull();
  });

  test('failed → sanitized error + retry action', () => {
    const status = buildIngestStatus({
      _id: '64a000000000000000000001',
      status: 'failed',
      jobId: 'job-1',
      ingestStage: 'parsing',
      ingestProgress: 0.1,
      ingestDetail: 'parsing 1 file(s)',
      ingestError: 'PDF rejected by the sandbox parser: encrypted',
      processedAt: null,
      updatedAt: new Date('2026-08-19T02:00:00Z')
    });
    expect(status.error).toMatch(/encrypted/);
    expect(status.retry).toMatchObject({
      action: 're-upload',
      endpoint: '/api/v1/study/courses/64a000000000000000000001/files',
      method: 'POST'
    });
  });
});

describe('GET /api/v1/study/courses/:courseId/ingest-status', () => {
  test('returns progress + status for the authenticated user', async () => {
    Course.findOne.mockResolvedValue({
      _id: '64a000000000000000000001',
      userId: 'user-123',
      status: 'processing',
      jobId: 'job-1',
      ingestStage: 'enriching',
      ingestProgress: 0.35,
      ingestDetail: 'enriching 4 subtopic(s)',
      processedAt: null,
      updatedAt: new Date('2026-08-19T03:00:00Z')
    });

    const res = await request(app)
      .get('/api/v1/study/courses/64a000000000000000000001/ingest-status')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      courseId: '64a000000000000000000001',
      status: 'processing',
      jobId: 'job-1',
      stage: 'enriching',
      progress: 0.35,
      detail: 'enriching 4 subtopic(s)',
      retry: null
    });
    expect(Course.findOne).toHaveBeenCalledWith({
      _id: '64a000000000000000000001',
      userId: 'user-123'
    });
  });

  test('scopes the lookup to the authenticated user', async () => {
    Course.findOne.mockResolvedValue(null);
    const res = await request(app)
      .get('/api/v1/study/courses/64a000000000000000000001/ingest-status')
      .set(authHeader());
    expect(res.status).toBe(404);
    expect(Course.findOne).toHaveBeenCalledWith({
      _id: '64a000000000000000000001',
      userId: 'user-123'
    });
  });

  test('surfaces failure reason + retry for a failed course', async () => {
    Course.findOne.mockResolvedValue({
      _id: '64a000000000000000000001',
      status: 'failed',
      userId: 'user-123',
      jobId: 'job-1',
      ingestStage: 'parsing',
      ingestProgress: 0.1,
      ingestDetail: 'parsing 1 file(s)',
      ingestError: 'PDF rejected by the sandbox parser: encrypted',
      processedAt: null,
      updatedAt: new Date('2026-08-19T00:00:00Z')
    });

    const res = await request(app)
      .get('/api/v1/study/courses/64a000000000000000000001/ingest-status')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.error).toMatch(/encrypted/);
    expect(res.body.retry).toMatchObject({ action: 're-upload' });
  });
});

describe('course gating (INGEST-07)', () => {
  test('session setup rejects a course that is still processing', async () => {
    Course.findOne.mockResolvedValue({
      _id: '64a000000000000000000001',
      userId: 'user-123',
      status: 'processing'
    });

    const res = await request(app)
      .post('/api/v1/study/sessions/setup')
      .set(authHeader())
      .send({ courseId: '64a000000000000000000001' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/still being processed/);
  });

  test('session setup allows a completed course through the gate', async () => {
    Course.findOne.mockResolvedValue({
      _id: '64a000000000000000000001',
      userId: 'user-123',
      status: 'completed'
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { StudyPlan, Task } = require('../models/index');
    StudyPlan.findOne.mockResolvedValue(null);
    Task.find.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/v1/study/sessions/setup')
      .set(authHeader())
      .send({ courseId: '64a000000000000000000001' });

    expect([200, 201, 202, 204]).toContain(res.status);
  });
});
