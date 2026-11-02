/**
 * INGEST-05 — async course-ingestion trigger.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const aiMessaging = require('@ednova/shared/ai-messaging');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { validateJobPayload } = require('@ednova/shared/ai-messaging/payloadSchemas');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { logger } = require('@ednova/shared');

const INGEST_JOB_TYPE = 'study.ingest.course';

interface IngestFileInfo {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  path: string;
  fileHash?: string;
}

export interface PublishIngestionParams {
  userId: string;
  courseId: string;
  /** Display title for the generated course, never an authorization input. */
  courseTitle?: string;
  revisionId?: string;
  fileRef: string;
  files?: IngestFileInfo[];
  requestId?: string;
  messageId?: string;
  correlationId?: string;
}

let customPublisher:
  ((...args: unknown[]) => Promise<{ messageId: string; correlationId: string }>) | null = null;

function setCustomPublisher(
  fn: ((...args: unknown[]) => Promise<{ messageId: string; correlationId: string }>) | null
) {
  customPublisher = fn;
}

/**
 * Enqueue an async course-ingestion job.
 */
async function publishCourseIngestionJob({
  userId,
  courseId,
  courseTitle,
  revisionId,
  fileRef,
  files,
  requestId,
  messageId: requestedMessageId,
  correlationId: requestedCorrelationId
}: PublishIngestionParams): Promise<{ jobId: string; correlationId: string }> {
  const payload: Record<string, unknown> = { courseId, fileRef, files: files || [] };
  if (courseTitle) payload.courseTitle = courseTitle;
  if (revisionId) {
    payload.revisionId = revisionId;
  }
  const check = validateJobPayload(INGEST_JOB_TYPE, payload);
  if (!check.valid) {
    const err = Object.assign(new Error(`invalid ingestion payload: ${check.errors.join('; ')}`), {
      code: 'INGEST_PAYLOAD_INVALID'
    });
    throw err;
  }

  const publishFn = customPublisher || aiMessaging.publishAiJob;
  const { messageId, correlationId } = await publishFn(INGEST_JOB_TYPE, userId, payload, {
    requestId: requestId || `req-${Date.now()}`,
    ...(requestedMessageId ? { messageId: requestedMessageId } : {}),
    ...(requestedCorrelationId ? { correlationId: requestedCorrelationId } : {})
  });

  logger.info('ingest_job_enqueued', {
    jobId: messageId,
    courseId,
    correlationId,
    userId,
    fileCount: files?.length || 0
  });
  return { jobId: messageId, correlationId };
}

export { publishCourseIngestionJob, INGEST_JOB_TYPE, setCustomPublisher };
module.exports = { publishCourseIngestionJob, INGEST_JOB_TYPE, setCustomPublisher };
