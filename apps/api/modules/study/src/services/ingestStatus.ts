import type { ICourse, ISubtopic } from '../models';
import type { AiProgressEnvelope, AiResultEnvelope } from '@ednova/shared/ai-messaging/envelope';

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}
type SanitizedSubtopic = Pick<
  ISubtopic,
  | 'id'
  | 'title'
  | 'summary'
  | 'key_concepts'
  | 'formulas'
  | 'examples'
  | 'definitions'
  | 'source_spans'
  | 'structured_blocks'
> & { learning_objectives?: unknown };
interface SanitizedTopic {
  title: string;
  subtopics: SanitizedSubtopic[];
  prerequisites: string[];
}
/**
 * INGEST-07 — course ingestion status tracker.
 *
 * Subscribes to the AI `study.ingest.course` worker's events on `ai.results`:
 *   • progress  (routing key `progress`)  → live stage/percentage for the
 *     ingest-status endpoint
 *   • result    (routing key `result`, own queue) → flips Course to
 *     completed/failed, persists the worker's course structure on completion
 *     and surfaces a sanitized failure reason + retry action.
 *
 * The orchestrator's result inbox (ai.results.inbox) keeps doing complete/fail
 * correlation on AiJob — a direct exchange copies `result` messages to both
 * queues, so nothing here interferes with it.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  consumeAiProgress,
  consumeIngestResults,
  closeAiMessaging
} = require('@ednova/shared/ai-messaging');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { logger } = require('@ednova/shared');
import { Course, CourseRevision } from '../models';
import { CourseIngestionOperation } from '../models/CourseIngestionOperation';
import { INGEST_JOB_TYPE } from './ingestionJob';
import { activityDigest } from './activityIdentity';

// Whitelist of subtopic fields a worker result may write into Course.topics.
const SUBTOPIC_STRING_ARRAY = ['key_concepts', 'formulas', 'examples'] as const;
const MAX_SOURCE_SPANS = 400;
const MAX_STRUCTURED_BLOCKS = 200;

function safeSourceSpans(value: unknown): NonNullable<ISubtopic['source_spans']> {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isObject)
    .slice(0, MAX_SOURCE_SPANS)
    .flatMap((span) =>
      typeof span.chunkId === 'string' &&
      span.chunkId.length <= 128 &&
      typeof span.documentId === 'string' &&
      span.documentId.length <= 128 &&
      (span.pageNumber === null ||
        (Number.isSafeInteger(span.pageNumber) && Number(span.pageNumber) > 0)) &&
      Number.isSafeInteger(span.lineStart) &&
      Number.isSafeInteger(span.lineEnd) &&
      Number(span.lineStart) > 0 &&
      Number(span.lineEnd) >= Number(span.lineStart)
        ? [
            {
              chunkId: span.chunkId as string,
              documentId: span.documentId as string,
              pageNumber: span.pageNumber as number | null,
              lineStart: span.lineStart as number,
              lineEnd: span.lineEnd as number
            }
          ]
        : []
    );
}

function sanitizeCourseFromResult(resultCourse: unknown): SanitizedTopic[] {
  if (!isObject(resultCourse)) return [];
  const topics = Array.isArray(resultCourse.topics) ? (resultCourse.topics as unknown[]) : [];
  return topics.filter(isObject).map((topic) => ({
    title: String(topic.title || ''),
    subtopics: (Array.isArray(topic.subtopics) ? (topic.subtopics as unknown[]) : [])
      .filter(isObject)
      .map((sub) => {
        const clean: SanitizedSubtopic = {
          id: String(sub.id || ''),
          title: String(sub.title || ''),
          summary: typeof sub.summary === 'string' ? sub.summary : ''
        };
        // The worker emits BLOOM objective ids with camel-case fields. The
        // draft editor consumes the id/statement shape; preserve the reviewed
        // source objective through that adapter rather than dropping it.
        const workerObjectives = Array.isArray(sub.learning_objectives)
          ? sub.learning_objectives.filter(isObject).map((objective) => ({
              id: String(objective.id || objective.objectiveId || ''),
              statement: String(objective.statement || objective.text || ''),
              text: String(objective.text || objective.statement || ''),
              bloomLevel: String(objective.bloomLevel || 'understand'),
              provenance: objective.provenance === 'manual' ? 'manual' : 'ai_generated'
            }))
          : [];
        for (const key of SUBTOPIC_STRING_ARRAY) {
          if (Array.isArray(sub[key])) {
            clean[key] = (sub[key] as unknown[])
              .filter((v): v is string => typeof v === 'string')
              .map(String);
          } else if (typeof sub[key] === 'string') {
            clean[key] = [sub[key]];
          }
        }
        if (Array.isArray(sub.definitions)) {
          clean.definitions = sub.definitions.filter(isObject).map((d) => ({
            term: String(d.term || ''),
            definition: String(d.definition || '')
          }));
        }
        if (workerObjectives.length) {
          clean.learning_objectives = workerObjectives;
        } else if (sub.learning_objectives !== undefined) {
          // Preserve legacy fixture/plugin objectives rather than inventing a
          // Bloom level for records that never followed the worker contract.
          clean.learning_objectives = sub.learning_objectives;
        }
        clean.source_spans = safeSourceSpans(sub.source_spans);
        clean.structured_blocks = Array.isArray(sub.structured_blocks)
          ? sub.structured_blocks.filter(isObject).slice(0, MAX_STRUCTURED_BLOCKS)
          : [];
        return clean;
      }),
    prerequisites: Array.isArray(topic.prerequisites) ? topic.prerequisites.map(String) : []
  }));
}

/** Additive canonical fields retain bounded source blocks but no vectors. */
function retryAction(
  courseId: string,
  status: string
): { action: string; description: string; endpoint: string; method: string } | null {
  if (status !== 'failed') return null;
  return {
    action: 're-upload',
    description: 'Re-upload the course files to trigger a new ingestion cycle',
    endpoint: `/api/v1/study/courses/${courseId}/files`,
    method: 'POST'
  };
}

