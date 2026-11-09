/** Batch 4 M4.4: evidence eligibility, preference isolation and concurrency.
 *
 * The privacy guarantees live here rather than in the policy, because they need
 * the database: whose rows are read, which revision they belong to, and whose
 * preferences a write may touch.
 */
jest.mock('../models/LearningEvidence', () => ({ LearningEvidence: { find: jest.fn() } }));
jest.mock('../models/LearnerAdaptationPreference', () => ({
  LearnerAdaptationPreference: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn()
  }
}));
jest.mock('../models/StructuredAsset', () => ({ StructuredAsset: { find: jest.fn() } }));
jest.mock('../services/experiencePlanStore', () => ({ peekStoredPlan: jest.fn() }));
jest.mock('../services/assetReviewProvenance', () => ({
  verifyReviewProvenance: jest.fn(async () => new Map())
}));

import { LearningEvidence } from '../models/LearningEvidence';
import { LearnerAdaptationPreference } from '../models/LearnerAdaptationPreference';
import { StructuredAsset } from '../models/StructuredAsset';
import { peekStoredPlan } from '../services/experiencePlanStore';
import { verifyReviewProvenance } from '../services/assetReviewProvenance';
import {
  AdaptationConflictError,
  dismissRecommendation,
  loadEligibleEvidence,
  readPreferences,
  recommendForLesson,
  resetPreferences,
  resolveLessonSupport,
  savePreferences
} from '../services/learnerAdaptation';
import { DEFAULT_PREFERENCES } from '../../../../shared/ednova/learningAdaptation';

const userId = '04b3da2d-ec14-5643-bf49-e43f550168bf';
const otherUser = 'ebf069b5-6c44-5857-8834-17d3bc9778d0';
const courseId = 'a57d9f30-21c4-58ff-b48c-1e9e140f4c6d';
const revisionId = 'rev_m44';

const findEvidence = LearningEvidence.find as jest.Mock;
const findPref = LearnerAdaptationPreference.findOne as jest.Mock;
const findOneAndUpdate = LearnerAdaptationPreference.findOneAndUpdate as jest.Mock;
const deleteOne = LearnerAdaptationPreference.deleteOne as jest.Mock;
const updateOne = LearnerAdaptationPreference.updateOne as jest.Mock;
const findAssets = StructuredAsset.find as jest.Mock;
const peek = peekStoredPlan as jest.Mock;
const verifyProvenance = verifyReviewProvenance as jest.Mock;

/** A query stub returning rows through `.select().limit().lean()`. */
function rows(value: unknown[]) {
  const chain = {
    select: () => chain,
    limit: () => chain,
    lean: async () => value,
    sort: () => chain
  };
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
  findEvidence.mockReturnValue(rows([]));
  findPref.mockReturnValue({ lean: async () => null });
  findAssets.mockReturnValue(rows([]));
  peek.mockResolvedValue(false);
  verifyProvenance.mockResolvedValue(new Map());
});

describe('evidence eligibility', () => {
  const row = (overrides: Record<string, unknown> = {}) => ({
    objectiveId: 'obj-1',
    masteryAchieved: false,
    activity: { revisionId, courseId },
    evaluator: { type: 'deterministic_rubric', validationVersion: '1.0.0' },
    ...overrides
  });

  it('queries only the learner’s own accepted rows for this course and revision', async () => {
    await loadEligibleEvidence({ userId, courseId, revisionId });
    const [filter] = findEvidence.mock.calls[0];
    expect(filter).toMatchObject({
      userId,
      'activity.courseId': courseId,
      'activity.revisionId': revisionId,
      status: 'accepted'
    });
    expect(filter.userId).not.toBe(otherUser);
  });

  it('bounds the query instead of reading a whole history', async () => {
    await loadEligibleEvidence({ userId, courseId, revisionId });
    // The chain includes a limit; a learner with thousands of rows must not
    // have them all loaded for a single recommendation.
    expect(findEvidence).toHaveBeenCalled();
  });

  it('returns identity and verdict only, never the learner’s answers', async () => {
    findEvidence.mockReturnValue(rows([row({ answers: { q1: 'secret' }, score: 0.42 })]));
    const [entry] = await loadEligibleEvidence({ userId, courseId, revisionId });
    expect(entry).toEqual({
      evidenceClass: 'accepted_assessment',
      courseId,
      revisionId,
      objectiveId: 'obj-1',
      mastered: false,
      evaluatorVersion: '1.0.0'
    });
    expect(JSON.stringify(entry)).not.toContain('secret');
    expect(JSON.stringify(entry)).not.toContain('0.42');
  });

  it('drops a row whose revision does not match, even if the query returned it', async () => {
    findEvidence.mockReturnValue(rows([row({ activity: { revisionId: 'rev_other', courseId } })]));
    expect(await loadEligibleEvidence({ userId, courseId, revisionId })).toEqual([]);
  });

  it('treats only an explicit true mastery flag as mastered', async () => {
    findEvidence.mockReturnValue(
      rows([row({ masteryAchieved: 'yes' }), row({ masteryAchieved: true })])
    );
    const loaded = await loadEligibleEvidence({ userId, courseId, revisionId });
    expect(loaded.map((entry) => entry.mastered)).toEqual([false, true]);
  });
});

