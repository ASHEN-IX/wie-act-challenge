import { canReadCourse } from '../modules/study/src/services/resourceAccess';
import type { Request, Response, NextFunction } from 'express';
import { AI_JOB_TIERS, effectiveTier } from './entitlements';
import crypto from 'node:crypto';

/** Every AI transport runs this policy, including module:// calls. */
export async function operationPolicy(req: Request, res: Response, next: NextFunction) {
  try {
    if (!/^\/api\/v1\/(ai|eval|search|coach)(\/|$)/.test(req.path)) return next();
    const user = (req as Request & { user?: { userId: string; role: string; tier: string } }).user;
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const payload = body.payload && typeof body.payload === 'object' ? body.payload : body;
    const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const jobType =
      req.path === '/api/v1/ai/jobs'
        ? String(body.type || '')
        : req.path.startsWith('/api/v1/search/')
          ? 'study.search.query'
          : /coach/.test(req.path)
            ? 'study.coach.nudge'
            : /eval/.test(req.path)
              ? 'study.eval.step'
              : /signals/.test(req.path)
                ? 'signals'
                : 'study.plan.generate';
    const allowed = jobType === 'signals' ? ['vip_plus', 'trial'] : AI_JOB_TIERS[jobType];
    if (mutation && jobType === 'study.eval.step' && typeof payload.sessionId === 'string') {
      // Evaluation conversations are not StudySession object IDs. Namespace
      // their identifiers so another account cannot resume a stolen conversation.
      payload.sessionId = crypto
        .createHash('sha256')
        .update(`${user.userId}\0${payload.sessionId}`)
        .digest('hex');
    }
    if (mutation && allowed && !allowed.includes(effectiveTier(user))) {
      return res
        .status(403)
        .json({ error: 'Upgrade required', code: 'TIER_REQUIRED', upgradeUrl: '/pricing' });
    }
    // Caller-provided actor fields never override the authenticated principal.
    for (const source of [body, payload]) {
      for (const field of ['userId', 'user_id']) {
        if (field in source) source[field] = user.userId;
      }
    }
    if (req.params.userId && req.params.userId !== user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const models = require('../modules/study/src/models');
    const resources = [
      ['courseId', 'course_id', models.Course],
      ['sessionId', 'session_id', models.StudySession],
      ['planId', 'plan_id', models.StudyPlan],
      ['subjectId', 'subject_id', models.Subject]
    ] as const;
    for (const [camel, snake, model] of resources) {
      if (camel === 'sessionId' && jobType === 'study.eval.step') continue;
      const candidates = [
        req.params[camel],
        payload[camel],
        payload[snake],
        body[camel],
        body[snake],
        req.query[camel],
        req.query[snake]
      ].filter((value) => value !== undefined && value !== null && value !== '');
      if (!candidates.length) continue;
      if (
        candidates.some(
          (id) =>
            typeof id !== 'string' ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
        )
      ) {
        return res.status(422).json({ error: `Invalid ${camel}` });
      }
      if (new Set(candidates).size !== 1)
        return res.status(422).json({ error: `Conflicting ${camel}` });
      const id = candidates[0];
      const found =
        camel === 'courseId'
          ? await canReadCourse(user.userId, id)
          : await model.exists({ id: id, userId: user.userId });
      if (!found) return res.status(404).json({ error: 'Resource not found' });
      if (camel === 'courseId') res.locals.sourceCourseId = id;
      if (camel === 'sessionId' || camel === 'planId') {
        const parent = await model
          .findOne({ id: id, userId: user.userId })
          .select('courseId')
          .lean();
        if (parent?.courseId) {
          if (!(await canReadCourse(user.userId, parent.courseId)))
            return res.status(404).json({ error: 'Resource not found' });
          if (res.locals.sourceCourseId && res.locals.sourceCourseId !== parent.courseId)
            return res.status(422).json({ error: 'Resource scope mismatch' });
          res.locals.sourceCourseId = parent.courseId;
        }
      }
    }
    return next();
  } catch (error) {
    return next(error);
  }
}
module.exports = { operationPolicy };
