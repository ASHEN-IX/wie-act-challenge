import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    api: vi.fn(),
    ApiError,
    segment: (s: string) => encodeURIComponent(s),
  };
});
import { api, ApiError } from "@/lib/api";
import * as actions from "./formula-actions";
beforeEach(() => vi.mocked(api).mockReset());
describe("formula Studio actions", () => {
  it("sends exact server review and draft versions and preserves corrections", async () => {
    vi.mocked(api).mockResolvedValue({ proposal: { state: "corrected" } });
    const result = await actions.reviewFormulaProposal(
      "course",
      "rev",
      "proposal",
      "correct",
      3,
      7,
      "x^2",
    );
    expect(result.ok).toBe(true);
    expect(api).toHaveBeenCalledWith(
      "/api/v1/study/courses/course/drafts/rev/formula-proposals/proposal/review",
      {
        method: "POST",
        body: JSON.stringify({
          action: "correct",
          reviewVersion: 3,
          draftVersion: 7,
          latex: "x^2",
        }),
      },
    );
  });
  it("preserves conflict status and actual operational denial reason", async () => {
    vi.mocked(api)
      .mockRejectedValueOnce(new ApiError(409, "REVIEW_CONFLICT"))
      .mockRejectedValueOnce(new ApiError(503, "FREE_TIER_UNVERIFIED"));
    expect(
      await actions.reviewFormulaProposal("c", "r", "p", "accept", 0, 0),
    ).toEqual({ ok: false, status: 409, error: "REVIEW_CONFLICT" });
    expect(
      await actions.requestFormulaRecognition("c", "r", "d", "region", 0),
    ).toEqual({ ok: false, status: 503, error: "FREE_TIER_UNVERIFIED" });
  });
  it("uses authenticated existing endpoints for history, proposal retrieval and cancellation", async () => {
    vi.mocked(api).mockResolvedValue({});
    await actions.formulaReviewHistory("c", "r", "p");
    await actions.readFormulaProposal("c", "r", "p");
    await actions.cancelFormulaJob("c", "r", "j");
    expect(vi.mocked(api).mock.calls.map((c) => c[0])).toEqual([
      "/api/v1/study/courses/c/drafts/r/formula-proposals/p/history",
      "/api/v1/study/courses/c/drafts/r/formula-proposals/p",
      "/api/v1/study/courses/c/drafts/r/recognition-jobs/j/cancel",
    ]);
  });
});
