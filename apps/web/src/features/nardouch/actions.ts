"use server";
import { unstable_rethrow } from "next/navigation";
import type { ActionResult } from "./action-result";
import { ApiError, api, segment } from "@/lib/api";
import type {
  NardouchConversation,
  NardouchInput,
} from "@ednova/shared/ednova/nardouch";
async function execute<T>(
  operation: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return { data: await operation() };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error:
        error instanceof ApiError
          ? error.message
          : "Nardouch is unavailable. Please retry.",
      status: error instanceof ApiError ? error.status : 503,
    };
  }
}
export async function sendNardouchTurn(input: NardouchInput) {
  return execute(() =>
    api<{ conversation: NardouchConversation }>("/api/v1/study/nardouch/turn", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}
export async function loadNardouchConversation(id: string) {
  return execute(() =>
    api<{ conversation: NardouchConversation }>(
      `/api/v1/study/nardouch/conversations/${segment(id)}`,
    ),
  );
}
export async function sendNardouchFeedback(
  id: string,
  messageId: string,
  helpful: boolean,
) {
  return execute(() =>
    api(`/api/v1/study/nardouch/conversations/${segment(id)}/feedback`, {
      method: "POST",
      body: JSON.stringify({ messageId, helpful }),
    }),
  );
}
export async function transcribeNardouchAudio(input: {
  courseId: string;
  revisionId: string;
  audioBase64: string;
  locale: "ar-TN" | "fr-FR" | "en-US";
  consent: true;
}) {
  return execute(() =>
    api<{ transcript: string }>("/api/v1/study/nardouch/transcribe", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}
export async function speakNardouchAnswer(id: string, messageId: string) {
  return execute(() =>
    api<{ audioBase64: string; mimeType: string }>(
      `/api/v1/study/nardouch/conversations/${segment(id)}/speech`,
      { method: "POST", body: JSON.stringify({ messageId }) },
    ),
  );
}
