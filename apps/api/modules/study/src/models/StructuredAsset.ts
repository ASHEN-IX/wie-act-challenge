import type {
  Prisma,
  StructuredAsset as StructuredAssetRow
} from '../../../../src/generated/prisma/client';
import { prisma } from '../../../../shared/database';
import { table } from './_table';

/**
 * A structured learning asset attached to one published revision.
 *
 * Assets are supplemental: they annotate or illustrate canonical content and
 * never replace it. `payload` is validated by `parseStructuredAsset` before it
 * is written, so the stored shape is always within the contract's limits.
 */
export type IStructuredAsset = Omit<StructuredAssetRow, 'payload' | 'sourceReferences'> & {
  _id: string;
  payload: unknown;
  sourceReferences?: unknown[] | null;
};

export const StructuredAsset = table<IStructuredAsset>({
  delegate: () => prisma.structuredAsset,
  jsonColumns: ['payload', 'sourceReferences'],
  columns: (row) => ({
    assetId: row.assetId,
    courseId: row.courseId,
    revisionId: row.revisionId,
    lessonId: row.lessonId,
    blockId: row.blockId,
    component: row.component,
    schemaVersion: row.schemaVersion,
    registryVersion: row.registryVersion,
    payload: row.payload as unknown as Prisma.InputJsonValue,
    provenance: row.provenance,
    reviewStatus: row.reviewStatus,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt,
    sourceReferences: row.sourceReferences as unknown as Prisma.InputJsonValue,
    audience: row.audience,
    fallback: row.fallback,
    disclosure: row.disclosure,
    createdByUserId: row.createdByUserId
  })
});

export default StructuredAsset;