/** Shape returned by GET /api/v1/study/courses/:courseId/ingest-status. */
function buildIngestStatus(
  course: Pick<ICourse, 'status'> &
    Partial<
      Pick<
        ICourse,
        'jobId' | 'ingestStage' | 'ingestProgress' | 'ingestDetail' | 'ingestError' | 'updatedAt'
      >
    > & { _id: { toString(): string }; processedAt?: Date | null }
) {
  return {
    courseId: course._id.toString(),
    status: course.status,
    jobId: course.jobId || null,
    stage: course.ingestStage || 'queued',
    progress: typeof course.ingestProgress === 'number' ? course.ingestProgress : 0,
    detail: course.ingestDetail || '',
    error: course.status === 'failed' ? course.ingestError || '' : '',
    processedAt: course.processedAt || null,
    retry: retryAction(course._id.toString(), course.status),
    cancelled: course.ingestDetail === 'cancelled',
    controls: course.jobId
      ? {
          expectedJobId: course.jobId,
          reconcile: `/api/v1/study/courses/${course._id}/ingestion/reconcile`,
          retry: `/api/v1/study/courses/${course._id}/ingestion/retry`,
          cancel: `/api/v1/study/courses/${course._id}/ingestion/cancel`
        }
      : null,
    updatedAt: course.updatedAt || null
  };
}

async function handleIngestProgress(
  progress: Pick<
    AiProgressEnvelope,
    'type' | 'correlationId' | 'stage' | 'progress' | 'detail' | 'status'
  >
): Promise<void> {
  if (progress.type !== INGEST_JOB_TYPE) return;
  const course = await Course.findOne({ correlationId: progress.correlationId });
  if (!course) {
    logger.warn('ingest_progress_unmatched_correlation', {
      correlationId: progress.correlationId
    });
    return;
  }
  course.ingestStage = progress.stage;
  course.ingestProgress = progress.progress!;
  course.ingestDetail = progress.detail || '';
  const current = await Course.updateOne(
    {
      _id: course._id,
      correlationId: progress.correlationId,
      status: 'processing',
      ingestProgress: { $lte: progress.progress! }
    },
    {
      $set: {
        ingestStage: course.ingestStage,
        ingestProgress: course.ingestProgress,
        ingestDetail: course.ingestDetail
      }
    }
  );
  if (!current) return;
  await CourseIngestionOperation.updateOne(
    { correlationId: progress.correlationId, state: { $in: ['prepared', 'queued', 'processing'] } },
    { $set: { state: 'processing' } }
  );
  logger.info('ingest_progress_recorded', {
    courseId: course._id.toString(),
    stage: progress.stage,
    progress: progress.progress
  });
}

