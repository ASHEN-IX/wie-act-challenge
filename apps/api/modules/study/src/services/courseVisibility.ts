import { Course, Institution, PublicCourseJoin } from '../models';
import type { CourseVisibility } from '../models';

// Not imported from '../models': that module's runtime exports are a hand-written registry.
const COURSE_VISIBILITIES: readonly CourseVisibility[] = ['private', 'institution', 'public'];
import { getCourseAccessRole } from './resourceAccess';

export class VisibilityError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

/** Courses created before this field existed keep their old meaning. */
export function effectiveVisibility(course: {
  scope?: string | null;
  visibility?: string | null;
}): CourseVisibility {
  if (course.visibility === 'public') return 'public';
  return course.scope === 'institutional' ? 'institution' : 'private';
}

/**
 * Change who can open a published course.
 * - Personal course: private (only me) or public (anyone signed in).
 * - Institutional course: institution (enrolled members) or public (anyone signed in).
 * - Going public needs a published version and the course creator or an institution admin.
 */
export async function setCourseVisibility(userId: string, courseId: string, value: unknown) {
  if (typeof value !== 'string' || !(COURSE_VISIBILITIES as readonly string[]).includes(value)) {
    throw new VisibilityError(400, 'visibility must be private, institution or public');
  }
  const visibility = value as CourseVisibility;
  const role = await getCourseAccessRole(userId, courseId);
  if (!role || role === 'student') throw new VisibilityError(404, 'Course not found');

  const course = await Course.findById(courseId).select(
    'scope visibility activeRevisionId userId ownerUserId'
  );
  // `.select()` narrows the projection at the database, so the row still carries
  // the columns `Course.save()` needs once `visibility` is added.
  if (!course) throw new VisibilityError(404, 'Course not found');
  const institutional = course.scope === 'institutional';

  if (institutional ? visibility === 'private' : visibility === 'institution') {
    throw new VisibilityError(
      400,
      institutional
        ? 'An institution course is shared with its institution or made public.'
        : 'A personal course is private or public.'
    );
  }
  if (visibility === 'public') {
    const creator = course.userId === userId || course.ownerUserId === userId;
    if (role === 'instructor' && !creator) {
      throw new VisibilityError(
        403,
        'Only the course creator or an institution admin can make a course public'
      );
    }
    if (!course.activeRevisionId) {
      throw new VisibilityError(409, 'Publish the course before making it public');
    }
  }
  course.visibility = visibility;
  await Course.save(course);
  return { visibility };
}

export interface PublicCourseSummary {
  id: string;
  title: string;
  description?: string;
  subjectId?: string;
  institutionName?: string;
  topicsCount: number;
  joined: boolean;
  own: boolean;
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function listPublicCourses(
  userId: string,
  options: { q?: string; limit?: number; skip?: number } = {}
): Promise<PublicCourseSummary[]> {
  const limit = Math.min(Math.max(options.limit || 24, 1), 50);
  const skip = Math.max(options.skip || 0, 0);
  const filter: Record<string, unknown> = {
    visibility: 'public',
    activeRevisionId: { $exists: true, $nin: [null, ''] }
  };
  const q = options.q?.trim().slice(0, 80);
  if (q) {
    const re = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: re }, { description: re }];
  }
  const courses = await Course.find(filter)
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .select('title description subjectId scope institutionId topics userId ownerUserId');

  const institutionIds = [
    ...new Set(courses.filter((c) => c.institutionId).map((c) => String(c.institutionId)))
  ];
  const institutions = institutionIds.length
    ? await Institution.find({ id: { $in: institutionIds }, status: 'active' }).select('name')
    : [];
  const names = new Map(institutions.map((i) => [String(i.id), i.name as string]));
  const joins = await PublicCourseJoin.find({
    userId,
    courseId: { $in: courses.map((c) => c.id) }
  }).select('courseId');
  const joined = new Set(joins.map((j) => String(j.courseId)));

  return courses
    .filter((c) => c.scope !== 'institutional' || names.has(String(c.institutionId)))
    .map((c): PublicCourseSummary => ({
      id: String(c.id),
      title: c.title,
      description: c.description ?? undefined,
      subjectId: c.subjectId ?? undefined,
      institutionName: c.institutionId ? names.get(String(c.institutionId)) : undefined,
      topicsCount: c.topics?.length || 0,
      joined: joined.has(String(c.id)),
      own: c.userId === userId || c.ownerUserId === userId
    }));
}

async function requirePublicCourse(courseId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(courseId))
    throw new VisibilityError(404, 'Course not found');
  const course = await Course.findOne({
    id: courseId,
    visibility: 'public',
    activeRevisionId: { $exists: true, $nin: [null, ''] }
  }).select('id scope institutionId');
  if (!course) throw new VisibilityError(404, 'Course not found');
  if (
    course.scope === 'institutional' &&
    !(
      course.institutionId &&
      (await Institution.exists({ id: course.institutionId, status: 'active' }))
    )
  ) {
    throw new VisibilityError(404, 'Course not found');
  }
  return course;
}

/** Add a public course to "My learning". Idempotent. */
export async function joinPublicCourse(userId: string, courseId: string) {
  const course = await requirePublicCourse(courseId);
  await PublicCourseJoin.findOneAndUpdate(
    { userId, courseId: course.id },
    { $setOnInsert: { userId, courseId: course.id } },
    { upsert: true }
  );
  return { joined: true };
}

export async function leavePublicCourse(userId: string, courseId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(courseId))
    throw new VisibilityError(404, 'Course not found');
  await PublicCourseJoin.deleteOne({ userId, courseId });
  return { joined: false };
}

export async function joinedPublicCourseIds(userId: string): Promise<string[]> {
  const joins = await PublicCourseJoin.find({ userId }).select('courseId');
  return joins.map((j) => String(j.courseId));
}
