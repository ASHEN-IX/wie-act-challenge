import { Document, Model, Schema, model, models } from 'mongoose';

/**
 * A persisted, accepted experience plan (Batch 4, Milestone 4.3).
 *
 * M4.2 kept only a digest, so a completed plan could not be retrieved for
 * normal learner use. This stores the plan body — but storing it does **not**
 * make it trusted. The validated-plan brand is a module-private symbol and does
 * not survive serialization, so a record read from here is exactly as untrusted
 * as raw provider output until the read path re-runs the trusted validator.
 *
 * Every read therefore re-verifies: authorization, exact revision, canonical
 * integrity, schema and registry compatibility, asset eligibility and persisted
 * review decisions, and then the seven-stage validator.
 */
export interface IExperiencePlanRecord extends Document {
  /** Deterministic identity: one accepted plan per (revision, lesson, mode,
   * fingerprint). A re-plan supersedes rather than stacks. */
  planId: string;
  courseId: string;
  revisionId: string;
  lessonId: string;
  mode: string;
  /** Canonical content hash of the revision this plan was built for. */
  contentHash: string;
  /** Fingerprint of the bounded planning context. */
  contextFingerprint: string;
  planSchemaVersion: string;
  registryVersion: string;
  presentationSchemaVersion: string;
  provider: string;
  providerModel: string;
  plannerImplementation: string;
  plannerVersion: string;
  planDigest: string;
  /** The accepted plan body, as proposed and validated. Untrusted on read. */
  plan: unknown;
  /** Who caused the plan to be generated (an author/operator, never a learner). */
  generatedBy: string;
  generatedAt: Date;
  /** Set when a newer plan for the same scope supersedes this one. */
  supersededAt?: Date;
  supersededByPlanId?: string;
  /** Set when the revision, registry or assets made this plan unusable. */
  invalidatedAt?: Date;
  invalidationReason?: string;
}

const schema = new Schema<IExperiencePlanRecord>(
  {
    planId: { type: String, required: true },
    courseId: { type: String, required: true },
    revisionId: { type: String, required: true },
    lessonId: { type: String, required: true },
    mode: { type: String, required: true },
    contentHash: { type: String, required: true },
    contextFingerprint: { type: String, required: true },
    planSchemaVersion: { type: String, required: true },
    registryVersion: { type: String, required: true },
    presentationSchemaVersion: { type: String, required: true },
    provider: { type: String, required: true },
    providerModel: { type: String, required: true },
    plannerImplementation: { type: String, required: true },
    plannerVersion: { type: String, required: true },
    planDigest: { type: String, required: true },
    // The body is validated on every read, so it is stored as opaque data.
    plan: { type: Schema.Types.Mixed, required: true },
    generatedBy: { type: String, required: true },
    generatedAt: { type: Date, required: true },
    supersededAt: Date,
    supersededByPlanId: String,
    invalidatedAt: Date,
    invalidationReason: String,
  },
  { collection: 'experience_plan_records', timestamps: true },
);

// One live plan per scope. A re-plan supersedes the previous row.
schema.index(
  { courseId: 1, revisionId: 1, lessonId: 1, mode: 1, contextFingerprint: 1 },
  { unique: true },
);
schema.index({ courseId: 1, revisionId: 1, lessonId: 1, mode: 1, supersededAt: 1 });

export const ExperiencePlanRecord: Model<IExperiencePlanRecord> =
  models.ExperiencePlanRecord ||
  model<IExperiencePlanRecord>('ExperiencePlanRecord', schema);
