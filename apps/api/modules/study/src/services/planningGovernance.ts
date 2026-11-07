/** Planning governance: consent, eligibility, approval and budget (M4.2).
 *
 * Every check that must pass before an external dispatch. Each one is a
 * separate, named refusal so a failure is auditable and a retry decision is
 * unambiguous: a refusal here provably did not reach the model.
 *
 * The deliberate stance throughout: absence of proof is refusal, not
 * permission. A missing consent record, an eligibility row without an operator
 * verification, or a budget that cannot be read all block dispatch.
 */

import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Course } from '../models';
import { canManageCourse } from './resourceAccess';

/** A planning consent names its purpose. Consent for formula recognition is a
 * different purpose and does not authorize lesson planning. */
export const PLANNING_CONSENT_PURPOSE = 'experience_planning';

export type PlanningRefusal =
  | 'PLANNING_DISABLED'
  | 'PLANNING_FORBIDDEN'
  | 'OWNER_CONSENT_REQUIRED'
  | 'CONSENT_REVOKED'
  | 'CONSENT_EXPIRED'
  | 'CONSENT_PURPOSE_MISMATCH'
  | 'FREE_TIER_UNVERIFIED'
  | 'BILLING_ATTACHED'
  | 'ELIGIBILITY_EXPIRED'
  | 'OPERATOR_APPROVAL_MISSING'
  | 'CREDENTIAL_MISMATCH'
  | 'BUDGET_UNAVAILABLE';

export class PlanningGovernanceError extends Error {
  readonly status: number;
  readonly code: PlanningRefusal;
  constructor(code: PlanningRefusal, status = 403) {
    super(code);
    this.name = 'PlanningGovernanceError';
    this.code = code;
    this.status = status;
  }
}

function collections() {
  const db = mongoose.connection.db!;
  return {
    consent: db.collection('experience_planning_consents'),
    eligibility: db.collection('experience_planner_eligibility'),
  };
}

export type PlanningConsentRecord = {
  identity: string;
  courseId: string;
  revisionId: string;
  purpose: string;
  provider: string;
  model: string;
  owner: string;
  grantedAt: Date;
  expiresAt: Date;
  revoked: boolean;
  /** Data-processing terms the owner accepted, recorded verbatim by key. */
  termsVersion: string;
};

/**
 * Grant consent for lesson planning on one revision.
 *
 * Only a course owner may grant it, the revision must be the exact one being
 * planned, and the record names the purpose, provider and model family so it
 * cannot silently authorize a different use or a different provider.
 */
export async function grantPlanningConsent(
  actor: string,
  input: {
    courseId: string;
    revisionId: string;
    provider: string;
    model: string;
    termsVersion: string;
    ttlMs?: number;
  },
): Promise<PlanningConsentRecord> {
  const course = await Course.findById(input.courseId).lean();
  if (!course) throw new PlanningGovernanceError('PLANNING_FORBIDDEN', 404);
  if (![course.ownerUserId, course.userId].includes(actor))
    throw new PlanningGovernanceError('OWNER_CONSENT_REQUIRED');

  const identity = crypto
    .createHash('sha256')
    .update(
      JSON.stringify([
        input.courseId,
        input.revisionId,
        PLANNING_CONSENT_PURPOSE,
        input.provider,
        input.model,
        input.termsVersion,
      ]),
    )
    .digest('hex');

  const grantedAt = new Date();
  // Bounded by default: consent is not indefinite.
  const expiresAt = new Date(grantedAt.getTime() + (input.ttlMs ?? 30 * 24 * 60 * 60 * 1000));

  const record: PlanningConsentRecord = {
    identity,
    courseId: input.courseId,
    revisionId: input.revisionId,
    purpose: PLANNING_CONSENT_PURPOSE,
    provider: input.provider,
    model: input.model,
    owner: actor,
    grantedAt,
    expiresAt,
    revoked: false,
    termsVersion: input.termsVersion,
  };

  await collections().consent.createIndex({ identity: 1 }, { unique: true });
  await collections().consent.updateOne(
    { identity },
    { $set: record },
    { upsert: true },
  );
  return record;
}

/** Revoke consent. Takes effect immediately: no dispatch that has not already
 * happened may proceed after this returns. */
export async function revokePlanningConsent(
  actor: string,
  input: { courseId: string; revisionId: string },
): Promise<{ revoked: number }> {
  if (!(await canManageCourse(actor, input.courseId)))
    throw new PlanningGovernanceError('PLANNING_FORBIDDEN');
  const result = await collections().consent.updateMany(
    { courseId: input.courseId, revisionId: input.revisionId, revoked: false },
    { $set: { revoked: true, revokedAt: new Date(), revokedBy: actor } },
  );
  return { revoked: result.modifiedCount };
}

/**
 * The full pre-dispatch gate.
 *
 * Order matters: authorization, then consent, then eligibility, then approval.
 * The cheapest and most authoritative refusals come first, and nothing
 * downstream can weaken an earlier answer.
 */
export async function assertPlanningAuthorized(input: {
  actor: string;
  courseId: string;
  revisionId: string;
  provider: string;
  model: string;
  /** Fingerprint the operator must have approved for this model. */
  keySha256: string;
}): Promise<{ consent: PlanningConsentRecord; approvalId: string; maxTokens: number }> {
  if (!(await canManageCourse(input.actor, input.courseId)))
    throw new PlanningGovernanceError('PLANNING_FORBIDDEN');

  const consent = await collections().consent.findOne({
    courseId: input.courseId,
    revisionId: input.revisionId,
    purpose: PLANNING_CONSENT_PURPOSE,
    provider: input.provider,
  });
  if (!consent) throw new PlanningGovernanceError('OWNER_CONSENT_REQUIRED');
  if (consent.revoked) throw new PlanningGovernanceError('CONSENT_REVOKED');
  if (consent.purpose !== PLANNING_CONSENT_PURPOSE)
    throw new PlanningGovernanceError('CONSENT_PURPOSE_MISMATCH');
  if (new Date(consent.expiresAt).getTime() <= Date.now())
    throw new PlanningGovernanceError('CONSENT_EXPIRED');

  // Eligibility is a separate, operator-verified record. The existence of an
  // API key never implies eligibility.
  const eligible = await collections().eligibility.findOne({
    provider: input.provider,
    model: input.model,
    revoked: { $ne: true },
  });
  if (!eligible) throw new PlanningGovernanceError('FREE_TIER_UNVERIFIED', 503);
  if (eligible.billingAttached === true)
    throw new PlanningGovernanceError('BILLING_ATTACHED', 503);
  if (eligible.freeTier !== true) throw new PlanningGovernanceError('FREE_TIER_UNVERIFIED', 503);
  if (new Date(eligible.expiresAt).getTime() <= Date.now())
    throw new PlanningGovernanceError('ELIGIBILITY_EXPIRED', 503);
  if (!eligible.verifiedBy || !eligible.projectId)
    throw new PlanningGovernanceError('OPERATOR_APPROVAL_MISSING', 503);
  if (eligible.keySha256 !== input.keySha256)
    throw new PlanningGovernanceError('CREDENTIAL_MISMATCH', 503);

  const approvalId = String(eligible.approvalId ?? '');
  const maxTokens = Number(eligible.maxTokens ?? 0);
  if (!approvalId || !Number.isSafeInteger(maxTokens) || maxTokens <= 0)
    throw new PlanningGovernanceError('BUDGET_UNAVAILABLE', 503);

  return { consent: consent as unknown as PlanningConsentRecord, approvalId, maxTokens };
}
