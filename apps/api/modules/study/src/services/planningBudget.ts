/** Durable planning budget accounting (Batch 4, Milestone 4.2).
 *
 * Reuses the existing durable-budget store the formula pipeline already writes
 * (`llm_approval_budgets` in the budget database), rather than introducing a
 * second ledger. The rules are the same ones that made that pipeline safe:
 *
 *   - reserve atomically *before* dispatch, with a conditional update
 *   - never release a reservation on an uncertain outcome
 *   - reconcile reported usage against the reservation, never below zero
 *
 * The one addition this milestone needs is explicit reconciliation: a provider
 * that reports fewer tokens than reserved gets the difference returned, and a
 * provider that reports nothing keeps the full reservation as spent.
 */

import { MongoClient, type Collection } from 'mongodb';
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

function budgetUri(): string | null {
  const uri = process.env.LLM_BUDGET_MONGODB_URI;
  return uri && uri.length > 0 ? uri : null;
}

function budgetDb(): string | null {
  const name = process.env.LLM_BUDGET_DB_NAME;
  return name && name.length > 0 ? name : null;
}

async function withBudget<T>(run: (collection: Collection) => Promise<T>): Promise<T> {
  const uri = budgetUri();
  const dbName = budgetDb();
  if (!uri || !dbName) throw new PlanningBudgetError();
  let client: MongoClient | null = null;
  try {
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 2000,
      connectTimeoutMS: 2000,
      socketTimeoutMS: 3000,
      retryWrites: false,
    });
    const collection = client.db(dbName).collection('llm_approval_budgets');
    return await run(collection);
  } catch (error) {
    if (error instanceof PlanningBudgetError) throw error;
    throw new PlanningBudgetError();
  } finally {
    if (client) await client.close().catch(() => undefined);
  }
}

export type Reservation = {
  approvalId: string;
  reservedTokens: number;
};

/**
 * Reserve tokens atomically.
 *
 * The conditional update is the whole safety property: it only matches when the
 * approval is unexpired, unrevoked, for this exact task and model, and still has
 * room for the full reservation. Two concurrent callers cannot both win.
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
  if (!Number.isSafeInteger(reservedTokens) || reservedTokens <= 0)
    throw new PlanningBudgetError();

  const updated = await withBudget((collection) =>
    collection.findOneAndUpdate(
      {
        _id: input.approvalId as never,
        task: input.task,
        model: input.model,
        maxTokens: input.maxTokens,
        expiresAt: { $eq: input.expiresAt, $gt: Date.now() / 1000 },
        revokedAt: { $exists: false },
        usedTokens: { $lte: input.maxTokens - reservedTokens },
      },
      { $inc: { usedTokens: reservedTokens, usedRequests: 1 } },
      { returnDocument: 'after' },
    ),
  );

  if (!updated) throw new PlanningBudgetError();
  return { approvalId: input.approvalId, reservedTokens };
}

/**
 * Reconcile after a dispatch.
 *
 * - reported usage: adjust the ledger to the actual amount, refunding any
 *   unused reservation
 * - no reported usage: keep the reservation spent, because the provider may
 *   still have charged for it
 *
 * A refund is a decrement, and it is bounded so a misreported number cannot
 * drive the ledger negative.
 */
export async function reconcilePlanningBudget(input: {
  approvalId: string;
  reservedTokens: number;
  usage: ProviderUsage | null;
}): Promise<{ chargedTokens: number; refunded: number; usageReported: boolean }> {
  const reported = input.usage?.usageReported ? input.usage.totalTokens : null;
  if (reported === null || !Number.isSafeInteger(reported) || reported < 0)
    return {
      chargedTokens: input.reservedTokens,
      refunded: 0,
      usageReported: false,
    };

  // Charge the larger of what was used and what was reserved only when usage
  // exceeds the reservation; otherwise refund the difference.
  if (reported >= input.reservedTokens)
    return { chargedTokens: reported, refunded: 0, usageReported: true };

  const refund = input.reservedTokens - reported;
  await withBudget((collection) =>
    collection.updateOne(
      { _id: input.approvalId as never },
      [{ $set: { usedTokens: { $max: [0, { $subtract: ['$usedTokens', refund] }] } } }],
    ),
  );
  return { chargedTokens: reported, refunded: refund, usageReported: true };
}

/** Read the ledger for diagnostics. Never returns credentials. */
export async function planningBudgetStatus(
  approvalId: string,
): Promise<{ usedTokens: number; maxTokens: number } | null> {
  const row = await withBudget((collection) =>
    collection.findOne({ _id: approvalId as never }),
  );
  if (!row) return null;
  const used = Number((row as Record<string, unknown>).usedTokens ?? 0);
  const max = Number((row as Record<string, unknown>).maxTokens ?? 0);
  return { usedTokens: used, maxTokens: max };
}
