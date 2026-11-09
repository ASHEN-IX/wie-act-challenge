import type { PublicCourseJoin as PublicCourseJoinRow } from '../../../../src/generated/prisma/client';
import { prisma } from '../../../../shared/database';
import { table } from './_table';

/**
 * A learner who added a public course to "My learning".
 *
 * Deliberately not a CourseEnrollment: institutional enrollments feed rosters and
 * instructor analytics, and a public learner is not an institution member. This
 * record grants nothing by itself; access comes from the course being public.
 */
export type IPublicCourseJoin = PublicCourseJoinRow & { _id: string };

export const PublicCourseJoin = table<IPublicCourseJoin>({
  delegate: () => prisma.publicCourseJoin,
  columns: (row) => ({ userId: row.userId, courseId: row.courseId })
});

export default PublicCourseJoin;
