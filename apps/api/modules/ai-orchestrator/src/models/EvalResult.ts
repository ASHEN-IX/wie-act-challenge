/**
 * EvalResult — per-step evaluation result record (F04 / EVAL-08).
 *
 * Persisted by the AI orchestrator when it consumes ai.results for completed
 * study.eval.step jobs. Each document is ONE step of ONE session. The record is
 * keyed by `correlationId` (unique, upserted) so a replayed result event is
 * idempotent — a step is never double-written or double-counted. This is the
 * raw per-step feed BLOOM-08 consumes (`demonstratedBloomLevel`) and the
 * step-history store the backend can read to resume a session.
 *
 * Write path: the Python agents ONLY publish ai.results events; they never
 * touch MongoDB. This model is where Mongo writes happen (Node side only).
 */

import mongoose, { Document, Model, Schema } from 'mongoose';

export type EvalStatus = 'MASTERY_CONFIRMED' | 'FAILED' | 'CONTINUE';

export const EVAL_STATUSES: EvalStatus[] = ['MASTERY_CONFIRMED', 'FAILED', 'CONTINUE'];

export interface IEvalResult extends Document {
  correlationId: string;
  messageId: string;
  userId: string;
  sessionId: string;
  step: number;
  status: EvalStatus;
  masteryScore: number | null;
  scores: Record<string, number>;
  nextQuestion: string | null;
  demonstratedBloomLevel: string | null;
  objectiveId: string | null;
  targetBloomLevel: string | null;
  createdAt: Date;
}

const evalResultSchema = new Schema<IEvalResult>(
  {
    correlationId: { type: String, required: true, unique: true },
    messageId: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    step: { type: Number, required: true },
    status: {
      type: String,
      enum: EVAL_STATUSES,
      required: true,
      index: true
    },
    masteryScore: { type: Number, default: null, min: 0, max: 1 },
    scores: { type: Schema.Types.Mixed, default: {} },
    nextQuestion: { type: String, default: null },
    demonstratedBloomLevel: { type: String, default: null },
    objectiveId: { type: String, default: null },
    // EVAL-02b: target Bloom level resolved server-side from the objective,
    // carried through the worker result feed for BLOOM-08 competency updates.
    targetBloomLevel: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
  },
  {
    collection: 'eval_results'
  }
);

// Composite index for resuming a session's step history in order.
evalResultSchema.index({ sessionId: 1, step: 1 });

// BLOOM-08 raw feed: find steps that demonstrated a given level.
evalResultSchema.index({ demonstratedBloomLevel: 1 });

const EvalResult =
  (mongoose.models.EvalResult as Model<IEvalResult>) ||
  mongoose.model<IEvalResult>('EvalResult', evalResultSchema);
export default EvalResult;
module.exports = EvalResult;
