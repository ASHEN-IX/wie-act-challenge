import "server-only";
import { load, segment } from "@/lib/api";
import type { Course, Subject } from "./types";
export const getCourses = () =>
  load<{ courses: Course[] }>("/api/v1/study/courses");
export const getSubjects = () =>
  load<{ subjects: Subject[] }>("/api/v1/study/subjects");
export const getCourse = (id: string) =>
  load<{ course: Course }>(`/api/v1/study/courses/${segment(id)}`);
