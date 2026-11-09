import type { ExperiencePlanRequest as ExperiencePlanRequestRow } from '../../../../src/generated/prisma/client';
import { prisma } from '../../../../shared/database';
import { table } from './_table';

/**
 * One experience-plan generation attempt (Batch 4, Milestone 4.2).
 *
 * This is the durable record of *dispatch*, not of content. It exists so that:
 *   - a duplicate request for the same authorized operation is refused while an
 *     attempt is active (idempotency)
 *   - a request that may have reached the provider is never silently retried
 *   - reserved and reported token usage are both accounted for
 *   - a learner-visible outcome can be audited without storing the proposal
 */
export type ExperiencePlanRequestState =
  | 'requested'
  | 'authorized'
  | 'reserved'
  | 'dispatched'
  | 'validating'
  | 'validated'
  | 'rejected'
  | 'failed'
  | 'uncertain'
  | 'cancelled';

export type IExperiencePlanRequest = ExperiencePlanRequestRow & { _id: string };

export const ExperiencePlanRequest = table<IExperiencePlanRequest>({
  delegate: () => prisma.experiencePlanRequest,
  defaults: () => ({ reservedTokens: 0, usageReported: false }),
  columns: (row) => ({
    requestId: row.requestId,
    identity: row.identity,
    courseId: row.courseId,
    revisionId: row.revisionId,
    lessonId: row.lessonId,
    mode: row.mode,
    actor: row.actor,
    provider: row.provider,
    providerModel: row.providerModel,
    contextFingerprint: row.contextFingerprint,
    state: row.state,
    code: row.code,
    stage: row.stage,
    approvalId: row.approvalId,
    reservedTokens: row.reservedTokens,
    reportedTokens: row.reportedTokens,
    usageReported: row.usageReported,
    modelVersion: row.modelVersion,
    planDigest: row.planDigest,
    dispatchAt: row.dispatchAt,
    finishedAt: row.finishedAt
  })
});

export default ExperiencePlanRequest;

/** States in which an attempt is still in flight. A duplicate request must not
 * start a second dispatch while one of these is active. */
export const ACTIVE_STATES = [
  'requested',
  'authorized',
  'reserved',
  'dispatched',
  'validating'
] as const;