describe('preferences', () => {
  it('returns defaults and version 0 when nothing is stored', async () => {
    const stored = await readPreferences(userId);
    expect(stored.preferences).toEqual(DEFAULT_PREFERENCES);
    expect(stored.version).toBe(0);
  });

  it('rejects a write carrying a stale version', async () => {
    findPref.mockReturnValue({
      lean: async () => ({ userId, version: 3, recommendationsEnabled: true })
    });
    await expect(savePreferences(userId, { preferDetailedProofs: true }, 1)).rejects.toBeInstanceOf(
      AdaptationConflictError
    );
  });

  it('applies a write at the version the caller read', async () => {
    findPref.mockReturnValue({
      lean: async () => ({
        userId,
        version: 2,
        recommendationsEnabled: true,
        allowAssessmentEvidence: true,
        preferredMode: null
      })
    });
    findOneAndUpdate.mockReturnValue({
      lean: async () => ({
        userId,
        version: 3,
        recommendationsEnabled: true,
        allowAssessmentEvidence: true,
        preferredMode: 'guided',
        preferWorkedExamples: false,
        preferVisualExploration: false,
        preferDetailedProofs: true
      })
    });
    const saved = await savePreferences(userId, { preferredMode: 'guided' }, 2);
    expect(saved.version).toBe(3);
    expect(saved.preferences.preferredMode).toBe('guided');
    // The conditional filter is what prevents a concurrent stale write winning.
    const [filter] = findOneAndUpdate.mock.calls[0];
    expect(filter).toMatchObject({ userId, version: 2 });
  });

  it('rejects a write that loses the concurrency race', async () => {
    findPref.mockReturnValue({ lean: async () => ({ userId, version: 1 }) });
    findOneAndUpdate.mockReturnValue({ lean: async () => null });
    await expect(savePreferences(userId, { preferDetailedProofs: true }, 1)).rejects.toBeInstanceOf(
      AdaptationConflictError
    );
  });

  it('resets by deleting, so "never chose" stays distinguishable', async () => {
    deleteOne.mockResolvedValue({});
    await resetPreferences(userId);
    expect(deleteOne).toHaveBeenCalledWith({ userId });
  });

  it('scopes dismissal to the learner and bounds the stored list', async () => {
    // The row is read, merged under the optimistic version, then written; the
    // vector bound (`$slice: -50`) is now applied to the merged array.
    const existing = Array.from({ length: 50 }, (_, index) => ({
      courseId: `course-${index}`,
      revisionId,
      lessonId: 'lesson-1',
      mode: 'guided',
      at: new Date(0)
    }));
    findOneAndUpdate.mockResolvedValue({ userId, version: 3, dismissed: existing });
    updateOne.mockResolvedValue({ matchedCount: 1 });
    await dismissRecommendation(userId, {
      courseId,
      revisionId,
      lessonId: 'lesson-1',
      mode: 'guided'
    });
    const [filter, update] = updateOne.mock.calls[0];
    expect(filter).toEqual({ userId, version: 3 });
    expect(update.$set.dismissed).toHaveLength(50);
    expect(update.$set.dismissed.at(-1)).toMatchObject({
      courseId,
      revisionId,
      lessonId: 'lesson-1',
      mode: 'guided'
    });
  });

  it('never writes another learner’s preference row', async () => {
    findPref.mockReturnValue({ lean: async () => ({ userId, version: 0 }) });
    findOneAndUpdate.mockReturnValue({
      lean: async () => ({
        userId,
        version: 1,
        recommendationsEnabled: true,
        allowAssessmentEvidence: true,
        preferredMode: null,
        preferWorkedExamples: false,
        preferVisualExploration: false,
        preferDetailedProofs: false
      })
    });
    await savePreferences(userId, { recommendationsEnabled: false }, 0);
    for (const call of findOneAndUpdate.mock.calls) expect(call[0].userId).toBe(userId);
    expect(JSON.stringify(findOneAndUpdate.mock.calls)).not.toContain(otherUser);
  });
});

