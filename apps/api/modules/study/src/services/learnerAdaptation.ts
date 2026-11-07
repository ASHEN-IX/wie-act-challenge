/** Learner adaptation service (Batch 4, Milestone 4.4).
 *
 * Owns the *trusted* half of adaptation: reading the learner's preferences,
 * filtering evidence down to what may legitimately inform a recommendation, and
 * resolving what the lesson can actually support. The decision itself is made
 * by the pure policy in `adaptationPolicy.ts`.
 *
 * Evidence rules, enforced here because they need the database:
 *
 *   - only the authenticated learner's rows
 *   - only this course and this exact revision
 *   - only accepted evidence from a known evaluator
 *   - never another student's row, never a bare page view, never a timer
 *
 * Adaptation never dispatches a provider request. It reads plans and decides
 * which existing mode to suggest; it never creates one.
 */

import crypto from 'node:crypto';
import { LearnerAdaptationPreference } from '../models/LearnerAdaptationPreference';
import { LearningEvidence } from '../models/LearningEvidence';
import {
  DEFAULT_PREFERENCES,
  parsePreferences,
  type AdaptationEvidence,
  type AdaptationPreferences,
} from '../../../../shared/ednova/learningAdaptation';
import {
  adaptationFingerprint,
  evaluateAdaptation,
  shouldSurface,
  type PolicyInput,
} from '../../../../shared/ednova/adaptationPolicy';
import type { LearningAdaptationV1 } from '../../../../shared/ednova/learningAdaptation';
import type { LearningMode } from '../../../../shared/ednova/learningModes';
import { peekStoredPlan } from './experiencePlanStore';
import { StructuredAsset } from '../models/StructuredAsset';
import { verifyReviewProvenance } from './assetReviewProvenance';
import { parseStructuredAsset } from '../../../../shared/ednova/structuredAsset';

export class AdaptationConflictError extends Error {
  readonly status = 409;
  readonly code = 'PREFERENCE_VERSION_CONFLICT';
  constructor() {
    super('PREFERENCE_VERSION_CONFLICT');
    this.name = 'AdaptationConflictError';
  }
}

export type StoredPreferences = {
  preferences: AdaptationPreferences;
  version: number;
  dismissed: Array<{ courseId: string; revisionId: string; lessonId: string; mode: string }>;
};

/** Read a learner's preferences. Absent means defaults with version 0, so a
 * learner who has never opened settings behaves as if nothing was chosen. */
export async function readPreferences(userId: string): Promise<StoredPreferences> {
  const row = await LearnerAdaptationPreference.findOne({ userId }).lean();
  if (!row)
    return { preferences: { ...DEFAULT_PREFERENCES }, version: 0, dismissed: [] };
  return {
    preferences: {
      recommendationsEnabled: row.recommendationsEnabled,
      allowAssessmentEvidence: row.allowAssessmentEvidence,
      preferredMode: (row.preferredMode as LearningMode | null) ?? null,
      preferWorkedExamples: row.preferWorkedExamples,
      preferVisualExploration: row.preferVisualExploration,
      preferDetailedProofs: row.preferDetailedProofs,
    },
    version: row.version,
    dismissed: (row.dismissed ?? []).map((entry) => ({
      courseId: entry.courseId,
      revisionId: entry.revisionId,
      lessonId: entry.lessonId,
      mode: entry.mode,
    })),
  };
}

/**
 * Save preferences with optimistic concurrency.
 *
 * A caller must present the version it read. If another tab already advanced
 * it, the write is rejected rather than silently overwriting a choice the
 * learner made elsewhere.
 */
