import type { DomainRequest } from '../../../../src/framework/contracts';
import express from 'express';
import request from 'supertest';
import {
  defaultLearningProfile,
  normalizeLearningProfile,
  orderHomeActions,
  suggestFocusMinutes,
  tutorPreferenceHints
} from '../../../../shared/ednova/learningProfile';

process.env.JWT_SECRET = 'test-secret-key';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test_ednova';
process.env.NODE_ENV = 'test';

jest.mock('../models/UserProfile', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  findOneAndUpdate: jest.fn().mockResolvedValue({})
}));
jest.mock('../models/Gamification', () => ({ findOne: jest.fn(), create: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const UserProfile = require('../models/UserProfile');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const profileRoutes = require('../routes/profile');

const app = express();
app.use(express.json());
app.use(
  '/api/v1/users/profile',
  (req: DomainRequest, _res, next) => {
    req.user = { userId: 'user-123', role: 'student' };
    next();
  },
  profileRoutes
);

const leanOf = (value: unknown) => ({ lean: () => Promise.resolve(value) });

describe('learning profile normalisation', () => {
  it('drops unknown keys, bad enums and over-long lists', () => {
    const result = normalizeLearningProfile({
      goals: ['exam_prep', 'become_famous', 'exam_prep'],
      subjects: ['  Linear   algebra ', '', 42, 'x'.repeat(200)],
      selfReportedLevel: 'wizard',
      languages: ['ar', 'fr', 'klingon'],
      formats: ['visual', 'nope'],
      sessionMinutes: 9999,
      isAdmin: true
    });
    expect(result.goals).toEqual(['exam_prep']);
    expect(result.subjects[0]).toBe('Linear algebra');
    expect(result.subjects[1]).toHaveLength(60);
    expect(result.selfReportedLevel).toBe('not_sure');
    expect(result.languages).toEqual(['ar', 'fr']);
    expect(result.formats).toEqual(['visual']);
    expect(result.sessionMinutes).toBeNull();
    expect(result).not.toHaveProperty('isAdmin');
  });

  it('keeps untouched fields on a partial update', () => {
    const base = normalizeLearningProfile({ goals: ['exam_prep'], formats: ['examples'] });
    const next = normalizeLearningProfile({ studyTime: 'morning' }, base);
    expect(next.goals).toEqual(['exam_prep']);
    expect(next.formats).toEqual(['examples']);
    expect(next.studyTime).toBe('morning');
  });

  it('reorders home actions without hiding any', () => {
    const peers = normalizeLearningProfile({ collaboration: 'collaborative' });
    expect(orderHomeActions(peers)[0]).toBe('study_together');
    expect(orderHomeActions(peers)).toHaveLength(3);
    const solo = normalizeLearningProfile({ collaboration: 'individual', formats: ['visual'] });
    expect(orderHomeActions(solo).at(-1)).toBe('study_together');
    expect(orderHomeActions(null)).toEqual(['courses', 'study_together', 'visual_lab']);
  });

  it('suggests a focus length from the stated session length only', () => {
    expect(suggestFocusMinutes(null)).toBe(25);
    expect(suggestFocusMinutes({ sessionMinutes: 50 })).toBe(50);
  });

  it('gives the tutor no hints before onboarding and never goals or subjects', () => {
    expect(tutorPreferenceHints(defaultLearningProfile())).toBeNull();
    const hints = tutorPreferenceHints(
      normalizeLearningProfile({
        onboardingStatus: 'completed',
        goals: ['exam_prep'],
        languages: ['fr']
      })
    );
    expect(hints).toEqual({
      language: 'fr',
      stepByStep: false,
      examples: false,
      guidedQuestions: false
    });
  });
});

describe('learning profile routes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns defaults for a new learner', async () => {
    UserProfile.findOne.mockReturnValue(leanOf(null));
    const res = await request(app).get('/api/v1/users/profile/learning');
    expect(res.status).toBe(200);
    expect(res.body.learningProfile.onboardingStatus).toBe('pending');
  });

  it('saves sanitised answers and completes onboarding', async () => {
    UserProfile.findOne.mockReturnValue(leanOf(null));
    const res = await request(app)
      .put('/api/v1/users/profile/learning')
      .send({ goals: ['exam_prep', 'bogus'], role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.learningProfile.goals).toEqual(['exam_prep']);
    expect(res.body.learningProfile.onboardingStatus).toBe('completed');
    const update = UserProfile.findOneAndUpdate.mock.calls[0][1];
    expect(JSON.stringify(update)).not.toContain('admin');
  });

  it('records a skip without inventing answers', async () => {
    UserProfile.findOne.mockReturnValue(leanOf(null));
    const res = await request(app)
      .put('/api/v1/users/profile/learning')
      .send({ onboardingStatus: 'skipped' });
    expect(res.body.learningProfile.onboardingStatus).toBe('skipped');
    expect(res.body.learningProfile.goals).toEqual([]);
  });

  it('rejects a non-object body', async () => {
    const res = await request(app).put('/api/v1/users/profile/learning').send([1, 2]);
    expect(res.status).toBe(400);
  });

  it('resets to skipped, not pending', async () => {
    const res = await request(app).delete('/api/v1/users/profile/learning');
    expect(res.status).toBe(200);
    expect(res.body.learningProfile.onboardingStatus).toBe('skipped');
    expect(res.body.learningProfile.formats).toEqual([]);
  });
});
