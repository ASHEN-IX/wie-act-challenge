/** Experience-plan generation lifecycle (Batch 4, Milestone 4.2).
 *
 * The bounded path from "a student asked for a planned lesson" to "a validated
 * plan, or a safe fallback":
 *
 *   requested → authorized → reserved → dispatched → validating
 *     → validated | rejected | failed | uncertain | cancelled
 *
 * Every transition is persisted, so a duplicate request, a crash, or a provider
 * that may have been charged all have a durable answer rather than an
 * assumption.
 *
 * Two invariants hold throughout:
 *
 *   1. the provider's output is untrusted until the M4.1 validator accepts it
 *   2. a failure never removes the deterministic reader
 */

import crypto from 'node:crypto';
import { ExperiencePlanRequest } from '../models/ExperiencePlanRequest';

/** States that mean another dispatch is genuinely in progress. `requested` is
 * excluded: it is the row this call just created. */
const IN_FLIGHT_STATES: readonly string[] = ['authorized', 'reserved', 'dispatched', 'validating'];
import type { ExperiencePlannerProvider, ProviderOutcome } from '../../../../shared/ednova/experiencePlannerProvider';
import { failureClass } from '../../../../shared/ednova/experiencePlannerProvider';
import {
  tryValidateExperiencePlan,
  type ValidationOutcome,
} from '../../../../shared/ednova/experiencePlanValidator';
import type {
  ExperiencePlanValidationContext,
  ValidatedLearningExperiencePlan,
} from '../../../../shared/ednova/experiencePlan';
import {
  assertPlanningAuthorized,
  PlanningGovernanceError,
  type PlanningRefusal,
} from './planningGovernance';
import {
  reconcilePlanningBudget,
  reservePlanningBudget,
  PlanningBudgetError,
} from './planningBudget';
import { peekStoredPlan, storeAcceptedPlan } from './experiencePlanStore';
import { recordEvent } from './planningMetrics';
import { isLearningMode } from '../../../../shared/ednova/learningModes';
import {
  buildPlanningContext,
  plannerOutputSchema,
  plannerTask,
  PlanningContextError,
  PLANNER_SYSTEM_POLICY,
  type PlanningContextInput,
} from '../../../../shared/ednova/planningContext';

export const PLANNING_TASK = 'experience_planning';

export type GenerationOutcome =
  | {
      status: 'validated';
      /** The validated plan itself. Branded, so only this path can produce one. */
      plan: ValidatedLearningExperiencePlan;
      planDigest: string;
      requestId: string;
      usageReported: boolean;
    }
  | { status: 'rejected'; code: string; stage: string; requestId: string }
  | { status: 'refused'; code: PlanningRefusal | string; requestId: string | null }
  | { status: 'failed'; code: string; requestId: string; uncertain: boolean }
  | { status: 'duplicate'; requestId: string }
  | { status: 'already_accepted'; planDigest: string; requestId: string };

/** Stable idempotency key: the same authorized operation maps to one row. */
export function planningIdentity(input: {
  courseId: string;
  revisionId: string;
  lessonId: string;
  mode: string;
  contextFingerprint: string;
  provider: string;
  model: string;
}): string {
  return (
    'sha256:' +
    crypto
      .createHash('sha256')
      .update(
        JSON.stringify([
          input.courseId,
          input.revisionId,
          input.lessonId,
          input.mode,
          input.contextFingerprint,
          input.provider,
          input.model,
        ]),
      )
      .digest('hex')
  );
}

/**
 * Run one planning attempt.
 *
 * `validationContext` is built by the caller from trusted data; this function
 * never builds it from provider output.
 */
