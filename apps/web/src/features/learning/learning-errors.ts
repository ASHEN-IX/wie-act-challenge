/**
 * Plain-language learning errors. Server Actions surface the API's error code as
 * the message, and the learning workspace used to print it verbatim.
 */

const FRIENDLY: Record<string, string> = {
  AI_SERVICE_UNAVAILABLE:
    "The AI tutor could not answer right now. Your activity and progress are kept; try again in a moment.",
  SOURCE_INTEGRITY_UNAVAILABLE:
    "The course sources could not be verified right now, so answers are paused. Try again in a moment.",
  "The service is unavailable. Please try again.":
    "EdNova could not reach the learning service. Your work is kept; try again in a moment.",
};

/**
 * Failures that say nothing about what the learner is allowed to see. Anything
 * else (forbidden, not found, stale revision) means what is on screen may no
 * longer be valid, so the workspace clears it.
 */
const TRANSIENT = new Set([
  "AI_SERVICE_UNAVAILABLE",
  "SOURCE_INTEGRITY_UNAVAILABLE",
  "The service is unavailable. Please try again.",
]);

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

export function learningErrorMessage(error: unknown): string {
  const message = messageOf(error);
  if (message.startsWith("Too many requests"))
    return "You are going a little fast. Wait a minute, then try the same thing again.";
  return FRIENDLY[message] ?? (message || "Learning is unavailable right now.");
}

export function isTransientLearningError(error: unknown): boolean {
  const message = messageOf(error);
  return TRANSIENT.has(message) || message.startsWith("Too many requests");
}
