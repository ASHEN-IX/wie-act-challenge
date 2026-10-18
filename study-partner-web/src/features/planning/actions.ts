"use server";
import { unstable_rethrow } from "next/navigation";
import { requireIdentity } from "@/server/identity";
import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import { text, integer, optionalText } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";
export async function generatePlan(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    const courseId = optionalText(form, "courseId", 64);
    const result = await api<{ jobId: string; correlationId: string }>(
      "/api/v1/study/plans/create",
      {
        method: "POST",
        body: JSON.stringify({
          goal: text(form, "goal", 500),
          availableTimeMinutes: integer(form, "minutes", 30, 1440),
          ...(courseId ? { courseId } : {}),
        }),
      },
    );
    return { jobId: result.jobId, correlationId: result.correlationId };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error ? error.message : "Unable to generate a plan.",
    };
  }
}
export async function finalizePlan(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    await api("/api/v1/study/plans/create-status", {
      method: "POST",
      body: JSON.stringify({ correlationId: text(form, "correlationId", 150) }),
    });
    revalidatePath("/planner");
    revalidatePath("/tasks");
    return { success: "Plan saved. Your tasks are ready." };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error: error instanceof Error ? error.message : "Unable to save plan.",
    };
  }
}
