/** Test-only Server Action transport. Production never imports this file. */
import { courseNardouchGrowth } from "@ednova/shared/ednova/nardouchGrowth";
const lessons = Array.from({ length: 4 }, (_, i) => ({
  id: `lesson-${i}`,
  title: ["Recursion", "Binary search", "Stacks and queues", "Course review"][
    i
  ],
}));
export async function loadCourseNardouch(
  courseId: string,
  revisionId = "revision",
) {
  const saved = JSON.parse(
    localStorage.getItem(`growth-fixture:${courseId}`) ||
      '{"completed":[],"passed":false}',
  );
  return {
    courseId,
    revisionId,
    lessons,
    ...courseNardouchGrowth(
      lessons,
      saved.completed,
      ["objective"],
      saved.passed ? ["objective"] : [],
    ),
  };
}
export async function finishNardouchLesson(
  courseId: string,
  revisionId: string,
  lessonId: string,
) {
  await new Promise((resolve) => setTimeout(resolve, 50));
  if (new URLSearchParams(location.search).has("failSave"))
    throw Error("Test-only persistence failure");
  const saved = JSON.parse(
    localStorage.getItem(`growth-fixture:${courseId}`) ||
      '{"completed":[],"passed":false}',
  );
  saved.completed = [...new Set([...saved.completed, lessonId])];
  localStorage.setItem(`growth-fixture:${courseId}`, JSON.stringify(saved));
  return loadCourseNardouch(courseId, revisionId);
}
export function passFixtureCheck(courseId: string) {
  const saved = JSON.parse(localStorage.getItem(`growth-fixture:${courseId}`)!);
  localStorage.setItem(
    `growth-fixture:${courseId}`,
    JSON.stringify({ ...saved, passed: true }),
  );
}
