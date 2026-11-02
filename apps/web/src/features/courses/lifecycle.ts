import type { Course } from "./types";

export type CourseStage = "processing" | "failed" | "review" | "ready";

/**
 * Ingestion completion and learner availability are different states. A
 * completed upload still needs an instructor to review and publish a revision
 * before its learning workspace can be opened.
 */
export function courseStage(
  course: Pick<Course, "status" | "activeRevisionId">,
): CourseStage {
  if (course.status === "processing") return "processing";
  if (course.status === "failed") return "failed";
  return course.activeRevisionId ? "ready" : "review";
}

export function courseStageLabel(stage: CourseStage): string {
  switch (stage) {
    case "processing":
      return "Processing";
    case "failed":
      return "Processing failed";
    case "review":
      return "Ready for review";
    case "ready":
      return "Ready to study";
  }
}

export function isCourseReady(
  course: Pick<Course, "status" | "activeRevisionId">,
): boolean {
  return courseStage(course) === "ready";
}
