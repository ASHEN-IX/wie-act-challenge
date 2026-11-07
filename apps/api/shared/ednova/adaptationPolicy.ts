/** Deterministic adaptation policy (Batch 4, Milestone 4.4).
 *
 * Pure, ordered rules over (preferences, eligible evidence, lesson support).
 * Same input always yields the same record, and every record names one reason
 * from the closed vocabulary — so a learner can always ask "why?" and get a
 * real answer.
 *
 * Order matters and is the policy:
 *
 *   1. recommendations disabled      → nothing is recommended at all
 *   2. explicit mode preference      → honour it, or explain why it cannot be
 *   3. guided request                → Guided, when the lesson supports it
 *   4. proof request                 → Deep Dive, when proof material exists
 *   5. visual request                → Explore, when an eligible asset exists
 *   6. accepted evidence             → the lesson covering an objective the
 *                                      learner has not yet mastered
 *   7. otherwise                     → neutral default, stated as such
 *
 * Rules 2–5 are the learner talking. Rule 6 is evidence, and it runs last so a
 * preference is never overridden by an assessment outcome: the student stays in
 * control.
 */

import {
  ADAPTATION_POLICY_VERSION,
  ADAPTATION_PREFERENCE_VERSION,
  DEFAULT_PREFERENCES,
  LEARNING_ADAPTATION_SCHEMA_VERSION,
  type AdaptationEvidence,
  type AdaptationPreferences,
  type AdaptationReason,
  type LearningAdaptationV1,
  type LessonSupport,
} from './learningAdaptation';
import type { LearningMode } from './learningModes';

/** How long a recommendation stays valid before the caller recomputes it.
 * Short by design: evidence and lesson availability both move. */
export const ADAPTATION_TTL_MS = 15 * 60 * 1000;

export type PolicyInput = {
  courseId: string;
  revisionId: string;
  lessonId: string;
  /** The mode the learner is currently on. Read is the neutral state. */
  currentMode: LearningMode;
  preferences: AdaptationPreferences;
  /** Trusted evidence, already filtered for ownership/course/revision. */
  evidence: readonly AdaptationEvidence[];
  support: LessonSupport;
  /** Deterministic fingerprint of the inputs, supplied by the caller. */
  evidenceFingerprint: string;
  /** Injected for tests; production passes the clock. */
  now?: Date;
};

/** Objective ids from accepted evidence where the objective was NOT mastered,
 * for objectives this lesson actually teaches. */
function unmasteredObjectivesForLesson(
  input: PolicyInput,
  lessonObjectiveIds: readonly string[],
): string[] {
  const mastered = new Set(
    input.evidence
      .filter((entry) => entry.evidenceClass === 'accepted_assessment' && entry.mastered)
      .map((entry) => entry.objectiveId)
      .filter((id): id is string => Boolean(id)),
  );
  // Only an objective the lesson teaches can be met by *this* lesson, and only
  // an objective with accepted evidence that it is not yet mastered is a
  // legitimate reason to suggest something.
  const seen = new Set<string>();
  const pending: string[] = [];
  for (const entry of input.evidence) {
    if (entry.evidenceClass !== 'accepted_assessment') continue;
    if (entry.mastered) continue;
    const id = entry.objectiveId;
    if (!id || seen.has(id)) continue;
    if (!lessonObjectiveIds.includes(id)) continue;
    if (mastered.has(id)) continue;
    seen.add(id);
    pending.push(id);
  }
  return pending;
}

function build(
  input: PolicyInput,
  recommendedMode: LearningMode | null,
  reason: AdaptationReason | null,
  objectiveIds: string[],
): LearningAdaptationV1 {
  const now = input.now ?? new Date();
  const eligibleModes = ['read', ...input.support.availableModes.filter((mode) => mode !== 'read')];
  return {
    schemaVersion: LEARNING_ADAPTATION_SCHEMA_VERSION,
    policyVersion: ADAPTATION_POLICY_VERSION,
    preferenceVersion: ADAPTATION_PREFERENCE_VERSION,
    courseId: input.courseId,
    revisionId: input.revisionId,
    lessonId: input.lessonId,
    evidenceFingerprint: input.evidenceFingerprint,
    recommendedMode,
    eligibleModes: [...new Set(eligibleModes)] as LearningMode[],
    reason,
    objectiveIds,
    generatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ADAPTATION_TTL_MS).toISOString(),
  };
}

