/**
 * Coach API (COACH-10) — async nudge trigger over the job bus.
 *
 * POST /api/v1/coach/nudge       → creates a `study.coach.nudge` job, 202 { jobId }
 * GET  /api/v1/coach/jobs/:jobId → status + nudge result (owner-scoped)
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createContracts } = require('@study-partner/shared/domainContracts');
import Joi from 'joi';
import mongoose from 'mongoose';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const moduleClient = require('@study-partner/shared/moduleClient');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { logger } = require('@study-partner/shared');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { tierGate } = require('@study-partner/shared/tierGate');
import { StudySession } from '../models';
import { resolveSessionStats } from '../utils/sessionStats';
import { fetchGamificationProfile } from '../utils/gamificationService';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { validateCoachPayload } = require('@study-partner/shared/ai-messaging/payloadSchemas');
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
router.post('/nudge', tierGate('vip_plus', 'trial'), async (req: any, res: any) => {
  try {
    const { error, value } = nudgeSchema.validate(req.body || {}, { stripUnknown: true });
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user.userId;

    let sessionId = value.session_id;
    let session = null;
    if (sessionId) {
      const owned = await StudySession.findOne({ _id: sessionId, userId });
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
      sessionId = active._id.toString();
    }

    const payload: Record<string, any> = { session_id: sessionId };
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
      now: new Date(payload.current_time),
      currentStreakDays: streakDays
    });

    const check = validateCoachPayload(payload);
    if (!check.valid) {
      return res.status(422).json({ error: 'payload failed validation', details: check.errors });
    }

    const requestId = req.get('X-Request-ID') || `req-${Date.now()}`;
    const orchestratorUrl = 'module://ai';

    let response: any;
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
    } catch (err: any) {
      logger.error('coach_job_create_failed', {
        status: err.response?.status,
        error: err.message
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
  } catch (err: any) {
    logger.error('coach_nudge_failed', { error: err.message });
    return res.status(503).json({ error: 'AI job bus unavailable, retry later' });
  }
});

// GET /api/v1/coach/jobs/:jobId → status + nudge (owner-scoped)
router.get('/jobs/:jobId', async (req: any, res: any) => {
  try {
    const userId = req.user.userId;
    const job = await mongoose.connection
      .collection('ai_jobs')
      .findOne({ jobId: req.params.jobId, userId });

    if (!job) {
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
  } catch (err: any) {
    logger.error('coach_job_status_failed', { error: err.message });
    return res.status(500).json({ error: 'Failed to fetch job status' });
  }
});

export default router;
module.exports = router;
