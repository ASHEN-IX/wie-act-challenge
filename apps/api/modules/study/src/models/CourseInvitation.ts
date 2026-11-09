import type { CourseInvitation as CourseInvitationRow } from '../../../../src/generated/prisma/client';
import { prisma } from '../../../../shared/database';
import { table } from './_table';

export const COURSE_INVITATION_ROLES = ['student', 'instructor'] as const;
export type CourseInvitationRole = (typeof COURSE_INVITATION_ROLES)[number];

export const COURSE_INVITATION_STATUSES = ['pending', 'accepted', 'revoked', 'expired'] as const;
export type CourseInvitationStatus = (typeof COURSE_INVITATION_STATUSES)[number];

export type ICourseInvitation = CourseInvitationRow & { _id: string };

export const CourseInvitation = table<ICourseInvitation>({
  delegate: () => prisma.courseInvitation,
  columns: (row) => ({
    courseId: row.courseId,
    institutionId: row.institutionId,
    role: row.role,
    tokenHash: row.tokenHash,
    recipientEmail: row.recipientEmail,
    status: row.status,
    issuedByUserId: row.issuedByUserId,
    acceptedByUserId: row.acceptedByUserId,
    acceptedAt: row.acceptedAt,
    revokedAt: row.revokedAt,
    expiresAt: row.expiresAt
  })
});

export default CourseInvitation;
