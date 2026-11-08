"use server";
import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { api, segment, ApiError } from "@/lib/api";
import { requireIdentity } from "@/server/identity";
import { hasTeachingAccess } from "@/server/teaching";
import { text, optionalText } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

const USERS = "/api/v1/users";

function fail(error: unknown, fallback: string): ActionState {
  unstable_rethrow(error);
  return { error: error instanceof Error ? error.message : fallback };
}

async function run(
  path: string,
  init: RequestInit,
  success: string,
  fallback: string,
): Promise<ActionState> {
  await requireIdentity();
  try {
    await api(path, init);
  } catch (error) {
    return fail(error, fallback);
  }
  revalidatePath("/study-together/connections");
  return { success };
}

// ── Connections ─────────────────────────────────────────────────────────────
export async function requestConnection(_s: ActionState, form: FormData): Promise<ActionState> {
  const userId = text(form, "userId", 100);
  return run(
    `${USERS}/friends/request`,
    { method: "POST", body: JSON.stringify({ userId }) },
    "Request sent.",
    "Unable to send the request.",
  );
}

export async function requestByCode(_s: ActionState, form: FormData): Promise<ActionState> {
  let friendCode: string;
  try {
    friendCode = text(form, "friendCode", 12).toUpperCase();
  } catch (error) {
    return fail(error, "Enter a friend code.");
  }
  return run(
    `${USERS}/friends/request`,
    { method: "POST", body: JSON.stringify({ friendCode }) },
    "Request sent.",
    "Unable to send the request.",
  );
}

export async function respondToRequest(_s: ActionState, form: FormData): Promise<ActionState> {
  const id = segment(text(form, "friendshipId", 100));
  const decision = form.get("decision") === "accept" ? "accept" : "reject";
  return run(
    `${USERS}/friends/request/${id}/${decision}`,
    { method: "PUT" },
    decision === "accept" ? "Connected." : "Declined.",
    "Unable to answer the request.",
  );
}

export async function cancelRequest(_s: ActionState, form: FormData): Promise<ActionState> {
  return run(
    `${USERS}/friends/request/${segment(text(form, "friendshipId", 100))}`,
    { method: "DELETE" },
    "Request cancelled.",
    "Unable to cancel the request.",
  );
}

export async function removeConnection(_s: ActionState, form: FormData): Promise<ActionState> {
  return run(
    `${USERS}/friends/${segment(text(form, "userId", 100))}`,
    { method: "DELETE" },
    "Connection removed.",
    "Unable to remove the connection.",
  );
}

export async function blockUser(_s: ActionState, form: FormData): Promise<ActionState> {
  return run(
    `${USERS}/friends/block/${segment(text(form, "userId", 100))}`,
    { method: "POST" },
    "User blocked.",
    "Unable to block this user.",
  );
}

export async function unblockUser(_s: ActionState, form: FormData): Promise<ActionState> {
  return run(
    `${USERS}/friends/block/${segment(text(form, "userId", 100))}`,
    { method: "DELETE" },
    "User unblocked.",
    "Unable to unblock this user.",
  );
}

// ── Study groups ────────────────────────────────────────────────────────────
export async function createGroup(_s: ActionState, form: FormData): Promise<ActionState> {
  let body: { name: string; subject: string };
  try {
    body = { name: text(form, "name", 60), subject: optionalText(form, "subject", 60) };
  } catch (error) {
    return fail(error, "Enter a group name.");
  }
  return run(
    `${USERS}/groups`,
    { method: "POST", body: JSON.stringify(body) },
    "Group created.",
    "Unable to create the group.",
  );
}

export async function inviteToGroup(_s: ActionState, form: FormData): Promise<ActionState> {
  const groupId = segment(text(form, "groupId", 100));
  return run(
    `${USERS}/groups/${groupId}/invite`,
    { method: "POST", body: JSON.stringify({ friendId: text(form, "friendId", 100) }) },
    "Invitation sent.",
    "Unable to invite this connection.",
  );
}

