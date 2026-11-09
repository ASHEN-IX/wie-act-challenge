import { Course, CourseEnrollment, Institution, InstitutionMembership, StudyPlan } from '../models';

export type CourseAccessRole = 'owner' | 'instructor' | 'admin' | 'student';

/** Content authority is distinct from institution metadata/enrollment administration.
 * Institutional grants always require a currently active institution and membership.
 * Legacy institutions without an explicit active state fail closed (no implicit migration).
 */
async function courseGrant(userId: string, courseId: unknown) {
  if (!userId || typeof courseId !== 'string' || !/^[a-f\d]{24}$/i.test(courseId)) return null;
  const course = await Course.findById(courseId)
    .select(
      'scope visibility userId ownerUserId institutionId assignedInstructorIds activeRevisionId'
    )
    .lean();
  if (!course) return null;
  return (await memberGrant(userId, courseId, course)) || (await publicGrant(course));
}

interface GrantCourse {
  scope?: string;
  visibility?: string;
  userId?: string;
  ownerUserId?: string;
  institutionId?: unknown;
  assignedInstructorIds?: string[];
  activeRevisionId?: string;
}

/** Anyone signed in may read a course its publisher made public, but only once it is
 * published, and for an institutional course only while the institution is active.
 * It is read access only: it never grants authoring, enrollment or admin rights. */
async function publicGrant(course: GrantCourse) {
  if (course.visibility !== 'public' || !course.activeRevisionId) return null;
  if (
    course.scope === 'institutional' &&
    !(
      course.institutionId &&
      (await Institution.exists({ _id: course.institutionId, status: 'active' }))
    )
  )
    return null;
  return { course, role: 'student' as const };
}

async function memberGrant(userId: string, courseId: string, course: GrantCourse) {
  if (!course.scope || course.scope === 'personal') {
    return course.userId === userId || course.ownerUserId === userId
      ? { course, role: 'owner' as const }
      : null;
  }
  if (course.scope !== 'institutional' || !course.institutionId) return null;
  if (!(await Institution.exists({ _id: course.institutionId, status: 'active' }))) return null;
  const membership = await InstitutionMembership.findOne({
    institutionId: course.institutionId,
    userId,
    status: 'active'
  }).lean();
  if (!membership) return null;
  if (membership.role === 'instructor' && course.assignedInstructorIds?.includes(userId)) {
    return { course, role: 'instructor' as const };
  }
  if (membership.role === 'university_admin') return { course, role: 'admin' as const };
  if (
    membership.role === 'university_student' &&
    (await CourseEnrollment.exists({
      courseId,
      institutionId: course.institutionId,
      userId,
      status: 'active'
    }))
  )
    return { course, role: 'student' as const };
  return null;
}

export async function getCourseAccessRole(
  userId: string,
  courseId: unknown
): Promise<CourseAccessRole | null> {
  return (await courseGrant(userId, courseId))?.role || null;
}

export async function canReadCourse(userId: string, courseId: unknown): Promise<boolean> {
  const role = await getCourseAccessRole(userId, courseId);
  return role === 'owner' || role === 'instructor' || role === 'student';
}

export async function canAuthorCourse(userId: string, courseId: unknown): Promise<boolean> {
  const role = await getCourseAccessRole(userId, courseId);
  return role === 'owner' || role === 'instructor';
}

// Separate named policy boundaries even where their current least-privilege rules agree.
export const canReviewCourse = canAuthorCourse;
export const canPublishCourse = canAuthorCourse;
export const canManageCourse = canAuthorCourse;

export async function canAdministerCourse(userId: string, courseId: unknown): Promise<boolean> {
  return (await getCourseAccessRole(userId, courseId)) === 'admin';
}

export async function canManageEnrollments(userId: string, courseId: unknown): Promise<boolean> {
  const role = await getCourseAccessRole(userId, courseId);
  return role === 'admin' || role === 'instructor';
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
