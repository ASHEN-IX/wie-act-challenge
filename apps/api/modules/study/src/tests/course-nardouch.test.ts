jest.mock('../models/CourseNardouchProgress', () => ({
  CourseNardouchProgress: {
    findOne: jest.fn(),
    updateOne: jest.fn(),
    collection: { createIndex: jest.fn() }
  }
}));
jest.mock('../services/courseReader', () => ({
  loadPublishedReading: jest.fn(),
  getLearningDocument: jest.fn()
}));
jest.mock('../services/learningJourney', () => ({ learnerProgress: jest.fn() }));
jest.mock('../services/resourceAccess', () => ({ canReadCourse: jest.fn() }));

import { CourseNardouchProgress as Store } from '../models/CourseNardouchProgress';
import { loadPublishedReading } from '../services/courseReader';
import { learnerProgress } from '../services/learningJourney';
import { canReadCourse } from '../services/resourceAccess';
import { completeNardouchLesson, getCourseNardouch } from '../services/courseNardouch';
import { courseNardouchGrowth } from '../../../../shared/ednova/nardouchGrowth';

const lessons = Array.from({ length: 8 }, (_, index) => ({
  id: `lesson-${index}`,
  title: `Lesson ${index}`
}));
const ids = lessons.map((lesson) => lesson.id);

describe('course Nardouch growth rules', () => {
  test.each([
    [0, 'baby'],
    [1, 'learner'],
    [4, 'explorer'],
    [6, 'expert'],
    [8, 'expert']
  ])('%i completed lessons unlock %s without passed checks', (count, expected) => {
    expect(
      courseNardouchGrowth(lessons, ids.slice(0, Number(count)), ['objective'], []).stage
    ).toBe(expected);
  });
  test('all lessons and all accepted objective checks are required together', () => {
    expect(courseNardouchGrowth(lessons, ids, ['a', 'b'], ['a']).graduated).toBe(false);
    expect(courseNardouchGrowth(lessons, ids.slice(0, 7), ['a', 'b'], ['a', 'b']).graduated).toBe(
      false
    );
    expect(courseNardouchGrowth(lessons, ids, ['a', 'b'], ['a', 'b']).stage).toBe('graduate');
  });
  test('empty curricula, absent checks, duplicates and foreign IDs cannot graduate', () => {
    expect(courseNardouchGrowth([], [], [], []).graduated).toBe(false);
    expect(courseNardouchGrowth(lessons, ids, [], []).stage).toBe('expert');
    const result = courseNardouchGrowth(
      lessons,
      ['lesson-0', 'lesson-0', 'foreign'],
      ['a', 'a'],
      ['foreign']
    );
    expect(result.completedLessonIds).toEqual(['lesson-0']);
    expect(result.passedChecks).toBe(0);
    expect(result.totalChecks).toBe(1);
  });
});

describe('private persisted course progress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (loadPublishedReading as jest.Mock).mockImplementation(
      async (_actor, courseId, revisionId = 'revision') => ({
        context: { courseId, revisionId, topics: [{ objectives: [{ objectiveId: 'objective' }] }] },
        canonical: { chapters: [{ lessons }] }
      })
    );
    (canReadCourse as jest.Mock).mockResolvedValue(true);
    (learnerProgress as jest.Mock).mockResolvedValue({ masteredObjectiveIds: [] });
    (Store.findOne as jest.Mock).mockReturnValue({ lean: async () => null });
    (Store.updateOne as jest.Mock).mockResolvedValue({});
    (Store.collection.createIndex as jest.Mock).mockResolvedValue('unique_course_owner');
  });
  test('fresh courses are Baby and lookups are scoped to actor, course and exact revision', async () => {
    expect((await getCourseNardouch('student', 'course-a', 'rev-a')).stage).toBe('baby');
    expect(Store.findOne).toHaveBeenCalledWith({
      userId: 'student',
      courseId: 'course-a',
      revisionId: 'rev-a'
    });
    await getCourseNardouch('other-student', 'course-b', 'rev-b');
    expect(Store.findOne).toHaveBeenLastCalledWith({
      userId: 'other-student',
      courseId: 'course-b',
      revisionId: 'rev-b'
    });
    expect(Store.updateOne).not.toHaveBeenCalled();
  });
  test('completion is an atomic add-to-set, never a client-provided stage or score', async () => {
    await completeNardouchLesson('student', 'course', { revisionId: 'rev', lessonId: 'lesson-0' });
    expect(Store.updateOne).toHaveBeenCalledWith(
      { userId: 'student', courseId: 'course', revisionId: 'rev' },
      { $addToSet: { completedLessonIds: 'lesson-0' } },
      { upsert: true }
    );
    await expect(
      completeNardouchLesson('student', 'course', {
        revisionId: 'rev',
        lessonId: 'lesson-0',
        stage: 'graduate'
      })
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      completeNardouchLesson('student', 'course', { revisionId: 'rev', lessonId: 'foreign' })
    ).rejects.toMatchObject({ status: 404 });
  });
  test('revoked access and invalid bodies cannot write progress', async () => {
    (canReadCourse as jest.Mock).mockResolvedValue(false);
    await expect(
      completeNardouchLesson('student', 'course', { revisionId: 'rev', lessonId: 'lesson-0' })
    ).rejects.toMatchObject({ status: 403 });
    for (const input of [
      null,
      [],
      {},
      { lessonId: 'lesson-0' },
      { revisionId: ['rev'], lessonId: 'lesson-0' }
    ])
      await expect(completeNardouchLesson('student', 'course', input)).rejects.toMatchObject({
        status: 400
      });
    expect(Store.updateOne).not.toHaveBeenCalled();
  });
  test('graduation is recomputed from saved reading and current accepted evidence', async () => {
    (Store.findOne as jest.Mock).mockReturnValue({
      lean: async () => ({ completedLessonIds: ids })
    });
    expect((await getCourseNardouch('student', 'course')).stage).toBe('expert');
    (learnerProgress as jest.Mock).mockResolvedValue({ masteredObjectiveIds: ['objective'] });
    expect((await getCourseNardouch('student', 'course')).stage).toBe('graduate');
    (learnerProgress as jest.Mock).mockResolvedValue({ masteredObjectiveIds: [] });
    expect((await getCourseNardouch('student', 'course')).stage).toBe('expert');
  });
  test('concurrent first completions recover from a unique-key race', async () => {
    (Store.updateOne as jest.Mock).mockRejectedValueOnce({ code: 11000 }).mockResolvedValue({});
    await completeNardouchLesson('student', 'course', { revisionId: 'rev', lessonId: 'lesson-0' });
    expect(Store.updateOne).toHaveBeenCalledTimes(2);
    expect(Store.updateOne).toHaveBeenLastCalledWith(
      { userId: 'student', courseId: 'course', revisionId: 'rev' },
      { $addToSet: { completedLessonIds: 'lesson-0' } }
    );
  });
});
