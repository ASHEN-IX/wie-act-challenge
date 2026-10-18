"use server";
import { unstable_rethrow } from "next/navigation";
import { requireIdentity } from "@/server/identity";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { api, segment } from "@/lib/api";
import { text } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";
export async function startSession(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  let id: string;
  try {
    const data = await api<{ session: { _id: string } }>(
      "/api/v1/study/sessions/setup",
      {
        method: "POST",
        body: JSON.stringify({
          courseId: text(form, "courseId", 64),
          mode: "focus",
        }),
      },
    );
    id = data.session._id;
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error ? error.message : "Unable to start session.",
    };
  }
  redirect(`/sessions/${segment(id)}`);
}
export async function completeSessionTask(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    const id = segment(text(form, "id"));
    await api(`/api/v1/study/sessions/${id}/task/complete`, { method: "POST" });
    revalidatePath(`/sessions/${id}`);
    return { success: "Progress saved." };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error ? error.message : "Unable to complete task.",
    };
  }
}
export async function finishSession(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    const id = segment(text(form, "id"));
    await api(`/api/v1/study/sessions/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        status: "completed",
        endTime: new Date().toISOString(),
      }),
    });
    revalidatePath(`/sessions/${id}`);
    return { success: "Session finished." };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error ? error.message : "Unable to finish session.",
    };
  }
}
