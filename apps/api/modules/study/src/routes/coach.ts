import { canDeliverJob } from '../../../ai-orchestrator/src/services/jobAccess';
import AiJob from '../../../ai-orchestrator/src/models/AiJob';
import { errorDetails } from '@noveris/shared/errors';
import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response } from 'express';
/**
 * Coach API (COACH-10) — async nudge trigger over the job bus.
 *
 * POST /api/v1/coach/nudge       → creates a `study.coach.nudge` job, 202 { jobId }
 * GET  /api/v1/coach/jobs/:jobId → status + nudge result (owner-scoped)
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createContracts } = require('@noveris/shared/domainContracts');
import Joi from 'joi';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const moduleClient = require('@noveris/shared/moduleClient');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { logger } = require('@noveris/shared');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { tierGate } = require('@noveris/shared/tierGate');
import { StudySession } from '../models';
import { resolveSessionStats } from '../utils/sessionStats';
import { fetchGamificationProfile } from '../utils/gamificationService';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { validateCoachPayload } = require('@noveris/shared/ai-messaging/payloadSchemas');
const router = createContracts();

// Mirrors COACH-02 limits (same bounds as validateCoachPayload).
const nudgeSchema = Joi.object({
  session_id: Joi.string().max(64).optional(),
  focus_score: Joi.number().min(0).max(1).optional(),
  focus_state: Joi.string().valid('Focused', 'Drifting', 'Lost').optional(),
  fatigue_score: Joi.number().min(0).max(1).optional(),
  fatigue_state: Joi.string().valid('Alert', 'Moderate', 'High', 'Critical').optional(),
  ignored_count: Joi.number().integer().min(0).optional(),
  do_not_disturb: Joi.boolean().optional(),
  current_time: Joi.date().iso().optional()
});

// POST /api/v1/coach/nudge → 202 { jobId }
router.post('/nudge', tierGate('vip_plus', 'trial'), async (req: DomainRequest, res: Response) => {
  try {
    const { error, value } = nudgeSchema.validate(req.body || {}, { stripUnknown: true });
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user!.userId;

    let sessionId = value.session_id;
    let session = null;
    if (sessionId) {
      const owned = await StudySession.findOne({ id: sessionId, userId });
      if (!owned) {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (owned.status !== 'active') {
        return res.status(400).json({ error: 'Session is not active' });
      }
      session = owned;
    } else {
      const active = await StudySession.findOne({ userId, status: 'active' }).sort({
        createdAt: -1
      });
      if (!active) {
        return res.status(400).json({ error: 'No active study session for this user' });
      }
      session = active;
      sessionId = active.id.toString();
    }

    const payload: Record<string, unknown> = { session_id: sessionId };
    for (const field of [
      'focus_score',
      'focus_state',
      'fatigue_score',
      'fatigue_state',
      'ignored_count',
      'do_not_disturb',
      'current_time'
    ]) {
      if (value[field] !== undefined) payload[field] = value[field];
    }
    payload.current_time = payload.current_time || new Date().toISOString();

    const profile = await fetchGamificationProfile({
      authorization: req.headers.cookie
    });
    const streakDays = profile?.stats?.currentStreak ?? 0;
    payload.session_stats = resolveSessionStats({
      session,
      now: new Date(String(payload.current_time)),
      currentStreakDays: streakDays
    });

    const check = validateCoachPayload(payload);
    if (!check.valid) {
      return res.status(422).json({ error: 'payload failed validation', details: check.errors });
    }

    const requestId = req.get('X-Request-ID') || `req-${Date.now()}`;
    const orchestratorUrl = 'module://ai';

    let response: { data: { jobId: string; correlationId: string } };
    try {
      response = await moduleClient.post(
        `${orchestratorUrl}/api/v1/ai/jobs`,
        { type: 'study.coach.nudge', payload },
        {
          headers: {
            Cookie: req.headers.cookie,
            'X-Request-ID': requestId
          },
          timeout: 10000
        }
      );
    } catch (err) {
      logger.error('coach_job_create_failed', {
        status: errorDetails(err).status,
        error: errorDetails(err).message
      });
      return res.status(503).json({ error: 'AI job bus unavailable, retry later' });
    }

    const { jobId, correlationId } = response.data;

    logger.info('coach_nudge_job_published', {
      userId,
      sessionId,
      jobId,
      correlationId
    });

    return res.status(202).json({
      status: 'processing',
      jobId,
      correlationId,
      message: 'Nudge scheduled. Poll /api/v1/coach/jobs/:jobId for completion.'
    });
  } catch (err) {
    logger.error('coach_nudge_failed', { error: errorDetails(err).message });
    return res.status(503).json({ error: 'AI job bus unavailable, retry later' });
  }
});

// GET /api/v1/coach/jobs/:jobId → status + nudge (owner-scoped)
router.get('/jobs/:jobId', async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const job = await AiJob.findOne({
      jobId: String(req.params.jobId),
      userId,
      type: 'study.coach.nudge'
    });

    if (!job || !(await canDeliverJob(job))) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.json({
      jobId: job.jobId,
      status: job.status,
      result: job.result,
      error: job.error,
      fallbackUsed: job.fallbackUsed,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    });
  } catch (err) {
    logger.error('coach_job_status_failed', { error: errorDetails(err).message });
    return res.status(500).json({ error: 'Failed to fetch job status' });
  }
});

export default router;
module.exports = router;
