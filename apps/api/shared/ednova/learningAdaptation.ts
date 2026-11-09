/** Evidence-based learner adaptation contract (Batch 4, Milestone 4.4).
 *
 * Four things are deliberately kept apart:
 *
 *   1. immutable canonical content          — never touched here
 *   2. validated presentation plans         — consumed, never authored here
 *   3. observed, authorized learning evidence — read, never fabricated
 *   4. student-selected preferences         — respected, always overridable
 *
 * A recommendation is a *suggestion with a stated reason*, not a judgment about
 * a learner. This module carries no ability estimate, no mastery score, no
 * psychological label and no reading-time heuristic, because inventing any of
 * those would be exactly the harm the milestone forbids.
 *
 * The reason vocabulary is closed. A recommendation that cannot name one of
 * these codes has no reason and must not be shown.
 */

import { isLearningMode, type LearningMode } from './learningModes';

export const LEARNING_ADAPTATION_SCHEMA_VERSION = '1.0.0' as const;

/** Bumped when the policy rules change, so a stored recommendation can be told
 * apart from one produced by different logic. */
export const ADAPTATION_POLICY_VERSION = '1.0.0' as const;

/** Preference schema, versioned separately: preferences outlive a policy. */
export const ADAPTATION_PREFERENCE_VERSION = '1.0.0' as const;

/**
 * Why a mode was recommended.
 *
 * Each code answers a question a learner could ask, and each is backed by
 * something the application actually knows. `explicit_preference` is the
 * learner's own request; the rest cite trusted evidence or a concrete
 * capability of the lesson.
 */
export const ADAPTATION_REASONS = [
  /** The learner asked for this mode and the lesson supports it. */
  'explicit_preference',
  /** The learner asked for more explanation; a guided arrangement exists. */
  'guided_requested',
  /** The learner asked for proofs; the lesson has source-backed proof material. */
  'proof_material_requested',
  /** The learner prefers visual exploration and an eligible asset exists. */
  'visual_asset_available',
  /** Accepted evidence shows an objective not yet mastered, and this lesson
   * covers it. Deliberately phrased as "not yet mastered", never as a deficit. */
  'objective_not_yet_mastered',
  /** No eligible evidence and no preference: a neutral default, stated as such. */
  'neutral_default',
  /** The learner's preference could not be honoured because the lesson lacks
   * the material it needs. Explains a limitation rather than inventing one. */
  'preference_unavailable_for_lesson',
] as const;

export type AdaptationReason = (typeof ADAPTATION_REASONS)[number];

/**
 * Evidence classes. Only `accepted_assessment` may influence a recommendation.
 *
 * The others are recorded so the application can explain what it did *not*
 * use — a learner who reads a lesson has not demonstrated understanding, and
 * saying so plainly is better than silently treating a page view as progress.
 */
export const EVIDENCE_CLASSES = [
  'accepted_assessment',
  'explicit_preference',
  'interaction_state',
  'inference',
] as const;
export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];

/** A single piece of trusted evidence, as the policy sees it. Identity and
 * verdict only: never the learner's answers, never another student's row. */
export type AdaptationEvidence = {
  /** Which class this is. Only accepted_assessment is decision-grade. */
  evidenceClass: EvidenceClass;
  courseId: string;
  revisionId: string;
  /** Objective the evidence speaks to, when it names one. */
  objectiveId: string | null;
  /** True only for a trusted review verdict that the objective was met. */
  mastered: boolean;
  /** Version of the evaluator that produced it, for auditability. */
  evaluatorVersion: string;
};

/**
 * The learner's explicit, editable preferences.
 *
 * Every field is optional. Absence means "no preference", which is different
 * from "false": a learner who has never chosen gets neutral behaviour, not a
 * default that looks like a choice they made.
 */
export type AdaptationPreferences = {
  /** Whether to show evidence-based recommendations at all. */
  recommendationsEnabled: boolean;
  /** Whether accepted assessment outcomes may inform a recommendation. */
  allowAssessmentEvidence: boolean;
  /** A mode the learner generally prefers, if any. */
  preferredMode: LearningMode | null;
  /** Prefer more worked examples when the lesson has them. */
  preferWorkedExamples: boolean;
  /** Prefer visual/interactive exploration when an asset is eligible. */
  preferVisualExploration: boolean;
  /** Prefer detailed proofs when the lesson has source-backed proof material. */
  preferDetailedProofs: boolean;
};

