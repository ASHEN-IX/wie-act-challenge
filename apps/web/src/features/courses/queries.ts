import "server-only";
import { load, segment } from "@/lib/api";
import type { Course, Subject, CourseDraft, PublicCourse } from "./types";
export const getCourses = (institutionId?: string) =>
  load<{ courses: Course[] }>(
    institutionId
      ? `/api/v1/study/courses?institution_id=${segment(institutionId)}`
      : "/api/v1/study/courses",
  );
export const getSubjects = () =>
  load<{ subjects: Subject[] }>("/api/v1/study/subjects");
export const getCourse = (id: string) =>
  load<{ course: Course }>(`/api/v1/study/courses/${segment(id)}`);
export const getCourseDraft = (courseId: string) =>
  load<{ draft: CourseDraft }>(
    `/api/v1/study/courses/${segment(courseId)}/draft`,
  );
export const getCourseEnrollments = (courseId: string) =>
  load<{
    enrollments: Array<{
      enrollmentId: string;
      userId: string;
      status: string;
      enrolledAt: string;
    }>;
  }>(`/api/v1/study/courses/${segment(courseId)}/enrollments`);
export const getPublicCourses = (q?: string) =>
  load<{ courses: PublicCourse[] }>(
    `/api/v1/study/courses/public${q ? `?q=${encodeURIComponent(q)}` : ""}`,
  );
