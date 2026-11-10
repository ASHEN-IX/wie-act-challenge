"use server";
import { api, segment } from "@/lib/api";
import { requireIdentity } from "@/server/identity";
import {
  decodeActivityDefinition,
  decodePrivateAssessmentResult,
  type ActivityDefinition,
} from "@/lib/activity-contracts";
import type { Contract } from "@noveris/shared/ednova/contracts";
import {
  parseLearningDocument,
} from "@noveris/shared/ednova/learningDocument";
import {
  parseReadingDocumentV2,
  migrateReadingDocumentV1,
} from "@noveris/shared/ednova/learningDocumentV2";
import { parsePublishedPresentation } from "@noveris/shared/ednova/presentationDocument";
import { parsePublishedExperiencePlan } from "@noveris/shared/ednova/publishedExperiencePlan";
import type { LearningMode } from "@noveris/shared/ednova/learningModes";
import type { AdaptationReason } from "@noveris/shared/ednova/learningAdaptation";
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
export async function learningDocument(courseId: string, revisionId?: string) {
  await requireIdentity();
  const payload = await api<unknown>(
    `/api/v1/study/learning/courses/${segment(courseId)}/document${revisionId !== undefined ? "?revisionId=" + encodeURIComponent(revisionId) : ""}`,
  );
  if (
    payload &&
    typeof payload === "object" &&
    (payload as { schemaVersion?: unknown }).schemaVersion === "2.0.0"
  )
    return parseReadingDocumentV2(payload);
  return migrateReadingDocumentV1(parseLearningDocument(payload));
}
export async function publishedPresentation(courseId: string, revisionId?: string) {
  await requireIdentity();
  const payload = await api<unknown>(
    `/api/v1/study/learning/courses/${segment(courseId)}/presentation${revisionId !== undefined ? "?revisionId=" + encodeURIComponent(revisionId) : ""}`,
  );
  // Strict browser-boundary parse: an unknown version, extra key or
  // inconsistent render policy is a projection failure, never a partial render.
  return parsePublishedPresentation(payload);
}
/**
 * Request a mock-planned lesson layout (Batch 4, M4.1).
 *
 * Development/QA only: the API refuses unless its own environment flag is set,
 * and this returns undefined on any failure so the caller keeps the
 * deterministic reader. A planner failure is never surfaced as a page error.
 */
export async function plannedLessonExperience(
  courseId: string,
  lessonId: string,
  scenario: string,
  blockIds: readonly string[],
) {
  await requireIdentity();
  try {
    const payload = await api<unknown>(
      `/api/v1/study/learning/courses/${segment(courseId)}/presentation/plan`,
      { method: "POST", body: JSON.stringify({ lessonId, scenario }) },
    );
    const outcome = payload as { status?: unknown; plan?: unknown };
    if (outcome?.status !== "planned") return undefined;
    return parsePublishedExperiencePlan(outcome.plan, blockIds);
  } catch {
    // Unavailable, rejected or disabled all mean the same thing to a learner:
    // read the deterministic presentation.
    return undefined;
  }
}
/**
 * Request an AI-planned lesson layout (Batch 4, M4.2).
 *
 * Optional and never blocking: the deterministic presentation is what renders
 * unless this returns a plan that parses. Every other outcome — refused,
 * rejected, failed, uncertain, duplicate, disabled — collapses to `undefined`,
 * because they all mean the same thing to a learner: read the lesson.
 *
 * A provider error is never surfaced. A security refusal is never dressed up as
 * success: the caller simply gets no plan.
 */
export async function aiPlannedLessonExperience(
  courseId: string,
  lessonId: string,
  blockIds: readonly string[],
) {
  await requireIdentity();
  try {
    const payload = await api<unknown>(
      `/api/v1/study/learning/courses/${segment(courseId)}/presentation/plan/ai`,
      { method: "POST", body: JSON.stringify({ lessonId }) },
    );
    const outcome = payload as { status?: unknown; plan?: unknown };
    if (outcome?.status !== "planned") return undefined;
    return parsePublishedExperiencePlan(outcome.plan, blockIds);
  } catch {
    return undefined;
  }
}
/**
 * Fetch an accepted, revalidated plan for a learning mode (Batch 4, M4.3).
 *
 * Read-only from the learner's side: this can never dispatch to a provider.
 * Every non-available outcome collapses to `undefined`, so a stale, revoked or
 * unauthorized plan simply returns the learner to the deterministic reader.
 */
