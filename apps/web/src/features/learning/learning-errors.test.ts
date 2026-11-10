import { describe, expect, it } from "vitest";
import {
  isTransientLearningError,
  learningErrorMessage,
} from "./learning-errors";

describe("learning errors", () => {
  it("explains the tutor outage in plain language and keeps the learner's work", () => {
    const error = new Error("AI_SERVICE_UNAVAILABLE");
    expect(learningErrorMessage(error)).not.toContain("AI_SERVICE_UNAVAILABLE");
    expect(learningErrorMessage(error)).toMatch(/progress are kept/i);
    expect(isTransientLearningError(error)).toBe(true);
  });

  it("never shows framework internals to a learner", () => {
    const error = new Error("Minified React error #441; visit https://react.dev/errors/441");
    expect(learningErrorMessage(error)).not.toMatch(/react/i);
    expect(learningErrorMessage(error)).toMatch(/try again/i);
  });

  it("treats rate limits as transient", () => {
    const error = new Error(
      "Too many requests. Wait a minute, then retry the same submission.",
    );
    expect(isTransientLearningError(error)).toBe(true);
    expect(learningErrorMessage(error)).toMatch(/wait a minute/i);
  });

  it("does not treat access or revision errors as transient", () => {
    for (const code of ["FORBIDDEN", "NOT_FOUND", "STALE_REVISION"]) {
      const error = new Error(code);
      expect(isTransientLearningError(error)).toBe(false);
      expect(learningErrorMessage(error)).toBe(code);
    }
  });

  it("falls back for non-Error values", () => {
    expect(learningErrorMessage("boom")).toMatch(/unavailable/i);
    expect(isTransientLearningError("boom")).toBe(false);
  });
});
