"use server";

import { api, segment } from "@/lib/api";
import { requireIdentity } from "@/server/identity";
import type { CourseNardouchJourney } from "@noveris/shared/ednova/nardouchGrowth";

export async function loadCourseNardouch(
  courseId: string,
  revisionId?: string,
) {
  await requireIdentity();
  return api<CourseNardouchJourney>(
    `/api/v1/study/learning/courses/${segment(courseId)}/nardouch${revisionId ? `?revisionId=${encodeURIComponent(revisionId)}` : ""}`,
  );
}

export async function finishNardouchLesson(
  courseId: string,
  revisionId: string,
  lessonId: string,
) {
  await requireIdentity();
  return api<CourseNardouchJourney>(
    `/api/v1/study/learning/courses/${segment(courseId)}/nardouch/lessons`,
    { method: "POST", body: JSON.stringify({ revisionId, lessonId }) },
  );
}
