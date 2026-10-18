"use server";
import { unstable_rethrow } from "next/navigation";
import { requireIdentity } from "@/server/identity";
import { revalidatePath } from "next/cache";
import { api, segment } from "@/lib/api";
import { text, optionalText, choice, integer } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";
export async function createTask(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    await api("/api/v1/study/tasks", {
      method: "POST",
      body: JSON.stringify({
        title: text(form, "title", 200),
        description: optionalText(form, "description") || undefined,
        priority: choice(form, "priority", ["low", "medium", "high"]),
        estimatedTime: integer(form, "minutes", 1, 600),
      }),
    });
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    return { success: "Task created." };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error: error instanceof Error ? error.message : "Unable to create task.",
    };
  }
}
export async function updateTask(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    await api(`/api/v1/study/tasks/${segment(text(form, "id"))}`, {
      method: "PUT",
      body: JSON.stringify({
        status: choice(form, "status", [
          "todo",
          "in-progress",
          "completed",
          "cancelled",
        ]),
      }),
    });
    revalidatePath("/tasks");
    revalidatePath("/dashboard");
    return { success: "Task updated." };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error: error instanceof Error ? error.message : "Unable to update task.",
    };
  }
}
