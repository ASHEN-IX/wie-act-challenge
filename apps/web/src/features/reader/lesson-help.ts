/**
 * Turns a learner's "help me with this part" action into a question for the
 * existing source-grounded tutor. The tutor already retrieves from the course
 * sources, so each question names the exact concept the learner is looking at.
 */
export type HelpMode = "simpler" | "example" | "steps" | "deeper" | "hint" | "free";

export const HELP_ACTIONS: ReadonlyArray<{ mode: Exclude<HelpMode, "hint" | "free">; label: string }> = [
  { mode: "simpler", label: "Explain simply" },
  { mode: "example", label: "Another example" },
  { mode: "steps", label: "Step by step" },
  { mode: "deeper", label: "Go deeper" },
];

const MAX_FOCUS = 400;
const LANGUAGE = "Reply in the language of the course material.";

/** What the learner is looking at: the concept's own words when there are any. */
function focusOf(title: string, focus?: string) {
  const text = focus?.replace(/\s+/g, " ").trim();
  return text ? `"${title}": ${text.slice(0, MAX_FOCUS)}` : `"${title}"`;
}

export function buildHelpQuestion(
  mode: HelpMode,
  input: { stepTitle: string; focusTitle?: string; focusText?: string; question?: string },
): string {
  const about = focusOf(input.focusTitle ?? input.stepTitle, input.focusText);
  switch (mode) {
    case "simpler":
      return `${about}. Explain this in simpler terms: the intuition first, then the precise idea. ${LANGUAGE}`;
    case "example":
      return `${about}. Give one new worked example of this, different from the ones in the lesson. ${LANGUAGE}`;
    case "steps":
      return `${about}. Walk me through this step by step, saying why each step is allowed. ${LANGUAGE}`;
    case "deeper":
      return `${about}. Go deeper: why it is true, when it fails, and how it connects to other ideas in this course. ${LANGUAGE}`;
    case "hint":
      return `${about}. I am working on this. Do not give the full solution: give one hint for the next step, then ask me one question that checks my reasoning. ${LANGUAGE}`;
    case "free":
      return `In the context of "${input.stepTitle}": ${(input.question ?? "").trim()}`.slice(0, 3900);
  }
}

/** What the learner sees as their own message in the thread. */
export function helpLabel(mode: HelpMode, title: string, question?: string): string {
  switch (mode) {
    case "simpler": return `Explain “${title}” simply`;
    case "example": return `Give me another example of “${title}”`;
    case "steps": return `Walk me through “${title}” step by step`;
    case "deeper": return `Go deeper on “${title}”`;
    case "hint": return `Give me a hint on “${title}”, not the answer`;
    case "free": return (question ?? "").trim();
  }
}
