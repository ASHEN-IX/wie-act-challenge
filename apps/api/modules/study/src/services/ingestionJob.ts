/**
 * INGEST-05 — async course-ingestion trigger.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { publishAiJob } = require('@study-partner/shared/ai-messaging');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { validateJobPayload } = require('@study-partner/shared/ai-messaging/payloadSchemas');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { logger } = require('@study-partner/shared');

const INGEST_JOB_TYPE = 'study.ingest.course';

interface IngestFileInfo {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  path: string;
}

interface PublishIngestionParams {
  userId: string;
  courseId: string;
  fileRef: string;
  files?: IngestFileInfo[];
  requestId?: string;
}

/**
 * Enqueue an async course-ingestion job.
 */
async function publishCourseIngestionJob({
  userId,
  courseId,
  fileRef,
  files,
  requestId
}: PublishIngestionParams): Promise<{ jobId: string; correlationId: string }> {
  const payload = { courseId, fileRef, files: files || [] };
  const check = validateJobPayload(INGEST_JOB_TYPE, payload);
  if (!check.valid) {
    const err: any = new Error(`invalid ingestion payload: ${check.errors.join('; ')}`);
    err.code = 'INGEST_PAYLOAD_INVALID';
    throw err;
  }

  const { messageId, correlationId } = await publishAiJob(INGEST_JOB_TYPE, userId, payload, {
    requestId: requestId || `req-${Date.now()}`
  });

  logger.info('ingest_job_enqueued', {
    jobId: messageId,
    courseId,
    correlationId,
    userId,
    fileCount: payload.files.length
  });
  return { jobId: messageId, correlationId };
}

export { publishCourseIngestionJob, INGEST_JOB_TYPE };
module.exports = { publishCourseIngestionJob, INGEST_JOB_TYPE };
