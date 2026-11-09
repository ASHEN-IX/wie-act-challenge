import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response, NextFunction } from 'express';
/**
 * Study Service Tests
 * Tests course upload, plan CRUD, and task completion endpoints
 */
import express from 'express';

process.env.JWT_SECRET = 'test-secret-key';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://ednova:ednova@127.0.0.1:5433/ednova_test';
process.env.NODE_ENV = 'test';

// Prevent process.exit() from killing tests
const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code): never => {
  throw new Error(`Unexpected process.exit(${code})`);
});
afterAll(() => exitSpy.mockRestore());

/** A cursor that resolves to `rows` and tolerates the `.lean()` chain. */
const asCursor = (rows: unknown[]) => {
  const promise = Promise.resolve(rows);
  return {
    lean: () => promise,
    exec: () => promise,
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise)
  };
};

// ── Mock Models ──────────────────────────────────
const mockCourse = {
  _id: '64a000000000000000000001',
  userId: 'user-123',
  title: 'Test Course',
  status: 'active',
  modules: [],
  toJSON: function () {
    return { ...this };
  },
  save: jest.fn().mockResolvedValue(true)
};

const mockPlan = {
  _id: 'plan-1',
  userId: 'user-123',
  courseId: '64a000000000000000000001',
  title: 'Test Plan',
  status: 'active',
  tasks: [
    { _id: 'task-1', title: 'Task 1', status: 'pending', duration_minutes: 30 },
    { _id: 'task-2', title: 'Task 2', status: 'pending', duration_minutes: 45 }
  ],
  toJSON: function () {
    return { ...this };
  },
  save: jest.fn().mockResolvedValue(true)
};

jest.mock('../models/index', () => ({
  CourseEnrollment: {
    find: jest.fn().mockReturnValue({ distinct: jest.fn().mockResolvedValue([]) })
  },
  PublicCourseJoin: {
    find: jest.fn().mockReturnValue({ select: async () => [] })
  },
  Institution: {
    find: jest.fn().mockReturnValue({ select: async () => [] }),
    exists: jest.fn().mockResolvedValue(false)
  },
  Course: {
    exists: jest.fn().mockResolvedValue({ _id: '64a000000000000000000001' }),
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    findOneAndDelete: jest.fn()
  },
  StudyPlan: {
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn()
  },
  StudySession: {},
  Task: {
    find: jest.fn()
  },
  Topic: {},
  Subject: {},
  LearningObjective: {
    find: jest.fn().mockReturnValue({ select: async () => [] }),
    findOneAndUpdate: jest.fn().mockResolvedValue({ id: 'obj-1' }),
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 })
  }
}));

// Get the mocked models
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Course, StudyPlan, Task } = require('../models/index');
import { validateLearningObjective } from '../validators/learningObjective';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const courseRoutes = require('../routes/courses');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const planRoutes = require('../routes/plans');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const learningObjectiveRoutes = require('../routes/learningObjectives');

// Build app with routes
const app = express();
app.use(express.json());

// Fake auth
const fakeAuth = (req: DomainRequest, res: Response, next: NextFunction) => {
  req.user = { userId: 'user-123', role: 'student' };
  next();
};

app.use('/api/v1/study/courses', fakeAuth, courseRoutes);
app.use('/api/v1/study/plans', fakeAuth, planRoutes);
app.use('/api/v1/study/learning-objectives', fakeAuth, learningObjectiveRoutes);

import request from 'supertest';

