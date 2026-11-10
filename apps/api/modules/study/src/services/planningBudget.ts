/** Durable planning budget accounting (Batch 4, Milestone 4.2).
 *
 * Uses the API-owned durable ledger (`llm_approval_budgets`) that the formula
 * pipeline also draws on, rather than introducing a second ledger. The rules are the same ones that made that pipeline safe:
 *
 *   - reserve atomically *before* dispatch, with a conditional update
 *   - never release a reservation on an uncertain outcome
 *   - reconcile reported usage against the reservation, never below zero
 *
 * The one addition this milestone needs is explicit reconciliation: a provider
 * that reports fewer tokens than reserved gets the difference returned, and a
 * provider that reports nothing keeps the full reservation as spent.
 */

import { prisma } from '../../../../shared/database';
import type { ProviderUsage } from '../../../../shared/ednova/experiencePlannerProvider';

export class PlanningBudgetError extends Error {
  readonly status = 503;
  readonly code = 'BUDGET_UNAVAILABLE';
  constructor() {
    super('BUDGET_UNAVAILABLE');
    this.name = 'PlanningBudgetError';
  }
}

/** Conservative reservation. Input and output are bounded separately, and the
 * total is what gets reserved so a long lesson cannot outspend its approval. */
export const PLANNING_RESERVED_TOKENS = 32_768;

/** Kept for callers that used to drop the pooled Mongo client. The ledger now
 * shares the application's Prisma connection, so there is nothing to close. */
export async function closeBudgetClient(): Promise<void> {
  return undefined;
}

/** Any ledger failure refuses rather than permits. */
async function withBudget<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw error instanceof PlanningBudgetError ? error : new PlanningBudgetError();
  }
}

export type Reservation = {
  approvalId: string;
  reservedTokens: number;
};

/**
 * Reserve tokens atomically.
 *
 * Node owns this reservation. Python verifies affordability independently but
 * does not debit, so one logical provider attempt is charged exactly once —
 * the M4.2 defect this milestone corrects.
 *
 * The conditional update is the safety property: it only matches when the
 * approval is unexpired, unrevoked, for this task and model, and still has room
 * for the full reservation. Two concurrent callers cannot both win.
 */
export async function reservePlanningBudget(input: {
  approvalId: string;
  task: string;
  model: string;
  maxTokens: number;
  maxRequests: number;
  expiresAt: number;
  reservedTokens?: number;
}): Promise<Reservation> {
  const reservedTokens = input.reservedTokens ?? PLANNING_RESERVED_TOKENS;
  if (!Number.isSafeInteger(reservedTokens) || reservedTokens <= 0) throw new PlanningBudgetError();

  const updated = await withBudget(async () => {
    // The ledger row is created on first use; a concurrent creator is harmless.
    await prisma.llmApprovalBudget.createMany({
      data: [
        {
          id: input.approvalId,
          task: input.task,
          model: input.model,
          limitRequests: input.maxRequests,
          maxTokens: input.maxTokens,
          expiresAt: input.expiresAt
        }
      ],
      skipDuplicates: true
    });
    const result = await prisma.llmApprovalBudget.updateMany({
      where: {
        id: input.approvalId,
        task: input.task,
        model: input.model,
        maxTokens: input.maxTokens,
        expiresAt: { equals: input.expiresAt, gt: Date.now() / 1000 },
        revokedAt: null,
        usedTokens: { lte: input.maxTokens - reservedTokens }
      },
      data: { usedTokens: { increment: reservedTokens }, used: { increment: 1 } }
    });
    return result.count === 1;
  });

  if (!updated) throw new PlanningBudgetError();
  return { approvalId: input.approvalId, reservedTokens };
}

/**
 * Reconcile the single reservation after dispatch.
 *
 * Reported usage refunds the difference; **no report keeps the full
 * reservation spent**, because the provider may still have charged for it.
 * Refunds are bounded so a misreported number cannot drive the ledger negative.
 */
export async function reconcilePlanningBudget(input: {
  approvalId: string;
  reservedTokens: number;
  usage: ProviderUsage | null;
}): Promise<{ chargedTokens: number; refunded: number; usageReported: boolean }> {
  return reconcile(input);
}

/**
 * Release a reservation for an attempt that provably never dispatched.
 *
 * `reconcilePlanningBudget` deliberately retains the reservation when no usage
 * is reported, because an *uncertain* outcome may still have been billed. A
 * crash between reserving and writing the dispatch marker is a different case:
 * the provider was never contacted, so the tokens were consumed for nothing.
 *
 * Without this, each such crash silently drained the allowance and a retry
 * reserved again — repeated crashes cost budget with zero inference (measured:
 * two reservations, 65,536 tokens, no provider call).
 *
 * The caller must only reach this for a state it can prove is pre-dispatch.
 * It is idempotent: releasing an already-released or unknown reservation is a
 * no-op, so concurrent recovery workers cannot double-refund.
 */
export async function releaseUndispatchedReservation(input: {
  approvalId: string;
  reservedTokens: number;
  /** Unique per attempt, so a repeated release is recognised. */
  releaseToken: string;
}): Promise<{ released: boolean; refunded: number }> {
  if (!Number.isSafeInteger(input.reservedTokens) || input.reservedTokens <= 0)
    return { released: false, refunded: 0 };
  if (!/^[A-Za-z0-9_.:-]{8,128}$/.test(input.releaseToken)) return { released: false, refunded: 0 };

  // The release marker lives on the ledger row. Its uniqueness is what makes a
  // second concurrent release a no-op rather than a second refund.
  const released = await withBudget(async () => {
    const claimed = await prisma.llmApprovalBudget.updateMany({
      where: {
        id: input.approvalId,
        NOT: { releaseMarkers: { has: input.releaseToken } },
        usedTokens: { gte: input.reservedTokens }
      },
      data: {
        usedTokens: { decrement: input.reservedTokens },
        releaseMarkers: { push: input.releaseToken }
      }
    });
    return claimed.count === 1;
  });

  return released
    ? { released: true, refunded: input.reservedTokens }
    : { released: false, refunded: 0 };
}

async function reconcile(input: {
  approvalId: string;
  reservedTokens: number;
  usage: ProviderUsage | null;
}): Promise<{ chargedTokens: number; refunded: number; usageReported: boolean }> {
  const reported = input.usage?.usageReported ? input.usage.totalTokens : null;
  if (reported === null || !Number.isSafeInteger(reported) || reported < 0)
    return { chargedTokens: input.reservedTokens, refunded: 0, usageReported: false };

  if (reported >= input.reservedTokens)
    return { chargedTokens: reported, refunded: 0, usageReported: true };

  const refund = input.reservedTokens - reported;
  await withBudget(
    () => prisma.$executeRaw`
      UPDATE "llm_approval_budgets"
         SET "usedTokens" = GREATEST(0, "usedTokens" - ${refund}), "updatedAt" = now()
       WHERE "id" = ${input.approvalId}`
  );
  return { chargedTokens: reported, refunded: refund, usageReported: true };
}

/** Read the ledger for diagnostics. Never returns credentials. */
export async function planningBudgetStatus(
  approvalId: string
): Promise<{ usedTokens: number; maxTokens: number } | null> {
  const row = await withBudget(() =>
    prisma.llmApprovalBudget.findUnique({ where: { id: approvalId } })
  );
  if (!row) return null;
  const used = row.usedTokens;
  const max = row.maxTokens ?? 0;
  return { usedTokens: used, maxTokens: max };
}