export async function savePreferences(
  userId: string,
  input: unknown,
  expectedVersion: number,
): Promise<{ preferences: AdaptationPreferences; version: number }> {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0)
    throw new AdaptationConflictError();
  const patch = parsePreferences(input);

  const existing = await LearnerAdaptationPreference.findOne({ userId }).lean();
  const currentVersion = existing?.version ?? 0;
  if (currentVersion !== expectedVersion) throw new AdaptationConflictError();

  const base = existing
    ? {
        recommendationsEnabled: existing.recommendationsEnabled,
        allowAssessmentEvidence: existing.allowAssessmentEvidence,
        preferredMode: existing.preferredMode,
        preferWorkedExamples: existing.preferWorkedExamples,
        preferVisualExploration: existing.preferVisualExploration,
        preferDetailedProofs: existing.preferDetailedProofs,
      }
    : { ...DEFAULT_PREFERENCES };

  const next = {
    userId,
    version: currentVersion + 1,
    ...base,
    ...patch,
  };

  // Conditional on the version we read, so a concurrent write loses cleanly.
  const updated = await LearnerAdaptationPreference.findOneAndUpdate(
    { userId, version: currentVersion },
    { $set: next },
    { upsert: currentVersion === 0, new: true },
  ).lean();
  if (!updated) throw new AdaptationConflictError();

  return {
    preferences: {
      recommendationsEnabled: updated.recommendationsEnabled,
      allowAssessmentEvidence: updated.allowAssessmentEvidence,
      preferredMode: (updated.preferredMode as LearningMode | null) ?? null,
      preferWorkedExamples: updated.preferWorkedExamples,
      preferVisualExploration: updated.preferVisualExploration,
      preferDetailedProofs: updated.preferDetailedProofs,
    },
    version: updated.version,
  };
}

/** Reset a learner's preferences. Deletes rather than zeroing, so "never chose"
 * and "chose the defaults" stay distinguishable. */
export async function resetPreferences(userId: string): Promise<void> {
  await LearnerAdaptationPreference.deleteOne({ userId });
}

/** Record that a learner dismissed a suggestion for this lesson and mode. */
export async function dismissRecommendation(
  userId: string,
  input: { courseId: string; revisionId: string; lessonId: string; mode: string },
): Promise<void> {
  await LearnerAdaptationPreference.updateOne(
    { userId },
    {
      $push: {
        dismissed: {
          $each: [{ ...input, at: new Date() }],
          // Bounded: dismissals are a UI courtesy, not a history.
          $slice: -50,
        },
      },
      $setOnInsert: { userId, version: 0 },
    },
    { upsert: true },
  );
}

/**
 * Load evidence eligible to inform a recommendation.
 *
 * Bounded query, exact revision, accepted status only, own rows only. The
 * returned records carry identity and verdict — never the learner's answers.
 */
export async function loadEligibleEvidence(input: {
  userId: string;
  courseId: string;
  revisionId: string;
}): Promise<AdaptationEvidence[]> {
  const rows = await LearningEvidence.find({
    userId: input.userId,
    'activity.courseId': input.courseId,
    'activity.revisionId': input.revisionId,
    status: 'accepted',
  })
    .select({
      'activity.revisionId': 1,
      objectiveId: 1,
      masteryAchieved: 1,
      'evaluator.type': 1,
      'evaluator.validationVersion': 1,
    })
    .limit(200)
    .lean();

  return rows
    .filter((row) => row.activity?.revisionId === input.revisionId)
    .map((row) => ({
      evidenceClass: 'accepted_assessment' as const,
      courseId: input.courseId,
      revisionId: input.revisionId,
      objectiveId: row.objectiveId ?? null,
      mastered: row.masteryAchieved === true,
      evaluatorVersion: row.evaluator?.validationVersion ?? 'unknown',
    }));
}

/**
 * Which modes have a validated plan, and what the lesson can support.
 *
 * Reads the durable plan store and the review-verified assets. It never
 * generates a plan: a mode without one is simply not offered.
 */
