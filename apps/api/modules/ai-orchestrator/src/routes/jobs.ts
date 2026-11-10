import { resolveObjectiveContext } from '../services/objectiveContext';
import { canDeliverJob } from '../services/jobAccess';
import type { IAiJob } from '../models/AiJob';
import type { Prisma } from '../../../../src/generated/prisma/client';
/**
 * AI jobs API (F01 / AI-COM-07).
 *
 * POST /api/v1/ai/jobs          → validate + persist + publish, 202 { jobId }
 * GET  /api/v1/ai/jobs/:jobId   → status/result for the owning user
 * GET  /api/v1/ai/jobs          → list own jobs (optional ?status=&limit=)
 */

import { createContracts } from '@noveris/shared/domainContracts';
import { logger } from '@noveris/shared';
import { publishAiJob, AI_JOB_TYPES } from '@noveris/shared/ai-messaging';
import { validateJobPayload } from '@noveris/shared/ai-messaging/payloadSchemas';
import AiJob from '../models/AiJob';
import crypto from 'crypto';

const router = createContracts();

router.post('/jobs', async (req, res, next) => {
  try {
    const userId = req.user!.userId; // from authenticated context — never body
    const { type, payload } = req.body || {};

    if (!AI_JOB_TYPES.includes(type)) {
      return res.status(400).json({ error: `unknown job type: ${type}` });
    }
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'payload must be an object' });
    }
    if (type === 'study.ingest.course' || type === 'study.knowledge.extract') {
      return res.status(403).json({ error: 'Use the authorized course upload endpoint' });
    }
    // Strict per-type payload validation (PLAN-02). Over-length or malformed
    // payloads are rejected here, BEFORE persisting or publishing.
    const payloadCheck = validateJobPayload(type, payload);
    if (!payloadCheck.valid) {
      return res
        .status(422)
        .json({ error: 'payload failed validation', details: payloadCheck.errors });
    }

    const scopeSnapshot = {
      ...payload,
      ...(res.locals.sourceCourseId ? { courseId: res.locals.sourceCourseId } : {})
    };
    if (type === 'study.eval.step' && payload.objectiveId) {
      const context = await resolveObjectiveContext(payload.objectiveId, userId);
      if (!context) return res.status(422).json({ error: 'Objective unavailable' });
      if (payload.courseId && payload.courseId !== context.courseId)
        return res.status(422).json({ error: 'Objective scope mismatch' });
      scopeSnapshot.courseId = context.courseId;
      payload.targetBloomLevel = context.targetBloomLevel;
      payload.knowledgeType = context.knowledgeType;
    }

    const requestId = req.get('X-Request-ID') || `req-${Date.now()}`;
    const messageId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();

    // Persist BEFORE publishing: a fast worker's result event must always
    // find its job (AI-COM-07 correlation guarantee).
    let job: IAiJob;
    try {
      job = await AiJob.createPending({
        type,
        userId,
        requestId,
        correlationId,
        messageId,
        payloadSnapshot: scopeSnapshot
      });
    } catch (err) {
      return next(err);
    }

    try {
      await publishAiJob(type, userId, payload, { requestId, correlationId, messageId });
    } catch {
      await AiJob.deleteOne({ id: job.id }); // no silent loss, no orphan PENDING rows
      logger.error('ai_job_publish_failed_rolling_back', { jobId: job.jobId });
      return res.status(503).json({ error: 'AI job bus unavailable, retry later' });
    }

    logger.info('ai_job_created', {
      jobId: job.jobId,
      correlationId: job.correlationId,
      type,
      requestId,
      userId
    });

    return res.status(202).json({
      jobId: job.jobId,
      status: job.status,
      correlationId: job.correlationId,
      poll: `/api/v1/ai/jobs/${job.jobId}`
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/jobs/:jobId', async (req, res, next) => {
  try {
    const query: Prisma.AiJobWhereInput = { jobId: String(req.params.jobId) };
    query.userId = req.user!.userId;
    const job = await AiJob.findOne(query);
    if (!job || job.userId !== req.user!.userId || !(await canDeliverJob(job)))
      return res.status(404).json({ error: 'job not found' });
    return res.json({
      jobId: job.jobId,
      type: job.type,
      status: job.status,
      attempts: job.attempts,
      result: job.result,
      error: job.error,
      fallbackUsed: job.fallbackUsed,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/jobs', async (req, res, next) => {
  try {
    const filter: Prisma.AiJobWhereInput = { userId: req.user!.userId };
    if (req.query.status) filter.status = String(req.query.status);
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
    const jobs = await AiJob.findMany(filter, { createdAt: 'desc' }, limit);
    const authorized = [];
    for (const job of jobs)
      if (await canDeliverJob(job))
        authorized.push({
          jobId: job.jobId,
          type: job.type,
          status: job.status,
          attempts: job.attempts,
          error: job.error,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt
        });
    return res.json({ jobs: authorized });
  } catch (err) {
    return next(err);
  }
});

export default router;
module.exports = router;
