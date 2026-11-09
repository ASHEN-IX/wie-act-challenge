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

/** One client per (uri) pair, reused. Opening and closing a client for every
 * accounting read was both slow and racy under concurrent test processes, and
 * the driver's handshake is not free. */
let pooled: { uri: string; client: MongoClient } | null = null;

async function budgetClient(uri: string): Promise<MongoClient> {
  if (pooled && pooled.uri === uri) return pooled.client;
  if (pooled) await pooled.client.close().catch(() => undefined);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
  await client.connect();
  pooled = { uri, client };
  return client;
}

/** Drop the pooled client. Callers that change the configured URI (tests,
 * shutdown) use this so the next call connects fresh. */
export async function closeBudgetClient(): Promise<void> {
  if (!pooled) return;
  const { client } = pooled;
  pooled = null;
  await client.close().catch(() => undefined);
}

async function withBudget<T>(run: (collection: Collection) => Promise<T>): Promise<T> {
  const uri = budgetUri();
  const dbName = budgetDb();
  if (!uri || !dbName) throw new PlanningBudgetError();
  let client: MongoClient;
  try {
    client = await budgetClient(uri);
  } catch {
    // Only a failure to *establish* the connection invalidates the pool. A
    // query that merely matched nothing must not tear it down, or every second
    // call in a process pays a reconnect.
    await closeBudgetClient();
    throw new PlanningBudgetError();
  }
  try {
    return await run(client.db(dbName).collection('llm_approval_budgets'));
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
  if (!Number.isSafeInteger(reservedTokens) || reservedTokens <= 0)
    throw new PlanningBudgetError();

  const updated = await withBudget((collection) =>
    collection.findOneAndUpdate(
      {
        id: input.approvalId as never,
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
  if (!/^[A-Za-z0-9_.:-]{8,128}$/.test(input.releaseToken))
    return { released: false, refunded: 0 };

  // The release marker lives on the ledger row. Its uniqueness is what makes a
  // second concurrent release a no-op rather than a second refund.
  const released = await withBudget(async (collection) => {
    const claimed = await (
      collection as unknown as {
        findOneAndUpdate: (filter: unknown, update: unknown, options: unknown) => Promise<unknown>;
      }
    ).findOneAndUpdate(
      {
        id: input.approvalId,
        releaseMarkers: { $ne: input.releaseToken },
        usedTokens: { $gte: input.reservedTokens },
      },
      {
        $inc: { usedTokens: -input.reservedTokens },
        $push: { releaseMarkers: input.releaseToken },
      },
      { returnDocument: 'after' },
    );
    return Boolean(claimed);
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
  await withBudget((collection) =>
    collection.updateOne(
      { id: input.approvalId as never },
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
    collection.findOne({ id: approvalId as never }),
  );
  if (!row) return null;
  const used = Number((row as Record<string, unknown>).usedTokens ?? 0);
  const max = Number((row as Record<string, unknown>).maxTokens ?? 0);
  return { usedTokens: used, maxTokens: max };
}
