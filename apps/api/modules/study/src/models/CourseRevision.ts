import type { CourseRevision as CourseRevisionRow } from '../../../../src/generated/prisma/client';
import { prisma } from '../../../../shared/database';
import { table } from './_table';

export const COURSE_REVISION_STATUSES = ['draft', 'published', 'deprecated'] as const;
export type CourseRevisionStatus = (typeof COURSE_REVISION_STATUSES)[number];

/** One captured source document of a revision (see `revisionSources`). */
export interface CourseRevisionSourceManifestEntry {
  documentId: string;
  filename: string;
  contentHash: string;
  provenance: 'extracted';
  storageRef?: string;
  mediaType?: string;
  extractionVersion?: '1.0' | '2.0';
  [key: string]: unknown;
}

/** The frozen formula-publication receipt stored on the source revision. */
export interface CourseRevisionFormulaPublication {
  targetTag?: string;
  projectionHash?: string;
  originalCanonicalHash?: string;
  sourceDraftId?: string;
  sourceTag?: string;
  sourceVersion?: number;
  canonical?: unknown;
  [key: string]: unknown;
}

/**
 * `version` is the old Mongoose `__v` optimistic-concurrency counter, now a real
 * integer column. Draft edits match it and increment it in one guarded write;
 * it is mirrored onto `__v` on read so call sites are unchanged.
 */
export type ICourseRevision = Omit<
  CourseRevisionRow,
  'topics' | 'contentDocument' | 'formulaPublication' | 'sourceManifest' | 'approvedActivities'
> & {
  _id: string;
  topics: unknown[];
  contentDocument?: unknown;
  formulaPublication?: CourseRevisionFormulaPublication | null;
  sourceManifest?: CourseRevisionSourceManifestEntry[] | null;
  approvedActivities?: unknown[] | null;
};

export const CourseRevision = table<ICourseRevision>({
  delegate: () => prisma.courseRevision,
  jsonColumns: [
    'topics',
    'contentDocument',
    'formulaPublication',
    'sourceManifest',
    'approvedActivities'
  ],
  defaults: () => ({ topics: [], status: 'draft', isInstructorReviewed: false }),
  columns: (row) => ({
    courseId: row.courseId,
    revisionTag: row.revisionTag,
    contentHash: row.contentHash,
    status: row.status,
    publishedByUserId: row.publishedByUserId,
    publishedAt: row.publishedAt,
    summary: row.summary,
    topics: row.topics,
    contentDocument: row.contentDocument,
    formulaPublication: row.formulaPublication,
    contentDocumentHash: row.contentDocumentHash,
    vectorIndexRef: row.vectorIndexRef,
    isInstructorReviewed: row.isInstructorReviewed,
    sourceManifest: row.sourceManifest,
    sourceManifestDigest: row.sourceManifestDigest,
    indexHash: row.indexHash,
    artifactHash: row.artifactHash,
    activationState: row.activationState,
    expectedActiveRevisionId: row.expectedActiveRevisionId,
    approvedActivities: row.approvedActivities,
    revokedAt: row.revokedAt
  })
});

export default CourseRevision;
