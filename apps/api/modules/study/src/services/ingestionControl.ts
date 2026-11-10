import crypto from 'node:crypto';
import { Course, CourseRevision } from '../models';
import { CourseIngestionOperation } from '../models/CourseIngestionOperation';
import { canManageCourse } from './resourceAccess';
import { publishCourseIngestionJob, type PublishIngestionParams } from './ingestionJob';

export class IngestionConflictError extends Error {
  readonly status = 409;
  readonly code = 'INGESTION_CONFLICT';
}

export async function enqueueCourseIngestionOperation(
  params: PublishIngestionParams,
  expectedJobId?: string
) {
  if (!params.revisionId) throw new IngestionConflictError('Exact revision required');
  const messageId = crypto.randomUUID(),
    correlationId = crypto.randomUUID();
  const operation = await CourseIngestionOperation.create({
    id: messageId,
    correlationId,
    courseId: params.courseId,
    revisionId: params.revisionId,
    userId: params.userId,
    fileRef: params.fileRef,
    courseTitle: params.courseTitle,
    files: params.files || [],
    requestId: params.requestId,
    state: 'prepared'
  });
  // This linkage is durable BEFORE publishing, including the fast-result path.
  const reserved = await Course.updateOne(
    {
      id: params.courseId,
      jobId: expectedJobId === undefined ? { $exists: false } : expectedJobId
    },
    {
      $set: {
        jobId: messageId,
        correlationId,
        status: 'processing',
        ingestStage: null,
        ingestProgress: 0,
        ingestDetail: 'queued',
        ingestError: ''
      }
    }
  );
  // `updateOne` resolves to `{ matchedCount, modifiedCount }`, which is truthy
  // even when nothing matched; the compare-and-set result is the count.
  if (!reserved.matchedCount) {
    await CourseIngestionOperation.updateOne({ id: messageId }, { $set: { state: 'superseded' } });
    throw new IngestionConflictError('Another ingestion operation already changed this course');
  }
  await dispatchIngestionOperation(messageId);
  return { jobId: operation.id as string, correlationId };
}

export async function dispatchIngestionOperation(jobId: string) {
  const operation = await CourseIngestionOperation.findById(jobId).lean();
  if (!operation || !['prepared', 'queued'].includes(operation.state))
    throw new IngestionConflictError('Operation cannot be dispatched');
  if (
    !(await Course.exists({
      id: operation.courseId,
      jobId,
      correlationId: operation.correlationId,
      status: 'processing'
    }))
  )
    throw new IngestionConflictError('Operation is no longer current');
  await CourseIngestionOperation.updateOne(
    { id: jobId, state: { $in: ['prepared', 'queued'] } },
    { $set: { state: 'queued', lastDispatchedAt: new Date() }, $inc: { dispatchCount: 1 } }
  );
  try {
    await publishCourseIngestionJob({
      // Recovery replays display metadata with the exact retained operation.
      courseTitle: operation.courseTitle ?? undefined,
      courseId: String(operation.courseId),
      revisionId: operation.revisionId,
      userId: operation.userId,
      fileRef: operation.fileRef,
      files: operation.files,
      requestId: operation.requestId ?? undefined,
      messageId: jobId,
      correlationId: operation.correlationId
    });
  } catch (error) {
    // An acknowledgement failure can mean the message was accepted. Retain the
    // same identity and all bytes; explicit reconciliation republishes safely.
    await Course.updateOne(
      {
        id: operation.courseId,
        jobId,
        correlationId: operation.correlationId,
        status: 'processing'
      },
      {
        $set: {
          status: 'failed',
          ingestError: 'Dispatch unconfirmed; reconcile this operation before retrying.',
          ingestDetail: 'dispatch_unconfirmed'
        }
      }
    );
    throw error;
  }
}

async function authorize(actor: string, courseId: string, expectedJobId: string) {
  if (!(await canManageCourse(actor, courseId)))
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  if (typeof expectedJobId !== 'string' || !expectedJobId)
    throw new IngestionConflictError('Expected operation identity required');
  const course = await Course.findOne({ id: courseId, jobId: expectedJobId });
  const operation = await CourseIngestionOperation.findOne({ id: expectedJobId, courseId }).lean();
  if (!course || !operation)
    throw new IngestionConflictError('Operation changed; reload its current state');
  return { course, operation };
}

export async function cancelIngestionOperation(
  actor: string,
  courseId: string,
  expectedJobId: string
) {
  const { operation } = await authorize(actor, courseId, expectedJobId);
  const stopped = await Course.updateOne(
    {
      id: courseId,
      jobId: expectedJobId,
      status: { $in: ['processing', 'failed'] },
      correlationId: operation.correlationId
    },
    {
      $set: {
        status: 'failed',
        ingestDetail: 'cancelled',
        ingestError: 'Ingestion cancelled by its author.'
      },
      $unset: { correlationId: 1 }
    }
  );
  if (!stopped.matchedCount)
    throw new IngestionConflictError('Operation already completed or cancelled');
  await CourseIngestionOperation.updateOne({ id: expectedJobId }, { $set: { state: 'cancelled' } });
  return { jobId: expectedJobId, status: 'cancelled', workerCancellation: 'at_stage_boundaries' };
}

export async function reconcileIngestionOperation(
  actor: string,
  courseId: string,
  expectedJobId: string
) {
  const { course, operation } = await authorize(actor, courseId, expectedJobId);
  if (operation.state === 'cancelled')
    throw new IngestionConflictError('Cancelled operations require an explicit retry');
  if (operation.result) {
    const { handleIngestResult } = await import('./ingestStatus.js');
    await handleIngestResult(operation.result);
    return { jobId: expectedJobId, status: 'reconciled_result' };
  }
  if (!['prepared', 'queued'].includes(operation.state))
    return {
      jobId: expectedJobId,
      status: course.status,
      detail: 'Worker processing or terminal outcome; no success inferred.'
    };
  await Course.updateOne(
    { id: courseId, jobId: expectedJobId, correlationId: operation.correlationId },
    { $set: { status: 'processing', ingestError: '', ingestDetail: 'queued' } }
  );
  await dispatchIngestionOperation(expectedJobId);
  return { jobId: expectedJobId, status: 'redispatched_same_identity' };
}

export async function retryIngestionOperation(
  actor: string,
  courseId: string,
  expectedJobId: string
) {
  const { course, operation } = await authorize(actor, courseId, expectedJobId);
  if (course.status !== 'failed')
    throw new IngestionConflictError('Only failed or cancelled operations can be retried');
  if (['prepared', 'queued'].includes(operation.state))
    throw new IngestionConflictError(
      'Unconfirmed dispatch must be reconciled with its original identity'
    );
  const revision = await CourseRevision.findOne({
    courseId,
    revisionTag: operation.revisionId
  }).lean();
  if (!revision?.sourceManifest?.length)
    throw new IngestionConflictError('Retained original manifest required');
  const revisionId = 'rev_' + crypto.randomUUID().replace(/-/g, '');
  await CourseRevision.create({
    courseId,
    revisionTag: revisionId,
    contentHash: revision.contentHash,
    sourceManifest: revision.sourceManifest,
    topics: revision.topics || [],
    status: 'draft',
    isInstructorReviewed: false
  });
  return enqueueCourseIngestionOperation(
    {
      userId: actor,
      courseId,
      courseTitle: course.title,
      revisionId,
      fileRef: operation.fileRef,
      files: operation.files
    },
    expectedJobId
  );
}
