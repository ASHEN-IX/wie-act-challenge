import { canReadCourse } from '../../../study/src/services/resourceAccess';
import { createContracts } from '@study-partner/shared/domainContracts';
import Joi from 'joi';
import moduleClient from '@study-partner/shared/moduleClient';
import FormData from 'form-data';
import { createProxy } from '../utils/proxyBuilder';
import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response } from 'express';
import { errorDetails } from '@study-partner/shared/errors';
import { tierGate } from '@study-partner/shared/tierGate';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const aiClient = require('@study-partner/shared/aiClient');
const AI_URL = (aiClient.getBaseUrl ? aiClient.getBaseUrl() : null) || 'http://localhost:8000';
const router = createContracts();

// Upstream JSON is untrusted; only object responses support these projections.
function responseObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid AI response object');
  }
  return value as Record<string, unknown>;
}
// Consume the current Study-owned projection instead of asking Python to
// resolve a raw ID against an unscoped course collection.
async function authorizedCourseContext(req: DomainRequest, courseId: string) {
  const response = await moduleClient.get<{
    course: { id: string; title: string; topics?: unknown[] };
  }>(`module://study/api/v1/study/courses/${encodeURIComponent(courseId)}`, {
    headers: { Cookie: req.headers.cookie }
  });
  const course = response.data.course;
  if (!course || course.id !== courseId) throw new Error('Authorized context unavailable');
  return { _id: course.id, title: course.title, topics: course.topics || [] };
}

interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  label?: string;
  isRecurring?: boolean;
}

// Validation Schemas
const ingestCourseSchema = Joi.object({
  courseData: Joi.string().required(),
  format: Joi.string().valid('pdf', 'text', 'markdown', 'html').required()
});
const generatePlanSchema = Joi.object({
  courseId: Joi.string().required(),
  deadline: Joi.date().optional(),
  hoursPerWeek: Joi.number().min(1).optional()
});
const scheduleTasksSchema = Joi.object({
  planId: Joi.string().required(),
  preferences: Joi.object({
    studyTime: Joi.string().optional(),
    breakDuration: Joi.number().optional()
  }).optional()
});
const coachAdviceSchema = Joi.object({
  ignored_count: Joi.number().min(0).optional().default(0),
  do_not_disturb: Joi.boolean().optional().default(false),
  focus_score: Joi.number().min(0).max(1).optional().allow(null),
  focus_state: Joi.string().optional().allow(null, ''),
  fatigue_score: Joi.number().min(0).max(1).optional().allow(null),
  fatigue_state: Joi.string().optional().allow(null, '')
});
const searchAskSchema = Joi.object({
  question: Joi.string().trim().allow('').required(),
  user_id: Joi.string().optional().allow('', null),
  session_id: Joi.string().optional().allow('', null)
});
const evaluateSessionSchema = Joi.object({
  session_duration_minutes: Joi.number().integer().min(0).required(),
  focus_score: Joi.number().min(0).max(100).required(),
  completed_tasks: Joi.number().integer().min(0).optional().default(0),
  skipped_tasks: Joi.number().integer().min(0).optional().default(0)
});
const socraticStartSchema = Joi.object({
  task_title: Joi.string().required(),
  task_description: Joi.string().required(),
  task_details: Joi.string().required(),
  max_attempts: Joi.number().integer().min(1).max(10).optional().default(5)
});
const socraticAnswerSchema = Joi.object({
  session_id: Joi.string().required(),
  user_answer: Joi.string().required()
});
const planCreateSchema = Joi.object({
  goal: Joi.string().required(),
  available_time_minutes: Joi.number().min(30).required(),
  course_id: Joi.string().optional().allow(null),
  start_date: Joi.date().optional().allow(null)
});

