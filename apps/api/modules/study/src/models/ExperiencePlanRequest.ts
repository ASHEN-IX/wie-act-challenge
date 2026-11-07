import { Document, Model, Schema, model, models } from 'mongoose';

/**
 * One experience-plan generation attempt (Batch 4, Milestone 4.2).
 *
 * This is the durable record of *dispatch*, not of content. It exists so that:
 *
 *   - a duplicate request for the same authorized operation is refused while an
 *     attempt is active (idempotency)
 *   - a request that may have reached the provider is never silently retried
 *   - reserved and reported token usage are both accounted for
 *   - a learner-visible outcome can be audited without storing the proposal
 *
 * It deliberately does not store the model output. The validated plan is
 * projected on demand; the request row keeps only identities, states and
 * accounting, so a stored row can never become a source of trusted content.
 */
export interface IExperiencePlanRequest extends Document {
  requestId: string;
  /** Idempotency key: the same authorized operation maps to one row. */
  identity: string;
  courseId: string;
  revisionId: string;
  lessonId: string;
  mode: string;
  actor: string;
  provider: string;
  providerModel: string;
  /** Fingerprint of the trusted planning context. */
  contextFingerprint: string;
  state:
    | 'requested'
    | 'authorized'
    | 'reserved'
    | 'dispatched'
    | 'validating'
    | 'validated'
    | 'rejected'
    | 'failed'
    | 'uncertain'
    | 'cancelled';
  /** Safe failure/rejection code. Never a raw provider message. */
  code?: string;
  /** Validation stage that rejected the proposal, when applicable. */
  stage?: string;
  approvalId?: string;
  reservedTokens: number;
  reportedTokens?: number;
  usageReported: boolean;
  modelVersion?: string;
  /** Digest of the validated plan, for audit. Not the plan itself. */
  planDigest?: string;
  dispatchAt?: Date;
  finishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IExperiencePlanRequest>(
  {
    requestId: { type: String, required: true },
    identity: { type: String, required: true },
    courseId: { type: String, required: true },
    revisionId: { type: String, required: true },
    lessonId: { type: String, required: true },
    mode: { type: String, required: true },
    actor: { type: String, required: true },
    provider: { type: String, required: true },
    providerModel: { type: String, required: true },
    contextFingerprint: { type: String, required: true },
    state: {
      type: String,
      enum: [
        'requested',
        'authorized',
        'reserved',
        'dispatched',
        'validating',
        'validated',
        'rejected',
        'failed',
        'uncertain',
        'cancelled',
      ],
      required: true,
    },
    code: String,
    stage: String,
    approvalId: String,
    reservedTokens: { type: Number, required: true, default: 0 },
    reportedTokens: Number,
    usageReported: { type: Boolean, required: true, default: false },
    modelVersion: String,
    planDigest: String,
    dispatchAt: Date,
    finishedAt: Date,
  },
  { collection: 'experience_plan_requests', timestamps: true },
);

// One row per authorized operation. This is what makes a duplicate a duplicate.
schema.index({ identity: 1 }, { unique: true });
// Fast lookup for the "is an attempt already active?" guard.
schema.index({ courseId: 1, revisionId: 1, lessonId: 1, state: 1 });

export const ExperiencePlanRequest: Model<IExperiencePlanRequest> =
  models.ExperiencePlanRequest ||
  model<IExperiencePlanRequest>('ExperiencePlanRequest', schema);

/** States in which an attempt is still in flight. A duplicate request must not
 * start a second dispatch while one of these is active. */
export const ACTIVE_STATES = [
  'requested',
  'authorized',
  'reserved',
  'dispatched',
  'validating',
] as const;
