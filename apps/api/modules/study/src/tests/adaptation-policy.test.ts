/** Batch 4 M4.4: the deterministic adaptation policy.
 *
 * These tests pin the two properties the milestone is really about:
 *
 *   1. the learner always outranks the evidence
 *   2. nothing is recommended without a reason the application can actually
 *      justify — no invented personalisation, no inferred ability
 */
import {
  DEFAULT_PREFERENCES,
  parseLearningAdaptation,
  parsePreferences,
  type AdaptationEvidence,
  type AdaptationPreferences,
  type LessonSupport,
} from '../../../../shared/ednova/learningAdaptation';
import {
  evaluateAdaptation,
  shouldSurface,
  adaptationFingerprint,
  ADAPTATION_TTL_MS,
  type PolicyInput,
} from '../../../../shared/ednova/adaptationPolicy';
import type { LearningMode } from '../../../../shared/ednova/learningModes';

const courseId = 'a57d9f30-21c4-58ff-b48c-1e9e140f4c6d';
const revisionId = 'rev_m44';
const lessonId = 'lesson-1';
const now = new Date('2026-11-07T10:00:00.000Z');

const allModes: LearningMode[] = ['read', 'guided', 'explore', 'practice', 'deep_dive'];

function support(overrides: Partial<LessonSupport> = {}): LessonSupport {
  return {
    availableModes: allModes,
    hasEligibleAsset: false,
    hasProofMaterial: false,
    hasWorkedExamples: false,
    ...overrides,
  };
}

function prefs(overrides: Partial<AdaptationPreferences> = {}): AdaptationPreferences {
  return { ...DEFAULT_PREFERENCES, ...overrides };
}

function evidence(overrides: Partial<AdaptationEvidence> = {}): AdaptationEvidence {
  return {
    evidenceClass: 'accepted_assessment',
    courseId,
    revisionId,
    objectiveId: 'obj-1',
    mastered: false,
    evaluatorVersion: '1.0.0',
    ...overrides,
  };
}

function input(overrides: Partial<PolicyInput> = {}): PolicyInput {
  return {
    courseId,
    revisionId,
    lessonId,
    currentMode: 'read',
    preferences: prefs(),
    evidence: [],
    support: support(),
    evidenceFingerprint: 'fnv1a64:0123456789abcdef',
    now,
    ...overrides,
  };
}

const evaluate = (
  overrides: Partial<PolicyInput> = {},
  lessonObjectiveIds: readonly string[] = ['obj-1'],
) => evaluateAdaptation(input(overrides), lessonObjectiveIds);

describe('rule 1 — recommendations disabled', () => {
  it('recommends nothing at all when the learner turned suggestions off', () => {
    const result = evaluate({
      preferences: prefs({ recommendationsEnabled: false, preferDetailedProofs: true }),
      support: support({ hasProofMaterial: true }),
      evidence: [evidence()],
    });
    expect(result.recommendedMode).toBeNull();
    expect(result.reason).toBeNull();
    expect(result.objectiveIds).toEqual([]);
  });
});

describe('rule 2 — explicit mode preference', () => {
  it('honours a preferred mode when the lesson supports it', () => {
    const result = evaluate({ preferences: prefs({ preferredMode: 'guided' }) });
    expect(result.recommendedMode).toBe('guided');
    expect(result.reason).toBe('explicit_preference');
  });

  it('explains the limitation when the preferred mode is unavailable', () => {
    // Explore is not offered because no validated plan exists for it.
    const result = evaluate({
      preferences: prefs({ preferredMode: 'explore' }),
      support: support({ availableModes: ['read', 'guided'] }),
    });
    expect(result.recommendedMode).toBeNull();
    expect(result.reason).toBe('preference_unavailable_for_lesson');
  });

  it('never recommends Read as if it were a suggestion', () => {
    const result = evaluate({ preferences: prefs({ preferredMode: 'read' }) });
    expect(result.recommendedMode).toBeNull();
  });

  it('a preference outranks assessment evidence', () => {
    const result = evaluate({
      preferences: prefs({ preferredMode: 'deep_dive' }),
      support: support({ hasProofMaterial: true }),
      evidence: [evidence({ mastered: false })],
    });
    expect(result.reason).toBe('explicit_preference');
    expect(result.objectiveIds).toEqual([]);
  });
});

