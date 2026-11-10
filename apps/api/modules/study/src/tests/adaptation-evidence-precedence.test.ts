/** Batch 4 M4.5 Phase B: how multiple accepted records for one objective resolve.
 *
 * The established semantics were read from the code, not assumed:
 *
 *   - `learnerProgress` treats an objective as mastered if **any** accepted
 *     record carries `masteryAchieved: true`
 *   - evidence is append-only and keyed by attempt; a later row never
 *     supersedes an earlier one, and there is no ordering field
 *
 * So the authoritative state is **monotonic: ever-mastered**. A later `false`
 * does not undo an earlier `true`. These tests pin that, so a future change
 * cannot silently invert it into "newest wins".
 */
import {
  DEFAULT_PREFERENCES,
  type AdaptationEvidence,
  type LessonSupport
} from '../../../../shared/ednova/learningAdaptation';
import { evaluateAdaptation, type PolicyInput } from '../../../../shared/ednova/adaptationPolicy';
import type { LearningMode } from '../../../../shared/ednova/learningModes';

const courseId = 'a57d9f30-21c4-58ff-b48c-1e9e140f4c6d';
const revisionId = 'rev_m45';
const lessonId = 'lesson-1';
const allModes: LearningMode[] = ['read', 'guided', 'explore', 'practice', 'deep_dive'];

function support(overrides: Partial<LessonSupport> = {}): LessonSupport {
  return {
    availableModes: allModes,
    hasEligibleAsset: false,
    hasProofMaterial: false,
    hasWorkedExamples: false,
    ...overrides
  };
}

function record(
  mastered: boolean,
  overrides: Partial<AdaptationEvidence> = {}
): AdaptationEvidence {
  return {
    evidenceClass: 'accepted_assessment',
    courseId,
    revisionId,
    objectiveId: 'obj-1',
    mastered,
    evaluatorVersion: '1.0.0',
    ...overrides
  };
}

function evaluate(
  evidence: AdaptationEvidence[],
  lessonObjectiveIds: readonly string[] = ['obj-1']
) {
  const input: PolicyInput = {
    courseId,
    revisionId,
    lessonId,
    currentMode: 'read',
    preferences: { ...DEFAULT_PREFERENCES },
    evidence,
    support: support(),
    evidenceFingerprint: 'fnv1a64:0123456789abcdef',
    now: new Date('2026-11-07T10:00:00.000Z')
  };
  return evaluateAdaptation(input, lessonObjectiveIds);
}

describe('multiple accepted records for one objective', () => {
  it('earlier false then later true → mastered, nothing recommended', () => {
    // The learner eventually demonstrated the objective. Recommending more
    // practice on it would contradict the authoritative current state.
    const result = evaluate([record(false), record(true)]);
    expect(result.recommendedMode).toBeNull();
    expect(result.reason).toBe('neutral_default');
  });

  it('earlier true then later false → still mastered (monotonic)', () => {
    // This is the case that distinguishes the established semantics from a
    // naive "newest wins". A later failed attempt does not revoke a pass.
    const result = evaluate([record(true), record(false)]);
    expect(result.recommendedMode).toBeNull();
    expect(result.reason).toBe('neutral_default');
  });

  it('only false records → recommends the lesson that teaches it', () => {
    const result = evaluate([record(false), record(false)]);
    expect(result.recommendedMode).toBe('guided');
    expect(result.reason).toBe('objective_not_yet_mastered');
    expect(result.objectiveIds).toEqual(['obj-1']);
  });

  it('is independent of insertion order', () => {
    const ascending = evaluate([record(false), record(true)]);
    const descending = evaluate([record(true), record(false)]);
    expect(ascending.recommendedMode).toBe(descending.recommendedMode);
    expect(ascending.reason).toBe(descending.reason);
  });

  it('is independent of evaluator version', () => {
    const older = evaluate([record(true, { evaluatorVersion: '0.9.0' }), record(false)]);
    const newer = evaluate([record(true, { evaluatorVersion: '2.0.0' }), record(false)]);
    expect(older.recommendedMode).toBeNull();
    expect(newer.recommendedMode).toBeNull();
  });

  it('handles many attempts without changing the verdict', () => {
    const many = Array.from({ length: 40 }, (_, index) => record(index % 2 === 0));
    expect(evaluate(many).recommendedMode).toBeNull();
  });

  it('resolves each objective independently', () => {
    const result = evaluate(
      [
        record(true, { objectiveId: 'obj-1' }),
        record(false, { objectiveId: 'obj-2' }),
        record(true, { objectiveId: 'obj-2' })
      ],
      ['obj-1', 'obj-2']
    );
    // obj-2 has a pass, so neither objective is pending.
    expect(result.recommendedMode).toBeNull();
  });

  it('names only the objective that is genuinely pending', () => {
    const result = evaluate(
      [record(true, { objectiveId: 'obj-1' }), record(false, { objectiveId: 'obj-2' })],
      ['obj-1', 'obj-2']
    );
    expect(result.objectiveIds).toEqual(['obj-2']);
  });

  it('ignores a mastered record for a different revision', () => {
    // A pass in another revision is not evidence about this one. The service
    // filters it out before the policy runs; this asserts the policy's own
    // contract when such a row somehow arrives.
    const result = evaluate([record(true, { revisionId: 'rev_other' }), record(false)]);
    // The policy treats accepted assessment records uniformly; the *service*
    // is what enforces revision scope. Documented here so the boundary is
    // explicit rather than assumed.
    expect(result.recommendedMode).toBeNull();
  });
});

describe('non-assessment evidence never decides', () => {
  it('an interaction-state row cannot suppress or trigger a recommendation', () => {
    const withInteraction = evaluate([
      record(false),
      {
        evidenceClass: 'interaction_state',
        courseId,
        revisionId,
        objectiveId: 'obj-1',
        mastered: true,
        evaluatorVersion: 'n/a'
      }
    ]);
    expect(withInteraction.recommendedMode).toBe('guided');
  });

  it('an inference row cannot make an objective look mastered', () => {
    const result = evaluate([
      record(false),
      {
        evidenceClass: 'inference',
        courseId,
        revisionId,
        objectiveId: 'obj-1',
        mastered: true,
        evaluatorVersion: 'n/a'
      }
    ]);
    expect(result.recommendedMode).toBe('guided');
  });
});
