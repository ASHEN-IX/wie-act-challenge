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

// Interface languages the learning workspace can actually render. Keep this list
// in step with the translations in the web workspace; a persisted value outside
// it would only produce a half-translated page.
const WORKSPACE_LANGUAGES = ['en', 'fr', 'ar', 'ary'] as const;
type WorkspaceLanguage = (typeof WORKSPACE_LANGUAGES)[number];

async function getWorkspaceLanguage(userId: string): Promise<WorkspaceLanguage> {
  const profile = await UserProfile.findOne({ userId }).select('preferences.language').lean();
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
router.get(
  '/courses/:courseId/activities',
  operation((r) => publishedActivities(r.user!.userId, String(r.params.courseId), revision(r)))
);
router.get(
  '/courses/:courseId/document',
  operation((r) =>
    getLearningDocument(r.user!.userId, String(r.params.courseId), revision(r))
  )
);
router.get(
  '/courses/:courseId/progress',
  operation((r) => learnerProgress(r.user!.userId, String(r.params.courseId), revision(r)))
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
router.get('/learning-style', operation((r) => getLearningStyle(r.user!.userId)));
router.put('/learning-style', operation((r) => saveLearningStyle(r.user!.userId, r.body)));
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
    const profile = await UserProfile.findOneAndUpdate(
      { userId: r.user!.userId },
      { $set: { 'preferences.language': language } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
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