describe('rule 3 — guided explanation request', () => {
  it('offers Guided when the learner asked for explanation and examples exist', () => {
    const result = evaluate({
      preferences: prefs({ preferWorkedExamples: true }),
      support: support({ hasWorkedExamples: true }),
    });
    expect(result.recommendedMode).toBe('guided');
    expect(result.reason).toBe('guided_requested');
  });

  it('does not offer Guided when the lesson has no worked examples', () => {
    const result = evaluate({
      preferences: prefs({ preferWorkedExamples: true }),
      support: support({ hasWorkedExamples: false }),
    });
    expect(result.recommendedMode).toBeNull();
    expect(result.reason).toBe('neutral_default');
  });
});

describe('rule 4 — detailed proof request', () => {
  it('offers Deep Dive when proof material exists', () => {
    const result = evaluate({
      preferences: prefs({ preferDetailedProofs: true }),
      support: support({ hasProofMaterial: true }),
    });
    expect(result.recommendedMode).toBe('deep_dive');
    expect(result.reason).toBe('proof_material_requested');
  });

  it('does not offer Deep Dive without proof material', () => {
    const result = evaluate({
      preferences: prefs({ preferDetailedProofs: true }),
      support: support({ hasProofMaterial: false }),
    });
    expect(result.recommendedMode).toBeNull();
  });
});

describe('rule 5 — visual exploration request', () => {
  it('offers Explore only when a review-verified asset exists', () => {
    const result = evaluate({
      preferences: prefs({ preferVisualExploration: true }),
      support: support({ hasEligibleAsset: true }),
    });
    expect(result.recommendedMode).toBe('explore');
    expect(result.reason).toBe('visual_asset_available');
  });

  it('never forces Explore when the lesson has no eligible asset', () => {
    // Without an asset Explore renders exactly Read, so offering it would be a
    // manufactured difference.
    const result = evaluate({
      preferences: prefs({ preferVisualExploration: true }),
      support: support({ hasEligibleAsset: false }),
    });
    expect(result.recommendedMode).toBeNull();
    expect(result.reason).toBe('neutral_default');
  });
});

describe('rule 6 — accepted assessment evidence', () => {
  it('suggests the lesson arrangement for an objective not yet mastered', () => {
    const result = evaluate({ evidence: [evidence({ mastered: false })] });
    expect(result.recommendedMode).toBe('guided');
    expect(result.reason).toBe('objective_not_yet_mastered');
    expect(result.objectiveIds).toEqual(['obj-1']);
  });

  it('says nothing when the objective is already mastered', () => {
    const result = evaluate({ evidence: [evidence({ mastered: true })] });
    expect(result.recommendedMode).toBeNull();
    expect(result.reason).toBe('neutral_default');
  });

  it('ignores evidence for an objective this lesson does not teach', () => {
    const result = evaluate({ evidence: [evidence({ objectiveId: 'obj-other' })] }, ['obj-1']);
    expect(result.recommendedMode).toBeNull();
    expect(result.objectiveIds).toEqual([]);
  });

  it('ignores evidence when the learner disallowed assessment evidence', () => {
    const result = evaluate({
      preferences: prefs({ allowAssessmentEvidence: false }),
      evidence: [evidence({ mastered: false })],
    });
    expect(result.recommendedMode).toBeNull();
    expect(result.reason).toBe('neutral_default');
  });

  it('never recommends from a non-assessment evidence class', () => {
    const result = evaluate({
      evidence: [
        evidence({ evidenceClass: 'interaction_state' }),
        evidence({ evidenceClass: 'inference' }),
      ],
    });
    expect(result.recommendedMode).toBeNull();
    expect(result.reason).toBe('neutral_default');
  });

  it('names only objectives that genuinely lack mastery', () => {
    const result = evaluate({
      evidence: [
        evidence({ objectiveId: 'obj-1', mastered: false }),
        evidence({ objectiveId: 'obj-2', mastered: true }),
      ],
    }, ['obj-1', 'obj-2']);
    expect(result.objectiveIds).toEqual(['obj-1']);
  });
});

describe('rule 7 — insufficient evidence', () => {
  it('returns a neutral default with no reason to show', () => {
    const result = evaluate();
    expect(result.recommendedMode).toBeNull();
    expect(result.reason).toBe('neutral_default');
    expect(result.eligibleModes).toEqual(allModes);
  });
});

