"use server";
import { unstable_rethrow } from "next/navigation";
import { requireIdentity } from "@/server/identity";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { api, segment, ApiError } from "@/lib/api";
import { text, optionalText } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

function replayFields(form: FormData) {
  const commandId = optionalText(form, "commandId", 64);
  const expectedSeq = optionalText(form, "expectedSeq", 20);
  return commandId
    ? {
        commandId,
        ...(expectedSeq ? { expectedSeq: Number(expectedSeq) } : {}),
      }
    : {};
}

export async function createRoom(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  let id: string;
  try {
    const courseId = optionalText(form, "courseId", 64);
    if (courseId) await api(`/api/v1/study/courses/${segment(courseId)}`);

    try {
      // Contract 10: Dedicated Study Room API
      const data = await api<{ roomId: string }>("/api/v1/study/rooms", {
        method: "POST",
        body: JSON.stringify({
          ...(courseId ? { courseId } : {}),
          maxParticipants: 6,
          moderatorMode: "guided",
          enableVoice: false,
          ...replayFields(form),
        }),
      });
      id = data.roomId;
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) throw error;
      // Fallback to legacy team session if needed
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
    }

    revalidatePath("/study-together");
  } catch (error) {
    unstable_rethrow(error);
    return {
      error: error instanceof Error ? error.message : "Unable to create room.",
    };
  }
  return {
    success: "Room command acknowledged.",
    destination: `/study-together/${segment(id)}`,
    destinationLabel: "Open room",
  };
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

    try {
      // Contract 10: Dedicated Study Room Join
      const data = await api<{ roomId: string }>("/api/v1/study/rooms/join", {
        method: "POST",
        body: JSON.stringify({
          inviteCode,
          hasVoiceConsent: false,
          ...replayFields(form),
        }),
      });
      id = data.roomId;
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) throw error;
      // Fallback to legacy join-by-code
      const data = await api<{ session: { _id: string } }>(
        "/api/v1/study/sessions/team/join-by-code",
        { method: "POST", body: JSON.stringify({ inviteCode }) },
      );
      id = data.session._id;
    }
  } catch (error) {
    unstable_rethrow(error);
    return {
      error: error instanceof Error ? error.message : "Unable to join room.",
    };
  }
  return {
    success: "Room command acknowledged.",
    destination: `/study-together/${segment(id)}`,
    destinationLabel: "Open room",
  };
}

export async function startRoom(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    const id = segment(text(form, "id"));
    try {
      await api(`/api/v1/study/rooms/${id}/phase`, {
        method: "PUT",
        body: JSON.stringify({
          currentPhase: "peer_discussion",
          ...replayFields(form),
        }),
      });
    } catch (error) {
      if (id.startsWith("room_")) throw error;
      await api(`/api/v1/study/sessions/team/${id}/start`, { method: "PUT" });
    }
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
    const id = segment(text(form, "id"));
    try {
      await api(`/api/v1/study/rooms/${id}/leave`, {
        method: "POST",
        body: JSON.stringify(replayFields(form)),
      });
    } catch (error) {
      if (id.startsWith("room_")) throw error;
      await api(`/api/v1/study/sessions/team/${id}/leave`, { method: "POST" });
    }
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
    try {
      await api(`/api/v1/study/rooms/${id}/phase`, {
        method: "PUT",
        body: JSON.stringify({
          currentPhase: "debrief",
          ...replayFields(form),
        }),
      });
    } catch (error) {
      if (id.startsWith("room_")) throw error;
      await api(`/api/v1/study/sessions/team/${id}/end`, { method: "PUT" });
    }
    revalidatePath(`/study-together/${id}`);
    return { success: "Session moved to debrief." };
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "Unable to end." };
  }
}

export async function setRoomPhase(
  _state: ActionState,
  form: FormData,
): Promise<ActionState & { retryable?: boolean }> {
  await requireIdentity();
  try {
    const id = segment(text(form, "id"));
    const currentPhase = text(form, "phase", 32);
    const activeActivityId = optionalText(form, "activeActivityId", 64);
    await api(`/api/v1/study/rooms/${id}/phase`, {
      method: "PUT",
      body: JSON.stringify({
        currentPhase,
        ...replayFields(form),
        ...(activeActivityId ? { activeActivityId } : {}),
      }),
    });
    revalidatePath(`/study-together/${id}`);
    return { success: `Phase updated to ${currentPhase}.` };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error: error instanceof Error ? error.message : "Unable to update phase.",
      retryable: error instanceof ApiError && error.status === 503,
    };
  }
}

