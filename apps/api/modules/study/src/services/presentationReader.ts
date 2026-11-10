/** Authorized published revision → presentation projection (Milestone 3.1).
 *
 * Structural only: no model call, no new source, no content synthesis. Every
 * guard that protects the reading projection also applies here because this
 * surface loads through the same published-reading boundary. */

import {
  buildPublishedPresentation,
  type PublishedPresentationV1
} from '../../../../shared/ednova/presentationDocument';
import {
  parseStructuredAsset,
  projectStructuredAssets,
  type PublishedStructuredAssetV1
} from '../../../../shared/ednova/structuredAsset';
import { StructuredAsset } from '../models/StructuredAsset';
import { canonicalBlocks, loadPublishedReading } from './courseReader';

export class PresentationUnavailableError extends Error {
  readonly status = 409;
}

function compact(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/**
 * Load the structured assets attached to one published revision.
 *
 * Authorization is already established: this is only called after
 * `loadPublishedReading` resolved the actor's access and pinned the revision.
 * Every stored asset is re-validated here, because the database is not a trust
 * boundary — a row written before a contract change must not reach the browser.
 *
 * A malformed asset is skipped, never thrown: an optional supplement failing to
 * validate must not take the whole lesson down. The learner keeps the static
 * fallback, which is the documented behaviour for a missing asset.
 */
async function loadStructuredAssets(
  courseId: string,
  revisionId: string
): Promise<PublishedStructuredAssetV1[]> {
  const rows = await StructuredAsset.find({ courseId, revisionId })
    .sort({ assetId: 1 })
    .limit(200)
    .lean();
  const valid = [];
  for (const row of rows) {
    try {
      valid.push(
        parseStructuredAsset({
          schemaVersion: row.schemaVersion,
          assetId: row.assetId,
          courseId: row.courseId,
          revisionId: row.revisionId,
          ...(row.blockId !== undefined ? { blockId: row.blockId } : {}),
          lessonId: row.lessonId,
          registryVersion: row.registryVersion,
          component: row.component,
          payload: row.payload,
          provenance: row.provenance,
          review: {
            status: row.reviewStatus,
            ...(row.reviewedBy !== undefined ? { reviewedBy: row.reviewedBy } : {}),
            ...(row.reviewedAt !== undefined ? { reviewedAt: row.reviewedAt } : {})
          },
          ...(row.sourceReferences !== undefined ? { sourceReferences: row.sourceReferences } : {}),
          audience: row.audience,
          fallback: row.fallback,
          disclosure: row.disclosure
        })
      );
    } catch {
      // Skipped deliberately: see the note above.
    }
  }
  return projectStructuredAssets(valid, { courseId, revisionId });
}

export async function getPublishedPresentation(
  actor: string,
  courseId: string,
  revisionId?: string
): Promise<PublishedPresentationV1> {
  const { context, revision, artifact, canonical } = await loadPublishedReading(
    actor,
    courseId,
    revisionId
  );
  if (!canonical)
    throw new PresentationUnavailableError(
      'This revision has no canonical presentation. Use the deterministic source-faithful reader.'
    );

  const mediaContext = { courseId, revisionId: context.revisionId };
  const chapters = canonical.chapters.map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    summary: compact(chapter.lessons.map((lesson) => lesson.summary).join(' '), 2000),
    lessons: chapter.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      summary: compact(lesson.summary, 2000),
      blocks: canonicalBlocks(lesson.blocks as Array<Record<string, unknown>>, mediaContext)
    }))
  }));

  const warnings = [
    'Source provenance is bound to the preserved document. Extraction fidelity, including symbols and layout, is unverified.',
    ...(canonical.quality?.publicationState === 'review_required'
      ? [
          'Extraction fidelity needs review. Source linkage does not establish mathematical correctness.'
        ]
      : [])
  ];

  return buildPublishedPresentation({
    courseId,
    revisionId: context.revisionId,
    contentHash: context.contentHash,
    canonicalContentHash: revision.contentDocumentHash,
    title: context.title,
    summary: compact(
      revision.summary || canonical.chapters.map((chapter) => chapter.title).join(' · '),
      2000
    ),
    objectives: context.topics
      .flatMap((topic) => topic.objectives)
      .slice(0, 500)
      .map((objective) => ({
        objectiveId: compact(objective.objectiveId, 128) || 'objective',
        statement: compact(objective.statement, 2000) || 'Objective',
        bloomLevel: compact(objective.bloomLevel, 40) || 'understand'
      })),
    chapters,
    sources: artifact.metadata.documents.map((source) => ({
      documentId: source.documentId,
      contentHash: source.contentHash,
      pageNumber: null,
      href: `/api/v1/study/courses/${encodeURIComponent(courseId)}/revisions/${encodeURIComponent(context.revisionId)}/sources/${encodeURIComponent(source.documentId)}`
    })),
    warnings
  });
}

/**
 * Published presentation plus the optional structured assets bound to it.
 *
 * The assets are additive and separate from the canonical projection: they are
 * supplements, labelled with their provenance, and the reader keeps the static
 * fallback wherever none applies. A revision with no assets returns an empty
 * list, so this method is safe to call on every published course.
 */
export async function getPublishedPresentationWithAssets(
  actor: string,
  courseId: string,
  revisionId?: string
): Promise<{
  presentation: PublishedPresentationV1;
  assets: PublishedStructuredAssetV1[];
}> {
  const presentation = await getPublishedPresentation(actor, courseId, revisionId);
  const assets = await loadStructuredAssets(courseId, presentation.revisionId);
  return { presentation, assets };
}
