import type { IStudyPlan } from '../models';
import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response, NextFunction } from 'express';
/**
 * BLOOM-10 — plans route wiring (Node side).
 */

import express from 'express';
import request from 'supertest';

const MOCK_COURSE = { _id: 'course-1', userId: 'user-123', status: 'completed' };

jest.mock('../models/index', () => ({
  Course: {
    findOne: jest.fn(async () => MOCK_COURSE)
  },
  StudyPlan: {
    create: jest.fn(
      async (
        doc: Pick<
          IStudyPlan,
          | 'userId'
          | 'goal'
          | 'availableTimeMinutes'
          | 'totalEstimatedMinutes'
          | 'warning'
          | 'taskGraph'
        >
      ) => ({
        _id: { toString: () => 'plan-1' },
        ...doc,
        userId: doc.userId,
        goal: doc.goal,
        availableTimeMinutes: doc.availableTimeMinutes,
        totalEstimatedMinutes: doc.totalEstimatedMinutes,
        status: 'created',
        warning: doc.warning,
        taskGraph: doc.taskGraph,
        createdAt: new Date()
      })
    )
  },
  Task: {
    create: jest.fn(async (doc: object) => ({ _id: 'task-1', ...doc }))
  }
}));

jest.mock('../services/competencyQueries', () => ({
  getWeakCompetenciesForCourse: jest.fn()
}));

jest.mock('@ednova/shared/moduleClient', () => ({
  post: jest.fn()
}));

import mongoose from 'mongoose';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const moduleClient = require('@ednova/shared/moduleClient');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { StudyPlan, Task } = require('../models/index');
import { getWeakCompetenciesForCourse } from '../services/competencyQueries';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const plansRoutes = require('../routes/plans');

const app = express();
app.use(express.json());
const fakeAuth = (req: DomainRequest, res: Response, next: NextFunction) => {
  req.user = { userId: 'user-123', tier: 'vip', role: 'student' };
  next();
};
app.use('/api/v1/plans', fakeAuth, plansRoutes);

beforeEach(() => jest.clearAllMocks());

describe('POST /api/v1/plans/create — weak_competencies payload', () => {
  test('includes the user weak competencies scoped to the course', async () => {
    (getWeakCompetenciesForCourse as jest.Mock).mockResolvedValue([
      { topic_id: 'sorting', topic_title: 'Sorting Algorithms', scores: { apply: 0.4 } }
    ]);
    moduleClient.post.mockResolvedValue({
      data: { jobId: 'job-1', correlationId: 'corr-1' }
    });

    const res = await request(app)
      .post('/api/v1/plans/create')
      .send({ goal: 'Learn sorting', availableTimeMinutes: 120, courseId: 'course-1' });

    expect(res.status).toBe(202);
    expect(getWeakCompetenciesForCourse).toHaveBeenCalledWith('user-123', 'course-1');
    const [, body] = moduleClient.post.mock.calls[0];
    expect(body.type).toBe('study.plan.generate');
    expect(body.payload.weak_competencies).toEqual([
      { topic_id: 'sorting', topic_title: 'Sorting Algorithms', scores: { apply: 0.4 } }
    ]);
  });

  test('still generates the plan when no competency data exists (empty array)', async () => {
    (getWeakCompetenciesForCourse as jest.Mock).mockResolvedValue([]);
    moduleClient.post.mockResolvedValue({ data: { jobId: 'job-1', correlationId: 'corr-1' } });

    const res = await request(app)
      .post('/api/v1/plans/create')
      .send({ goal: 'Learn sorting', availableTimeMinutes: 120, courseId: 'course-1' });

    expect(res.status).toBe(202);
    expect(moduleClient.post.mock.calls[0][1].payload.weak_competencies).toEqual([]);
  });

  test('degrades gracefully if the competency query throws', async () => {
    (getWeakCompetenciesForCourse as jest.Mock).mockRejectedValue(new Error('db down'));
    moduleClient.post.mockResolvedValue({ data: { jobId: 'job-1', correlationId: 'corr-1' } });

    const res = await request(app)
      .post('/api/v1/plans/create')
      .send({ goal: 'Learn sorting', availableTimeMinutes: 120, courseId: 'course-1' });

    expect(res.status).toBe(202);
    expect(moduleClient.post.mock.calls[0][1].payload.weak_competencies).toEqual([]);
  });
});

describe('POST /api/v1/plans/create-status — competency target persistence', () => {
  function aiJobsResult(
    taskOverrides: { extra?: Array<Partial<import('../models').IStudyPlanTask>> } = {}
  ) {
    return {
      userId: 'user-123',
      type: 'study.plan.generate',
      resourceScope: {},
      status: 'COMPLETED',
      result: {
        task_graph: {
          goal: 'Learn sorting',
          tasks: [
            {
              id: 't1',
              title: 'Sorting Algorithms Practice',
              description: 'implement quicksort',
              estimated_minutes: 30,
              difficulty: 0.5,
              objective_id: 'sorting',
              target_bloom_level: 'apply'
            },
            {
              id: 't2',
              title: 'Arrays Review',
              description: 'basic arrays',
              estimated_minutes: 20,
              difficulty: 0.3
            },
            ...(taskOverrides.extra || [])
          ]
        }
      }
    };
  }

  test('persists objectiveId/targetBloomLevel on each task and in taskGraph', async () => {
    const aiJob = aiJobsResult();
    const aiJobsColl = {
      findOne: jest.fn(async () => aiJob)
    };
    const original = mongoose.connection;
    Object.defineProperty(mongoose.connection, 'collection', {
      value: jest.fn(() => aiJobsColl),
      configurable: true
    });

    const res = await request(app)
      .post('/api/v1/plans/create-status')
      .send({ correlationId: 'corr-1' });

    expect(res.status).toBe(201);
    // first task carries the competency target
    expect(Task.create.mock.calls[0][0]).toMatchObject({
      objectiveId: 'sorting',
      targetBloomLevel: 'apply',
      userId: 'user-123',
      studyPlanId: 'plan-1'
    });
    // second task (no target in AI result) -> fields absent
    expect(Task.create.mock.calls[1][0]).toMatchObject({
      objectiveId: undefined,
      targetBloomLevel: undefined
    });

    // taskGraph persisted with snake_case competency echo
    const savedPlanDoc = StudyPlan.create.mock.calls[0][0];
    expect(savedPlanDoc.taskGraph.tasks[0]).toMatchObject({
      objective_id: 'sorting',
      target_bloom_level: 'apply'
    });
    expect(savedPlanDoc.taskGraph.tasks[1]).not.toHaveProperty('objective_id');
    expect(original).toBe(mongoose.connection);
  });
});
