import { createContracts } from '../../../../shared/domainContracts';
import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response, NextFunction } from 'express';
import {
  publishedActivities,
  learnerProgress,
  selectLearningActivity,
  diagnosticChecks,
  studioContext
} from '../services/learningJourney';
import {
  ownRoomCheck,
  submitOwnRoomCheck,
  roomLearningDebrief,
  proposeRoomSupport,
  decideRoomSupport
} from '../services/roomLearning';
import { broadcastRoomState } from './rooms';
import { sourceLearningSupport } from '../services/learningSupport';
import {
  getLearningStyle,
  learningStyleProbeQuestions,
  saveLearningStyle
} from '../services/learningStyle';
import UserProfile from '../../../user-profile/src/models/UserProfile';
import { getLearningDocument } from '../services/courseReader';
import { getPublishedPresentationWithAssets } from '../services/presentationReader';
import { attachStructuredAsset } from '../services/structuredAssets';
import {
  planLessonExperience,
  planLessonWithProvider,
  readStoredPlan
} from '../services/experiencePlanning';
import { canManageCourse } from '../services/resourceAccess';
import {
  adaptationForLesson,
  dismissRecommendation,
  readPreferences,
  resetPreferences,
  savePreferences
} from '../services/lessonAdaptation';
import { isLearningMode } from '../../../../shared/ednova/learningModes';
import { summarizeMetrics } from '../services/planningMetrics';
const { requireRole } = require('@noveris/shared/auth');
import {
  resolvePlannerProvider,
  configuredPlannerModel
} from '../services/experiencePlannerProviders';
import { grantPlanningConsent } from '../services/planningGovernance';
import { getCourseNardouch, completeNardouchLesson } from '../services/courseNardouch';

// Interface languages the learning workspace can actually render. Keep this list
// in step with the translations in the web workspace; a persisted value outside
// it would only produce a half-translated page.
const WORKSPACE_LANGUAGES = ['en', 'fr', 'ar', 'ary'] as const;
type WorkspaceLanguage = (typeof WORKSPACE_LANGUAGES)[number];

async function getWorkspaceLanguage(userId: string): Promise<WorkspaceLanguage> {
  const profile = await UserProfile.findOne({ userId });
  const stored = profile?.preferences?.language;
  return WORKSPACE_LANGUAGES.includes(stored as WorkspaceLanguage)
    ? (stored as WorkspaceLanguage)
    : 'en';
}

