/** Authoritative structured-asset review provenance (Batch 4, M4.2 — closes C3).
 *
 * M4.1 asked: "does this asset's review claim look consistent and correctly
 * bound?" That is not the same as "did an authorized person approve this exact
 * asset version?" This module answers the second question, from persisted
 * records only.
 *
 * The rule is deliberately strict:
 *
 *   - a decision is a row in `structured_asset_reviews`
 *   - it names the reviewer, the decision and the exact asset content hash
 *   - it must be approved, unrevoked, and bound to this course/revision/lesson
 *   - the reviewer must still hold author rights on the course right now
 *
 * Anything short of that is "not verified", and an asset that requires review
 * and is not verified never becomes learner-visible through a plan.
 */

import { createHash } from 'node:crypto';
import type { StructuredAssetV1 } from '../../../../shared/ednova/structuredAsset';
import { StructuredAssetReview } from '../models/StructuredAssetReview';
import { canAuthorCourse } from './resourceAccess';
import { invalidateStoredPlans } from './experiencePlanStore';

/** Content hash of an asset payload. Two assets with the same id but different
 * payloads hash differently, so approval cannot silently transfer across an
 * edit. Keys are sorted so the digest does not depend on insertion order. */
export function assetContentHash(asset: StructuredAssetV1): string {
  const canonical = (value: unknown): string => {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object')
      return (
        '{' +
        Object.keys(value)
          .sort()
          .map((key) => JSON.stringify(key) + ':' + canonical((value as Record<string, unknown>)[key]))
          .join(',') +
        '}'
      );
    return JSON.stringify(value);
  };
  const payload = canonical({
    assetId: asset.assetId,
    courseId: asset.courseId,
    revisionId: asset.revisionId,
    lessonId: asset.lessonId,
    blockId: asset.blockId ?? null,
    component: asset.component,
    payload: asset.payload,
    provenance: asset.provenance,
    disclosure: asset.disclosure,
  });
  return 'sha256:' + createHash('sha256').update(payload).digest('hex');
}

export type ReviewProvenance = {
  assetId: string;
  contentHash: string;
  /** A persisted approval covers this exact asset version and is still valid. */
  verified: boolean;
  reviewId: string | null;
  reviewerUserId: string | null;
  decidedAt: string | null;
  /** Why verification failed, for audit. Safe: never carries content. */
  reason:
    | 'verified'
    | 'no_decision'
    | 'rejected'
    | 'revoked'
    | 'version_mismatch'
    | 'binding_mismatch'
    | 'reviewer_not_authorized'
    | 'provenance_not_reviewable';
};

/** Provenance that may claim review at all.
 *
 * `instructor_authored` is included: an instructor-written asset still needs a
 * recorded approval before it is learner-visible. `deterministic_demo` is not,
 * because product-authored demonstration content has no instructor to review it.
 * `generated_proposal` never can. */
const REVIEWABLE_PROVENANCE = new Set([
  'source_derived',
  'instructor_authored',
  'reviewed_supplemental',
]);

/**
 * Verify review provenance for a set of assets.
 *
 * One database read, then an authorization check per distinct reviewer. The
 * assets come from the trusted loader, so they are already parsed and bound;
 * this only establishes whether their review claim has authority.
 */