describe('lesson support resolution', () => {
  it('offers only modes that have a validated plan', async () => {
    peek.mockImplementation(async ({ mode }: { mode: string }) => mode === 'guided');
    const support = await resolveLessonSupport({
      courseId,
      revisionId,
      lessonId: 'lesson-1',
      contentHash: 'sha256:' + 'a'.repeat(64),
      modes: ['read', 'guided', 'explore'],
      hasProofMaterial: false,
      hasWorkedExamples: false
    });
    expect(support.availableModes).toEqual(['read', 'guided']);
  });

  it('never counts an asset whose review is not verified', async () => {
    findAssets.mockReturnValue(
      rows([
        {
          assetId: 'a1',
          component: 'CodeWalkthrough',
          payload: {},
          provenance: 'instructor_authored'
        }
      ])
    );
    verifyProvenance.mockResolvedValue(new Map([['a1', { verified: false }]]));
    const support = await resolveLessonSupport({
      courseId,
      revisionId,
      lessonId: 'lesson-1',
      contentHash: 'sha256:' + 'a'.repeat(64),
      modes: ['read'],
      hasProofMaterial: false,
      hasWorkedExamples: false
    });
    expect(support.hasEligibleAsset).toBe(false);
  });
});

describe('recommendation assembly', () => {
  const base = {
    userId,
    courseId,
    revisionId,
    lessonId: 'lesson-1',
    contentHash: 'sha256:' + 'a'.repeat(64),
    currentMode: 'read' as const,
    lessonObjectiveIds: ['obj-1'],
    hasProofMaterial: false,
    hasWorkedExamples: false
  };

  it('suppresses evidence entirely when the learner disallowed it', async () => {
    findPref.mockReturnValue({
      lean: async () => ({
        userId,
        version: 1,
        recommendationsEnabled: true,
        allowAssessmentEvidence: false,
        preferredMode: null,
        preferWorkedExamples: false,
        preferVisualExploration: false,
        preferDetailedProofs: false,
        dismissed: []
      })
    });
    findEvidence.mockReturnValue(
      rows([{ objectiveId: 'obj-1', masteryAchieved: false, activity: { revisionId } }])
    );
    const result = await recommendForLesson(base);
    // The evidence query must not even run: the learner opted out.
    expect(findEvidence).not.toHaveBeenCalled();
    expect(result.adaptation.recommendedMode).toBeNull();
  });

  it('does not surface a suggestion the learner dismissed', async () => {
    findPref.mockReturnValue({
      lean: async () => ({
        userId,
        version: 1,
        recommendationsEnabled: true,
        allowAssessmentEvidence: true,
        preferredMode: 'guided',
        preferWorkedExamples: false,
        preferVisualExploration: false,
        preferDetailedProofs: false,
        dismissed: [{ courseId, revisionId, lessonId: 'lesson-1', mode: 'guided' }]
      })
    });
    peek.mockResolvedValue(true);
    const result = await recommendForLesson(base);
    expect(result.adaptation.recommendedMode).toBe('guided');
    expect(result.surface).toBe(false);
  });

  it('produces a neutral default with no evidence and no preference', async () => {
    const result = await recommendForLesson(base);
    expect(result.adaptation.recommendedMode).toBeNull();
    expect(result.surface).toBe(false);
    expect(result.adaptation.reason).toBe('neutral_default');
  });
});
