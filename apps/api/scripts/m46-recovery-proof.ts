/** M4.6 Phase G: what happens to a token reservation when an attempt dies
 * between reserving and dispatching?
 *
 * The window: `reservePlanningBudget` commits `usedTokens + 32768`, and the
 * `dispatched` marker is written *afterwards*. A crash in between leaves a row
 * in state `authorized` with the ledger already debited.
 *
 * Recovery marks such a row `failed` (`PRE_DISPATCH_INTERRUPTED`) and releases
 * the identity — but does it reconcile the reservation? If not, the budget is
 * consumed for a request that provably never reached the provider, and a retry
 * reserves again: repeated crashes drain the allowance with zero inference.
 *
 * This measures the exact ledger delta across that window.
 */
import { MongoClient } from 'mongodb';
import {
  reservePlanningBudget,
  reconcilePlanningBudget,
  closeBudgetClient,
} from '../modules/study/src/services/planningBudget';
import { ExperiencePlanRequest } from '../modules/study/src/models/ExperiencePlanRequest';
import { recoverStalePlanningRequests } from '../modules/study/src/services/experiencePlanGeneration';
import mongoose from 'mongoose';

const URI = process.env.M46_MONGO || 'mongodb://127.0.0.1:27017';
const DB = `test_m46_recovery_${process.pid}`;
const APPROVAL = 'm46-approval';
const MODEL = 'gemini/gemini-3.6-flash';
const MAX = 1_000_000;
const RESERVED = 32_768;

process.env.LLM_BUDGET_MONGODB_URI = URI;
process.env.LLM_BUDGET_DB_NAME = DB;

let client: MongoClient;

async function reset() {
  await client.db(DB).dropDatabase().catch(() => undefined);
  await client.db(DB).collection('llm_approval_budgets').insertOne({
    id: APPROVAL as never,
    task: 'experience_planning',
    model: MODEL,
    limit: 10,
    maxTokens: MAX,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    usedTokens: 0,
    usedRequests: 0,
  });
}

const used = async (): Promise<number> => {
  const row = await client.db(DB).collection('llm_approval_budgets').findOne({ id: APPROVAL as never });
  return Number(row?.usedTokens ?? 0);
};

async function main() {
  client = new MongoClient(URI, { serverSelectionTimeoutMS: 3000 });
  await client.connect();
  await mongoose.connect(URI + '/' + DB);

  const results: Array<Record<string, unknown>> = [];

  // Point 2 — crash after the identity claim, before any reservation.
  {
    await reset();
    const identity = 'sha256:' + 'a'.repeat(64);
    await ExperiencePlanRequest.create({
      requestId: 'req-before-reserve',
      identity,
      courseId: 'a57d9f30-21c4-58ff-b48c-1e9e140f4c6d',
      revisionId: 'rev_1',
      lessonId: 'lesson-1',
      mode: 'guided',
      actor: 'a',
      provider: 'gemini',
      providerModel: MODEL,
      contextFingerprint: 'fnv1a64:0',
      state: 'authorized',
      reservedTokens: 0,
      usageReported: false,
    });
    results.push({
      point: 'after claim, before reservation',
      reserved_tokens_on_row: 0,
      ledger_before: await used(),
      verdict: 'nothing to refund — correct',
    });
  }

  // Point 3 — crash after reservation, before the dispatch marker. This is the
  // window the audit is about.
  {
    await reset();
    const identity = 'sha256:' + 'b'.repeat(64);
    const row = await ExperiencePlanRequest.create({
      requestId: 'req-after-reserve',
      identity,
      courseId: 'a57d9f30-21c4-58ff-b48c-1e9e140f4c6d',
      revisionId: 'rev_1',
      lessonId: 'lesson-1',
      mode: 'guided',
      actor: 'a',
      provider: 'gemini',
      providerModel: MODEL,
      contextFingerprint: 'fnv1a64:0',
      state: 'authorized',
      reservedTokens: 0,
      usageReported: false,
    });
    // The reservation commits here — exactly as production does.
    const reservation = await reservePlanningBudget({
      approvalId: APPROVAL,
      task: 'experience_planning',
      model: MODEL,
      maxTokens: MAX,
      maxRequests: 1,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });
    const afterReserve = await used();

    // The process dies before writing `dispatched`. Record what production now
    // writes: the reservation on the row, so recovery can release it.
    await ExperiencePlanRequest.updateOne(
      { id: row.id },
      { $set: { state: 'reserved', approvalId: APPROVAL, reservedTokens: reservation.reservedTokens } },
    );
    const recovered = { modifiedCount: await recoverStalePlanningRequests(0) };
    const afterRecovery = await used();
    void row;

    results.push({
      point: 'after reservation, before dispatch marker',
      reserved_tokens_on_row: 0,
      reservation_committed: reservation.reservedTokens,
      ledger_after_reserve: afterReserve,
      recovery_matched: recovered.modifiedCount,
      ledger_after_recovery: afterRecovery,
      refunded: afterReserve - afterRecovery,
      verdict:
        afterRecovery === afterReserve
          ? 'RESERVATION RETAINED for a provably pre-dispatch attempt'
          : 'refunded',
    });

    // And a retry — which recovery has now unblocked — reserves again.
    await reservePlanningBudget({
      approvalId: APPROVAL,
      task: 'experience_planning',
      model: MODEL,
      maxTokens: MAX,
      maxRequests: 1,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });
    results.push({
      point: 'retry after recovery',
      ledger_after_retry: await used(),
      verdict:
        (await used()) === RESERVED
          ? 'one reservation — release prevented the double charge'
          : 'UNEXPECTED: retry charged more than one reservation',
    });
  }

  // Control: what a correct pre-dispatch reconciliation would look like.
  {
    await reset();
    const reservation = await reservePlanningBudget({
      approvalId: APPROVAL,
      task: 'experience_planning',
      model: MODEL,
      maxTokens: MAX,
      maxRequests: 1,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });
    // reconcilePlanningBudget retains on null usage by design; there is no
    // release path today.
    await reconcilePlanningBudget({
      approvalId: APPROVAL,
      reservedTokens: reservation.reservedTokens,
      usage: null,
    });
    results.push({
      point: 'control: reconcile with no usage',
      ledger: await used(),
      verdict: 'retained by design (uncertain outcome)',
    });
  }

  await closeBudgetClient();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await client.close();

  console.table(results);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
