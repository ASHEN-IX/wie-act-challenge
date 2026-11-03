/** Authorized published revision → presentation projection (Milestone 3.1).
 *
 * Structural only: no model call, no new source, no content synthesis. Every
 * guard that protects the reading projection also applies here because this
 * surface loads through the same published-reading boundary. */

import {
  buildPublishedPresentation,
  type PublishedPresentationV1,
} from '../../../../shared/ednova/presentationDocument';
import { canonicalBlocks, loadPublishedReading } from './courseReader';

export class PresentationUnavailableError extends Error {
  readonly status = 409;
}

function compact(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function getPublishedPresentation(
  actor: string,
  courseId: string,
  revisionId?: string,
): Promise<PublishedPresentationV1> {
  const { context, revision, artifact, canonical } = await loadPublishedReading(
    actor,
    courseId,
    revisionId,
  );
  if (!canonical)
    throw new PresentationUnavailableError(
      'This revision has no canonical presentation. Use the deterministic source-faithful reader.',
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
      blocks: canonicalBlocks(
        lesson.blocks as Array<Record<string, unknown>>,
        mediaContext,
      ),
    })),
  }));

  const warnings = [
    'Source provenance is bound to the preserved document. Extraction fidelity, including symbols and layout, is unverified.',
    ...(canonical.quality?.publicationState === 'review_required'
      ? [
          'Extraction fidelity needs review. Source linkage does not establish mathematical correctness.',
        ]
      : []),
  ];

  return buildPublishedPresentation({
    courseId,
    revisionId: context.revisionId,
    contentHash: context.contentHash,
    canonicalContentHash: revision.contentDocumentHash,
    title: context.title,
    summary: compact(
      revision.summary || canonical.chapters.map((chapter) => chapter.title).join(' · '),
      2000,
    ),
    objectives: context.topics
      .flatMap((topic) => topic.objectives)
      .slice(0, 500)
      .map((objective) => ({
        objectiveId: compact(objective.objectiveId, 128) || 'objective',
        statement: compact(objective.statement, 2000) || 'Objective',
        bloomLevel: compact(objective.bloomLevel, 40) || 'understand',
      })),
    chapters,
    sources: artifact.metadata.documents.map((source) => ({
      documentId: source.documentId,
      contentHash: source.contentHash,
      pageNumber: null,
      href: `/api/v1/study/courses/${encodeURIComponent(courseId)}/revisions/${encodeURIComponent(context.revisionId)}/sources/${encodeURIComponent(source.documentId)}`,
    })),
    warnings,
  });
}
