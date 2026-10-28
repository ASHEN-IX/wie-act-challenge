import { SourceIntegrityError } from '../services/revisionSources';
import { type Response, type NextFunction } from 'express';
import { createContracts } from '../../../../shared/domainContracts';
import { ActivityBoundaryError } from '../services/activityResolution';
import type { DomainRequest } from '../../../../src/framework/contracts';
import {
  registerActivity,
  getPublicActivity,
  submitAttempt,
  getAttemptResult,
  AttemptConflictError,
  AttemptNotFoundError,
  ActivityNotFoundError,
  StaleRevisionSubmissionError,
  ActivityValidationError
} from '../services/activityAttempt';
import { PublicationForbiddenError, UnpublishedCourseError } from '../services/coursePublication';

const router = createContracts();
router.use((req: DomainRequest, res: Response, next: NextFunction) => {
  if (!req.user?.userId) return res.status(401).json({ error: 'Authentication required' });
  return next();
});

// Contract 04: Public Activity Definition (never leaks answer key or rubric)
router.get('/:activityId', async (req: DomainRequest, res: Response) => {
  try {
    const activityId = String(req.params.activityId);
    const userId = req.user!.userId;
    const courseId = typeof req.query.courseId === 'string' ? req.query.courseId : undefined;

    const revisionId = typeof req.query.revisionId === 'string' ? req.query.revisionId : undefined;
    const activity = await getPublicActivity(userId, activityId, courseId, revisionId);
    res.json(activity);
  } catch (error) {
    if (error instanceof SourceIntegrityError || error instanceof ActivityBoundaryError)
      return res.status(error.status).json({ error: error.code, message: error.message });
    if (error instanceof ActivityBoundaryError)
      return res.status(error.status).json({ error: error.code, message: error.message });
    if (error instanceof ActivityNotFoundError) {
      return res.status(404).json({ error: error.code, message: error.message });
    }
    if (error instanceof PublicationForbiddenError) {
      return res.status(403).json({ error: 'FORBIDDEN', message: error.message });
    }
    console.error('Error fetching activity definition:', error);
    res.status(500).json({ error: 'Failed to fetch activity definition' });
  }
});

// Register activity definition and server-only evaluation definition (instructors)
router.post('/:activityId/register', async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { courseId, activity, serverEvaluation } = req.body || {};

    if (!courseId) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'courseId is required' });
    }

    if (
      Object.keys(req.body || {}).some(
        (key) => !['courseId', 'activity', 'serverEvaluation'].includes(key)
      )
    ) {
      return res.status(400).json({ error: 'INVALID_INPUT' });
    }
    const saved = await registerActivity(
      userId,
      courseId,
      activity,
      serverEvaluation,
      String(req.params.activityId)
    );
    res.status(201).json(saved);
  } catch (error) {
    if (error instanceof SourceIntegrityError || error instanceof ActivityBoundaryError)
      return res.status(error.status).json({ error: error.code, message: error.message });
    if (error instanceof ActivityBoundaryError)
      return res.status(error.status).json({ error: error.code, message: error.message });
    if (error instanceof AttemptConflictError)
      return res.status(409).json({ error: error.code, message: error.message });
    if (error instanceof PublicationForbiddenError) {
      return res.status(403).json({ error: 'FORBIDDEN', message: error.message });
    }
    if (error instanceof ActivityValidationError) {
      return res.status(400).json({ error: error.code, message: error.message });
    }
    console.error('Error registering activity:', error);
    res.status(500).json({ error: 'Failed to register activity' });
  }
});

// Contract 05 / 06: Authoritative Attempt Submission & Assessment
router.post('/:activityId/attempts', async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const submissionBody = req.body;

    const assessmentResult = await submitAttempt(
      userId,
      submissionBody,
      String(req.params.activityId)
    );
    res.status(200).json(assessmentResult);
  } catch (error) {
    if (error instanceof SourceIntegrityError || error instanceof ActivityBoundaryError)
      return res.status(error.status).json({ error: error.code, message: error.message });
    if (error instanceof AttemptConflictError) {
      return res.status(409).json({ error: error.code, message: error.message });
    }
    if (error instanceof StaleRevisionSubmissionError) {
      return res.status(409).json({ error: error.code, message: error.message });
    }
    if (error instanceof ActivityValidationError) {
      return res.status(400).json({ error: error.code, message: error.message });
    }
    if (error instanceof PublicationForbiddenError) {
      return res.status(403).json({ error: 'FORBIDDEN', message: error.message });
    }
    if (error instanceof UnpublishedCourseError) {
      return res.status(404).json({ error: error.code, message: error.message });
    }
    if (error instanceof ActivityBoundaryError)
      return res.status(error.status).json({ error: error.code, message: error.message });
    if (error instanceof ActivityNotFoundError) {
      return res.status(404).json({ error: error.code, message: error.message });
    }
    console.error('Error submitting activity attempt:', error);
    res.status(500).json({ error: 'Failed to process activity attempt' });
  }
});

// Contract 06: Retrieve private attempt result strictly for recipient
router.get('/:activityId/attempts/:attemptId', async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const attemptId = String(req.params.attemptId);

    const result = await getAttemptResult(userId, attemptId, String(req.params.activityId));
    res.json(result);
  } catch (error) {
    if (error instanceof SourceIntegrityError || error instanceof ActivityBoundaryError)
      return res.status(error.status).json({ error: error.code, message: error.message });
    if (error instanceof AttemptNotFoundError) {
      return res.status(404).json({ error: error.code, message: error.message });
    }
    if (error instanceof PublicationForbiddenError) {
      return res.status(403).json({ error: 'FORBIDDEN', message: error.message });
    }
    console.error('Error retrieving attempt result:', error);
    res.status(500).json({ error: 'Failed to retrieve attempt result' });
  }
});

export default router;
