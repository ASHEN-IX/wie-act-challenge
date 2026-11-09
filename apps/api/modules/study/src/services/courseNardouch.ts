import { CourseNardouchProgress } from '../models/CourseNardouchProgress';
import { isDuplicateKey } from '../models/_table';
import { loadPublishedReading, getLearningDocument } from './courseReader';
import { learnerProgress } from './learningJourney';
import { canReadCourse } from './resourceAccess';
import { PublicationForbiddenError } from './coursePublication';
import { ActivityBoundaryError } from './activityResolution';
import {
  courseNardouchGrowth,
  type CourseNardouchJourney
} from '../../../../shared/ednova/nardouchGrowth';

async function journeyContext(actor: string, courseId: string, revisionId?: string) {
  const { context, canonical } = await loadPublishedReading(actor, courseId, revisionId);
  const lessons = canonical
    ? canonical.chapters.flatMap((chapter) =>
        chapter.lessons.map((lesson) => ({ id: lesson.id, title: lesson.title }))
      )
    : (await getLearningDocument(actor, courseId, context.revisionId)).sections
        .filter((section) => section.id !== 'course-source')
        .map((section) => ({ id: section.id, title: section.title }));
  return { context, lessons };
}

export async function getCourseNardouch(
  actor: string,
  courseId: string,
  revisionId?: string
): Promise<CourseNardouchJourney> {
  const { context, lessons } = await journeyContext(actor, courseId, revisionId);
  const [saved, progress] = await Promise.all([
    CourseNardouchProgress.findOne({
      userId: actor,
      courseId,
      revisionId: context.revisionId
    }),
    learnerProgress(actor, courseId, context.revisionId)
  ]);
  if (!(await canReadCourse(actor, courseId))) throw new PublicationForbiddenError();
  return {
    courseId,
    revisionId: context.revisionId,
    lessons,
    ...courseNardouchGrowth(
      lessons,
      saved?.completedLessonIds ?? [],
      context.topics.flatMap((topic) => topic.objectives.map((objective) => objective.objectiveId)),
      progress.masteredObjectiveIds
    )
  };
}

export async function completeNardouchLesson(actor: string, courseId: string, input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new ActivityBoundaryError(400, 'INVALID_INPUT', 'Lesson and revision are required');
  const body = input as Record<string, unknown>;
  if (
    Object.keys(body).some((key) => !['revisionId', 'lessonId'].includes(key)) ||
    typeof body.revisionId !== 'string' ||
    !body.revisionId ||
    body.revisionId.length > 128 ||
    typeof body.lessonId !== 'string' ||
    !body.lessonId ||
    body.lessonId.length > 128
  )
    throw new ActivityBoundaryError(400, 'INVALID_INPUT', 'Exact lesson and revision are required');
  const { context, lessons } = await journeyContext(actor, courseId, body.revisionId);
  if (!lessons.some((lesson) => lesson.id === body.lessonId))
    throw new ActivityBoundaryError(
      404,
      'LESSON_NOT_FOUND',
      'Lesson is not in this course revision'
    );
  if (!(await canReadCourse(actor, courseId))) throw new PublicationForbiddenError();
  // Unique (userId, courseId, revisionId). A completed lesson is only added if
  // absent, matching the old `$addToSet`, so a concurrent first completion and
  // a repeat completion both converge on one row with one copy of the id.
  const key = { userId: actor, courseId, revisionId: context.revisionId };
  try {
    // Create-if-missing on the unique owner/course/revision key.
    await CourseNardouchProgress.findOneAndUpdate(
      key,
      { $setOnInsert: { ...key, completedLessonIds: [] } },
      { upsert: true, new: true }
    );
  } catch (error) {
    // A concurrent first completion inserted the same row first; the add below
    // still applies to it.
    if (!isDuplicateKey(error)) throw error;
  }
  // `$addToSet` semantics: the guarded push only appends when the lesson is
  // absent, so repeated and concurrent completions store it once.
  await CourseNardouchProgress.addToSet(key, 'completedLessonIds', body.lessonId);
  return getCourseNardouch(actor, courseId, context.revisionId);
}
