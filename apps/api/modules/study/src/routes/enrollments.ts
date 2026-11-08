import { Response } from 'express';
import type { DomainRequest } from '../../../../src/framework/contracts';
import { errorDetails } from '@ednova/shared/errors';
import {
  acceptCourseInvitation,
  assignInstructorToCourse,
  enrollStudentDirectly,
  issueCourseInvitation,
  listCourseEnrollments,
  revokeInstructorAssignment,
  withdrawOrRevokeEnrollment,
  EnrollmentError
} from '../services/enrollments';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createContracts } = require('@ednova/shared/domainContracts');
const router = createContracts();

function handleError(res: Response, error: unknown) {
  if (error instanceof EnrollmentError) {
    return res.status(error.status).json({ error: error.message });
  }
  const details = errorDetails(error);
  return res.status(500).json({ error: details.message || 'Internal server error' });
}

function param(req: DomainRequest, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

// Assign instructor to course
router.post('/:courseId/instructors', async (req: DomainRequest, res: Response) => {
  try {
    const actorUserId = req.user!.userId;
    const courseId = param(req, 'courseId');
    const { instructorUserId } = req.body;

    const result = await assignInstructorToCourse(actorUserId, courseId, instructorUserId);
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error);
  }
});

// Revoke instructor assignment
router.delete(
  '/:courseId/instructors/:instructorUserId',
  async (req: DomainRequest, res: Response) => {
    try {
      const actorUserId = req.user!.userId;
      const courseId = param(req, 'courseId');
      const instructorUserId = param(req, 'instructorUserId');

      const result = await revokeInstructorAssignment(actorUserId, courseId, instructorUserId);
      res.status(200).json(result);
    } catch (error) {
      handleError(res, error);
    }
  }
);

// Issue course invitation
router.post('/:courseId/invitations', async (req: DomainRequest, res: Response) => {
  try {
    const actorUserId = req.user!.userId;
    const courseId = param(req, 'courseId');
    const { role, expiresInHours } = req.body || {};

    const result = await issueCourseInvitation(actorUserId, courseId, { role, expiresInHours });
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error);
  }
});

// Accept course invitation (claim single-use token)
router.post('/invitations/accept', async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { token } = req.body || {};

    const result = await acceptCourseInvitation(userId, token, req.user?.email);
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error);
  }
});

// Direct administrative or instructor enrollment
router.post('/:courseId/enrollments', async (req: DomainRequest, res: Response) => {
  try {
    const actorUserId = req.user!.userId;
    const courseId = param(req, 'courseId');
    const { studentUserId } = req.body || {};

    const result = await enrollStudentDirectly(actorUserId, courseId, studentUserId);
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error);
  }
});

// List enrolled students in a course
router.get('/:courseId/enrollments', async (req: DomainRequest, res: Response) => {
  try {
    const actorUserId = req.user!.userId;
    const courseId = param(req, 'courseId');

    const enrollments = await listCourseEnrollments(actorUserId, courseId);
    res.status(200).json({ enrollments });
  } catch (error) {
    handleError(res, error);
  }
});

// Withdraw from course (self)
router.delete('/:courseId/enrollments', async (req: DomainRequest, res: Response) => {
  try {
    const actorUserId = req.user!.userId;
    const courseId = param(req, 'courseId');

    const result = await withdrawOrRevokeEnrollment(actorUserId, courseId, undefined);
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error);
  }
});

// Revoke a student enrollment (instructor/admin)
router.delete(
  '/:courseId/enrollments/:studentUserId',
  async (req: DomainRequest, res: Response) => {
    try {
      const actorUserId = req.user!.userId;
      const courseId = param(req, 'courseId');
      const studentUserId = param(req, 'studentUserId');

      const result = await withdrawOrRevokeEnrollment(actorUserId, courseId, studentUserId);
      res.status(200).json(result);
    } catch (error) {
      handleError(res, error);
    }
  }
);

export default router;
