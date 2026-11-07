import { Document, Model, Schema, model, models } from 'mongoose';

/**
 * An authoritative instructor review decision for one structured asset version.
 *
 * Batch 4.1 verified review claims by internal consistency: a reviewer name, a
 * timestamp, and the asset's own binding. That proves a claim is *shaped* like a
 * review, not that a person made one. This collection is the missing authority:
 * a decision exists as its own persisted row, written by an authorized reviewer,
 * and it names the exact asset version it applies to.
 *
 * Two properties matter and are enforced by the schema and the service:
 *
 *   - a decision binds to `contentHash`, not to an asset id alone, so editing
 *     the payload invalidates it rather than silently inheriting approval
 *   - a decision records who decided and when, and is revocable
 *
 * An AI provider can never write here, and no proposal field can create one.
 */
export interface IStructuredAssetReview extends Document {
  reviewId: string;
  courseId: string;
  revisionId: string;
  assetId: string;
  /** Exact asset content this decision covers. A payload edit changes it. */
  contentHash: string;
  lessonId: string;
  decision: 'approved' | 'rejected';
  reviewerUserId: string;
  reviewerRole: 'instructor' | 'owner';
  decidedAt: Date;
  /** Free-form rationale, bounded. Never rendered as course content. */
  rationale?: string;
  revokedAt?: Date;
  revokedByUserId?: string;
}

const schema = new Schema<IStructuredAssetReview>(
  {
    reviewId: { type: String, required: true },
    courseId: { type: String, required: true },
    revisionId: { type: String, required: true },
    assetId: { type: String, required: true },
    contentHash: { type: String, required: true },
    lessonId: { type: String, required: true },
    decision: { type: String, enum: ['approved', 'rejected'], required: true },
    reviewerUserId: { type: String, required: true },
    reviewerRole: { type: String, enum: ['instructor', 'owner'], required: true },
    decidedAt: { type: Date, required: true },
    rationale: String,
    revokedAt: Date,
    revokedByUserId: String,
  },
  { collection: 'structured_asset_reviews', timestamps: true },
);

// One live decision per asset version. A re-decision supersedes rather than
// stacks, so "which decision applies" is never ambiguous.
schema.index({ courseId: 1, revisionId: 1, assetId: 1, contentHash: 1 }, { unique: true });
schema.index({ courseId: 1, revisionId: 1, lessonId: 1 });

export const StructuredAssetReview: Model<IStructuredAssetReview> =
  models.StructuredAssetReview ||
  model<IStructuredAssetReview>('StructuredAssetReview', schema);
