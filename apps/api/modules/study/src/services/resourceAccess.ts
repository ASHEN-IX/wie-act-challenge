import { Course, StudyPlan } from '../models';

/** Current Study-owned grant: private personal ownership only. No admin,
 * room-invite or hypothetical enrollment bypass. Future grants belong here. */
export async function canReadCourse(userId: string, courseId: unknown): Promise<boolean> {
  if (!userId || typeof courseId !== 'string' || !/^[a-f\d]{24}$/i.test(courseId)) return false;
  return !!(await Course.exists({ _id: courseId, userId }));
}

/** Materialized task/plan content inherits its current source grant. Legacy
 * plans with no source provenance cannot be upgraded into a sharing grant. */
export async function canReadPlanContext(userId: string, planId: string): Promise<boolean> {
  const plan = await StudyPlan.findOne({ _id: planId, userId })
    .select('courseId resourceScope')
    .lean();
  if (!plan) return false;
  return canReadPlanSource(userId, plan);
}

export async function canReadPlanSource(
  userId: string,
  plan: { courseId?: string; resourceScope?: { courseId?: string } }
): Promise<boolean> {
  const courseId = plan.courseId || plan.resourceScope?.courseId;
  return courseId ? canReadCourse(userId, courseId) : !!plan.resourceScope;
}