async function handleIngestResult(
  result: Pick<AiResultEnvelope, 'type' | 'correlationId' | 'status' | 'payload' | 'error'>
): Promise<void> {
  if (result.type !== INGEST_JOB_TYPE) return;
  const course = await Course.findOne({ correlationId: result.correlationId });
  if (!course) {
    logger.warn('ingest_result_unmatched_correlation', {
      correlationId: result.correlationId,
      status: result.status
    });
    return;
  }

  const operation = await CourseIngestionOperation.findOne({
    correlationId: result.correlationId
  }).lean();
  if (operation && ['cancelled', 'superseded'].includes(operation.state)) return;
  if (
    operation &&
    result.status === 'completed' &&
    (result.payload?.revisionId !== operation.revisionId ||
      (result.payload?.courseId !== undefined &&
        result.payload.courseId !== String(operation.courseId)))
  ) {
    logger.warn('ingest_result_operation_pin_mismatch');
    return;
  }

  if (operation?.resultApplied) return;
  if (operation?.result) result = operation.result;
  if (operation && !operation.result) {
    await CourseIngestionOperation.updateOne(
      {
        _id: operation._id,
        result: { $exists: false },
        state: { $nin: ['cancelled', 'superseded'] }
      },
      { $set: { result } }
    );
    // The first durable outcome wins, including concurrent/conflicting delivery.
    const recorded = await CourseIngestionOperation.findById(operation._id).lean();
    if (!recorded || ['cancelled', 'superseded'].includes(recorded.state) || !recorded.result)
      return;
    result = recorded.result;
  }
  const terminalStatus = result.status === 'completed' ? 'completed' : 'failed';
  const claimed = await Course.updateOne(
    {
      _id: course._id,
      correlationId: result.correlationId,
      $or: [
        { status: 'processing' },
        { status: 'failed', ingestDetail: 'dispatch_unconfirmed' },
        ...(operation?.result && !operation.resultApplied ? [{ status: terminalStatus }] : [])
      ]
    },
    { $set: { status: terminalStatus } }
  );
  if (!claimed) return;

  if (result.status === 'completed') {
    course.status = 'completed';
    course.ingestStage = 'indexing';
    course.ingestProgress = 1;
    course.ingestDetail = 'done';
    course.ingestError = '';
    if (result.payload && result.payload.course) {
      // Preserve the existing schema-cast boundary for legacy objective metadata.
      const sanitizedTopics = sanitizeCourseFromResult(result.payload.course);
      if (result.payload.revisionId && typeof result.payload.revisionId === 'string') {
        const rev = await CourseRevision.findOne({
          courseId: course._id,
          revisionTag: result.payload.revisionId
        });
        if (rev) {
          if (rev.isInstructorReviewed) {
            logger.warn('ingest_result_skipped_instructor_reviewed', {
              courseId: course._id.toString(),
              revisionTag: rev.revisionTag
            });
          } else {
            const expectedIndex =
              'faiss/' + course._id.toString() + '/' + rev.revisionTag + '.faiss';
            const canonical = result.payload.contentDocument;
            const changed = await CourseRevision.updateOne(
              {
                _id: rev._id,
                revisionTag: rev.revisionTag,
                status: 'draft',
                activationState: { $ne: 'prepared' },
                isInstructorReviewed: false,
                __v: rev.__v
              },
              {
                $set: {
                  topics: sanitizedTopics,
                  ...(canonical && typeof canonical === 'object'
                    ? { contentDocument: canonical, contentDocumentHash: contentHashOf(canonical) }
                    : {}),
                  ...(result.payload.vectorIndexRef === expectedIndex
                    ? { vectorIndexRef: expectedIndex }
                    : {})
                },
                $inc: { __v: 1 }
              }
            );
            if (changed) Object.assign(course, { topics: sanitizedTopics });
          }
        } else {
          Object.assign(course, { topics: sanitizedTopics });
        }
      } else {
        Object.assign(course, { topics: sanitizedTopics });
      }
    }
    course.processedAt = new Date();
    logger.info('ingest_completed', { courseId: course._id.toString() });
  } else {
    course.status = 'failed';
    course.ingestError = result.error || 'ingestion failed';
    logger.error('ingest_failed', {
      courseId: course._id.toString(),
      error: course.ingestError
    });
  }
  const applied = await Course.updateOne(
    { _id: course._id, correlationId: result.correlationId, status: terminalStatus },
    {
      $set: {
        status: course.status,
        ingestStage: course.ingestStage,
        ingestProgress: course.ingestProgress,
        ingestDetail: course.ingestDetail,
        ingestError: course.ingestError,
        ...(course.processedAt ? { processedAt: course.processedAt } : {}),
        topics: course.topics
      }
    }
  );
  if (operation && applied)
    await CourseIngestionOperation.updateOne(
      { _id: operation._id, state: { $nin: ['cancelled', 'superseded'] } },
      { $set: { state: terminalStatus, resultApplied: true } }
    );
}

function contentHashOf(value: unknown): string {
  return activityDigest(value);
}

/**
 * Start the ingest-status consumers. Resolves once both subscriptions are live.
 * No-op safe: callers guard with `process.env.RABBITMQ_URL`.
 */
async function startIngestStatusTracker(): Promise<void> {
  const [progressChannel, resultChannel] = await Promise.all([
    consumeAiProgress(handleIngestProgress),
    consumeIngestResults(handleIngestResult)
  ]);
  logger.info('ingest_status_tracker_started', {
    progressConsumer: Boolean(progressChannel),
    resultConsumer: Boolean(resultChannel)
  });
}

/** Graceful shutdown for the tracker's consumers. */
function stopIngestStatusTracker() {
  return closeAiMessaging();
}

export {
  startIngestStatusTracker,
  stopIngestStatusTracker,
  handleIngestProgress,
  handleIngestResult,
  buildIngestStatus,
  sanitizeCourseFromResult
};

module.exports = {
  startIngestStatusTracker,
  stopIngestStatusTracker,
  handleIngestProgress,
  handleIngestResult,
  buildIngestStatus,
  sanitizeCourseFromResult
};
