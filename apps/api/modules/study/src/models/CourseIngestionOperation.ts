import type { Prisma } from '../../../../src/generated/prisma/client';
import { prisma } from '../../../../shared/database';
import { table } from './_table';
import type { PublishIngestionParams } from '../services/ingestionJob';
import type { AiResultEnvelope } from '@noveris/shared/ai-messaging/envelope';

export type IngestionOperationState =
  'prepared' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'superseded';

export interface IngestionOperation extends Record<string, unknown> {
  id: string;
  correlationId: string;
  courseId: string;
  revisionId: string;
  userId: string;
  requestId?: string | null;
  fileRef: string;
  /** Display-only title captured with this operation for an exact retry/reconcile. */
  courseTitle?: string | null;
  files: NonNullable<PublishIngestionParams['files']>;
  state: IngestionOperationState;
  result?: Pick<AiResultEnvelope, 'type' | 'correlationId' | 'status' | 'payload' | 'error'> | null;
  resultApplied?: boolean;
  dispatchCount: number;
  lastDispatchedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  __v?: number;
}

export const CourseIngestionOperation = table<IngestionOperation>({
  delegate: () => prisma.courseIngestionOperation,
  jsonColumns: ['files', 'result'],
  // Non-null columns: a `$ne`/`$nin` filter needs no NULL branch for these.
  requiredColumns: ['correlationId', 'courseId', 'revisionId', 'userId', 'fileRef', 'state'],
  defaults: () => ({ files: [], resultApplied: false, dispatchCount: 0 }),
  columns: (row) => ({
    correlationId: row.correlationId,
    courseId: row.courseId,
    revisionId: row.revisionId,
    userId: row.userId,
    requestId: row.requestId,
    fileRef: row.fileRef,
    courseTitle: row.courseTitle,
    files: row.files as unknown as Prisma.InputJsonValue,
    state: row.state,
    result: row.result as unknown as Prisma.InputJsonValue,
    resultApplied: row.resultApplied,
    dispatchCount: row.dispatchCount,
    lastDispatchedAt: row.lastDispatchedAt
  })
});

export default CourseIngestionOperation;
