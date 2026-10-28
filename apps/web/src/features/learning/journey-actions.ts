"use server";
import { api, segment } from "@/lib/api";
import { requireIdentity } from "@/server/identity";
import {
  decodeActivityDefinition,
  decodePrivateAssessmentResult,
  type ActivityDefinition,
} from "@/lib/activity-contracts";
import type { Contract } from "@study-partner/shared/ednova/contracts";
export async function learningCatalog(courseId: string, revisionId?: string) {
  await requireIdentity();
  const data = await api<{
    context: Contract<"PublishedContext">;
    activities: ActivityDefinition[];
  }>(
    `/api/v1/study/learning/courses/${segment(courseId)}/activities${revisionId !== undefined ? "?revisionId=" + encodeURIComponent(revisionId) : ""}`,
  );
  return { ...data, activities: data.activities.map(decodeActivityDefinition) };
}
export async function learningProgress(courseId: string, revisionId: string) {
  await requireIdentity();
  return api<{
    masteredObjectiveIds: string[];
    history: Array<{
      attemptId: string;
      activityId: string;
      submittedAt: string;
      result: Contract<"AssessmentResult">;
    }>;
    policy: string;
    recommendation: { objectiveId: string; reason: string } | null;
  }>(
    `/api/v1/study/learning/courses/${segment(courseId)}/progress?revisionId=${encodeURIComponent(revisionId)}`,
  );
}
export async function selectLearning(
  courseId: string,
  input: {
    revisionId: string;
    objectiveId: string;
    activityType: string;
    intent: string;
  },
) {
  await requireIdentity();
  return api<{
    kind: string;
    activity: ActivityDefinition | null;
    reason: string;
    adaptive: boolean;
    assessmentState?: string;
    limitation?: string;
  }>(`/api/v1/study/learning/courses/${segment(courseId)}/select`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
export async function learningDiagnostic(courseId: string, revisionId: string) {
  await requireIdentity();
  return api<{ status: string; checks: ActivityDefinition[]; policy: string }>(
    `/api/v1/study/learning/courses/${segment(courseId)}/diagnostic?revisionId=${encodeURIComponent(revisionId)}`,
  );
}
export async function sendLearningAttempt(
  activity: ActivityDefinition,
  attemptId: string,
  answers: Record<string, unknown>,
  timeSpentSeconds: number,
  roomId?: string,
) {
  const identity = await requireIdentity();
  const {
    courseId,
    revisionId,
    contentHash,
    activityId,
    activityRevision,
    activityType,
  } = activity;
  const result = await api<unknown>(
    `/api/v1/study/activities/${segment(activityId)}/attempts`,
    {
      method: "POST",
      body: JSON.stringify({
        schemaVersion: "1.0.0",
        attemptId,
        activity: {
          courseId,
          revisionId,
          contentHash,
          activityId,
          activityRevision,
          activityType,
        },
        answers,
        timeSpentSeconds,
        roomId: roomId || null,
      }),
    },
  );
  return decodePrivateAssessmentResult(result, identity.userId);
}
export async function askLearningTutor(
  courseId: string,
  input: {
    revisionId: string;
    topicId: string;
    objectiveId: string;
    question: string;
  },
) {
  await requireIdentity();
  return api<{
    status: string;
    answer?: string;
    executionMode?: string;
    citations?: Array<{
      documentId: string;
      pageNumber: number | null;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  }>(`/api/v1/study/courses/${segment(courseId)}/tutor/ask`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function requestLearningSupport(
  courseId: string,
  input: { revisionId: string; activityId: string; mode: "hint" | "explain" },
) {
  await requireIdentity();
  return api<{
    text: string;
    hintLevel: number;
    executionMode: string;
    policy: string;
  }>(`/api/v1/study/learning/courses/${segment(courseId)}/support`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