export async function generateExperiencePlan(input: {
  actor: string;
  provider: ExperiencePlannerProvider;
  courseId: string;
  revisionId: string;
  lessonId: string;
  mode: string;
  keySha256: string;
  contextInput: PlanningContextInput;
  validationContext: ExperiencePlanValidationContext;
  /** Injected for tests: the durable budget ledger may be unavailable. */
  reserve?: typeof reservePlanningBudget;
  reconcile?: typeof reconcilePlanningBudget;
}): Promise<GenerationOutcome> {
  const providerIdentity = input.provider.identity;

  recordEvent('planning_request');
  if (!input.provider.isEnabled())
    return { status: 'refused', code: 'PLANNING_DISABLED', requestId: null };

  // ---- context -----------------------------------------------------------
  let context;
  let task: string;
  let schema: Record<string, unknown>;
  try {
    context = buildPlanningContext(input.contextInput);
    schema = plannerOutputSchema(context);
    task = plannerTask(context, input.contextInput);
  } catch (error) {
    const code =
      error instanceof PlanningContextError ? error.code : 'CONTEXT_TOO_LARGE';
    return { status: 'refused', code, requestId: null };
  }

  // ---- authorization, consent, eligibility --------------------------------
  let authorization;
  try {
    authorization = await assertPlanningAuthorized({
      actor: input.actor,
      courseId: input.courseId,
      revisionId: input.revisionId,
      provider: providerIdentity.provider,
      model: providerIdentity.model,
      keySha256: input.keySha256,
    });
  } catch (error) {
    const code =
      error instanceof PlanningGovernanceError ? error.code : 'PLANNING_FORBIDDEN';
    return { status: 'refused', code, requestId: null };
  }

  const identity = planningIdentity({
    courseId: input.courseId,
    revisionId: input.revisionId,
    lessonId: input.lessonId,
    mode: input.mode,
    contextFingerprint: context.fingerprint,
    provider: providerIdentity.provider,
    model: providerIdentity.model,
  });

  // ---- release expired in-flight attempts ---------------------------------
  // Without this a process that dies mid-attempt blocks its identity forever:
  // every later request would answer `duplicate` for a plan that can never
  // exist. Bounded by age, so live work is never disturbed and no possibly
  // billable attempt is replayed.
  await recoverBeforePlanning();

  // ---- idempotency -------------------------------------------------------
  // One row per authorized operation. If an attempt is still in flight, a
  // duplicate must not start a second dispatch.
  let row;
  try {
    row = await ExperiencePlanRequest.findOneAndUpdate(
      { identity },
      {
        $setOnInsert: {
          requestId: crypto.randomUUID(),
          identity,
          courseId: input.courseId,
          revisionId: input.revisionId,
          lessonId: input.lessonId,
          mode: input.mode,
          actor: input.actor,
          provider: providerIdentity.provider,
          providerModel: providerIdentity.model,
          contextFingerprint: context.fingerprint,
          state: 'requested',
          reservedTokens: 0,
          usageReported: false,
        },
      },
      { upsert: true, new: true },
    ).lean();
  } catch (error) {
    // A unique-index race means another attempt created the row first.
    if ((error as { code?: number }).code !== 11000) throw error;
    row = await ExperiencePlanRequest.findOne({ identity }).lean();
  }
  if (!row) return { status: 'refused', code: 'PLANNING_FORBIDDEN', requestId: null };

  const requestId = String(row.requestId);

  // ---- atomic claim ------------------------------------------------------
  // Reading the row and then acting on it is a check-then-act race: two
  // processes both read `requested` and both conclude they may proceed. M4.5's
  // cross-process proof showed exactly that — five workers reserved five times
  // for one logical attempt. The claim must be a single conditional update so
  // only one caller can move `requested` forward.
  if (String(row.state) === 'requested') {
    const claimed = await ExperiencePlanRequest.findOneAndUpdate(
      { _id: row._id, state: 'requested' },
      { $set: { state: 'authorized' } },
      { new: true },
    ).lean();
    if (!claimed) {
      // Another process won the claim. Re-read to report its state honestly.
      const current = await ExperiencePlanRequest.findOne({ _id: row._id }).lean();
      recordEvent('duplicate_suppressed');
      return { status: 'duplicate', requestId: String(current?.requestId ?? requestId) };
    }
    row = claimed;
  }

  // Any other in-flight state belongs to a live attempt.
  if (IN_FLIGHT_STATES.includes(String(row.state))) {
    recordEvent('duplicate_suppressed');
    return { status: 'duplicate', requestId };
  }

  // A previously validated attempt whose plan record is still live is the
  // answer: re-planning would be a second, separately-accounted provider call
  // for material that is already accepted.
  if (row.state === 'validated' && row.planDigest) {
    const live = await peekStoredPlan({
      courseId: input.courseId,
      revisionId: input.revisionId,
      lessonId: input.lessonId,
      mode: input.mode,
    });
    // The accepted plan is already stored; this call must not produce a second
    // one. `already_accepted` tells the caller to read the store instead.
    if (live) {
      recordEvent('already_accepted_reuse');
      recordEvent('cache_hit');
      return { status: 'already_accepted', planDigest: String(row.planDigest), requestId };
    }
    recordEvent('cache_miss');
    // The record was invalidated or superseded (asset edit, review revocation,
    // registry change), so the accepted plan no longer applies. Regeneration is
    // legitimate — and is separately reserved and reconciled like any attempt.
  }
  if (row.state === 'uncertain')
    return { status: 'failed', code: 'PROVIDER_UNCERTAIN_PREVIOUS', requestId, uncertain: true };

  // ---- reserve -----------------------------------------------------------
  let reservation;
  try {
    reservation = await (input.reserve ?? reservePlanningBudget)({
      approvalId: authorization.approvalId,
      task: PLANNING_TASK,
      model: providerIdentity.model,
      maxTokens: authorization.maxTokens,
      maxRequests: 1,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });
  } catch (error) {
    await ExperiencePlanRequest.updateOne(
      { _id: row._id },
      { $set: { state: 'failed', code: 'BUDGET_UNAVAILABLE', finishedAt: new Date() } },
    );
    return {
      status: 'refused',
      code: error instanceof PlanningBudgetError ? 'BUDGET_UNAVAILABLE' : 'BUDGET_UNAVAILABLE',
      requestId,
    };
  }

  await ExperiencePlanRequest.updateOne(
    { _id: row._id },
    {
      $set: {
        state: 'dispatched',
        approvalId: authorization.approvalId,
        reservedTokens: reservation.reservedTokens,
        dispatchAt: new Date(),
      },
    },
  );

  // ---- dispatch ----------------------------------------------------------
  let outcome: ProviderOutcome;
  try {
    outcome = await input.provider.plan({
      requestId,
      contextFingerprint: context.fingerprint,
      systemPolicy: PLANNER_SYSTEM_POLICY,
      task,
      outputSchema: schema,
      limits: {
        maxInputCharacters: task.length + PLANNER_SYSTEM_POLICY.length,
        maxOutputTokens: 2048,
        timeoutMs: 30_000,
      },
    });
  } catch {
    // An adapter that threw is not proof that nothing was dispatched.
    outcome = {
      ok: false,
      code: 'PROVIDER_UNAVAILABLE',
      failure: 'uncertain',
      usage: null,
    };
  }

  // ---- reconcile accounting ----------------------------------------------
  const accounting = await (input.reconcile ?? reconcilePlanningBudget)({
    approvalId: reservation.approvalId,
    reservedTokens: reservation.reservedTokens,
    usage: outcome.ok ? outcome.usage : outcome.usage,
  }).catch(() => ({ chargedTokens: reservation.reservedTokens, refunded: 0, usageReported: false }));

  await ExperiencePlanRequest.updateOne(
    { _id: row._id },
    {
      $set: {
        usageReported: accounting.usageReported,
        reservedTokens: reservation.reservedTokens,
        ...(outcome.ok && outcome.usage.totalTokens !== null
          ? { reportedTokens: outcome.usage.totalTokens }
          : {}),
        ...(outcome.ok && outcome.usage.modelVersion
          ? { modelVersion: outcome.usage.modelVersion }
          : {}),
      },
    },
  );

  if (!outcome.ok) {
    const uncertain = outcome.failure === 'uncertain' || failureClass(outcome.code) === 'uncertain';
    recordEvent(uncertain ? 'uncertain_outcome' : 'known_failure');
    await ExperiencePlanRequest.updateOne(
      { _id: row._id },
      {
        $set: {
          state: uncertain ? 'uncertain' : 'failed',
          code: outcome.code,
          finishedAt: new Date(),
        },
      },
    );
    return { status: 'failed', code: outcome.code, requestId, uncertain };
  }

  // ---- independent validation -------------------------------------------
  await ExperiencePlanRequest.updateOne({ _id: row._id }, { $set: { state: 'validating' } });
  const validation: ValidationOutcome = tryValidateExperiencePlan(
    outcome.proposal,
    input.validationContext,
  );

  if (!validation.ok) {
    recordEvent('validation_reject');
    await ExperiencePlanRequest.updateOne(
      { _id: row._id },
      {
        $set: {
          state: 'rejected',
          code: validation.code,
          stage: validation.stage,
          finishedAt: new Date(),
        },
      },
    );
    return { status: 'rejected', code: validation.code, stage: validation.stage, requestId };
  }

  recordEvent('validation_accept');
  recordEvent('provider_dispatch');
  await ExperiencePlanRequest.updateOne(
    { _id: row._id },
    {
      $set: {
        state: 'validated',
        planDigest: validation.plan.digest,
        finishedAt: new Date(),
      },
      $unset: { code: 1, stage: 1 },
    },
  );
  // M4.3: persist the accepted body so a learner can retrieve it without
  // another inference. Storing does not make it trusted; the read path
  // revalidates against current records.
  const stored = await storeAcceptedPlan({
    plan: validation.plan,
    generatedBy: input.actor,
    contextFingerprint: context.fingerprint,
    mode: isLearningMode(input.mode) ? input.mode : 'read',
  });
  if (!stored.stored) {
    // A plan that validated but cannot be stored is not usable to a learner;
    // report it rather than pretend it is available.
    await ExperiencePlanRequest.updateOne(
      { _id: row._id },
      { $set: { state: 'validated', planDigest: validation.plan.digest, code: 'PLAN_NOT_STORED' } },
    );
  }

  return {
    status: 'validated',
    plan: validation.plan,
    planDigest: validation.plan.digest,
    requestId,
    usageReported: accounting.usageReported,
  };
}

