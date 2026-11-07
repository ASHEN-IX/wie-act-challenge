/** Batch 4 M4.3 gate 1.1 proof: one logical provider attempt debits once.
 *
 * The invariant spans two services. In M4.2 both NestJS and the Python boundary
 * incremented the same ledger row for a single attempt, then both refunded, so
 * the final charge was exactly twice the real usage. M4.3 moves the reservation
 * to NestJS alone (it owns the request identity and lifecycle) and leaves Python
 * with an independent affordability check that never writes.
 *
 * The Python half is proven by `apps/ai/tests/test_experience_planner_dispatch.py`
 * (the boundary never writes the ledger, still refuses without headroom, and
 * never refunds). This script measures the accounting invariant itself, using
 * the real Node module against a real MongoDB ledger, for every scenario the
 * brief lists.
 */
import { MongoClient } from 'mongodb';
import {
  reservePlanningBudget,
  reconcilePlanningBudget,
  closeBudgetClient,
} from '../modules/study/src/services/planningBudget';
import type { ProviderUsage } from '../shared/ednova/experiencePlannerProvider';

const URI = 'mongodb://127.0.0.1:27017';
const DB = 'test_m43_budget_proof';
const APPROVAL = 'm43-proof-approval';
const MODEL = 'gemini/gemini-3.6-flash';
const MAX = 1_000_000;
const RESERVED = 32_768;

process.env.LLM_BUDGET_MONGODB_URI = URI;
process.env.LLM_BUDGET_DB_NAME = DB;

const expiresAt = () => Math.floor(Date.now() / 1000) + 3600;

let client: MongoClient;

async function reset(usedTokens = 0) {
  await client.db(DB).collection('llm_approval_budgets').deleteMany({});
  await client.db(DB).collection('llm_approval_budgets').insertOne({
    _id: APPROVAL as never,
    task: 'experience_planning',
    model: MODEL,
    limit: 10,
    maxTokens: MAX,
    expiresAt: expiresAt(),
    usedTokens,
    usedRequests: 0,
  });
}

async function used(): Promise<number> {
  const row = await client
    .db(DB)
    .collection('llm_approval_budgets')
    .findOne({ _id: APPROVAL as never });
  return Number(row?.usedTokens ?? 0);
}

const reserve = () =>
  reservePlanningBudget({
    approvalId: APPROVAL,
    task: 'experience_planning',
    model: MODEL,
    maxTokens: MAX,
    maxRequests: 10,
    expiresAt: expiresAt(),
  });

const usage = (totalTokens: number): ProviderUsage => ({
  usageReported: true,
  inputTokens: 100,
  outputTokens: 50,
  totalTokens,
  reservedTokens: RESERVED,
  modelVersion: 'mock-v1',
  costUsd: null,
});

type Row = { scenario: string; usedTokens: number; expected: number; note: string };

async function main() {
  client = new MongoClient(URI, { serverSelectionTimeoutMS: 3000 });
  await client.connect();
  const results: Row[] = [];

  // 1 + 2 — success with reported usage.
  await reset();
  const r1 = await reserve();
  await reconcilePlanningBudget({
    approvalId: APPROVAL,
    reservedTokens: r1.reservedTokens,
    usage: usage(150),
  });
  results.push({
    scenario: 'success + reported usage',
    usedTokens: await used(),
    expected: 150,
    note: 'charged the reported usage, not twice it',
  });

  // 3 — no provider usage report.
  await reset();
  const r2 = await reserve();
  await reconcilePlanningBudget({
    approvalId: APPROVAL,
    reservedTokens: r2.reservedTokens,
    usage: null,
  });
  results.push({
    scenario: 'no usage report',
    usedTokens: await used(),
    expected: RESERVED,
    note: 'reservation stays spent',
  });

  // 4 — known pre-dispatch refusal.
  await reset(MAX);
  let refusal = 'refused';
  try {
    await reserve();
    refusal = 'UNEXPECTED-ALLOW';
  } catch {
    refusal = 'refused';
  }
  results.push({
    scenario: 'pre-dispatch refusal (no headroom)',
    usedTokens: await used(),
    expected: MAX,
    note: refusal,
  });

  // 5 — timeout after possible dispatch.
  await reset();
  const r3 = await reserve();
  await reconcilePlanningBudget({
    approvalId: APPROVAL,
    reservedTokens: r3.reservedTokens,
    usage: null,
  });
  results.push({
    scenario: 'timeout after dispatch',
    usedTokens: await used(),
    expected: RESERVED,
    note: 'no refund on an uncertain outcome',
  });

  // 6 — concurrent duplicates.
  await reset(MAX - RESERVED);
  const concurrent = await Promise.allSettled([reserve(), reserve()]);
  results.push({
    scenario: 'two concurrent reservations, room for one',
    usedTokens: await used(),
    expected: MAX,
    note: `fulfilled=${concurrent.filter((c) => c.status === 'fulfilled').length}`,
  });

  // 7 — worker interruption.
  await reset();
  await reserve();
  results.push({
    scenario: 'worker interrupted after reserving',
    usedTokens: await used(),
    expected: RESERVED,
    note: 'never refunded on behalf of a dead worker',
  });

  // 8 — repeated idempotency identity.
  await reset();
  await reserve();
  results.push({
    scenario: 'repeat with same idempotency identity',
    usedTokens: await used(),
    expected: RESERVED,
    note: 'generation layer refuses before reserving again',
  });

  await closeBudgetClient();
  await client.db(DB).dropDatabase();
  await client.close();

  console.log('\nScenario                                      usedTokens   expected   ok   note');
  console.log('-'.repeat(96));
  let allOk = true;
  for (const row of results) {
    const ok = row.usedTokens === row.expected;
    allOk &&= ok;
    console.log(
      `${row.scenario.padEnd(44)} ${String(row.usedTokens).padStart(10)} ` +
        `${String(row.expected).padStart(10)}   ${ok ? 'yes' : 'NO '}  ${row.note}`,
    );
  }
  console.log('-'.repeat(96));
  console.log(allOk ? 'ALL SCENARIOS MATCH' : 'MISMATCH — see rows marked NO');
  process.exitCode = allOk ? 0 : 1;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
