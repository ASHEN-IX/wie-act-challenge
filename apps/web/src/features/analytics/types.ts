export interface InstructorInsights {
  course: { courseId: string; title: string; revisionId: string | null };
  policy: { minimumCohort: number | null; status: "provisional" };
  suppressed: boolean;
  suppressionReason: string | null;
  summary: {
    enrolledLearners: number;
    practicedLearners: number | null;
    masteredLearners: number | null;
  } | null;
  activityBreakdown: Array<{
    activityType: string;
    practicedLearners: number | null;
  }>;
  trends: Array<{ week: string; practicedLearners: number | null }>;
}