/**
 * Mark stale in-flight attempts as uncertain.
 *
 * Mirrors the formula pipeline's recovery rule: a crash during dispatch is not
 * proof of no charge, so it is reconciled by a human rather than replayed.
 */
export async function recoverStalePlanningRequests(olderThanMs = 120_000): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);

  // An attempt that reached `dispatched` or `validating` may have been billed,
  // so it becomes uncertain and is never replayed automatically.
  const uncertain = await ExperiencePlanRequest.updateMany(
    {
      state: { $in: ['dispatched', 'validating'] },
      $or: [{ dispatchAt: { $lt: cutoff } }, { dispatchAt: { $exists: false } }],
      updatedAt: { $lt: cutoff },
    },
    {
      $set: { state: 'uncertain', code: 'WORKER_INTERRUPTED', finishedAt: new Date() },
    },
  );

  // `authorized` and `reserved` are provably pre-dispatch: the provider was
  // never contacted, so the attempt failed safely and the identity is released
  // for a fresh, separately-accounted request. Recording `failed` rather than
  // deleting keeps the audit trail while unblocking the lesson.
  const abandoned = await ExperiencePlanRequest.updateMany(
    {
      state: { $in: ['authorized', 'reserved'] },
      updatedAt: { $lt: cutoff },
    },
    {
      $set: { state: 'failed', code: 'PRE_DISPATCH_INTERRUPTED', finishedAt: new Date() },
    },
  );

  return uncertain.modifiedCount + abandoned.modifiedCount;
}

/** Release expired in-flight rows before deciding a duplicate. Cheap, bounded,
 * and only touches rows older than the cutoff, so it cannot disturb live work. */
export async function recoverBeforePlanning(olderThanMs = 120_000): Promise<void> {
  const recovered = await recoverStalePlanningRequests(olderThanMs).catch(() => 0);
  if (recovered > 0) recordEvent('stale_recovered', recovered);
}