// Proxy Routes
router.post(
  '/ingest',
  ...createProxy({
    method: 'POST',
    path: '/api/ai/courses/ingest',
    targetUrl: AI_URL,
    timeout: 60000,
    tier: ['vip', 'vip_plus', 'trial'],
    schema: ingestCourseSchema,
    userIdField: 'userId',
    mapResponse: (data) => ({ message: 'Course ingested successfully', ...responseObject(data) })
  })
);
router.get(
  '/plan/list',
  ...createProxy({
    method: 'GET',
    path: (req) => `/api/ai/planner/plans/${req.user!.userId}`,
    targetUrl: AI_URL,
    tier: ['vip', 'vip_plus', 'trial'],
    mapResponse: (data) => ({ plans: data })
  })
);
router.post(
  '/plan',
  ...createProxy({
    method: 'POST',
    path: '/api/ai/planner/create-plan',
    targetUrl: AI_URL,
    timeout: 120000,
    schema: generatePlanSchema,
    mapBody: async (req) => {
      const { courseId, deadline, hoursPerWeek } = req.body;
      const course_knowledge = await authorizedCourseContext(req, courseId);
      return {
        user_id: req.user!.userId,
        goal: `Complete course ${courseId || 'general'} by ${deadline || 'flexible'}`,
        available_time_minutes: (hoursPerWeek || 10) * 60,
        course_id: courseId,
        course_knowledge
      };
    },
    mapResponse: (data) => ({ message: 'Study plan generated', ...responseObject(data) })
  })
);
router.post(
  '/schedule',
  ...createProxy({
    method: 'POST',
    path: '/api/ai/scheduler/schedule',
    targetUrl: AI_URL,
    timeout: 120000,
    tier: ['vip', 'vip_plus', 'trial'],
    schema: scheduleTasksSchema,
    mapBody: (req) => ({
      user_id: req.user!.userId,
      plan_id: req.body.planId,
      preferences: req.body.preferences
    }),
    mapResponse: (data) => ({ message: 'Tasks scheduled', ...responseObject(data) })
  })
);
router.post(
  '/schedule/reschedule',
  ...createProxy({
    method: 'POST',
    path: '/api/ai/scheduler/reschedule',
    targetUrl: AI_URL,
    tier: ['vip', 'vip_plus', 'trial'],
    schema: Joi.object({ reason: Joi.string().trim().max(500).optional().default('manual') }),
    mapResponse: (data) => ({ message: 'Reschedule request submitted', result: data })
  })
);
router.post(
  '/schedule/apply-coach-action',
  ...createProxy({
    method: 'POST',
    path: '/api/ai/scheduler/apply-coach-action',
    targetUrl: AI_URL,
    tier: ['vip_plus', 'trial'],
    schema: Joi.object({ coach_action: Joi.object().required() }),
    mapBody: (req) => ({ user_id: req.user!.userId, coach_action: req.body.coach_action }),
    mapResponse: (data) => ({ message: 'Coach action applied to schedule', result: data })
  })
);
router.get(
  '/schedule/status',
  ...createProxy({
    method: 'GET',
    path: (req) => `/api/ai/scheduler/status/${req.user!.userId}`,
    targetUrl: AI_URL,
    tier: ['vip', 'vip_plus', 'trial']
  })
);
router.put(
  '/schedule/optimize',
  ...createProxy({
    method: 'PUT',
    path: '/api/ai/scheduler/optimize',
    targetUrl: AI_URL,
    tier: ['vip', 'vip_plus', 'trial'],
    schema: Joi.object({
      reason: Joi.string().trim().max(500).optional().default('manual_optimize')
    }),
    mapBody: (req) => ({ user_id: req.user!.userId, reason: req.body.reason }),
    mapResponse: (data) => ({ message: 'Schedule optimization complete', result: data })
  })
);
router.post(
  '/evaluator/session',
  ...createProxy({
    method: 'POST',
    path: '/api/ai/evaluator/session',
    targetUrl: AI_URL,
    tier: ['vip', 'vip_plus', 'trial'],
    schema: evaluateSessionSchema,
    userIdField: 'user_id'
  })
);
router.post(
  '/evaluator/socratic/start',
  ...createProxy({
    method: 'POST',
    path: '/api/ai/evaluator/socratic/start',
    targetUrl: AI_URL,
    tier: ['vip', 'vip_plus', 'trial'],
    schema: socraticStartSchema,
    userIdField: 'user_id'
  })
);
router.post(
  '/evaluator/socratic/answer',
  ...createProxy({
    method: 'POST',
    path: '/api/ai/evaluator/socratic/answer',
    targetUrl: AI_URL,
    tier: ['vip', 'vip_plus', 'trial'],
    schema: socraticAnswerSchema
  })
);
router.post(
  '/signals/fatigue/reset',
  ...createProxy({
    method: 'POST',
    path: '/api/ai/signals/fatigue/reset',
    targetUrl: AI_URL,
    tier: ['vip_plus', 'trial'],
    schema: Joi.object({ user_id: Joi.string().required() })
  })
);
router.get(
  '/vector/status/:courseId',
  ...createProxy({
    method: 'GET',
    path: (req) => `/api/ai/vector/status/${req.params.courseId}`,
    targetUrl: AI_URL,
    tier: ['vip', 'vip_plus', 'trial']
  })
);
router.post(
  '/vector/rebuild/:courseId',
  ...createProxy({
    method: 'POST',
    path: (req) => `/api/ai/vector/rebuild/${req.params.courseId}`,
    targetUrl: AI_URL,
    tier: ['vip', 'vip_plus', 'trial']
  })
);
router.post(
  '/coach',
  ...createProxy({
    method: 'POST',
    path: '/api/ai/coach/decision',
    targetUrl: AI_URL,
    tier: ['vip_plus', 'trial'],
    schema: coachAdviceSchema,
    mapBody: (req) => {
      const {
        ignored_count = 0,
        do_not_disturb = false,
        focus_score,
        focus_state,
        fatigue_score,
        fatigue_state
      } = req.body;
      const payload: Record<string, unknown> = {
        user_id: req.user?.userId || 'anonymous',
        ignored_count,
        do_not_disturb
      };
      if (focus_score != null) payload.focus_score = focus_score;
      if (focus_state) payload.focus_state = focus_state;
      if (fatigue_score != null) payload.fatigue_score = fatigue_score;
      if (fatigue_state) payload.fatigue_state = fatigue_state;
      return payload;
    },
    mapResponse: (data) => {
      const result = responseObject(data);
      const action = responseObject(result.coach_action);
      return {
        message: 'Coach executed successfully',
        action_type: action.action_type,
        coach_message: action.message,
        reasoning: action.reasoning,
        schedule_update: result.schedule_update,
        timestamp: new Date().toISOString()
      };
    }
  })
);
router.get(
  '/coach/history/:userId',
  ...createProxy({
    method: 'GET',
    path: (req) => `/api/ai/coach/history/${req.params.userId}`,
    targetUrl: AI_URL,
    tier: ['vip_plus', 'trial'],
    requireOwnership: true,
    forwardQuery: true
  })
);
router.get(
  '/signals/current/:userId',
  ...createProxy({
    method: 'GET',
    path: (req) => `/api/ai/signals/current/${req.params.userId}`,
    targetUrl: AI_URL,
    tier: ['vip_plus', 'trial'],
    requireOwnership: true
  })
);
router.get(
  '/signals/history/:userId',
  ...createProxy({
    method: 'GET',
    path: (req) => `/api/ai/signals/history/${req.params.userId}`,
    targetUrl: AI_URL,
    tier: ['vip_plus', 'trial'],
    requireOwnership: true,
    forwardQuery: true
  })
);
router.post(
  '/signals/process',
  ...createProxy({
    method: 'POST',
    path: '/api/ai/signals/process',
    targetUrl: AI_URL,
    tier: ['vip_plus', 'trial'],
    mapBody: (req) => ({ user_id: req.user?.userId })
  })
);
router.get(
  '/signals/latest/:userId',
  ...createProxy({
    method: 'GET',
    path: (req) => `/api/ai/signals/latest/${req.params.userId}`,
    targetUrl: AI_URL,
    tier: ['vip_plus', 'trial'],
    requireOwnership: true,
    forwardQuery: true
  })
);
router.get(
  '/search/history/:userId',
  ...createProxy({
    method: 'GET',
    path: (req) => `/api/ai/search/history/${req.params.userId}`,
    targetUrl: AI_URL,
    tier: ['vip', 'vip_plus', 'trial'],
    requireOwnership: true,
    forwardQuery: true
  })
);
router.delete(
  '/search/history/:userId',
  ...createProxy({
    method: 'DELETE',
    path: (req) => `/api/ai/search/history/${req.params.userId}`,
    targetUrl: AI_URL,
    tier: ['vip', 'vip_plus', 'trial'],
    requireOwnership: true
  })
);
router.post(
  '/reviews/schedule',
  ...createProxy({
    method: 'POST',
    path: '/api/ai/reviews/schedule',
    targetUrl: AI_URL,
    tier: ['vip', 'vip_plus', 'trial'],
    mapBody: (req) => ({ ...req.body, user_id: req.user?.userId })
  })
);
router.post(
  '/reviews/record-result',
  ...createProxy({
    method: 'POST',
    path: '/api/ai/reviews/record-result',
    targetUrl: AI_URL,
    tier: ['vip', 'vip_plus', 'trial'],
    mapBody: (req) => ({
      user_id: req.user?.userId,
      review_id:
        req.body?.review_id ||
        req.body?.reviewId ||
        req.body?._id ||
        req.body?.id ||
        req.body?.topicId,
      quality_score: req.body?.quality_score ?? req.body?.qualityScore ?? req.body?.quality
    }),
    validateBody: (value) => {
      const body = responseObject(value);
      if (!body.user_id || !body.review_id || body.quality_score === undefined) {
        return 'Invalid review result payload. Required fields: user_id, review_id, quality_score';
      }
    }
  })
);
router.get(
  '/reviews/pending/:userId',
  ...createProxy({
    method: 'GET',
    path: (req) => `/api/ai/reviews/pending/${req.params.userId}`,
    targetUrl: AI_URL,
    tier: ['vip', 'vip_plus', 'trial'],
    requireOwnership: true,
    forwardQuery: true
  })
);
router.get(
  '/reviews/stats/:userId',
  ...createProxy({
    method: 'GET',
    path: (req) => `/api/ai/reviews/stats/${req.params.userId}`,
    targetUrl: AI_URL,
    tier: ['vip', 'vip_plus', 'trial'],
    requireOwnership: true
  })
);

