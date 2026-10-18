/**
 * AI jobs API (F01 / AI-COM-07).
 *
 * POST /api/v1/ai/jobs          → validate + persist + publish, 202 { jobId }
 * GET  /api/v1/ai/jobs/:jobId   → status/result for the owning user
 * GET  /api/v1/ai/jobs          → list own jobs (optional ?status=&limit=)
 */

import { createContracts } from '@study-partner/shared/domainContracts';
import { logger } from '@study-partner/shared';
import { publishAiJob, AI_JOB_TYPES } from '@study-partner/shared/ai-messaging';
import { validateJobPayload } from '@study-partner/shared/ai-messaging/payloadSchemas';
import AiJob from '../models/AiJob';
import crypto from 'crypto';

const router = createContracts();

router.post('/jobs', async (req: any, res: any, next: any) => {
  try {
    const userId = req.user.userId; // from authenticated context — never body
    const { type, payload } = req.body || {};

    if (!AI_JOB_TYPES.includes(type)) {
      return res.status(400).json({ error: `unknown job type: ${type}` });
    }
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'payload must be an object' });
    }
    // Strict per-type payload validation (PLAN-02). Over-length or malformed
    // payloads are rejected here, BEFORE persisting or publishing.
    const payloadCheck = validateJobPayload(type, payload);
    if (!payloadCheck.valid) {
      return res
        .status(422)
        .json({ error: 'payload failed validation', details: payloadCheck.errors });
    }

    const requestId = req.get('X-Request-ID') || `req-${Date.now()}`;
    const messageId = crypto.randomUUID();
    const correlationId = crypto.randomUUID();

    // Persist BEFORE publishing: a fast worker's result event must always
    // find its job (AI-COM-07 correlation guarantee).
    let job: any;
    try {
      job = await (AiJob as any).createPending({
        type,
        userId,
        requestId,
        correlationId,
        messageId
      });
    } catch (err) {
      return next(err);
    }

    try {
      await publishAiJob(type, userId, payload, { requestId, correlationId, messageId });
    } catch (err) {
      await job.deleteOne(); // no silent loss, no orphan PENDING rows
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

router.get('/jobs/:jobId', async (req: any, res: any, next: any) => {
  try {
    const query: any = { jobId: req.params.jobId };
    if (req.user.role !== 'admin') query.userId = req.user.userId;
    const job = await AiJob.findOne(query).lean();
    if (!job) return res.status(404).json({ error: 'job not found' });
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

router.get('/jobs', async (req: any, res: any, next: any) => {
  try {
    const filter: any = { userId: req.user.userId };
    if (req.query.status) filter.status = String(req.query.status);
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
    const jobs = await AiJob.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('jobId type status attempts error createdAt updatedAt')
      .lean();
    return res.json({ jobs });
  } catch (err) {
    return next(err);
  }
});

export default router;
module.exports = router;