export async function verifyReviewProvenance(
  assets: readonly StructuredAssetV1[],
  binding: { courseId: string; revisionId: string; lessonId: string },
): Promise<Map<string, ReviewProvenance>> {
  const results = new Map<string, ReviewProvenance>();
  if (assets.length === 0) return results;

  const hashes = new Map<string, string>();
  for (const asset of assets) hashes.set(asset.assetId, assetContentHash(asset));

  const rows = await StructuredAssetReview.find({
    courseId: binding.courseId,
    revisionId: binding.revisionId,
    assetId: { $in: assets.map((asset) => asset.assetId) },
  })
    .limit(200)
    .lean();

  const byAsset = new Map(rows.map((row) => [row.assetId, row] as const));
  // Reviewer authorization is checked per distinct reviewer, not per asset.
  const authorCache = new Map<string, boolean>();
  const isAuthor = async (userId: string): Promise<boolean> => {
    const cached = authorCache.get(userId);
    if (cached !== undefined) return cached;
    const allowed = await canAuthorCourse(userId, binding.courseId);
    authorCache.set(userId, allowed);
    return allowed;
  };

  for (const asset of assets) {
    const contentHash = hashes.get(asset.assetId)!;
    const base = {
      assetId: asset.assetId,
      contentHash,
      reviewId: null,
      reviewerUserId: null,
      decidedAt: null,
    };

    if (!REVIEWABLE_PROVENANCE.has(asset.provenance)) {
      results.set(asset.assetId, {
        ...base,
        verified: false,
        reason: 'provenance_not_reviewable',
      });
      continue;
    }

    const row = byAsset.get(asset.assetId);
    if (!row) {
      results.set(asset.assetId, { ...base, verified: false, reason: 'no_decision' });
      continue;
    }

    const record = {
      reviewId: row.reviewId,
      reviewerUserId: row.reviewerUserId,
      decidedAt: row.decidedAt.toISOString(),
    };

    if (row.decision !== 'approved') {
      results.set(asset.assetId, { ...base, ...record, verified: false, reason: 'rejected' });
      continue;
    }
    if (row.revokedAt) {
      results.set(asset.assetId, { ...base, ...record, verified: false, reason: 'revoked' });
      continue;
    }
    // The decision must cover *this* version of the asset.
    if (row.contentHash !== contentHash) {
      results.set(asset.assetId, {
        ...base,
        ...record,
        verified: false,
        reason: 'version_mismatch',
      });
      continue;
    }
    if (row.lessonId !== binding.lessonId) {
      results.set(asset.assetId, {
        ...base,
        ...record,
        verified: false,
        reason: 'binding_mismatch',
      });
      continue;
    }
    if (!(await isAuthor(row.reviewerUserId))) {
      results.set(asset.assetId, {
        ...base,
        ...record,
        verified: false,
        reason: 'reviewer_not_authorized',
      });
      continue;
    }

    results.set(asset.assetId, { ...base, ...record, verified: true, reason: 'verified' });
  }

  return results;
}

export class ReviewDecisionError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(code);
    this.name = 'ReviewDecisionError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Record an instructor decision for an asset.
 *
 * Only a current course author may decide, and only on an asset that exists in
 * this revision. Re-deciding supersedes the previous row for the same version.
 */
export async function recordAssetReviewDecision(
  actor: string,
  input: {
    courseId: string;
    revisionId: string;
    assetId: string;
    asset: StructuredAssetV1;
    decision: 'approved' | 'rejected';
    rationale?: string;
  },
): Promise<{ reviewId: string; decision: string; contentHash: string }> {
  if (!(await canAuthorCourse(actor, input.courseId)))
    throw new ReviewDecisionError(403, 'REVIEWER_NOT_AUTHORIZED');
  if (input.asset.courseId !== input.courseId || input.asset.revisionId !== input.revisionId)
    throw new ReviewDecisionError(409, 'ASSET_BINDING_MISMATCH');
  if (!REVIEWABLE_PROVENANCE.has(input.asset.provenance))
    throw new ReviewDecisionError(422, 'PROVENANCE_NOT_REVIEWABLE');

  const contentHash = assetContentHash(input.asset);
  const reviewId = `rev_${contentHash.slice(7, 23)}`;
  const now = new Date();

  await StructuredAssetReview.findOneAndUpdate(
    {
      courseId: input.courseId,
      revisionId: input.revisionId,
      assetId: input.assetId,
      contentHash,
    },
    {
      $set: {
        reviewId,
        courseId: input.courseId,
        revisionId: input.revisionId,
        assetId: input.assetId,
        contentHash,
        lessonId: input.asset.lessonId,
        decision: input.decision,
        reviewerUserId: actor,
        reviewerRole: 'instructor',
        decidedAt: now,
        ...(input.rationale ? { rationale: input.rationale.slice(0, 500) } : {}),
      },
      $unset: { revokedAt: 1, revokedByUserId: 1 },
    },
    { upsert: true, new: true },
  );

  // A decision changes review eligibility, and plans may have been accepted
  // while the previous decision stood. Withdrawing them is the safe direction:
  // a plan that depended on a now-rejected asset must not keep rendering it.
  await invalidateStoredPlans({
    courseId: input.courseId,
    revisionId: input.revisionId,
    reason: `ASSET_REVIEW_${input.decision.toUpperCase()}`,
  });

  return { reviewId, decision: input.decision, contentHash };
}