// Custom Routes (multi-service orchestration, multipart, special error handling)

router.post(
  '/plan/create',
  tierGate('vip', 'vip_plus', 'trial'),
  async (req: DomainRequest, res: Response) => {
    const { error } = planCreateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const userId = req.user!.userId;
    const { goal, available_time_minutes, course_id, start_date } = req.body;

    try {
      const USER_PROFILE_URL = 'module://users';
      let calendar_events: {
        day_of_week: number;
        start_time: string;
        end_time: string;
        label: string;
        is_recurring: boolean;
      }[] = [];
      try {
        const availabilityResponse = await moduleClient.get<AvailabilitySlot[]>(
          `${USER_PROFILE_URL}/api/v1/users/availability`,
          { headers: { Cookie: req.headers.cookie } }
        );
        calendar_events = availabilityResponse.data.map((s) => ({
          day_of_week: s.dayOfWeek,
          start_time: s.startTime,
          end_time: s.endTime,
          label: s.label || 'Blocked',
          is_recurring: s.isRecurring !== false
        }));
      } catch (availErr) {
        console.warn('Failed to fetch user availability:', errorDetails(availErr).message);
      }

      const course_knowledge = course_id
        ? await authorizedCourseContext(req, course_id)
        : undefined;
      const response = await moduleClient.post(
        `${AI_URL}/api/ai/planner/create-plan`,
        {
          user_id: userId,
          goal,
          available_time_minutes,
          course_id,
          course_knowledge,
          start_date,
          calendar_events
        },
        { timeout: 60000 }
      );
      if (course_id && !(await canReadCourse(userId, course_id)))
        return res.status(404).json({ error: 'Resource not found' });
      res.json({ message: 'Study plan created successfully', plan: response.data });
    } catch (err) {
      console.error('Plan creation failed:', errorDetails(err).code || 'AI_UPSTREAM_ERROR');
      return res
        .status(errorDetails(err).status ? 502 : 503)
        .json({ error: 'AI service unavailable' });
    }
  }
);

