/** Durable accepted-plan storage and the revalidating read path (M4.3).
 *
 * A stored plan is **not** trusted. The validated-plan brand is a module-private
 * symbol and does not survive serialization, so a record read from MongoDB is as
 * untrusted as raw provider output. Every read therefore re-runs the whole
 * trusted pipeline against current records:
 *
 *   authorize → resolve exact revision → verify canonical/presentation integrity
 *   → parse the stored plan → check schema/registry compatibility
 *   → recheck eligible assets and persisted review decisions
 *   → rerun the seven-stage validator → return the plan or fall back
 *
 * This is what stops an old cached plan from bypassing review governance: if an
 * approval was revoked or an asset edited since the plan was accepted, the same
 * record now fails and the reader falls back.
 */

import crypto from 'node:crypto';
import { ExperiencePlanRecord, type IExperiencePlanRecord } from '../models/ExperiencePlanRecord';
import {
  parseExperiencePlanProposal,
  type ExperiencePlanValidationContext,
  type ValidatedLearningExperiencePlan
} from '../../../../shared/ednova/experiencePlan';
import { tryValidateExperiencePlan } from '../../../../shared/ednova/experiencePlanValidator';
import { parsePublishedExperiencePlan } from '../../../../shared/ednova/publishedExperiencePlan';
import { recordEvent } from './planningMetrics';
import type { PublishedExperiencePlanV1 } from './experiencePlanning';
import { projectExperiencePlan } from './experiencePlanning';
import { COMPONENT_REGISTRY_VERSION } from '../../../../shared/ednova/componentRegistry';
import { PRESENTATION_SCHEMA_VERSION } from '../../../../shared/ednova/presentationDocument';
import { EXPERIENCE_PLAN_SCHEMA_VERSION } from '../../../../shared/ednova/experiencePlan';
import type { LearningMode } from '../../../../shared/ednova/learningModes';

/** Deterministic plan identity. One accepted plan per scope. */
export function experiencePlanId(input: {
  courseId: string;
  revisionId: string;
  lessonId: string;
  mode: string;
  contextFingerprint: string;
}): string {
  return (
    'plan_' +
    crypto
      .createHash('sha256')
      .update(
        JSON.stringify([
          input.courseId,
          input.revisionId,
          input.lessonId,
          input.mode,
          input.contextFingerprint
        ])
      )
      .digest('hex')
      .slice(0, 32)
  );
}

export type StoreOutcome =
  | { stored: true; planId: string }
  | { stored: false; reason: 'not_validated' | 'identity_mismatch' };

/**
 * Persist an accepted plan.
 *
 * Only a branded validated plan can reach here — `projectExperiencePlan` refuses
 * anything else, and callers pass the plan the validator returned. The row keeps
 * the accepted body so a later read can revalidate it, plus the identities that
 * make it checkable against current records.
 */
export async function storeAcceptedPlan(input: {
  plan: ValidatedLearningExperiencePlan;
  generatedBy: string;
  contextFingerprint: string;
  mode: LearningMode;
}): Promise<StoreOutcome> {
  let projected: PublishedExperiencePlanV1;
  try {
    projected = projectExperiencePlan(input.plan);
  } catch {
    // Brand check failed: this is not a validated plan.
    return { stored: false, reason: 'not_validated' };
  }

  if (projected.contextFingerprint !== input.contextFingerprint)
    return { stored: false, reason: 'identity_mismatch' };

  const planId = experiencePlanId({
    courseId: projected.courseId,
    revisionId: projected.revisionId,
    lessonId: projected.lessonId,
    mode: projected.mode,
    contextFingerprint: projected.contextFingerprint
  });

  const now = new Date();
  // Supersede any previous accepted plan for the same scope, so "which plan
  // applies" is never ambiguous.
  await ExperiencePlanRecord.updateMany(
    {
      courseId: projected.courseId,
      revisionId: projected.revisionId,
      lessonId: projected.lessonId,
      mode: projected.mode,
      supersededAt: { $exists: false }
    },
    { $set: { supersededAt: now, supersededByPlanId: planId } }
  );

  await ExperiencePlanRecord.findOneAndUpdate(
    {
      courseId: projected.courseId,
      revisionId: projected.revisionId,
      lessonId: projected.lessonId,
      mode: projected.mode,
      contextFingerprint: projected.contextFingerprint
    },
    {
      $set: {
        planId,
        courseId: projected.courseId,
        revisionId: projected.revisionId,
        lessonId: projected.lessonId,
        mode: projected.mode,
        contentHash: projected.contentHash,
        contextFingerprint: projected.contextFingerprint,
        planSchemaVersion: projected.schemaVersion,
        registryVersion: COMPONENT_REGISTRY_VERSION,
        presentationSchemaVersion: PRESENTATION_SCHEMA_VERSION,
        provider: projected.planner.implementation,
        providerModel: projected.planner.version,
        plannerImplementation: projected.planner.implementation,
        plannerVersion: projected.planner.version,
        planDigest: projected.digest,
        plan: projected,
        generatedBy: input.generatedBy,
        generatedAt: now
      },
      $unset: { supersededAt: 1, supersededByPlanId: 1, invalidatedAt: 1, invalidationReason: 1 }
    },
    { upsert: true, new: true }
  );

  return { stored: true, planId };
}

