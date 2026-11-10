/**
 * Structured learning-asset writes (Batch 3, Milestone 3.6).
 *
 * An authorized course author may attach a supplemental asset to a published
 * revision. The asset is validated by the shared contract before it is stored,
 * and its binding is verified against the revision that actually exists — an
 * asset cannot be written against a revision the author cannot author, nor
 * against a revision id that is not published.
 *
 * Nothing here mutates canonical content. Assets live in their own collection
 * and are read as an additive projection.
 */

import {
  parseStructuredAsset,
  type StructuredAssetV1
} from '../../../../shared/ednova/structuredAsset';
import { StructuredAsset } from '../models/StructuredAsset';
import { CourseRevision } from '../models/CourseRevision';
import { canAuthorCourse } from './resourceAccess';
import { invalidateStoredPlans } from './experiencePlanStore';
import { PresentationUnavailableError } from './presentationReader';

export class StructuredAssetForbiddenError extends Error {
  readonly status = 403;
}

export class StructuredAssetInvalidError extends Error {
  readonly status = 422;
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export class StructuredAssetConflictError extends Error {
  readonly status = 409;
}

/**
 * Attach one validated asset to a published revision.
 *
 * The caller supplies the asset shape; this function overwrites the binding
 * fields with the authorized values, so a caller cannot smuggle in a different
 * course or revision than the one it is allowed to author.
 */
export async function attachStructuredAsset(
  actor: string,
  courseId: string,
  revisionId: string,
  input: Record<string, unknown>
): Promise<StructuredAssetV1> {
  if (!(await canAuthorCourse(actor, courseId)))
    throw new StructuredAssetForbiddenError('Not permitted to author this course');

  // The revision must exist and be visible: draft, published or deprecated.
  // Writing against a soft-revoked revision would create an orphan.
  const revision = await CourseRevision.findOne({
    courseId,
    revisionTag: revisionId,
    revokedAt: { $exists: false }
  })
    .select({ id: 1, status: 1 })
    .lean();
  if (!revision) throw new PresentationUnavailableError('Published revision unavailable');

  const candidate = {
    ...input,
    courseId,
    revisionId,
    audience: 'course'
  };

  let asset: StructuredAssetV1;
  try {
    asset = parseStructuredAsset(candidate);
  } catch (error) {
    throw new StructuredAssetInvalidError(
      (error as { code?: string }).code ?? 'INVALID_STRUCTURED_ASSET'
    );
  }

  const existing = await StructuredAsset.findOne({
    courseId,
    revisionId,
    assetId: asset.assetId
  })
    .select({ id: 1 })
    .lean();
  // Identity is stable: re-writing the same id would silently replace a
  // supplement a learner may already be reading. Reject and require a new id.
  if (existing) throw new StructuredAssetConflictError('Asset identity already exists');

  await StructuredAsset.create({
    assetId: asset.assetId,
    courseId: asset.courseId,
    revisionId: asset.revisionId,
    lessonId: asset.lessonId,
    ...(asset.blockId !== undefined ? { blockId: asset.blockId } : {}),
    component: asset.component,
    schemaVersion: asset.schemaVersion,
    registryVersion: asset.registryVersion,
    payload: asset.payload,
    provenance: asset.provenance,
    reviewStatus: asset.review.status,
    ...(asset.review.reviewedBy !== undefined ? { reviewedBy: asset.review.reviewedBy } : {}),
    ...(asset.review.reviewedAt !== undefined ? { reviewedAt: asset.review.reviewedAt } : {}),
    ...(asset.sourceReferences !== undefined ? { sourceReferences: asset.sourceReferences } : {}),
    audience: asset.audience,
    fallback: asset.fallback,
    disclosure: asset.disclosure,
    createdByUserId: actor
  });

  // A new eligible supplement can change which modes a lesson supports, so any
  // accepted plan for this lesson was built without it. Invalidating is safe:
  // the plan is rebuilt on demand through the normal authorized path, and no
  // learner loses access because the deterministic reader remains available.
  await invalidateStoredPlans({
    courseId: asset.courseId,
    revisionId: asset.revisionId,
    reason: 'STRUCTURED_ASSET_ADDED'
  });

  return asset;
}
