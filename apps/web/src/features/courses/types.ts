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
  activeRevisionId?: string;
  subjectId: string;
  scope?: "personal" | "institutional";
  institutionId?: string;
  assignedInstructorIds?: string[];
  createdAt: string;
  topicsCount?: number;
  filesCount?: number;
  files?: CourseFile[];
  topics?: CourseTopic[];
  aiCourseId?: string;
}

export interface DraftLearningObjective {
  id: string;
  text?: string;
  statement?: string;
  bloomLevel: string;
  provenance?: "extracted" | "ai_generated" | "manual";
}

export interface DraftSubtopic {
  id: string;
  title: string;
  summary?: string;
  key_concepts?: string[];
  provenance?: "extracted" | "ai_generated" | "manual";
  learning_objectives?: DraftLearningObjective[];
}

export interface DraftTopic {
  id: string;
  title: string;
  description?: string;
  subtopics?: DraftSubtopic[];
  learning_objectives?: DraftLearningObjective[];
}

export interface CourseDraft {
  courseId: string;
  revisionTag: string;
  contentHash: string;
  status: "draft" | "published" | "deprecated";
  isInstructorReviewed: boolean;
  summary: string;
  topics: DraftTopic[];
  vectorIndexRef?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ActivityCandidateResult {
  candidateActivity: Record<string, unknown>;
  candidateEvaluation: Record<string, unknown>;
  draftRevisionTag: string;
  generatedAt: string;
  executionMode?: "DETERMINISTIC_FALLBACK";
  generationSettings?: {
    language: "en" | "fr" | "ar" | "ary";
    difficulty: "beginner" | "standard" | "advanced";
    hintDepth: "none" | "cue" | "context";
    sourceSectionId: string;
  };
  evidencePreview?: {
    documentId: string;
    chunkId: string;
    sectionId: string;
    pageNumber: number | null;
    text: string;
  };
  warnings?: string[];
}
