"use server";
import { unstable_rethrow } from "next/navigation";
import { requireIdentity } from "@/server/identity";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { api, segment } from "@/lib/api";
import { text, optionalText } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";
export async function createRoom(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  let id: string;
  try {
    const courseId = optionalText(form, "courseId", 64);
    if (courseId) await api(`/api/v1/study/courses/${segment(courseId)}`);
    const data = await api<{ session: { _id: string } }>(
      "/api/v1/study/sessions/team",
      {
        method: "POST",
        body: JSON.stringify({
          ...(courseId ? { courseId } : {}),
          mode: "focus",
          maxParticipants: 4,
        }),
      },
    );
    id = data.session._id;
    revalidatePath("/study-together");
  } catch (error) {
    unstable_rethrow(error);
    return {
      error: error instanceof Error ? error.message : "Unable to create room.",
    };
  }
  redirect(`/study-together/${segment(id)}`);
}
export async function joinRoom(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  let id: string;
  try {
    const inviteCode = text(form, "code", 12).toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(inviteCode))
      return { error: "Enter the six-character invite code." };
    const data = await api<{ session: { _id: string } }>(
      "/api/v1/study/sessions/team/join-by-code",
      { method: "POST", body: JSON.stringify({ inviteCode }) },
    );
    id = data.session._id;
  } catch (error) {
    unstable_rethrow(error);
    return {
      error: error instanceof Error ? error.message : "Unable to join room.",
    };
  }
  redirect(`/study-together/${segment(id)}`);
}
export async function startRoom(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    const id = segment(text(form, "id"));
    await api(`/api/v1/study/sessions/team/${id}/start`, { method: "PUT" });
    revalidatePath(`/study-together/${id}`);
    return { success: "Session started." };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error: error instanceof Error ? error.message : "Unable to start.",
    };
  }
}
export async function leaveRoom(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    await api(
      `/api/v1/study/sessions/team/${segment(text(form, "id"))}/leave`,
      { method: "POST" },
    );
  } catch (error) {
    unstable_rethrow(error);
    return {
      error: error instanceof Error ? error.message : "Unable to leave.",
    };
  }
  redirect("/study-together");
}
export async function endRoom(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    const id = segment(text(form, "id"));
    await api(`/api/v1/study/sessions/team/${id}/end`, { method: "PUT" });
    revalidatePath(`/study-together/${id}`);
    return { success: "Session ended." };
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "Unable to end." };
  }
}
export async function askRoom(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    const id = segment(text(form, "id"));
    await api(`/api/v1/study/sessions/team/${id}/participants`);
    await api(`/api/v1/session-chat/${id}/query`, {
      method: "POST",
      body: JSON.stringify({ query: text(form, "query", 1000) }),
    });
    revalidatePath(`/study-together/${id}`);
    return { success: "Question submitted." };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error ? error.message : "Unable to submit question.",
    };
  }
}
