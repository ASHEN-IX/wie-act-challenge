import type { StructuredAssetReview as StructuredAssetReviewRow } from '../../../../src/generated/prisma/client';
import { prisma } from '../../../../shared/database';
import { table } from './_table';

/**
 * An authoritative instructor review decision for one structured asset version.
 *
 * A decision binds to `contentHash`, not to an asset id alone, so editing the
 * payload invalidates it rather than silently inheriting approval. A decision
 * records who decided and when, and is revocable. An AI provider can never write
 * here, and no proposal field can create one.
 */
export type IStructuredAssetReview = StructuredAssetReviewRow & { _id: string };

export const StructuredAssetReview = table<IStructuredAssetReview>({
  delegate: () => prisma.structuredAssetReview,
  columns: (row) => ({
    reviewId: row.reviewId,
    courseId: row.courseId,
    revisionId: row.revisionId,
    assetId: row.assetId,
    contentHash: row.contentHash,
    lessonId: row.lessonId,
    decision: row.decision,
    reviewerUserId: row.reviewerUserId,
    reviewerRole: row.reviewerRole,
    decidedAt: row.decidedAt,
    rationale: row.rationale,
    revokedAt: row.revokedAt,
    revokedByUserId: row.revokedByUserId
  })
});

export default StructuredAssetReview;
