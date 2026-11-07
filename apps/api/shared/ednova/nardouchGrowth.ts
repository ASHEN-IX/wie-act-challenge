export type NardouchStage = 'baby' | 'learner' | 'explorer' | 'expert' | 'graduate';

export type CourseNardouchJourney = {
  courseId: string;
  revisionId: string;
  stage: NardouchStage;
  lessons: Array<{ id: string; title: string }>;
  completedLessonIds: string[];
  readingPercent: number;
  passedChecks: number;
  totalChecks: number;
  graduated: boolean;
};

/** Reading is self-reported. Only server-accepted assessment evidence graduates. */
export function courseNardouchGrowth(
  lessons: readonly { id: string; title: string }[],
  completed: readonly string[],
  objectiveIds: readonly string[],
  mastered: readonly string[]
) {
  const lessonIds = [...new Set(lessons.map((lesson) => lesson.id))];
  const completedSet = new Set(completed);
  const completedLessonIds = lessonIds.filter((id) => completedSet.has(id));
  const objectives = [...new Set(objectiveIds)];
  const masteredSet = new Set(mastered);
  const passedChecks = objectives.filter((id) => masteredSet.has(id)).length;
  const fraction = lessonIds.length ? completedLessonIds.length / lessonIds.length : 0;
  const graduated = fraction === 1 && objectives.length > 0 && passedChecks === objectives.length;
  const stage: NardouchStage = graduated
    ? 'graduate'
    : fraction >= 0.75
      ? 'expert'
      : fraction >= 0.4
        ? 'explorer'
        : fraction > 0
          ? 'learner'
          : 'baby';
  return {
    stage,
    completedLessonIds,
    readingPercent: Math.floor(fraction * 100),
    passedChecks,
    totalChecks: objectives.length,
    graduated
  };
}
