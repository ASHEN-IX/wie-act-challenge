import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response } from 'express';
import { Course, CourseIngestionOperation, CourseRevision } from '../models';

/**
 * Ingestion fencing context for the Python worker.
 *
 * The worker used to read `course_revisions`, `course_ingestion_operations` and
 * `courses` straight from MongoDB to decide whether a dispatch was still
 * current: an operation that was cancelled or superseded, or a course whose
 * `jobId`/`correlationId` moved on, must not be ingested. Those reads stopped
 * matching when the tables moved to PostgreSQL, and because the worker treats a
 * missing database as "nothing to check", the guard silently stopped enforcing.
 *é
 * These endpoints restore it at the boundary the worker already owns: it asks
 * the API, and the API answers from the tables it writes.
 */

const OPERATION_STATES = ['prepared', 'queued', 'processing'] as const;

/**
 * GET /api/v1/study/internal/ingestion/revisions/:courseId/:revisionTag
 * → { revisionTag, contentHash, sourceManifest, isCurrent } or 404
 */
export async function ingestionRevision(req: DomainRequest, res: Response) {
  const courseId = typeof req.params.courseId === 'string' ? req.params.courseId : '';
  const revisionTag = typeof req.params.revisionTag === 'string' ? req.params.revisionTag : '';
  if (!courseId || !revisionTag)
    return res.status(400).json({ error: 'courseId and revisionTag are required' });
  try {
    const revision = await CourseRevision.findOne({ courseId, revisionTag, status: 'draft' });
    if (!revision) return res.status(404).json({ error: 'Revision not found' });

    const manifest = (revision.sourceManifest as Array<{ storageRef?: unknown }> | null) || [];
    if (manifest.length === 0 || manifest.some((entry) => !entry?.storageRef))
      return res.status(409).json({ error: 'Revision has no verifiable source manifest' });

    return res.json({
      revisionTag: revision.revisionTag,
      // The worker builds a `sha256:`-prefixed digest from this value.
      contentHash: String(revision.contentHash ?? '').replace(/^sha256:/, ''),
      sourceManifest: manifest,
      isCurrent: true
    });
  } catch {
    return res.status(404).json({ error: 'Revision unavailable' });
  }
}

/**
 * GET /api/v1/study/internal/ingestion/operations/:messageId
 *   ?courseId=&revisionId=&userId=&jobId=&correlationId=
 * → 200 when the dispatch is still current, 409 when it is not.
 *
 * The worker cannot proceed on a stale dispatch, so "not current" is a
 * definitive answer rather than an empty document it has to interpret.
 */
export async function ingestionOperation(req: DomainRequest, res: Response) {
  const messageId = typeof req.params.messageId === 'string' ? req.params.messageId : '';
  const courseId = typeof req.query.courseId === 'string' ? req.query.courseId : '';
  const revisionId = typeof req.query.revisionId === 'string' ? req.query.revisionId : '';
  const userId = typeof req.query.userId === 'string' ? req.query.userId : '';
  const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : '';
  const correlationId = typeof req.query.correlationId === 'string' ? req.query.correlationId : '';
  if (!messageId) return res.status(400).json({ error: 'messageId is required' });

  try {
    const operation = await CourseIngestionOperation.findOne({ id: messageId });
    if (!operation) return res.status(404).json({ error: 'Operation not found' });

    const stateIsActive = OPERATION_STATES.includes(
      operation.state as (typeof OPERATION_STATES)[number]
    );
    if (
      !stateIsActive ||
      String(operation.courseId) !== courseId ||
      (operation.revisionId ?? '') !== revisionId ||
      operation.userId !== userId
    )
      return res.status(409).json({ error: 'Operation cancelled, superseded or resolved' });

    const course = await Course.findById(courseId);
    if (
      !course ||
      course.jobId !== jobId ||
      course.correlationId !== correlationId ||
      course.ingestDetail === 'cancelled'
    )
      return res.status(409).json({ error: 'Ingestion operation is no longer current' });

    return res.json({ current: true, state: operation.state });
  } catch {
    return res.status(409).json({ error: 'Ingestion operation unavailable' });
  }
}

export default { ingestionRevision, ingestionOperation };