const router = createContracts();
router.use((req: DomainRequest, res: Response, next: NextFunction) =>
  req.user?.userId ? next() : res.status(401).json({ error: 'Unauthorized' })
);
function operation(run: (req: DomainRequest) => Promise<unknown>) {
  return async (req: DomainRequest, res: Response) => {
    try {
      res.status(200).json(await run(req));
    } catch (error) {
      const status = (error as { status?: number }).status;
      res
        .status(status && [400, 401, 403, 404, 409, 422, 503].includes(status) ? status : 503)
        .json({ error: error instanceof Error ? error.message : 'Learning unavailable' });
    }
  };
}
const revision = (r: DomainRequest) => {
  if (r.query.revisionId !== undefined && typeof r.query.revisionId !== 'string')
    throw Object.assign(new Error('Exact revision tag required'), { status: 400 });
  return r.query.revisionId as string | undefined;
};
// An authorized course author attaches a supplemental structured asset to a
// published revision. The asset is supplemental only: it never mutates
// canonical content, and a reader without it keeps the static fallback.
router.post(
  '/courses/:courseId/presentation/assets',
  operation(async (r) => {
    const revisionId = revision(r);
    if (!revisionId) throw Object.assign(new Error('Exact revision tag required'), { status: 400 });
    const asset = await attachStructuredAsset(
      r.user!.userId,
      String(r.params.courseId),
      revisionId,
      (r.body || {}) as Record<string, unknown>
    );
    return { asset };
  })
);
router.get(
  '/courses/:courseId/activities',
  operation((r) => publishedActivities(r.user!.userId, String(r.params.courseId), revision(r)))
);
router.get(
  '/courses/:courseId/document',
  operation((r) => getLearningDocument(r.user!.userId, String(r.params.courseId), revision(r)))
);
router.get(
  '/courses/:courseId/presentation',
  operation(async (r) => {
    // Assets travel with the presentation so the reader makes one authorized
    // request per lesson surface, not one per component.
    const { presentation, assets } = await getPublishedPresentationWithAssets(
      r.user!.userId,
      String(r.params.courseId),
      revision(r)
    );
    return assets.length ? { ...presentation, assets } : presentation;
  })
);
// Operational metrics for the planning path (Batch 4, M4.5).
//
// Author-only: counts and latency buckets, never a learner, course or request
// identifier. A learner has no reason to read it and no permission to.
// Operational metrics are **process-global**, so they are authorized as an
// operator concern, not a course concern.
//
// M4.6 returned these under `/courses/:courseId/planning/metrics` guarded by
// `canManageCourse`. That was wrong twice over: the path implied a per-course
// measurement that does not exist, and the authorization let any single course
// author observe activity generated by every other course. A `scope: 'process'`
// label is a honest description, not an authorization mechanism.
//
// The endpoint is now operator-only and named for what it measures. No
// per-course or per-learner labels are exposed, so there is nothing a course
// author could use to infer another course's activity even if they held the
// operator role.
router.get(
  '/planning/metrics',
  requireRole('admin'),
  operation(async () => {
    return {
      scope: 'process' as const,
      scopeNote:
        'Aggregate counters for this application process across all courses. ' +
        'No per-course or per-learner breakdown is recorded.',
      processUptimeSeconds: Math.round(process.uptime()),
      ...summarizeMetrics()
    };
  })
);
// Evidence-based adaptation (Batch 4, M4.4).
//
// Learner-scoped and read-mostly: the recommendation route reads the student's
// own trusted evidence and preferences and returns a suggestion. It never
// dispatches to a provider, and it never reads another student's records.
router.get(
  '/courses/:courseId/adaptation',
  operation(async (r) => {
    const lessonId = r.query.lessonId;
    const mode = r.query.mode;
    if (typeof lessonId !== 'string' || typeof mode !== 'string')
      throw Object.assign(new Error('lessonId and mode are required'), { status: 400 });
    if (!isLearningMode(mode)) return { adaptation: null, surface: false };
    return adaptationForLesson(
      r.user!.userId,
      String(r.params.courseId),
      lessonId,
      mode,
      revision(r)
    );
  })
);
router.get(
  '/adaptation/preferences',
  operation(async (r) => readPreferences(r.user!.userId))
);
router.put(
  '/adaptation/preferences',
  operation(async (r) => {
    const body = (r.body || {}) as Record<string, unknown>;
    return savePreferences(r.user!.userId, body.preferences ?? body, Number(body.version ?? 0));
  })
);
router.delete(
  '/adaptation/preferences',
  operation(async (r) => {
    await resetPreferences(r.user!.userId);
    return { reset: true };
  })
);
router.post(
  '/courses/:courseId/adaptation/dismiss',
  operation(async (r) => {
    const body = (r.body || {}) as Record<string, unknown>;
    if (typeof body.lessonId !== 'string' || typeof body.mode !== 'string')
      throw Object.assign(new Error('lessonId and mode are required'), { status: 400 });
    await dismissRecommendation(r.user!.userId, {
      courseId: String(r.params.courseId),
      revisionId: String(body.revisionId ?? ''),
      lessonId: body.lessonId,
      mode: body.mode
    });
    return { dismissed: true };
  })
);
// Development/QA-only experience planning (Batch 4, M4.1).
//
// The route is gated twice: the service refuses unless the environment flag is
// explicitly set, and the mock planner is the only implementation the validator
// will accept. A production deployment without the flag gets a 403 and keeps the
// deterministic reader.
router.post(
  '/courses/:courseId/presentation/plan',
  operation(async (r) => {
    const body = (r.body || {}) as Record<string, unknown>;
    if (typeof body.lessonId !== 'string' || typeof body.scenario !== 'string')
      throw Object.assign(new Error('lessonId and scenario are required'), { status: 400 });
    return planLessonExperience(
      r.user!.userId,
      String(r.params.courseId),
      body.lessonId,
      body.scenario as never
    );
  })
);
// Real-provider planning (Batch 4, M4.2). Off unless an operator enables it;
// the provider is resolved from configuration, never from the request body.
// A refusal is a normal outcome: the caller keeps the deterministic reader.
// Learner read path (Batch 4, M4.3).
//
// Viewing an accepted plan is a different privilege from generating one: this
// route can never dispatch to a provider. It revalidates the stored plan against
// current trusted records and returns only a plan that still passes.
router.get(
  '/courses/:courseId/presentation/plan/stored',
  operation(async (r) => {
    const lessonId = r.query.lessonId;
    const mode = r.query.mode;
    if (typeof lessonId !== 'string' || typeof mode !== 'string')
      throw Object.assign(new Error('lessonId and mode are required'), { status: 400 });
    const outcome = await readStoredPlan({
      actor: r.user!.userId,
      courseId: String(r.params.courseId),
      lessonId,
      mode
    });
    // A non-available outcome is not an error to a learner: the reader falls
    // back. Internal codes never reach the browser.
    return outcome.status === 'available'
      ? { status: 'available', plan: outcome.plan }
      : { status: 'unavailable' };
  })
);
router.post(
  '/courses/:courseId/presentation/plan/ai',
  operation(async (r) => {
    const body = (r.body || {}) as Record<string, unknown>;
    if (typeof body.lessonId !== 'string')
      throw Object.assign(new Error('lessonId is required'), { status: 400 });
    // Generating a plan is an author/operator privilege, not a learner one.
    if (!(await canManageCourse(r.user!.userId, String(r.params.courseId))))
      throw Object.assign(new Error('Plan generation requires course author rights'), {
        status: 403
      });
    const provider = resolvePlannerProvider(async () => {
      throw new Error('Mock delegation is not used on this path');
    });
    if (!provider) return { status: 'refused', code: 'PLANNING_DISABLED' };
    return planLessonWithProvider(
      r.user!.userId,
      String(r.params.courseId),
      body.lessonId,
      provider
    );
  })
);
router.post(
  '/courses/:courseId/presentation/plan/consent',
  operation(async (r) => {
    const body = (r.body || {}) as Record<string, unknown>;
    if (typeof body.revisionId !== 'string' || typeof body.termsVersion !== 'string')
      throw Object.assign(new Error('revisionId and termsVersion are required'), { status: 400 });
    return grantPlanningConsent(r.user!.userId, {
      courseId: String(r.params.courseId),
      revisionId: body.revisionId,
      provider: 'gemini',
      model: configuredPlannerModel(),
      termsVersion: body.termsVersion
    });
  })
);
router.get(
  '/courses/:courseId/progress',
  operation((r) => learnerProgress(r.user!.userId, String(r.params.courseId), revision(r)))
);
router.get(
  '/courses/:courseId/nardouch',
  operation((r) => getCourseNardouch(r.user!.userId, String(r.params.courseId), revision(r)))
);
router.post(
  '/courses/:courseId/nardouch/lessons',
  operation((r) => completeNardouchLesson(r.user!.userId, String(r.params.courseId), r.body))
);
router.post(
  '/courses/:courseId/select',
  operation((r) => selectLearningActivity(r.user!.userId, String(r.params.courseId), r.body || {}))
);
router.post(
  '/courses/:courseId/support',
  operation((r) => sourceLearningSupport(r.user!.userId, String(r.params.courseId), r.body || {}))
);
router.get(
  '/courses/:courseId/diagnostic',
  operation((r) => diagnosticChecks(r.user!.userId, String(r.params.courseId), revision(r)))
);
// Private, provisional learning-style probe. Only the learner can read or save their profile.
router.get(
  '/learning-style/probe',
  operation(async () => ({ questions: learningStyleProbeQuestions() }))
);
router.get(
  '/learning-style',
  operation((r) => getLearningStyle(r.user!.userId))
);
router.put(
  '/learning-style',
  operation((r) => saveLearningStyle(r.user!.userId, r.body))
);
// The learner's interface language, so the choice survives a reload and follows
// them to any surface that renders these languages.
router.get(
  '/language',
  operation(async (r) => ({ language: await getWorkspaceLanguage(r.user!.userId) }))
);
router.put(
  '/language',
  operation(async (r) => {
    const language = (r.body || {}).language;
    if (!WORKSPACE_LANGUAGES.includes(language)) {
      throw Object.assign(new Error('Unsupported interface language'), { status: 400 });
    }
    const existing = await UserProfile.findOne({ userId: r.user!.userId });
    if (!existing) {
      await UserProfile.create({ userId: r.user!.userId });
    }
    // Preferences are one JSON column; merge and write it whole so the language
    // survives a reload without clobbering the other preferences.
    await UserProfile.findOneAndUpdate(
      { userId: r.user!.userId },
      { preferences: { ...(existing?.preferences ?? {}), language } },
      { upsert: true }
    );
    return { language };
  })
);
router.get(
  '/studio/:courseId',
  operation((r) => studioContext(r.user!.userId, String(r.params.courseId), revision(r)))
);
router.get(
  '/rooms/:roomId/check',
  operation((r) => ownRoomCheck(r.user!.userId, String(r.params.roomId)))
);
router.get(
  '/rooms/:roomId/checks/:checkId',
  operation((r) => ownRoomCheck(r.user!.userId, String(r.params.roomId), String(r.params.checkId)))
);
router.post(
  '/rooms/:roomId/checks/:checkId',
  operation((r) =>
    submitOwnRoomCheck(
      r.user!.userId,
      String(r.params.roomId),
      String(r.params.checkId),
      r.body || {}
    )
  )
);
router.get(
  '/rooms/:roomId/debrief',
  operation((r) => roomLearningDebrief(r.user!.userId, String(r.params.roomId)))
);
router.post(
  '/rooms/:roomId/proposals',
  operation((r) => {
    if (Object.keys(r.body || {}).length)
      throw Object.assign(new Error('Unsupported proposal field'), { status: 400 });
    return proposeRoomSupport(r.user!.userId, String(r.params.roomId));
  })
);
router.post(
  '/rooms/:roomId/proposals/:proposalId/decision',
  async (req: DomainRequest, res: Response) => {
    try {
      const result = await decideRoomSupport(
        req.user!.userId,
        String(req.params.roomId),
        String(req.params.proposalId),
        req.body || {}
      );
      if ('changedRoom' in result && result.changedRoom)
        await broadcastRoomState(result.changedRoom, req);
      res.status(result.status).json(result.body);
    } catch (error) {
      res
        .status((error as { status?: number }).status || 503)
        .json({ error: error instanceof Error ? error.message : 'Proposal unavailable' });
    }
  }
);
export default router;