export async function answerGroupInvite(_s: ActionState, form: FormData): Promise<ActionState> {
  const groupId = segment(text(form, "groupId", 100));
  const accept = form.get("decision") === "accept";
  return run(
    `${USERS}/groups/${groupId}/${accept ? "accept" : "decline"}`,
    { method: "POST" },
    accept ? "You joined the group." : "Invitation declined.",
    "Unable to answer the invitation.",
  );
}

export async function leaveOrRemove(_s: ActionState, form: FormData): Promise<ActionState> {
  return run(
    `${USERS}/groups/${segment(text(form, "groupId", 100))}/members/${segment(text(form, "userId", 100))}`,
    { method: "DELETE" },
    "Done.",
    "Unable to update the group.",
  );
}

export async function deleteGroup(_s: ActionState, form: FormData): Promise<ActionState> {
  return run(
    `${USERS}/groups/${segment(text(form, "groupId", 100))}`,
    { method: "DELETE" },
    "Group deleted.",
    "Unable to delete the group.",
  );
}

/** Creates a normal study room, attaches it to the group and opens it. */
export async function startGroupSession(_s: ActionState, form: FormData): Promise<ActionState> {
  await requireIdentity();
  if (await hasTeachingAccess()) redirect("/dashboard");
  let roomId: string;
  try {
    const groupId = segment(text(form, "groupId", 100));
    const room = await api<{ roomId: string }>("/api/v1/study/rooms", {
      method: "POST",
      body: JSON.stringify({
        maxParticipants: 6,
        moderatorMode: "guided",
        enableVoice: false,
        commandId: randomUUID(),
      }),
    });
    roomId = room.roomId;
    await api(`${USERS}/groups/${groupId}/session`, {
      method: "POST",
      body: JSON.stringify({ roomId }),
    });
  } catch (error) {
    return fail(error, "Unable to start a group session.");
  }
  redirect(`/study-together/${segment(roomId)}`);
}

/** Joins the group's current room using the code the server holds for members. */
export async function joinGroupSession(_s: ActionState, form: FormData): Promise<ActionState> {
  await requireIdentity();
  if (await hasTeachingAccess()) redirect("/dashboard");
  let roomId: string;
  try {
    const groupId = segment(text(form, "groupId", 100));
    const { session } = await api<{ session: { inviteCode: string } | null }>(
      `${USERS}/groups/${groupId}/session`,
    );
    if (!session) return { error: "This group has no active session." };
    const joined = await api<{ roomId: string }>("/api/v1/study/rooms/join", {
      method: "POST",
      body: JSON.stringify({
        inviteCode: session.inviteCode,
        hasVoiceConsent: false,
        commandId: randomUUID(),
      }),
    });
    roomId = joined.roomId;
  } catch (error) {
    return fail(
      error instanceof ApiError && error.status === 404
        ? new Error("That session has ended.")
        : error,
      "Unable to join the session.",
    );
  }
  redirect(`/study-together/${segment(roomId)}`);
}

// ── Inside a room ───────────────────────────────────────────────────────────
export interface ConnectionSummary {
  userId: string;
  name: string;
}

export async function listConnectionsForInvite(): Promise<{
  friends: ConnectionSummary[];
  error?: string;
}> {
  await requireIdentity();
  try {
    const data = await api<{ friends: ConnectionSummary[] }>(`${USERS}/friends`);
    return { friends: data.friends.map(({ userId, name }) => ({ userId, name })) };
  } catch (error) {
    return { friends: [], error: fail(error, "Unable to load connections.").error };
  }
}

export async function inviteConnectionToRoom(
  roomId: string,
  friendId: string,
): Promise<{ ok: true } | { error: string }> {
  await requireIdentity();
  try {
    await api(`${USERS}/friends/invite-to-room`, {
      method: "POST",
      body: JSON.stringify({ roomId, friendId }),
    });
    return { ok: true };
  } catch (error) {
    return { error: fail(error, "Unable to send the invitation.").error ?? "Failed." };
  }
}

export async function dismissNotification(_s: ActionState, form: FormData): Promise<ActionState> {
  return run(
    `/api/v1/notifications/${segment(text(form, "id", 100))}/read`,
    { method: "PATCH" },
    "Dismissed.",
    "Unable to dismiss.",
  );
}