router.post(
  '/signals/analyze-frame',
  tierGate('vip_plus', 'trial'),
  async (req: DomainRequest, res: Response) => {
    try {
      const formData = new FormData();
      formData.append('user_id', req.user!.userId);
      if (req.file) {
        formData.append('frame', req.file.buffer, {
          filename: 'frame.jpg',
          contentType: req.file.mimetype
        });
      } else if (req.files?.frame) {
        const frame = Array.isArray(req.files.frame) ? req.files.frame[0] : req.files.frame;
        formData.append('frame', frame.data, { filename: frame.name, contentType: frame.mimetype });
      }
      const response = await moduleClient.post(`${AI_URL}/api/ai/signals/analyze-frame`, formData, {
        headers: formData.getHeaders(),
        timeout: 30000,
        maxContentLength: 10 * 1024 * 1024
      });
      res.json(response.data);
    } catch (err) {
      console.error('Frame analysis proxy failed:', errorDetails(err).message);
      if (errorDetails(err).status) res.status(502).json({ error: 'Upstream service error' });
      else res.status(503).json({ error: 'AI service unavailable' });
    }
  }
);

router.post(
  '/search/ask',
  tierGate('vip', 'vip_plus', 'trial'),
  async (req: DomainRequest, res: Response) => {
    const normalizedBody: { question: string; user_id?: string; session_id?: string } = {
      question: (req.body?.question || req.body?.query || '').toString().trim()
    };
    if (req.user?.userId) normalizedBody.user_id = req.user!.userId;
    if (req.body?.session_id) normalizedBody.session_id = req.body.session_id;

    const { error } = searchAskSchema.validate(normalizedBody);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
      const response = await moduleClient.post(`${AI_URL}/api/ai/search/ask`, normalizedBody, {
        timeout: 120000
      });
      res.json(response.data);
    } catch (err) {
      if (errorDetails(err).code === 'ECONNABORTED') {
        return res.status(200).json({
          success: true,
          question: normalizedBody.question,
          answer:
            'Search took too long to complete. Please try again with a more specific question.',
          sources_count: 0,
          urls: [],
          degraded: true,
          reason: 'Search timeout at AI orchestrator'
        });
      }
      if (errorDetails(err).status) res.status(502).json({ error: 'Upstream service error' });
      else res.status(503).json({ error: 'AI service unavailable' });
    }
  }
);

