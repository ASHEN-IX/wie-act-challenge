const findOne = jest.fn();
jest.mock('mongoose', () => ({
  __esModule: true,
  default: { connection: { collection: () => ({ findOne }) } }
}));
jest.mock('../models', () => ({ CourseRevision: {} }));
jest.mock('../services/revisionSources', () => ({ verifyRevisionArtifact: jest.fn() }));
jest.mock('../services/coursePublication', () => ({
  getPublishedCourseContext: jest.fn(),
  resolveCourseSource: jest.fn(),
  PublicationForbiddenError: class extends Error {},
  UnpublishedCourseError: class extends Error {}
}));
jest.mock('../services/resourceAccess', () => ({ canReadCourse: jest.fn() }));

import { loadTutorStyle } from '../services/tutorGrounding';

describe('tutor style from stated preferences', () => {
  beforeEach(() => findOne.mockReset());

  it('returns only the closed hint fields', async () => {
    findOne.mockResolvedValue({
      learningProfile: {
        onboardingStatus: 'completed',
        languages: ['fr', 'en'],
        formats: ['examples', 'step_by_step'],
        goals: ['exam_prep'],
        subjects: ['my private subject']
      }
    });
    const style = await loadTutorStyle('u1');
    expect(style).toEqual({
      language: 'fr',
      stepByStep: true,
      examples: true,
      guidedQuestions: false
    });
    expect(JSON.stringify(style)).not.toContain('private');
    expect(JSON.stringify(style)).not.toContain('exam_prep');
  });

  it('sends nothing before onboarding or when the learner has no profile', async () => {
    findOne.mockResolvedValueOnce(null);
    expect(await loadTutorStyle('u1')).toBeNull();
    findOne.mockResolvedValueOnce({
      learningProfile: { onboardingStatus: 'pending', languages: ['ar'] }
    });
    expect(await loadTutorStyle('u1')).toBeNull();
  });

  it('never blocks the tutor when the lookup fails', async () => {
    findOne.mockRejectedValue(new Error('db down'));
    expect(await loadTutorStyle('u1')).toBeNull();
  });
});