export async function resolveLessonSupport(input: {
  courseId: string;
  revisionId: string;
  lessonId: string;
  contentHash: string;
  modes: readonly LearningMode[];
  hasProofMaterial: boolean;
  hasWorkedExamples: boolean;
}): Promise<{
  availableModes: LearningMode[];
  hasEligibleAsset: boolean;
}> {
  const availableModes: LearningMode[] = [];
  for (const mode of input.modes) {
    if (mode === 'read') {
      availableModes.push('read');
      continue;
    }
    // Look up by scope: a stored plan's context fingerprint depends on the
    // block list, and availability does not require reconstructing it.
    const found = await peekStoredPlan({
      courseId: input.courseId,
      revisionId: input.revisionId,
      lessonId: input.lessonId,
      mode,
    });
    if (found) availableModes.push(mode);
  }

  // An asset only counts when its review is backed by a persisted decision.
  const rows = await StructuredAsset.find({
    courseId: input.courseId,
    revisionId: input.revisionId,
    lessonId: input.lessonId,
  })
    .limit(50)
    .lean();
  let hasEligibleAsset = false;
  for (const row of rows) {
    try {
      const asset = parseStructuredAsset(row);
      const provenance = await verifyReviewProvenance([asset], {
        courseId: input.courseId,
        revisionId: input.revisionId,
        lessonId: input.lessonId,
      });
      if (provenance.get(asset.assetId)?.verified) {
        hasEligibleAsset = true;
        break;
      }
    } catch {
      // A malformed asset is simply not eligible.
    }
  }

  return { availableModes, hasEligibleAsset };
}

export type AdaptationResult = {
  adaptation: LearningAdaptationV1;
  surface: boolean;
  preferenceVersion: number;
};

/**
 * Produce the recommendation for one lesson.
 *
 * Everything it needs is passed in from trusted sources; the caller has already
 * authorized the student and pinned the exact revision.
 */
export async function recommendForLesson(input: {
  userId: string;
  courseId: string;
  revisionId: string;
  lessonId: string;
  contentHash: string;
  currentMode: LearningMode;
  lessonObjectiveIds: readonly string[];
  hasProofMaterial: boolean;
  hasWorkedExamples: boolean;
  now?: Date;
}): Promise<AdaptationResult> {
  const stored = await readPreferences(input.userId);
  const evidence = stored.preferences.allowAssessmentEvidence
    ? await loadEligibleEvidence({
        userId: input.userId,
        courseId: input.courseId,
        revisionId: input.revisionId,
      })
    : [];

  const support = await resolveLessonSupport({
    courseId: input.courseId,
    revisionId: input.revisionId,
    lessonId: input.lessonId,
    contentHash: input.contentHash,
    modes: ['read', 'guided', 'explore', 'practice', 'deep_dive'],
    hasProofMaterial: input.hasProofMaterial,
    hasWorkedExamples: input.hasWorkedExamples,
  });

  const policyInput: PolicyInput = {
    courseId: input.courseId,
    revisionId: input.revisionId,
    lessonId: input.lessonId,
    currentMode: input.currentMode,
    preferences: stored.preferences,
    evidence,
    support: {
      availableModes: support.availableModes,
      hasEligibleAsset: support.hasEligibleAsset,
      hasProofMaterial: input.hasProofMaterial,
      hasWorkedExamples: input.hasWorkedExamples,
    },
    evidenceFingerprint: adaptationFingerprint({
      courseId: input.courseId,
      revisionId: input.revisionId,
      lessonId: input.lessonId,
      preferences: stored.preferences,
      evidence,
      availableModes: support.availableModes,
    }),
    ...(input.now ? { now: input.now } : {}),
  };

  const adaptation = evaluateAdaptation(policyInput, input.lessonObjectiveIds);
  const dismissed = stored.dismissed.some(
    (entry) =>
      entry.courseId === input.courseId &&
      entry.revisionId === input.revisionId &&
      entry.lessonId === input.lessonId &&
      entry.mode === adaptation.recommendedMode,
  );
  return {
    adaptation,
    surface: shouldSurface(adaptation, input.currentMode) && !dismissed,
    preferenceVersion: stored.version,
  };
}

/** Deterministic student-safe reference. Never an internal row id. */
export function adaptationReference(input: {
  courseId: string;
  revisionId: string;
  lessonId: string;
}): string {
  return (
    'adp_' +
    crypto
      .createHash('sha256')
      .update(JSON.stringify([input.courseId, input.revisionId, input.lessonId]))
      .digest('hex')
      .slice(0, 16)
  );
}
