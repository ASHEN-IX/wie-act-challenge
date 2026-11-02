import { describe, expect, it } from "vitest";
import { courseStage, courseStageLabel, isCourseReady } from "./lifecycle";

describe("course publication lifecycle", () => {
  it("distinguishes a processed draft from a published course", () => {
    expect(courseStage({ status: "completed" })).toBe("review");
    expect(courseStageLabel("review")).toBe("Ready for review");
    expect(isCourseReady({ status: "completed" })).toBe(false);
    expect(
      isCourseReady({
        status: "completed",
        activeRevisionId: "rev_verified",
      }),
    ).toBe(true);
  });

  it("keeps processing and failure visible", () => {
    expect(courseStage({ status: "processing" })).toBe("processing");
    expect(courseStage({ status: "failed" })).toBe("failed");
  });
});
