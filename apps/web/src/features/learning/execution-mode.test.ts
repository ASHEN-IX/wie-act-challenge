import { describe, expect, it } from "vitest";
import { describeExecutionMode } from "./execution-mode";

describe("describeExecutionMode", () => {
  it("presents a real model answer as model output", () => {
    const notice = describeExecutionMode("REAL_APPROVED");
    expect(notice.isModelOutput).toBe(true);
    expect(notice.label).toBe("Model answer");
  });

  it("never presents rule-based text as model output", () => {
    const notice = describeExecutionMode("DETERMINISTIC_FALLBACK");
    expect(notice.isModelOutput).toBe(false);
    expect(notice.tone).toBe("caution");
    expect(notice.description).toMatch(/rather than a model/);
  });

  it("treats an unreported mode as unknown instead of assumed success", () => {
    expect(describeExecutionMode(undefined)).toMatchObject({
      mode: null,
      isModelOutput: false,
    });
    expect(describeExecutionMode("SOMETHING_NEW").mode).toBeNull();
  });
});
