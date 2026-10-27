import type { Response } from 'express';
import { createContracts } from '../../../../shared/domainContracts';
import type { DomainRequest } from '../../../../src/framework/contracts';
import {
  instructorAnalyticsCourses,
  instructorCourseAnalytics
} from '../services/instructorAnalytics';

const router = createContracts();
function operation(run: (req: DomainRequest) => Promise<unknown>) {
  return async (req: DomainRequest, res: Response) => {
    res.setHeader('Cache-Control', 'private, no-store');
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    if (Object.keys(req.query || {}).length)
      return res.status(400).json({ error: 'Insight filters and drill-down are unsupported' });
    try {
      return res.status(200).json(await run(req));
    } catch (error) {
      const status = (error as { status?: number }).status;
      return res.status(status === 403 || status === 409 ? status : 503).json({
        error:
          status === 403
            ? 'Instructor course insight access denied'
            : status === 409
              ? 'Published revision changed; reload insights'
              : 'Course insights unavailable'
      });
    }
  };
}
router.get(
  '/courses',
  operation((req) => instructorAnalyticsCourses(req.user!.userId))
);
router.get(
  '/courses/:courseId',
  operation((req) => instructorCourseAnalytics(req.user!.userId, String(req.params.courseId)))
);
export default router;
