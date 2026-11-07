/** One independent process in the M4.5 cross-process idempotency proof.
 *
 * Claims a request identity and, if it wins, reserves budget — mirroring the
 * production path exactly. Prints one word: `reserved`, `duplicate` or `error`.
 *
 * Env: M45_IDENTITY, M45_DB, M45_APPROVAL, M45_EXPIRES.
 */
import mongoose from 'mongoose';
import { ExperiencePlanRequest } from '../modules/study/src/models/ExperiencePlanRequest';
import {
  reservePlanningBudget,
  closeBudgetClient,
} from '../modules/study/src/services/planningBudget';

const MODEL = 'gemini/gemini-3.6-flash';
const MAX = 1_000_000;

process.env.LLM_BUDGET_MONGODB_URI = process.env.M45_MONGO ?? 'mongodb://127.0.0.1:27017';
process.env.LLM_BUDGET_DB_NAME = process.env.M45_DB;

async function main() {
  const identity = process.env.M45_IDENTITY as string;
  await mongoose.connect((process.env.M45_MONGO ?? 'mongodb://127.0.0.1:27017') + '/' + process.env.M45_DB);
  try {
    const row = await ExperiencePlanRequest.findOneAndUpdate(
      { identity },
      {
        $setOnInsert: {
          requestId: `req-${process.pid}`,
          identity,
          courseId: '0123456789abcdef01234567',
          revisionId: 'rev_1',
          lessonId: 'lesson-1',
          mode: 'guided',
          actor: 'a',
          provider: 'gemini',
          providerModel: MODEL,
          contextFingerprint: 'fnv1a64:0',
          state: 'requested',
          reservedTokens: 0,
          usageReported: false,
        },
      },
      { upsert: true, new: true },
    ).lean();
    if (!row) throw new Error('no row');

    // The production claim: one conditional update, so only one process can
    // move `requested` forward.
    const claimed = await ExperiencePlanRequest.findOneAndUpdate(
      { _id: row._id, state: 'requested' },
      { $set: { state: 'authorized' } },
      { new: true },
    ).lean();
    if (!claimed) {
      process.stdout.write('duplicate');
      return;
    }

    await reservePlanningBudget({
      approvalId: process.env.M45_APPROVAL as string,
      task: 'experience_planning',
      model: MODEL,
      maxTokens: MAX,
      maxRequests: 10,
      expiresAt: Number(process.env.M45_EXPIRES),
    });
    await ExperiencePlanRequest.updateOne({ identity }, { $set: { state: 'dispatched' } });
    process.stdout.write('reserved');
  } catch {
    process.stdout.write('error');
  } finally {
    await closeBudgetClient();
    await mongoose.disconnect();
  }
}

void main();