export type LoadOutcome =
  | { status: 'available'; plan: PublishedExperiencePlanV1 }
  | { status: 'absent' }
  | { status: 'stale'; reason: string }
  | { status: 'rejected'; code: string; stage: string };

/**
 * Load and revalidate a stored plan against current trusted records.
 *
 * `validationContext` must be built from the live revision and persisted asset
 * decisions — never from the stored row. That is the whole point: the record is
 * data, the context is truth.
 */
/**
 * Availability of a stored plan for one lesson and mode.
 *
 * M4.4 answered this with `exists()`, which promises more than an existence
 * query can support: a row written under another registry version, or one whose
 * asset review was revoked, still exists but cannot render. Adaptation then
 * advertised a mode whose plan would fail on retrieval.
 *
 * This reports the honest state, from the record's own compatibility fields, in
 * one bounded read:
 *
 *   available       a live row whose schema/registry/revision still match
 *   stale           a row exists but is incompatible — it will be refused
 *   unavailable     no live row
 *
 * It is still not a substitute for retrieval: the caller revalidates fully
 * before rendering. This only stops the UI promising what validation will deny.
 */
export type PlanAvailability = 'available' | 'stale' | 'unavailable';

export async function peekStoredPlan(input: {
  courseId: string;
  revisionId: string;
  lessonId: string;
  mode: string;
}): Promise<boolean> {
  return (await checkStoredPlanAvailability(input)) === 'available';
}

export async function checkStoredPlanAvailability(input: {
  courseId: string;
  revisionId: string;
  lessonId: string;
  mode: string;
}): Promise<PlanAvailability> {
  if (input.mode === 'read') return 'available';
  const row = await ExperiencePlanRecord.findOne({
    courseId: input.courseId,
    revisionId: input.revisionId,
    lessonId: input.lessonId,
    mode: input.mode,
    supersededAt: { $exists: false }
  })
    .select({
      invalidatedAt: 1,
      planSchemaVersion: 1,
      registryVersion: 1,
      presentationSchemaVersion: 1
    })
    .lean();
  if (!row) return 'unavailable';
  // Explicitly invalidated rows are stale, not merely absent: the UI must not
  // keep offering a mode whose plan was withdrawn.
  if (row.invalidatedAt) return 'stale';
  if (
    row.planSchemaVersion !== EXPERIENCE_PLAN_SCHEMA_VERSION ||
    row.registryVersion !== COMPONENT_REGISTRY_VERSION ||
    row.presentationSchemaVersion !== PRESENTATION_SCHEMA_VERSION
  )
    return 'stale';
  return 'available';
}

