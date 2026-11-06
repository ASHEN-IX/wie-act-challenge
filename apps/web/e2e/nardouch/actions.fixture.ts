import audioFixture from "./audio.fixture.json";
/** Test-only transport fixture. Production never imports this module. */
import type {
  NardouchConversation,
  NardouchInput,
} from "@ednova/shared/ednova/nardouch";
let conversation: NardouchConversation | null = null;
export async function sendNardouchTurn(input: NardouchInput) {
  if (input.message === "provider down")
    return { error: "Provider unavailable; retry your question.", status: 503 };
  const answer = {
    displayText: "El récursivité test7a9 base case. factorial(0) = 1.",
    speechText: "El récursivité test7a9 base case. factorial(0) = 1.",
    followups: ["3lech base case?"],
    citations: [],
    evidenceStatus: "missing_context" as const,
    mode: input.mode,
    language: input.language,
    usage: {
      traceId: crypto.randomUUID(),
      model: "test-only",
      tier: "capable" as const,
      executionMode: "REAL_APPROVED" as const,
      latencyMs: 1,
      tokens: null,
      fallbackUsed: false,
    },
  };
  conversation = {
    id: "b".repeat(24),
    courseId: input.courseId,
    revisionId: input.revisionId,
    version: (conversation?.version || 0) + 1,
    mode: input.mode,
    language: input.language,
    messages: [
      ...(conversation?.messages || []),
      { id: crypto.randomUUID(), role: "user", content: input.message },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: answer.displayText,
        answer,
      },
    ],
  };
  return { data: { conversation } };
}
export async function loadNardouchConversation() {
  return conversation
    ? { data: { conversation } }
    : { error: "Not found", status: 404 };
}
export async function sendNardouchFeedback() {
  return { data: { saved: true } };
}
export async function transcribeNardouchAudio() {
  return { data: { transcript: "mafhemtech el stuck" } };
}
export async function speakNardouchAnswer() {
  const state = globalThis as typeof globalThis & {
    __nardouchSpeechCalls?: number;
  };
  state.__nardouchSpeechCalls = (state.__nardouchSpeechCalls || 0) + 1;
  if (new URLSearchParams(location.search).get("audio") === "success")
    return { data: audioFixture };
  return { error: "TTS provider down", status: 503 };
}