/**
 * Evaluate the policy.
 *
 * `lessonObjectiveIds` is the set of objectives this lesson actually teaches,
 * derived server-side from the published revision. Passing it in keeps the
 * policy pure and prevents it from ever claiming a lesson covers something it
 * does not.
 */
export function evaluateAdaptation(
  input: PolicyInput,
  lessonObjectiveIds: readonly string[],
): LearningAdaptationV1 {
  const preferences = { ...DEFAULT_PREFERENCES, ...input.preferences };
  const available = new Set(input.support.availableModes);

  // Rule 1 — the learner turned recommendations off. Say nothing.
  if (!preferences.recommendationsEnabled) return build(input, null, null, []);

  // Rule 2 — an explicit mode preference. Honoured when available; otherwise
  // the learner is told the lesson cannot support it, rather than being
  // silently given something else.
  if (preferences.preferredMode && preferences.preferredMode !== 'read') {
    const wanted = preferences.preferredMode;
    if (available.has(wanted)) return build(input, wanted, 'explicit_preference', []);
    return build(input, null, 'preference_unavailable_for_lesson', []);
  }

  // Rule 3 — an explicit request for more explanation. Guided needs no special
  // content beyond what the lesson already has, so it is offered whenever a
  // validated Guided plan exists.
  if (preferences.preferWorkedExamples && input.support.hasWorkedExamples && available.has('guided'))
    return build(input, 'guided', 'guided_requested', []);

  // Rule 4 — a request for detailed proofs, when the lesson has them.
  if (preferences.preferDetailedProofs && input.support.hasProofMaterial && available.has('deep_dive'))
    return build(input, 'deep_dive', 'proof_material_requested', []);

  // Rule 5 — a request for visual exploration, when an eligible asset exists.
  // Without the asset, Explore would render exactly Read, so it is not offered.
  if (preferences.preferVisualExploration && input.support.hasEligibleAsset && available.has('explore'))
    return build(input, 'explore', 'visual_asset_available', []);

  // Rule 6 — accepted assessment evidence for an objective this lesson teaches
  // that the learner has not yet mastered. This is the only evidence-driven
  // rule, it runs after every preference, and it recommends an *existing*
  // source-backed mode rather than asserting anything about the learner.
  if (preferences.allowAssessmentEvidence) {
    const pending = unmasteredObjectivesForLesson(input, lessonObjectiveIds);
    if (pending.length > 0) {
      // Prefer a source-backed explanation. Guided is that arrangement; fall
      // back to staying put when no plan exists.
      if (available.has('guided')) return build(input, 'guided', 'objective_not_yet_mastered', pending);
      return build(input, null, 'neutral_default', pending);
    }
  }

  // Rule 7 — nothing to say. A neutral default, explicitly labelled as such so
  // the UI never presents invented personalisation.
  return build(input, null, 'neutral_default', []);
}

/**
 * Whether a recommendation should be surfaced to the learner.
 *
 * Deliberately narrow: a recommendation identical to the lesson the learner is
 * already on is noise, and a memory-only suggestion is not shown.
 */
export function shouldSurface(
  adaptation: LearningAdaptationV1,
  currentMode: LearningMode,
): boolean {
  if (!adaptation.recommendedMode) return false;
  if (adaptation.recommendedMode === currentMode) return false;
  return adaptation.reason !== null;
}

/** Deterministic fingerprint of the inputs a recommendation rests on, so a
 * stored recommendation can be detected as stale. */
export function adaptationFingerprint(input: {
  courseId: string;
  revisionId: string;
  lessonId: string;
  preferences: AdaptationPreferences;
  evidence: readonly AdaptationEvidence[];
  availableModes: readonly LearningMode[];
}): string {
  const payload = JSON.stringify([
    input.courseId,
    input.revisionId,
    input.lessonId,
    [
      input.preferences.recommendationsEnabled,
      input.preferences.allowAssessmentEvidence,
      input.preferences.preferredMode,
      input.preferences.preferWorkedExamples,
      input.preferences.preferVisualExploration,
      input.preferences.preferDetailedProofs,
    ],
    input.evidence
      .map((entry) => [entry.evidenceClass, entry.objectiveId, entry.mastered, entry.evaluatorVersion])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    [...input.availableModes].sort(),
  ]);
  let state = 14695981039346656037n;
  const prime = 1099511628211n;
  for (let index = 0; index < payload.length; index += 1) {
    state ^= BigInt(payload.charCodeAt(index));
    state = (state * prime) & 0xffffffffffffffffn;
  }
  return 'fnv1a64:' + state.toString(16).padStart(16, '0');
}
