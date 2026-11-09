import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response, NextFunction } from 'express';
import { StudySession } from '../models';
import { canReadCourse } from '../services/resourceAccess';
import { isTeamSessionMember } from '../utils/sessionHelpers';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createContracts } = require('@ednova/shared/domainContracts');
const router = createContracts();

// eslint-disable-next-line @typescript-eslint/no-require-imports
const core = require('./coreSessions');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const challenge = require('./challengeSessions');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tasks = require('./sessionTasks');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const team = require('./teamSessions');

// This owning-domain middleware is carried into HTTP and module:// contracts.
router.use(async (req: DomainRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    if (req.body?.courseId && !(await canReadCourse(userId, req.body.courseId))) {
      return res.status(404).json({ error: 'Course not found' });
    }
    const joining = /\/join(?:-by-code)?$/.test(req.path);
    const leaving = /\/leave$/.test(req.path);
    const sessionId = req.params.sessionId;
    const code = req.body?.inviteCode;
    if (!sessionId && !(joining && typeof code === 'string')) return next();
    const filter = sessionId
      ? { id: sessionId }
      : { inviteCode: code.toUpperCase(), type: 'team', status: 'active' };
    const session = await StudySession.findOne(filter).select(
      'userId participants courseId type status'
    );
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (!joining && !isTeamSessionMember(session, userId)) {
      return res.status(403).json({ error: 'Not a participant in this session' });
    }
    if (!leaving && session.courseId && !(await canReadCourse(userId, session.courseId))) {
      return res.status(403).json({ error: 'Source access unavailable' });
    }
    return next();
  } catch (error) {
    return next(error);
  }
});
router.use('/', core);
router.use('/', challenge);
router.use('/', tasks);
router.use('/', team);

export default router;
module.exports = router;