describe('learningObjective validator (F01)', () => {
  const base = {
    objectiveId: 'obj-1',
    topicId: 'topic-1',
    knowledgeType: 'conceptual',
    bloomLevel: 'apply',
    verb: 'Solve',
    text: 'Solve systems of linear equations using substitution.'
  };

  test('accepts a valid objective', () => {
    const result = validateLearningObjective(base);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("rejects a verb not in the level's verb map", () => {
    const result = validateLearningObjective({ ...base, verb: 'Design' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('verb must be one of'))).toBe(true);
  });

  test('rejects a bloomLevel outside the enum', () => {
    const result = validateLearningObjective({ ...base, bloomLevel: 'memorize' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('bloomLevel must be one of'))).toBe(true);
  });

  test('rejects non-measurable phrasing', () => {
    const result = validateLearningObjective({
      ...base,
      verb: 'Solve',
      text: 'Know how to solve systems of linear equations.'
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('non-measurable phrasing'))).toBe(true);
  });

  test('rejects empty text', () => {
    const result = validateLearningObjective({ ...base, text: '' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('text must be a non-empty string');
  });

  test('rejects text over 200 chars', () => {
    const result = validateLearningObjective({ ...base, text: 'Solve ' + 'x'.repeat(200) });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('exceeds 200 chars'))).toBe(true);
  });

  test('rejects verb not near the start of text', () => {
    const result = validateLearningObjective({
      ...base,
      text: 'Using substitution, systems of linear equations can be solved by students.'
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('must appear at/near the start'))).toBe(true);
  });
});

describe('POST /api/v1/study/learning-objectives (route)', () => {
  const validObjective = {
    objectiveId: 'obj-route-1',
    topicId: 'topic-1',
    knowledgeType: 'conceptual',
    bloomLevel: 'apply',
    verb: 'Solve',
    text: 'Solve systems of linear equations using substitution.'
  };

  test('returns 200 and echoes the objective when valid', async () => {
    const res = await request(app).post('/api/v1/study/learning-objectives').send(validObjective);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Learning objective accepted');
    expect(res.body.objective).toEqual(validObjective);
  });

  test('returns 400 with errors and does not create anything when invalid', async () => {
    const invalidObjective = { ...validObjective, verb: 'Design' }; // wrong verb for 'apply'

    const res = await request(app).post('/api/v1/study/learning-objectives').send(invalidObjective);

    expect(res.status).toBe(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.some((e: string) => e.includes('verb must be one of'))).toBe(true);
  });
});

describe('Study Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The converted models return the row directly; `select()` stays chainable
    // but no longer needs `.lean()`.
    Course.findById.mockImplementation(() =>
      Object.assign(Promise.resolve(mockCourse), {
        select: () => Promise.resolve(mockCourse)
      })
    );
  });

  // ── Courses ──────────────────────────────────
  describe('Courses', () => {
    describe('GET /api/v1/study/courses', () => {
      it('should return user courses', async () => {
        // The model returns a cursor: awaitable, and chainable with .lean().
        Course.find.mockReturnValue({
          sort: jest.fn().mockReturnValue(asCursor([mockCourse]))
        });

        const res = await request(app).get('/api/v1/study/courses');
        expect(res.status).toBe(200);
        expect(res.body.courses).toHaveLength(1);
      });
    });

    describe('GET /api/v1/study/courses/:id', () => {
      it('should return a specific course', async () => {
        Course.findOne.mockResolvedValue(mockCourse);

        const res = await request(app).get('/api/v1/study/courses/64a000000000000000000001');
        expect(res.status).toBe(200);
      });

      it('should return 404 for missing course', async () => {
        Course.findOne.mockResolvedValue(null);

        const res = await request(app).get('/api/v1/study/courses/nonexistent');
        expect(res.status).toBe(404);
      });
    });

    describe('DELETE /api/v1/study/courses/:id', () => {
      it('should delete a course', async () => {
        Course.findByIdAndDelete.mockResolvedValue(mockCourse);

        const res = await request(app).delete('/api/v1/study/courses/64a000000000000000000001');
        expect(res.status).toBe(200);
      });
    });
  });

  // ── Plans ──────────────────────────────────
  describe('Plans', () => {
    describe('GET /api/v1/study/plans', () => {
      it('should return user study plans', async () => {
        StudyPlan.find.mockReturnValue({
          sort: jest.fn().mockReturnValue(asCursor([mockPlan]))
        });

        const res = await request(app).get('/api/v1/study/plans');
        expect(res.status).toBe(200);
      });
    });

    describe('GET /api/v1/study/plans/:id', () => {
      it('should return a specific plan', async () => {
        StudyPlan.findOne.mockResolvedValue(mockPlan);
        Task.find.mockReturnValue({
          lean: jest.fn().mockResolvedValue([])
        });

        const res = await request(app).get('/api/v1/study/plans/507f1f77bcf86cd799439011');
        expect(res.status).toBe(200);
      });

      it('should return 404 for missing plan', async () => {
        StudyPlan.findOne.mockResolvedValue(null);

        const res = await request(app).get('/api/v1/study/plans/507f1f77bcf86cd799439012');
        expect(res.status).toBe(404);
      });
    });
  });
});