export async function loadAcceptedPlan(input: {
  courseId: string;
  revisionId: string;
  lessonId: string;
  mode: LearningMode;
  contentHash: string;
  contextFingerprint: string;
  validationContext: ExperiencePlanValidationContext;
}): Promise<LoadOutcome> {
  const record = (await ExperiencePlanRecord.findOne({
    courseId: input.courseId,
    revisionId: input.revisionId,
    lessonId: input.lessonId,
    mode: input.mode,
    supersededAt: { $exists: false },
    invalidatedAt: { $exists: false }
  }).lean()) as IExperiencePlanRecord | null;

  if (!record) return { status: 'absent' };

  // The plan must describe *this* revision content and *this* context. A
  // changed canonical hash or fingerprint makes it stale, not merely old.
  if (record.contentHash !== input.contentHash)
    return { status: 'stale', reason: 'CONTENT_HASH_CHANGED' };
  if (record.contextFingerprint !== input.contextFingerprint)
    return { status: 'stale', reason: 'CONTEXT_FINGERPRINT_CHANGED' };
  if (record.planSchemaVersion !== EXPERIENCE_PLAN_SCHEMA_VERSION)
    return { status: 'stale', reason: 'PLAN_SCHEMA_CHANGED' };
  if (record.registryVersion !== COMPONENT_REGISTRY_VERSION)
    return { status: 'stale', reason: 'REGISTRY_VERSION_CHANGED' };
  if (record.presentationSchemaVersion !== PRESENTATION_SCHEMA_VERSION)
    return { status: 'stale', reason: 'PRESENTATION_SCHEMA_CHANGED' };

  // Re-parse the stored body with the parser for the shape that is actually
  // stored.
  //
  // The record holds a *published* plan (`canonical`/`supplemental`/`digest`/
  // `disclosure`), not an untrusted *proposal* (`claims`/`placements`/`notes`).
  // Parsing it with `parseExperiencePlanProposal` rejects it as
  // PLAN_SCHEMA_UNKNOWN_FIELD, which made this function return `rejected` for
  // every stored plan — so the learner read route could never serve one. The
  // published parser also enforces the canonical block order, which the trusted
  // context supplies.
  let published;
  try {
    published = parsePublishedExperiencePlan(
      record.plan,
      input.validationContext.blocks.map((block) => block.blockId)
    );
  } catch {
    return { status: 'rejected', code: 'PLAN_SCHEMA_INVALID', stage: 'schema' };
  }

  // The parsed body must still describe *this* plan, not merely be well formed.
  if (published.digest !== record.planDigest)
    return { status: 'stale', reason: 'PLAN_DIGEST_CHANGED' };
  if (published.contextFingerprint !== input.contextFingerprint)
    return { status: 'stale', reason: 'CONTEXT_FINGERPRINT_CHANGED' };

  // The validator's contract takes an untrusted *proposal* and re-derives
  // everything from the live context. Handing it the published shape fails at
  // its own schema stage, so rebuild the proposal from the stored body. This
  // is a faithful reverse of `projectExperiencePlan`, and the validator then
  // re-checks identity, coverage, capability and asset/review authority as it
  // does for provider output. A revoked approval or edited asset fails here
  // even though the record was accepted earlier.
  const outcome = tryValidateExperiencePlan(
    {
      schemaVersion: published.schemaVersion,
      planId: published.planId,
      claims: {
        courseId: published.courseId,
        revisionId: published.revisionId,
        contentHash: published.contentHash,
        lessonId: published.lessonId,
        mode: published.mode,
        registryVersion: published.registryVersion,
        presentationSchemaVersion: PRESENTATION_SCHEMA_VERSION,
        contextFingerprint: published.contextFingerprint
      },
      planner: published.planner,
      // Reverse the published flattening precisely: a proposal placement nests
      // its target under `block` and carries `kind`; the published shape is
      // flat with `blockType` instead. Passing the published objects straight
      // through fails the proposal parser's key allowlist.
      placements: [
        ...published.canonical.map((entry) => ({
          placementId: entry.placementId,
          kind: 'canonical' as const,
          block: { lessonId: published.lessonId, blockId: entry.blockId },
          component: entry.component,
          componentVersion: entry.componentVersion,
          group: entry.group,
          disclosure: entry.disclosure,
          ...('interaction' in entry && entry.interaction !== undefined
            ? { interaction: entry.interaction }
            : {}),
          fallback: entry.fallback
        })),
        ...published.supplemental.map((entry) => ({
          placementId: entry.placementId,
          kind: 'supplemental' as const,
          block: { lessonId: published.lessonId, blockId: entry.blockId },
          component: entry.component,
          componentVersion: entry.componentVersion,
          group: entry.group,
          disclosure: entry.disclosure,
          ...('interaction' in entry && entry.interaction !== undefined
            ? { interaction: entry.interaction }
            : {}),
          fallback: entry.fallback,
          assetId: (entry as { assetId?: string }).assetId
        }))
      ]
    },
    input.validationContext
  );
  if (!outcome.ok) return { status: 'rejected', code: outcome.code, stage: outcome.stage };

  // The revalidated plan must be the same plan, not merely a valid one.
  if (outcome.plan.digest !== record.planDigest)
    return { status: 'stale', reason: 'PLAN_DIGEST_CHANGED' };

  return { status: 'available', plan: projectExperiencePlan(outcome.plan) };
}

/** Mark every stored plan for a scope unusable. Used when a revision is
 * deprecated or an asset's approval is revoked. */
export async function invalidateStoredPlans(input: {
  courseId: string;
  revisionId: string;
  reason: string;
}): Promise<number> {
  const result = await ExperiencePlanRecord.updateMany(
    { courseId: input.courseId, revisionId: input.revisionId, invalidatedAt: { $exists: false } },
    { $set: { invalidatedAt: new Date(), invalidationReason: input.reason.slice(0, 80) } }
  );
  if (result.modifiedCount > 0) recordEvent('plan_invalidated', result.modifiedCount);
  return result.modifiedCount;
}