export async function storedLessonPlan(
  courseId: string,
  lessonId: string,
  mode: string,
  blockIds: readonly string[],
) {
  await requireIdentity();
  try {
    const payload = await api<unknown>(
      `/api/v1/study/learning/courses/${segment(courseId)}/presentation/plan/stored` +
        `?lessonId=${encodeURIComponent(lessonId)}&mode=${encodeURIComponent(mode)}`,
    );
    const outcome = payload as { status?: unknown; plan?: unknown };
    if (outcome?.status !== "available") return undefined;
    return parsePublishedExperiencePlan(outcome.plan, blockIds);
  } catch {
    return undefined;
  }
}
/**
 * Ask for an explained mode suggestion (Batch 4, M4.4).
 *
 * Read-only and optional: the server returns a suggestion only when the
 * learner's own preferences or accepted evidence justify one. Anything else —
 * disabled, no evidence, unavailable plan, any error — yields undefined, and
 * the reader shows no suggestion at all.
 *
 * This never dispatches a provider request and never changes the learner's mode.
 */
export async function lessonRecommendation(
  courseId: string,
  lessonId: string,
  mode: string,
) {
  try {
    await requireIdentity();
    const payload = await api<unknown>(
      `/api/v1/study/learning/courses/${segment(courseId)}/adaptation` +
        `?lessonId=${encodeURIComponent(lessonId)}&mode=${encodeURIComponent(mode)}`,
    );
    const result = payload as {
      adaptation?: {
        recommendedMode?: unknown;
        reason?: unknown;
      } | null;
      surface?: unknown;
    };
    const adaptation = result?.adaptation;
    if (!adaptation || result?.surface !== true) return undefined;
    const recommended = adaptation.recommendedMode;
    const reason = adaptation.reason;
    if (typeof recommended !== "string" || typeof reason !== "string") return undefined;
    if (recommended === "read" || recommended === mode) return undefined;
    return { mode: recommended as LearningMode, reason: reason as AdaptationReason };
  } catch {
    return undefined;
  }
}
/**
 * Record that the learner dismissed a suggestion (Batch 4, M4.4).
 *
 * Scoped to one learner and one lesson+mode. Dismissal is a UI courtesy, not a
 * permanent setting: the learner can still turn suggestions off entirely.
 */
export async function dismissModeSuggestion(
  courseId: string,
  input: { revisionId: string; lessonId: string; mode: string },
) {
  await requireIdentity();
  try {
    await api<unknown>(
      `/api/v1/study/learning/courses/${segment(courseId)}/adaptation/dismiss`,
      { method: "POST", body: JSON.stringify(input) },
    );
    return { dismissed: true };
  } catch {
    return { dismissed: false };
  }
}

/** Turn evidence-based suggestions off for this learner. */
export async function disableModeSuggestions(): Promise<boolean> {
  await requireIdentity();
  try {
    const current = await api<{ version?: number; preferences?: Record<string, unknown> }>(
      `/api/v1/study/learning/adaptation/preferences`,
    );
    await api<unknown>(`/api/v1/study/learning/adaptation/preferences`, {
      method: "PUT",
      body: JSON.stringify({
        version: current?.version ?? 0,
        preferences: { recommendationsEnabled: false },
      }),
    });
    return true;
  } catch {
    return false;
  }
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
    // Omitted when the learner has not chosen a type, so the adaptive policy picks.
    activityType?: string;
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
    // Tentative and private: reasons only, never a grade.
    confusion?: { tentative: boolean; reasons: string[] };
  }>(`/api/v1/study/learning/courses/${segment(courseId)}/support`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type LearningStyleQuestion = {
  id: string;
  prompt: string;
  options: Array<{ id: string; label: string }>;
};
export type LearningStyleProfile = {
  primary: string;
  provisional: true;
  completedAt: string;
} | null;

export async function loadLearningStyle() {
  await requireIdentity();
  const [probe, profile] = await Promise.all([
    api<{ questions: LearningStyleQuestion[] }>(
      "/api/v1/study/learning/learning-style/probe",
    ),
    api<LearningStyleProfile>("/api/v1/study/learning/learning-style"),
  ]);
  return { questions: probe.questions, profile };
}

export async function saveLearningStyle(answers: Record<string, string>) {
  await requireIdentity();
  return api<NonNullable<LearningStyleProfile>>(
    "/api/v1/study/learning/learning-style",
    { method: "PUT", body: JSON.stringify(answers) },
  );
}

export type WorkspaceLanguage = "en" | "fr" | "ar" | "ary";

/** The learner's persisted interface language. Falls back to English. */
export async function loadWorkspaceLanguage(): Promise<WorkspaceLanguage> {
  await requireIdentity();
  const data = await api<{ language: WorkspaceLanguage }>(
    "/api/v1/study/learning/language",
  );
  return data.language;
}

export async function saveWorkspaceLanguage(language: WorkspaceLanguage) {
  await requireIdentity();
  return api<{ language: WorkspaceLanguage }>(
    "/api/v1/study/learning/language",
    { method: "PUT", body: JSON.stringify({ language }) },
  );
}
