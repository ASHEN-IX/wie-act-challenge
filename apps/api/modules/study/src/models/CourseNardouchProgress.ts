import type { CourseNardouchProgress as CourseNardouchProgressRow } from '../../../../src/generated/prisma/client';
import { prisma } from '../../../../shared/database';
import { table } from './_table';

export type ICourseNardouchProgress = CourseNardouchProgressRow & { _id: string };

export const CourseNardouchProgress = table<ICourseNardouchProgress>({
  delegate: () => prisma.courseNardouchProgress,
  defaults: () => ({ completedLessonIds: [] }),
  columns: (row) => ({
    userId: row.userId,
    courseId: row.courseId,
    revisionId: row.revisionId,
    completedLessonIds: row.completedLessonIds
  })
});

export default CourseNardouchProgress;
