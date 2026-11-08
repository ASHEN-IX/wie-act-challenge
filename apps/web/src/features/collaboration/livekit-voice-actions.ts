"use server";

import { requireIdentity } from "@/server/identity";
import { api, segment } from "@/lib/api";
import { unstable_rethrow } from "next/navigation";

export interface LiveKitTokenResponse {
  token: string;
  livekitUrl: string;
  roomName: string;
  participantIdentity: string;
  participantName: string;
  expiresInSeconds: number;
  canPublishAudio: boolean;
  canSubscribeAudio: boolean;
}

export interface ModeratorDispatchResponse {
  dispatched: boolean;
  roomId: string;
  agentIdentity: string;
  dispatchId: string;
  status: string;
}

export interface VoiceConsentResponse {
  roomId: string;
  hasVoiceConsent: boolean;
}

/**
 * Fetch a short-lived cryptographically signed LiveKit JWT for the active room session (Contract 11).
 * Enforces room membership, active course enrollment, and explicit voice consent on the server.
 */
export async function getLiveKitToken(roomId: string): Promise<{
  data?: LiveKitTokenResponse;
  error?: string;
}> {
  await requireIdentity();
  try {
    const data = await api<LiveKitTokenResponse>(
      `/api/v1/study/rooms/${segment(roomId)}/livekit-token`,
      {
        method: "POST",
      },
    );
    return { data };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to retrieve LiveKit media token.",
    };
  }
}

/**
 * Update the user's explicit voice consent status in the study room.
 * Revoking consent (false) immediately suppresses server-side audio publishing grants.
 */
export async function updateVoiceConsent(
  roomId: string,
  hasVoiceConsent: boolean,
): Promise<{
  data?: VoiceConsentResponse;
  error?: string;
}> {
  await requireIdentity();
  try {
    const data = await api<VoiceConsentResponse>(
      `/api/v1/study/rooms/${segment(roomId)}/voice-consent`,
      {
        method: "PUT",
        body: JSON.stringify({ hasVoiceConsent }),
      },
    );
    return { data };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to update voice consent.",
    };
  }
}

/**
 * Authorize and dispatch the AI Voice Moderator agent to the LiveKit study room (Contract 12).
 */
export async function dispatchAiModerator(roomId: string): Promise<{
  data?: ModeratorDispatchResponse;
  error?: string;
}> {
  await requireIdentity();
  try {
    const data = await api<ModeratorDispatchResponse>(
      `/api/v1/study/rooms/${segment(roomId)}/ai-moderator/dispatch`,
      {
        method: "POST",
      },
    );
    return { data };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to dispatch AI voice moderator.",
    };
  }
}

