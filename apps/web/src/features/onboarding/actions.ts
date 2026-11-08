"use server";
import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import { requireIdentity } from "@/server/identity";
import type { ActionState } from "@/lib/action-state";
import { safeNext } from "./options";

function collect(form: FormData) {
  const minutes = Number(form.get("sessionMinutes"));
  const subjects = String(form.get("subjects") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const pick = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" && v ? v : null;
  };
  return {
    goals: form.getAll("goals"),
    subjects,
    selfReportedLevel: pick("selfReportedLevel") ?? "not_sure",
    languages: form.getAll("languages"),
    formats: form.getAll("formats"),
    sessionMinutes: Number.isInteger(minutes) && minutes > 0 ? minutes : null,
    studyTime: pick("studyTime"),
    collaboration: pick("collaboration"),
    reduceMotion: form.get("reduceMotion") === "on",
    largeText: form.get("largeText") === "on",
  };
}

/** Saves answers. During onboarding it continues to `next`; in settings it stays. */
export async function saveLearningPreferences(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  const onboarding = form.get("mode") === "onboarding";
  try {
    await api("/api/v1/users/profile/learning", {
      method: "PUT",
      body: JSON.stringify({ ...collect(form), onboardingStatus: "completed" }),
    });
  } catch (error) {
    unstable_rethrow(error);
    return {
      error: error instanceof Error ? error.message : "Unable to save preferences.",
    };
  }
  revalidatePath("/", "layout");
  if (onboarding) redirect(safeNext(form.get("next")));
  return { success: "Preferences saved." };
}

export async function skipOnboarding(form: FormData): Promise<void> {
  await requireIdentity();
  await api("/api/v1/users/profile/learning", {
    method: "PUT",
    body: JSON.stringify({ onboardingStatus: "skipped" }),
  });
  revalidatePath("/", "layout");
  redirect(safeNext(form.get("next")));
}

export async function resetLearningPreferences(
  _state: ActionState,
  _form: FormData,
): Promise<ActionState> {
  void _form;
  await requireIdentity();
  try {
    await api("/api/v1/users/profile/learning", { method: "DELETE" });
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "Unable to reset." };
  }
  revalidatePath("/", "layout");
  return { success: "Preferences cleared." };
}
