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
import { Prisma } from '../../../../src/generated/prisma/client';
import { prisma } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';
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

/**
 * Both tables are generic `payload` rows (the fields vary by provider and
 * purpose), so the documented consent/eligibility keys live in `payload` and
 * are matched after hydration. Reads are bounded by the typed identity columns.
 */
type ConsentRow = { id: string; payload: Record<string, unknown> };

async function findConsent(where: Partial<PlanningConsentRecord>): Promise<ConsentRow | null> {
  // Consent is matched on identity/documentPurpose fields. `purpose` is
  // re-checked by the caller: a row for a different purpose must never be
  // treated as this purpose's authorization.
  const rows = await prisma.experiencePlanningConsent.findMany({
    where: {
      ...(where.courseId ? { payload: { path: ['courseId'], equals: where.courseId } } : {})
    }
  });
  for (const row of rows) {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    // `purpose` is excluded here: the caller re-checks it so a row recorded for
    // another purpose is refused with CONSENT_PURPOSE_MISMATCH, not silently
    // treated as absent.
    if (
      Object.entries(where).every(([key, value]) => key === 'purpose' || payload[key] === value)
    ) {
      return { id: row.id, payload };
    }
  }
  return null;
}

async function findEligibility(where: Record<string, unknown>) {
  const rows = await prisma.experiencePlannerEligibility.findMany({
    where: {
      ...(typeof where.provider === 'string' ? { provider: where.provider } : {}),
      ...(typeof where.model === 'string' ? { model: where.model } : {})
    }
  });
  for (const row of rows) {
    const payload = { ...(row.payload as Record<string, unknown>) };
    if (
      Object.entries(where).every(([key, value]) => {
        if (key === 'provider' || key === 'model')
          return (row as unknown as Record<string, unknown>)[key] === value;
        if (key === 'revoked') {
          const expected = value as { $ne?: unknown } | boolean;
          return typeof expected === 'object' && expected !== null && '$ne' in expected
            ? payload.revoked !== expected.$ne
            : payload.revoked === expected;
        }
        return payload[key] === value;
      })
    ) {
      return { ...row, ...payload } as Record<string, unknown>;
    }
  }
  return null;
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
  }
): Promise<PlanningConsentRecord> {
  const course = await Course.findById(input.courseId);
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
        input.termsVersion
      ])
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
    termsVersion: input.termsVersion
  };

  const existing = await findConsent({ identity });
  if (existing) {
    await prisma.experiencePlanningConsent.update({
      where: { id: existing.id },
      data: {
        userId: actor,
        scope: PLANNING_CONSENT_PURPOSE,
        payload: record as unknown as Prisma.InputJsonValue
      }
    });
  } else {
    await prisma.experiencePlanningConsent.create({
      data: {
        id: newId(),
        userId: actor,
        scope: PLANNING_CONSENT_PURPOSE,
        payload: record as unknown as Prisma.InputJsonValue
      }
    });
  }
  return record;
}

/** Revoke consent. Takes effect immediately: no dispatch that has not already
 * happened may proceed after this returns. */
export async function revokePlanningConsent(
  actor: string,
  input: { courseId: string; revisionId: string }
): Promise<{ revoked: number }> {
  if (!(await canManageCourse(actor, input.courseId)))
    throw new PlanningGovernanceError('PLANNING_FORBIDDEN');
  // Match the documented (courseId, revisionId, revoked) keys inside payload,
  // then revoke each matching row.
  const rows = await prisma.experiencePlanningConsent.findMany({
    where: { payload: { path: ['courseId'], equals: input.courseId } }
  });
  let revoked = 0;
  for (const row of rows) {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    if (payload.revisionId !== input.revisionId || payload.revoked !== false) continue;
    await prisma.experiencePlanningConsent.update({
      where: { id: row.id },
      data: {
        payload: {
          ...payload,
          revoked: true,
          revokedAt: new Date(),
          revokedBy: actor
        } as unknown as Prisma.InputJsonValue
      }
    });
    revoked++;
  }
  return { revoked };
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

  const consentRow = await findConsent({
    courseId: input.courseId,
    revisionId: input.revisionId,
    purpose: PLANNING_CONSENT_PURPOSE,
    provider: input.provider
  });
  const consent = consentRow?.payload as unknown as PlanningConsentRecord | undefined;
  if (!consent) throw new PlanningGovernanceError('OWNER_CONSENT_REQUIRED');
  if (consent.revoked) throw new PlanningGovernanceError('CONSENT_REVOKED');
  if (consent.purpose !== PLANNING_CONSENT_PURPOSE)
    throw new PlanningGovernanceError('CONSENT_PURPOSE_MISMATCH');
  if (new Date(consent.expiresAt).getTime() <= Date.now())
    throw new PlanningGovernanceError('CONSENT_EXPIRED');

  // Eligibility is a separate, operator-verified record. The existence of an
  // API key never implies eligibility.
  const eligible = await findEligibility({
    provider: input.provider,
    model: input.model,
    revoked: { $ne: true }
  });
  if (!eligible) throw new PlanningGovernanceError('FREE_TIER_UNVERIFIED', 503);
  if (eligible.billingAttached === true) throw new PlanningGovernanceError('BILLING_ATTACHED', 503);
  if (eligible.freeTier !== true) throw new PlanningGovernanceError('FREE_TIER_UNVERIFIED', 503);
  if (new Date(eligible.expiresAt as string).getTime() <= Date.now())
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