export const DEFAULT_PREFERENCES: AdaptationPreferences = Object.freeze({
  recommendationsEnabled: true,
  allowAssessmentEvidence: true,
  preferredMode: null,
  preferWorkedExamples: false,
  preferVisualExploration: false,
  preferDetailedProofs: false,
});

/** What the lesson can actually support. Supplied by the caller from trusted
 * presentation data; the policy never inspects content itself. */
export type LessonSupport = {
  /** A validated plan exists for this lesson and mode. */
  availableModes: readonly LearningMode[];
  /** A review-verified structured asset can be shown for this lesson. */
  hasEligibleAsset: boolean;
  /** Source-backed proof material exists (proof callouts or reviewed math). */
  hasProofMaterial: boolean;
  /** Source-backed worked examples exist (example/solution callouts). */
  hasWorkedExamples: boolean;
};

/** A recommendation, or an explicit statement that none applies. */
export type LearningAdaptationV1 = {
  schemaVersion: typeof LEARNING_ADAPTATION_SCHEMA_VERSION;
  policyVersion: typeof ADAPTATION_POLICY_VERSION;
  preferenceVersion: typeof ADAPTATION_PREFERENCE_VERSION;
  courseId: string;
  revisionId: string;
  lessonId: string;
  /** Deterministic fingerprint of the inputs that produced this record. */
  evidenceFingerprint: string;
  /** The suggested mode, or null when nothing is recommended. */
  recommendedMode: LearningMode | null;
  /** Modes the learner may switch to on this lesson. Always includes Read. */
  eligibleModes: LearningMode[];
  /** Why. Null exactly when `recommendedMode` is null. */
  reason: AdaptationReason | null;
  /** Objectives this recommendation rests on. Empty when none. */
  objectiveIds: string[];
  /** When the recommendation was produced. */
  generatedAt: string;
  /** Recommendations do not outlive their inputs; a stale one is recomputed. */
  expiresAt: string;
};

export class AdaptationValidationError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = 'AdaptationValidationError';
    this.code = code;
  }
}

