import { describe, it, expect } from "vitest";
import {
  AI_WAIT_STAGE_MS,
  AI_WAIT_STAGES,
  describeAiMode,
  waitStageIndex,
} from "./ai-status";

describe("describeAiMode", () => {
  it.each([
    ["REAL_APPROVED", "ok", "Answered by the AI model"],
    ["MOCK_TEST", "notice", "Test answer"],
    ["DETERMINISTIC_FALLBACK", "notice", "Built-in guidance"],
    ["UNAVAILABLE", "warning", "AI unavailable"],
  ])("maps %s to a %s note titled %s", (mode, tone, title) => {
    const note = describeAiMode(mode);
    expect(note.tone).toBe(tone);
    expect(note.title).toBe(title);
    expect(note.detail.length).toBeGreaterThan(10);
  });

  it("treats a missing or unknown mode as unavailable, never as a real answer", () => {
    expect(describeAiMode(undefined).title).toBe("AI unavailable");
    expect(describeAiMode(null).title).toBe("AI unavailable");
    expect(describeAiMode("SOME_NEW_MODE").title).toBe("AI unavailable");
  });

  it("does not expose internal mode names to the learner", () => {
    for (const mode of ["REAL_APPROVED", "MOCK_TEST", "DETERMINISTIC_FALLBACK", "UNAVAILABLE"]) {
      const note = describeAiMode(mode);
      expect(`${note.title} ${note.detail}`).not.toMatch(/[A-Z]{4,}_[A-Z_]+/);
    }
  });
});

describe("waitStageIndex", () => {
  it("advances one stage every stage interval and stops at the last stage", () => {
    expect(waitStageIndex(0)).toBe(0);
    expect(waitStageIndex(AI_WAIT_STAGE_MS - 1)).toBe(0);
    expect(waitStageIndex(AI_WAIT_STAGE_MS)).toBe(1);
    expect(waitStageIndex(2 * AI_WAIT_STAGE_MS)).toBe(2);
    expect(waitStageIndex(60 * AI_WAIT_STAGE_MS)).toBe(AI_WAIT_STAGES.length - 1);
  });

  it("never goes below the first stage for negative elapsed time", () => {
    expect(waitStageIndex(-500)).toBe(0);
  });

  it("ends on a stage that says the wait may be long", () => {
    expect(AI_WAIT_STAGES[AI_WAIT_STAGES.length - 1]).toMatch(/Still working/);
  });
});
