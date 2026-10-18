export interface Subject {
  id: string;
  name: string;
  description?: string;
  course_count?: number;
}
export interface CourseFile {
  filename: string;
  originalName?: string;
  size?: number;
}
export interface CourseTopic {
  id?: string;
  title: string;
  summary?: string;
  subtopics?: { id?: string; title: string; summary?: string }[];
}
export interface Course {
  id: string;
  title: string;
  description?: string;
  status: string;
  subjectId: string;
  createdAt: string;
  topicsCount?: number;
  filesCount?: number;
  files?: CourseFile[];
  topics?: CourseTopic[];
  aiCourseId?: string;
}
