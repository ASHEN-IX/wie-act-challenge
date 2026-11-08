import { describe, it, expect } from "vitest";
import { buildHelpQuestion, helpLabel } from "./lesson-help";

const base = { stepTitle: "Modes de convergence", focusTitle: "Définition 8.1", focusText: "On dit que la suite converge simplement." };

describe("buildHelpQuestion", () => {
  it("leads with the concept so retrieval stays on it", () => {
    for (const mode of ["simpler", "example", "steps", "deeper", "hint"] as const)
      expect(buildHelpQuestion(mode, base).startsWith('"Définition 8.1": On dit que la suite')).toBe(true);
  });
  it("a hint never asks for the solution", () => {
    expect(buildHelpQuestion("hint", base)).toMatch(/Do not give the full solution/);
  });
  it("keeps free questions in the step's context and within the API limit", () => {
    const q = buildHelpQuestion("free", { stepTitle: "Step", question: "x".repeat(9000) });
    expect(q.startsWith('In the context of "Step": ')).toBe(true);
    expect(q.length).toBeLessThanOrEqual(3900);
  });
  it("bounds the quoted concept text", () => {
    expect(buildHelpQuestion("simpler", { ...base, focusText: "y".repeat(5000) }).length).toBeLessThan(700);
  });
  it("labels the learner's own message without the instruction boilerplate", () => {
    expect(helpLabel("hint", "Exercice 1")).toBe("Give me a hint on “Exercice 1”, not the answer");
  });
});
