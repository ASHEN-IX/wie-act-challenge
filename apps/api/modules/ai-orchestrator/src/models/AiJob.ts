/**
 * AiJob — persisted AI job state machine (F01 / AI-COM-07).
 *
 * Every AI operation creates an AiJob in PENDING and returns its jobId
 * immediately (202). Result events correlate via correlationId. Terminal jobs
 * get expireAt = +30d so Mongo's TTL index cleans them up.
 */

import mongoose, { Document, Model, Schema } from 'mongoose';
import crypto from 'crypto';

export type JobStatus = 'PENDING' | 'PROCESSING' | 'RETRYING' | 'COMPLETED' | 'FAILED';

export const JOB_STATUSES: JobStatus[] = [
  'PENDING',
  'PROCESSING',
  'RETRYING',
  'COMPLETED',
  'FAILED'
];

// Allowed transitions; anything else is rejected.
// PENDING -> COMPLETED/FAILED covers result races (worker finishes before
// the orchestrator observes PROCESSING).
const TRANSITIONS: Record<string, string[]> = {
  PENDING: ['PROCESSING', 'COMPLETED', 'FAILED'],
  PROCESSING: ['COMPLETED', 'FAILED', 'RETRYING'],
  RETRYING: ['PROCESSING', 'COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: []
};

export interface JobResourceScope {
  courseId?: string;
  sessionId?: string;
  objectiveId?: string;
  step?: number;
}

export interface IAiJob extends Document {
  resourceScope?: JobResourceScope;
  jobId: string;
  type: string;
  userId: string;
  requestId?: string;
  correlationId: string;
  messageId: string;
  status: JobStatus;
  result: unknown;
  error: string | null;
  attempts: number;
  fallbackUsed: boolean;
  createdAt: Date;
  updatedAt: Date;
  expireAt: Date | null;
  transitionTo(nextStatus: JobStatus | string): Promise<IAiJob>;
}

export interface IAiJobModel extends Model<IAiJob> {
  createPending(params: {
    type: string;
    userId: string;
    requestId?: string;
    correlationId: string;
    messageId: string;
    payloadSnapshot?: unknown;
  }): Promise<IAiJob>;
  completeByCorrelation(
    correlationId: string,
    payload?: unknown,
    binding?: Pick<IAiJob, 'userId' | 'messageId' | 'type' | 'requestId'>
  ): Promise<IAiJob | null>;
  failByCorrelation(
    correlationId: string,
    sanitizedError?: string,
    binding?: Pick<IAiJob, 'userId' | 'messageId' | 'type' | 'requestId'>
  ): Promise<IAiJob | null>;
}

const aiJobSchema = new Schema<IAiJob, IAiJobModel>(
  {
    jobId: { type: String, default: () => crypto.randomUUID(), unique: true },
    type: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    requestId: { type: String },
    correlationId: { type: String, required: true, index: true },
    messageId: { type: String, required: true },
    status: {
      type: String,
      enum: JOB_STATUSES,
      default: 'PENDING',
      index: true
    },
    resourceScope: { type: Schema.Types.Mixed },
    result: { type: Schema.Types.Mixed, default: null },
    error: {
      type: String,
      default: null,
      maxlength: 512 // sanitized only — no stacks / connection strings
    },
    attempts: { type: Number, default: 0 },
    fallbackUsed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    expireAt: { type: Date, default: null }
  },
  {
    collection: 'ai_jobs',
    minimize: false // An explicit empty scope identifies authorized source-free jobs.
  }
);

aiJobSchema.index({ userId: 1, createdAt: -1 });

// TTL sweep for terminal jobs (expireAt set on completion/failure).
aiJobSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

aiJobSchema.methods.transitionTo = function transitionTo(nextStatus: string) {
  const allowed = TRANSITIONS[this.status] || [];
  if (!allowed.includes(nextStatus)) {
    const err = new Error(`invalid job transition ${this.status} -> ${nextStatus}`) as Error & {
      code?: string;
    };
    err.code = 'EINVALIDTRANSITION';
    throw err;
  }
  this.status = nextStatus as JobStatus;
  if (nextStatus === 'COMPLETED' || nextStatus === 'FAILED') {
    this.expireAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  this.updatedAt = new Date();
  return this.save();
};

/** Create a PENDING job from a published envelope's identifiers. */
aiJobSchema.statics.createPending = function createPending({
  type,
  userId,
  requestId,
  correlationId,
  messageId,
  payloadSnapshot = undefined
}: {
  type: string;
  userId: string;
  requestId?: string;
  correlationId: string;
  messageId: string;
  payloadSnapshot?: unknown;
}) {
  const source =
    payloadSnapshot && typeof payloadSnapshot === 'object'
      ? (payloadSnapshot as Record<string, unknown>)
      : {};
  const resourceScope: JobResourceScope = {};
  for (const field of ['courseId', 'sessionId', 'objectiveId'] as const) {
    const value = source[field] ?? source[field.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())];
    if (typeof value === 'string' && value) resourceScope[field] = value;
  }
  if (typeof source.step === 'number') resourceScope.step = source.step;
  return this.create({
    type,
    userId,
    requestId,
    correlationId,
    messageId,
    status: 'PENDING',
    resourceScope
  });
};

/** Correlated completion — idempotent: replayed results are ignored once terminal. */
aiJobSchema.statics.completeByCorrelation = async function completeByCorrelation(
  correlationId: string,
  payload?: unknown,
  binding?: Pick<IAiJob, 'userId' | 'messageId' | 'type' | 'requestId'>
) {
  const filter = { correlationId, ...binding };
  const job = await this.findOneAndUpdate(
    { ...filter, status: { $in: ['PENDING', 'PROCESSING', 'RETRYING'] } },
    {
      $set: {
        status: 'COMPLETED',
        result: payload || {},
        updatedAt: new Date(),
        expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    },
    { new: true }
  );
  return job || this.findOne(filter);
};

aiJobSchema.statics.failByCorrelation = async function failByCorrelation(
  correlationId: string,
  sanitizedError?: string,
  binding?: Pick<IAiJob, 'userId' | 'messageId' | 'type' | 'requestId'>
) {
  const filter = { correlationId, ...binding };
  const job = await this.findOneAndUpdate(
    { ...filter, status: { $in: ['PENDING', 'PROCESSING', 'RETRYING'] } },
    {
      $set: {
        status: 'FAILED',
        error: String(sanitizedError || 'AI job failed').slice(0, 512),
        updatedAt: new Date(),
        expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    },
    { new: true }
  );
  return job || this.findOne(filter);
};

const AiJob =
  (mongoose.models.AiJob as IAiJobModel) ||
  mongoose.model<IAiJob, IAiJobModel>('AiJob', aiJobSchema);
export default AiJob;
module.exports = AiJob;
