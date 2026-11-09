import type {
  CourseEnrollment as CourseEnrollmentRow,
  Prisma
} from '../../../../src/generated/prisma/client';
import { prisma } from '../../../../shared/database';
import { table } from './_table';

export const COURSE_ENROLLMENT_STATUSES = ['active', 'dropped', 'revoked'] as const;
export type CourseEnrollmentStatus = (typeof COURSE_ENROLLMENT_STATUSES)[number];

export type ICourseEnrollment = CourseEnrollmentRow & { _id: string };

export const CourseEnrollment = table<ICourseEnrollment>({
  delegate: () => prisma.courseEnrollment,
  columns: (row) => ({
    courseId: row.courseId,
    institutionId: row.institutionId,
    userId: row.userId,
    status: row.status,
    enrolledAt: row.enrolledAt,
    enrolledByUserId: row.enrolledByUserId,
    revokedAt: row.revokedAt
  })
});

export default CourseEnrollment;

// Keep the Prisma type reachable for call sites that annotate update payloads.
export type CourseEnrollmentUpdate = Prisma.CourseEnrollmentUpdateInput;