export async function submitActivityFlag(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    const id = segment(text(form, "id"));
    await api(`/api/v1/study/rooms/${id}/submit-flag`, {
      method: "POST",
    });
    revalidatePath(`/study-together/${id}`);
    return { success: "Answer submitted to room tally." };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error: error instanceof Error ? error.message : "Unable to submit flag.",
    };
  }
}

export async function askRoom(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    const id = segment(text(form, "id"));
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

export async function askFacilitator(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    const id = segment(text(form, "id"));
    const prompt = text(form, "prompt", 1000);
    await api(`/api/v1/study/rooms/${id}/facilitator/action`, {
      method: "POST",
      body: JSON.stringify({
        actionType: "ask_facilitator",
        promptText: prompt,
      }),
    });
    revalidatePath(`/study-together/${id}`);
    return { success: "Question presented to AI Facilitator." };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error ? error.message : "Unable to reach facilitator.",
    };
  }
}

export async function requestFacilitatorHint(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    const id = segment(text(form, "id"));
    const hintLevel = parseInt(optionalText(form, "hintLevel", 2) || "1", 10);
    await api(`/api/v1/study/rooms/${id}/facilitator/action`, {
      method: "POST",
      body: JSON.stringify({ actionType: "request_hint", hintLevel }),
    });
    revalidatePath(`/study-together/${id}`);
    return { success: `Hint Level ${hintLevel} requested.` };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error: error instanceof Error ? error.message : "Unable to request hint.",
    };
  }
}

export async function declineFacilitatorPrompt(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireIdentity();
  try {
    const id = segment(text(form, "id"));
    const interventionId = text(form, "interventionId", 64);
    await api(`/api/v1/study/rooms/${id}/facilitator/action`, {
      method: "POST",
      body: JSON.stringify({ actionType: "decline_prompt", interventionId }),
    });
    revalidatePath(`/study-together/${id}`);
    return { success: "Prompt politely declined." };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error ? error.message : "Unable to decline prompt.",
    };
  }
}

// Public peer text uses the authenticated API gateway; no AI or credential props.
export async function sendPeerMessage(
  roomId: string,
  submissionId: string,
  message: string,
) {
  try {
    const data = await api<{
      message: import("./peer-text-state").PeerMessage;
    }>(`/api/v1/session-chat/${segment(roomId)}/messages`, {
      method: "POST",
      body: JSON.stringify({ submissionId, text: message }),
    });
    return { data };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error: error instanceof Error ? error.message : "Message unavailable.",
      status: error instanceof ApiError ? error.status : 503,
    };
  }
}
export async function getPeerHistory(roomId: string, afterSeq: number) {
  try {
    const data = await api<{
      items: import("./peer-text-state").PeerMessage[];
      lastSeq: number;
      nextAfterSeq: number;
      hasMore: boolean;
    }>(
      `/api/v1/session-chat/${segment(roomId)}/history?kind=peer&afterSeq=${afterSeq}&limit=100`,
    );
    return { data };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error: error instanceof Error ? error.message : "History unavailable.",
      status: error instanceof ApiError ? error.status : 503,
    };
  }
}

export async function getActivityDefinition(activityId: string) {
  await requireIdentity();
  try {
    const data = await api<
      import("@/lib/activity-contracts").ActivityDefinition
    >(`/api/v1/study/activities/${segment(activityId)}`);
    return { data };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error: error instanceof Error ? error.message : "Activity unavailable.",
    };
  }
}

export async function submitRoomAttempt(
  activityId: string,
  payload: {
    attemptId: string;
    roomId: string;
    answers: Record<string, unknown>;
    timeSpentSeconds: number;
    activity: {
      courseId: string;
      revisionId: string;
      contentHash: string;
      activityId: string;
      activityRevision: string;
      activityType: "InteractiveQuiz" | "GuidedProblem";
    };
  },
) {
  await requireIdentity();
  try {
    const data = await api<
      import("@/features/learning/activity-renderer").AssessmentResultView
    >(`/api/v1/study/activities/${segment(activityId)}/attempts`, {
      method: "POST",
      body: JSON.stringify({
        schemaVersion: "1.0.0",
        ...payload,
      }),
    });
    return { data };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error ? error.message : "Failed to submit attempt.",
    };
  }
}