router.get('/status', async (req: DomainRequest, res: Response) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const aiCli = require('@study-partner/shared/aiClient');
  // Report the provider's real state. A hardcoded "available" told the product,
  // operators and the demo that inference was up while every agent was actually
  // answering from deterministic fallbacks. The probe is bounded and never fails
  // the request: an unreachable provider is itself the answer.
  const agentNames = [
    'courseIngestion',
    'planner',
    'scheduler',
    'coach',
    'signals',
    'reviews'
  ] as const;
  const agentKeys = [
    'course_ingestion',
    'planner',
    'schedule',
    'coach',
    'signals',
    'reviews'
  ] as const;
  let report: {
    execution_mode?: string;
    agents?: Record<string, { tier?: string; model?: string; available?: boolean }>;
  } | null = null;
  try {
    report = await aiCli.getProviderStatus({ timeout: 2000 });
  } catch {
    report = null;
  }
  const agents: Record<string, { status: string; tier: string | null; model: string | null }> = {};
  for (const [index, name] of agentNames.entries()) {
    const entry = report?.agents?.[agentKeys[index]];
    agents[name] = {
      status: entry ? (entry.available ? 'available' : 'unavailable') : 'unavailable',
      tier: entry?.tier || null,
      model: entry?.model || null
    };
  }
  res.json({
    executionMode: report?.execution_mode || 'UNAVAILABLE',
    agents,
    aiServiceUrl: (aiCli.getBaseUrl ? aiCli.getBaseUrl() : null) || 'http://localhost:8000'
  });
});

export default router;
module.exports = router;
