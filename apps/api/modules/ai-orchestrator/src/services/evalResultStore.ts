/**
 * EvalResult persistence helpers (F04 / EVAL-08).
 *
 * `upsertByCorrelation` is idempotent by `correlationId`: a replayed result
 * event preserves the first accepted document, so a step is never
 * double-counted. `listStepsForSession` returns the ordered per-step history a
 * backend can use to resume a session.
 *
 * This is the only writer to the eval_results table — the Python agents only
 * publish ai.results events and never touch the database.
 */

import { Prisma } from '../../../../src/generated/prisma/client';
import EvalResult from '../models/EvalResult';
import { EvalResultRecord } from './evalResultBuilder';

/**
 * @param {object} record fields produced by buildEvalResultRecord
 * @returns {Promise<string>} correlationId written
 */
export async function upsertByCorrelation(record: EvalResultRecord): Promise<string> {
  const doc = {
    correlationId: record.correlationId,
    messageId: record.messageId,
    userId: record.userId,
    sessionId: record.sessionId,
    step: record.step,
    status: record.status,
    masteryScore: record.masteryScore,
    scores: record.scores as unknown as Prisma.InputJsonValue,
    nextQuestion: record.nextQuestion,
    demonstratedBloomLevel: record.demonstratedBloomLevel,
    objectiveId: record.objectiveId,
    targetBloomLevel: record.targetBloomLevel || null
  };
  await EvalResult.upsertByCorrelation(doc);
  return doc.correlationId;
}

/**
 * @param {string} sessionId
 * @returns {Promise<Array>} step records ascending by step
 */
export async function listStepsForSession(sessionId: string, userId: string) {
  return EvalResult.findMany({ sessionId, userId }, { step: 'asc' });
}

export default { upsertByCorrelation, listStepsForSession };
module.exports = { upsertByCorrelation, listStepsForSession };
