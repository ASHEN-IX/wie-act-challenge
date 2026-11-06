import { Document, Model, Schema, model, models } from 'mongoose';

/**
 * A structured learning asset attached to one published revision.
 *
 * Assets are supplemental: they annotate or illustrate canonical content and
 * never replace it. `payload` is validated by `parseStructuredAsset` before it
 * is written, so the stored shape is always within the contract's limits.
 */
export interface IStructuredAsset extends Document {
  assetId: string;
  courseId: string;
  revisionId: string;
  lessonId: string;
  blockId?: string;
  component: string;
  schemaVersion: string;
  registryVersion: string;
  payload: unknown;
  provenance: string;
  reviewStatus: string;
  reviewedBy?: string;
  reviewedAt?: string;
  sourceReferences?: unknown[];
  audience: 'course';
  fallback: string;
  disclosure: string;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IStructuredAsset>(
  {
    assetId: { type: String, required: true },
    courseId: { type: String, required: true },
    revisionId: { type: String, required: true },
    lessonId: { type: String, required: true },
    blockId: String,
    component: { type: String, required: true },
    schemaVersion: { type: String, required: true },
    registryVersion: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    provenance: { type: String, required: true },
    reviewStatus: { type: String, required: true },
    reviewedBy: String,
    reviewedAt: String,
    sourceReferences: { type: [Schema.Types.Mixed], default: undefined },
    audience: { type: String, enum: ['course'], required: true },
    fallback: { type: String, required: true },
    disclosure: { type: String, required: true },
    createdByUserId: { type: String, required: true },
  },
  { timestamps: true },
);

// One asset identity per revision: identity is stable, not versioned by write.
schema.index({ courseId: 1, revisionId: 1, assetId: 1 }, { unique: true });
schema.index({ courseId: 1, revisionId: 1, lessonId: 1 });

export const StructuredAsset: Model<IStructuredAsset> =
  models.StructuredAsset || model<IStructuredAsset>('StructuredAsset', schema);