describe('determinism and explainability', () => {
  it('produces an identical record for identical input', () => {
    const a = evaluate({ evidence: [evidence()] });
    const b = evaluate({ evidence: [evidence()] });
    expect(a).toEqual(b);
  });

  it('changes the fingerprint when the evidence changes', () => {
    const base = {
      courseId,
      revisionId,
      lessonId,
      preferences: prefs(),
      availableModes: allModes,
    };
    const a = adaptationFingerprint({ ...base, evidence: [evidence({ mastered: false })] });
    const b = adaptationFingerprint({ ...base, evidence: [evidence({ mastered: true })] });
    expect(a).not.toBe(b);
  });

  it('sets an expiry so a stale suggestion is recomputed', () => {
    const result = evaluate();
    expect(Date.parse(result.expiresAt) - Date.parse(result.generatedAt)).toBe(ADAPTATION_TTL_MS);
  });

  it('surfaces only a real suggestion that differs from the current mode', () => {
    const suggested = evaluate({ preferences: prefs({ preferredMode: 'guided' }) });
    expect(shouldSurface(suggested, 'read')).toBe(true);
    expect(shouldSurface(suggested, 'guided')).toBe(false);
    const none = evaluate();
    expect(shouldSurface(none, 'read')).toBe(false);
  });
});

describe('the record validates strictly', () => {
  const binding = { courseId, revisionId, lessonId };

  it('accepts a well-formed record', () => {
    const record = evaluate({ preferences: prefs({ preferredMode: 'guided' }) });
    expect(parseLearningAdaptation(record, binding).recommendedMode).toBe('guided');
  });

  it('rejects a record for another course or revision', () => {
    const record = evaluate();
    expect(() => parseLearningAdaptation(record, { ...binding, courseId: '1b083a5b-c476-5351-93ed-34d5f0615103' })).toThrow();
    expect(() => parseLearningAdaptation(record, { ...binding, revisionId: 'rev_other' })).toThrow();
    expect(() => parseLearningAdaptation(record, { ...binding, lessonId: 'lesson-2' })).toThrow();
  });

  it('rejects an unknown field', () => {
    const record = evaluate();
    expect(() =>
      parseLearningAdaptation({ ...record, inferredAbility: 'high' }, binding),
    ).toThrow();
  });

  it('rejects a recommendation for a mode that is not eligible', () => {
    const record = evaluate({ preferences: prefs({ preferredMode: 'guided' }) });
    expect(() =>
      parseLearningAdaptation({ ...record, eligibleModes: ['read'] }, binding),
    ).toThrow();
  });

  it('rejects a recommendation without a reason', () => {
    const record = evaluate({ preferences: prefs({ preferredMode: 'guided' }) });
    expect(() => parseLearningAdaptation({ ...record, reason: null }, binding)).toThrow();
  });

  it('rejects a silent record claiming an actionable reason', () => {
    // Only the two neutral reasons may accompany "no recommendation".
    const neutral = evaluate();
    for (const reason of ['explicit_preference', 'objective_not_yet_mastered', 'guided_requested'])
      expect(() => parseLearningAdaptation({ ...neutral, reason }, binding)).toThrow();
  });

  it('accepts a neutral record that explains its own silence', () => {
    const neutral = evaluate();
    expect(parseLearningAdaptation(neutral, binding).recommendedMode).toBeNull();
    expect(neutral.reason).toBe('neutral_default');
  });

  it('rejects a recommendation carrying a neutral reason', () => {
    const record = evaluate({ preferences: prefs({ preferredMode: 'guided' }) });
    expect(() =>
      parseLearningAdaptation({ ...record, reason: 'neutral_default' }, binding),
    ).toThrow();
  });

  it('rejects an unknown reason code', () => {
    const record = evaluate({ preferences: prefs({ preferredMode: 'guided' }) });
    expect(() =>
      parseLearningAdaptation({ ...record, reason: 'learner_is_struggling' }, binding),
    ).toThrow();
  });
});

describe('preference parsing', () => {
  it('accepts a partial update', () => {
    expect(parsePreferences({ preferDetailedProofs: true })).toEqual({
      preferDetailedProofs: true,
    });
  });

  it('rejects an unknown field rather than silently dropping it', () => {
    expect(() => parsePreferences({ learningStyle: 'visual' })).toThrow();
  });

  it('rejects an unsupported mode', () => {
    expect(() => parsePreferences({ preferredMode: 'immersive' })).toThrow();
  });

  it('never accepts a learning-style classification', () => {
    for (const key of ['visual', 'auditory', 'kinesthetic', 'abilityLevel', 'masteryScore'])
      expect(() => parsePreferences({ [key]: true })).toThrow();
  });
});