const fail = (code: string): never => {
  throw new AdaptationValidationError(code);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

/** Strict parse of a stored or transmitted adaptation record. Unknown fields,
 * invalid modes and cross-revision identities all fail. */
export function parseLearningAdaptation(
  value: unknown,
  binding: { courseId: string; revisionId: string; lessonId: string },
): LearningAdaptationV1 {
  if (!isRecord(value)) return fail('INVALID_ADAPTATION');
  const allowed = [
    'schemaVersion',
    'policyVersion',
    'preferenceVersion',
    'courseId',
    'revisionId',
    'lessonId',
    'evidenceFingerprint',
    'recommendedMode',
    'eligibleModes',
    'reason',
    'objectiveIds',
    'generatedAt',
    'expiresAt',
  ];
  if (Object.keys(value).some((key) => !allowed.includes(key))) return fail('INVALID_ADAPTATION');
  if (value.schemaVersion !== LEARNING_ADAPTATION_SCHEMA_VERSION) fail('ADAPTATION_VERSION_UNSUPPORTED');

  const text = (input: unknown, max: number): string => {
    if (typeof input !== 'string' || !input || input.length > max) return fail('INVALID_ADAPTATION');
    return input;
  };

  // Identity is bound at the boundary: a record for another revision cannot be
  // presented as this one's.
  const courseId = text(value.courseId, 36);
  const revisionId = text(value.revisionId, 128);
  const lessonId = text(value.lessonId, 128);
  if (courseId !== binding.courseId) return fail('ADAPTATION_COURSE_MISMATCH');
  if (revisionId !== binding.revisionId) return fail('ADAPTATION_REVISION_MISMATCH');
  if (lessonId !== binding.lessonId) return fail('ADAPTATION_LESSON_MISMATCH');

  if (!Array.isArray(value.eligibleModes) || value.eligibleModes.length === 0)
    return fail('INVALID_ADAPTATION');
  const eligibleModes: LearningMode[] = [];
  for (const mode of value.eligibleModes) {
    if (!isLearningMode(mode)) return fail('INVALID_ADAPTATION');
    if (eligibleModes.includes(mode)) return fail('INVALID_ADAPTATION');
    eligibleModes.push(mode);
  }
  // Read is always available: it is the deterministic fallback, and a record
  // claiming otherwise would be describing a reader that cannot function.
  if (!eligibleModes.includes('read')) return fail('INVALID_ADAPTATION');

  const recommendedMode =
    value.recommendedMode === null
      ? null
      : isLearningMode(value.recommendedMode)
        ? value.recommendedMode
        : fail('INVALID_ADAPTATION');
  if (recommendedMode && !eligibleModes.includes(recommendedMode))
    return fail('ADAPTATION_RECOMMENDS_UNAVAILABLE_MODE');
  // Read is the neutral state, never a "recommendation".
  if (recommendedMode === 'read') return fail('INVALID_ADAPTATION');

  const reason =
    value.reason === null
      ? null
      : (ADAPTATION_REASONS as readonly unknown[]).includes(value.reason)
        ? (value.reason as AdaptationReason)
        : fail('INVALID_ADAPTATION');
  // A recommendation without a reason is not explainable and must not exist.
  // The neutral states are the exception: they carry `neutral_default` or
  // `preference_unavailable_for_lesson` so the UI can say *why* it is silent,
  // while recommending nothing. Any other reason without a mode is malformed.
  if (recommendedMode !== null && reason === null) return fail('INVALID_ADAPTATION');
  if (
    recommendedMode === null &&
    reason !== null &&
    reason !== 'neutral_default' &&
    reason !== 'preference_unavailable_for_lesson'
  )
    return fail('INVALID_ADAPTATION');
  if (recommendedMode !== null && reason === 'neutral_default')
    return fail('INVALID_ADAPTATION');

  if (!Array.isArray(value.objectiveIds) || value.objectiveIds.length > 32)
    return fail('INVALID_ADAPTATION');
  const objectiveIds = value.objectiveIds.map((id) => text(id, 128));
  if (new Set(objectiveIds).size !== objectiveIds.length) return fail('INVALID_ADAPTATION');

  const generatedAt = text(value.generatedAt, 40);
  const expiresAt = text(value.expiresAt, 40);
  if (!Number.isFinite(Date.parse(generatedAt)) || !Number.isFinite(Date.parse(expiresAt)))
    return fail('INVALID_ADAPTATION');

  return {
    schemaVersion: LEARNING_ADAPTATION_SCHEMA_VERSION,
    policyVersion: text(value.policyVersion, 32) as typeof ADAPTATION_POLICY_VERSION,
    preferenceVersion: text(value.preferenceVersion, 32) as typeof ADAPTATION_PREFERENCE_VERSION,
    courseId,
    revisionId,
    lessonId,
    evidenceFingerprint: text(value.evidenceFingerprint, 71),
    recommendedMode,
    eligibleModes,
    reason,
    objectiveIds,
    generatedAt,
    expiresAt,
  };
}

/** Strict parse of learner-supplied preferences. Every field is optional, and
 * an unknown field is a rejection rather than a silently dropped setting. */
export function parsePreferences(value: unknown): Partial<AdaptationPreferences> {
  if (!isRecord(value)) return fail('INVALID_PREFERENCES');
  const allowed = [
    'recommendationsEnabled',
    'allowAssessmentEvidence',
    'preferredMode',
    'preferWorkedExamples',
    'preferVisualExploration',
    'preferDetailedProofs',
  ];
  if (Object.keys(value).some((key) => !allowed.includes(key))) return fail('INVALID_PREFERENCES');

  const bool = (input: unknown): boolean => {
    if (typeof input !== 'boolean') return fail('INVALID_PREFERENCES');
    return input;
  };

  const parsed: Partial<AdaptationPreferences> = {};
  if (value.recommendationsEnabled !== undefined)
    parsed.recommendationsEnabled = bool(value.recommendationsEnabled);
  if (value.allowAssessmentEvidence !== undefined)
    parsed.allowAssessmentEvidence = bool(value.allowAssessmentEvidence);
  if (value.preferredMode !== undefined) {
    if (value.preferredMode !== null && !isLearningMode(value.preferredMode))
      return fail('INVALID_PREFERENCES');
    parsed.preferredMode = value.preferredMode as LearningMode | null;
  }
  if (value.preferWorkedExamples !== undefined)
    parsed.preferWorkedExamples = bool(value.preferWorkedExamples);
  if (value.preferVisualExploration !== undefined)
    parsed.preferVisualExploration = bool(value.preferVisualExploration);
  if (value.preferDetailedProofs !== undefined)
    parsed.preferDetailedProofs = bool(value.preferDetailedProofs);
  return parsed;
}
