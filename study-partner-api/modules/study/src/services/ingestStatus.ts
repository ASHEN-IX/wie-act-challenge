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
} = require('@study-partner/shared/ai-messaging');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { logger } = require('@study-partner/shared');
import { Course } from '../models';
import { INGEST_JOB_TYPE } from './ingestionJob';

// Whitelist of subtopic fields a worker result may write into Course.topics.
const SUBTOPIC_STRING_ARRAY = ['key_concepts', 'formulas', 'examples'];

function sanitizeCourseFromResult(resultCourse: any): any[] {
  if (!resultCourse || typeof resultCourse !== 'object') return [];
  const topics = Array.isArray(resultCourse.topics) ? resultCourse.topics : [];
  return topics
    .filter((topic: any) => topic && typeof topic === 'object')
    .map((topic: any) => ({
      title: String(topic.title || ''),
      subtopics: (Array.isArray(topic.subtopics) ? topic.subtopics : [])
        .filter((sub: any) => sub && typeof sub === 'object')
        .map((sub: any) => {
          const clean: Record<string, any> = {
            id: String(sub.id || ''),
            title: String(sub.title || ''),
            summary: typeof sub.summary === 'string' ? sub.summary : ''
          };
          for (const key of SUBTOPIC_STRING_ARRAY) {
            if (Array.isArray(sub[key])) {
              clean[key] = sub[key].filter((v: any) => typeof v === 'string').map(String);
            } else if (typeof sub[key] === 'string') {
              clean[key] = [sub[key]];
            }
          }
          if (Array.isArray(sub.definitions)) {
            clean.definitions = sub.definitions
              .filter((d: any) => d && typeof d === 'object')
              .map((d: any) => ({
                term: String(d.term || ''),
                definition: String(d.definition || '')
              }));
          }
          if (sub.learning_objectives !== undefined) {
            clean.learning_objectives = sub.learning_objectives;
          }
          return clean;
        }),
      prerequisites: Array.isArray(topic.prerequisites) ? topic.prerequisites.map(String) : []
    }));
}

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
function buildIngestStatus(course: any) {
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
    updatedAt: course.updatedAt || null
  };
}

async function handleIngestProgress(progress: any): Promise<void> {
  if (progress.type !== INGEST_JOB_TYPE) return;
  const course = await Course.findOne({ correlationId: progress.correlationId });
  if (!course) {
    logger.warn('ingest_progress_unmatched_correlation', {
      correlationId: progress.correlationId
    });
    return;
  }
  course.ingestStage = progress.stage;
  course.ingestProgress = progress.progress;
  course.ingestDetail = progress.detail || '';
  await course.save();
  logger.info('ingest_progress_recorded', {
    courseId: course._id.toString(),
    stage: progress.stage,
    progress: progress.progress
  });
}

async function handleIngestResult(result: any): Promise<void> {
  if (result.type !== INGEST_JOB_TYPE) return;
  const course = await Course.findOne({ correlationId: result.correlationId });
  if (!course) {
    logger.warn('ingest_result_unmatched_correlation', {
      correlationId: result.correlationId,
      status: result.status
    });
    return;
  }

  if (result.status === 'completed') {
    course.status = 'completed';
    course.ingestStage = 'indexing';
    course.ingestProgress = 1;
    course.ingestDetail = 'done';
    course.ingestError = '';
    if (result.payload && result.payload.course) {
      course.topics = sanitizeCourseFromResult(result.payload.course);
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
  await course.save();
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
