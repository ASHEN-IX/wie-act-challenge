"use server";
import { redirect } from "next/navigation";
import { api, segment } from "@/lib/api";
import { requireIdentity } from "@/server/identity";
import {
  decodeCheckResult,
  decodeGuideResponse,
  decodeVisualLab,
  decodeVisualLabPlan,
  type PublicVisualLab,
} from "./contracts";

export interface LabActionState {
  error?: string;
  status?: string;
}

const LAB_ERRORS: Record<string, string> = {
  UNSUPPORTED_CONCEPT:
    "The lab can't represent that concept accurately yet. It supports weighted graphs and shortest paths, Newton's second law, projectile motion and quadratic functions. Try one of those.",
  INVALID_SCENARIO:
    "A valid experiment could not be built for that concept. Try rephrasing it.",
  VISUAL_LAB_UNAVAILABLE:
    "The visual lab is unavailable right now. Please try again.",
  UNPUBLISHED: "Only published course material can ground a lab.",
};

function labErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "The lab could not be created.";
  return (
    LAB_ERRORS[error.message] ??
    (/^[A-Z_]+$/.test(error.message)
      ? "The lab could not be created."
      : error.message)
  );
}

/** Course-grounded planning. The course grant and revision pin are server-side. */
export async function createCourseLab(
  _state: LabActionState,
  form: FormData,
): Promise<LabActionState> {
  await requireIdentity();
  const courseId = String(form.get("courseId") || "");
  const concept = String(form.get("concept") || "").trim();
  const revisionId = String(form.get("revisionId") || "").trim();
  const topicId = String(form.get("topicId") || "").trim();
  if (!concept) return { error: "Describe the concept you want to explore." };
  let labId: string;
  try {
    const data = await api<unknown>("/api/v1/study/visual-lab/plan", {
      method: "POST",
      body: JSON.stringify({
        mode: "course",
        courseId,
        concept,
        ...(revisionId ? { revisionId } : {}),
        ...(topicId ? { topicId } : {}),
      }),
    });
    labId = decodeVisualLabPlan(data).labId;
  } catch (error) {
    return { error: labErrorMessage(error) };
  }
  redirect(`/visual-lab/${labId}`);
}

/** Independent topic request. The lab is explicitly not course-grounded. */
export async function createTopicLab(
  _state: LabActionState,
  form: FormData,
): Promise<LabActionState> {
  await requireIdentity();
  const concept = String(form.get("concept") || "").trim();
  if (!concept) return { error: "Describe the concept you want to explore." };
  let labId: string;
  try {
    const data = await api<unknown>("/api/v1/study/visual-lab/plan", {
      method: "POST",
      body: JSON.stringify({ mode: "topic", concept }),
    });
    labId = decodeVisualLabPlan(data).labId;
  } catch (error) {
    return { error: labErrorMessage(error) };
  }
  redirect(`/visual-lab/${labId}`);
}

export async function loadLab(labId: string): Promise<PublicVisualLab> {
  await requireIdentity();
  const data = await api<unknown>(`/api/v1/study/visual-lab/${segment(labId)}`);
  return decodeVisualLab(data);
}

export async function askLabGuide(
  labId: string,
  input: {
    question: string;
    guidanceMode: "explain" | "hint" | "next" | "challenge";
    parameters?: unknown;
  },
) {
  await requireIdentity();
  const data = await api<unknown>(
    `/api/v1/study/visual-lab/${segment(labId)}/guide`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return decodeGuideResponse(data);
}

export async function submitLabCheck(labId: string, selectedOptionId: string) {
  await requireIdentity();
  const data = await api<unknown>(
    `/api/v1/study/visual-lab/${segment(labId)}/check`,
    { method: "POST", body: JSON.stringify({ selectedOptionId }) },
  );
  return decodeCheckResult(data);
}
