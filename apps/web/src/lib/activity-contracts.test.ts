import { describe, expect, it, vi, afterEach } from "vitest";
import fixtures from "../../../../docs/contracts/ednova-v1-fixtures.json";
import {
  decodeActivityDefinition,
  decodePrivateAssessmentResult,
  decodeRoomActivityState,
} from "./activity-contracts";
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ cookie: "synthetic-session" }),
}));
vi.mock("@/server/identity", () => ({
  requireIdentity: async () => ({ userId: "learner_synthetic" }),
}));
import { api, ApiError } from "./api";
afterEach(() => vi.unstubAllGlobals());
const fixture = (name: string) =>
  fixtures.fixtures.find((f) => f.name === name)!.payload;
describe("canonical public API decoding", () => {
  it("consumes both P0 activity types and pinned room state", () => {
    expect(
      decodeActivityDefinition(fixture("interactive quiz")).activityType,
    ).toBe("InteractiveQuiz");
    expect(
      decodeActivityDefinition(fixture("guided problem")).activityType,
    ).toBe("GuidedProblem");
    expect(decodeRoomActivityState(fixture("pinned room state")).seq).toBe(3);
    expect(decodeRoomActivityState(fixture("source-free room state")).pin).toBeNull();
  });
  it("decodes private guidance only for its authenticated recipient", () => {
    const result = decodePrivateAssessmentResult(
      fixture("graded result with guidance"),
      "learner_synthetic",
    );
    expect(result.status).toBe("graded");
    if (result.status !== "graded") throw new Error("expected graded result");
    expect(result.socraticHint).toContain("repeating groups");
    expect(() =>
      decodePrivateAssessmentResult(
        fixture("graded result with guidance"),
        "other_learner",
      ),
    ).toThrow();
    expect(() =>
      decodeRoomActivityState(fixture("room activity without pin")),
    ).toThrow();
  });
  it("rejects private/executable material rather than stripping it", () => {
    for (const name of [
      "answer key leak",
      "rubric leak",
      "executable field",
      "unsupported renderer",
    ])
      expect(() => decodeActivityDefinition(fixture(name))).toThrow();
    expect(() =>
      decodeRoomActivityState(fixture("private evidence in public event")),
    ).toThrow();
  });
  it("validates actual API JSON before returning it and retains private fetch options", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(fixture("interactive quiz")), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    const activity = await api(
      "/api/v1/study/contract-fixture",
      {},
      decodeActivityDefinition,
    );
    expect(activity.activityType).toBe("InteractiveQuiz");
    const options = fetcher.mock.calls[0][1];
    expect(options.cache).toBe("no-store");
    expect(options.headers.get("cookie")).toBe("synthetic-session");
  });
  it("turns a private-field leak into a sanitized failure at the API decoder", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(fixture("answer key leak")), {
            status: 200,
          }),
        ),
    );
    const result = api(
      "/api/v1/study/contract-fixture",
      {},
      decodeActivityDefinition,
    );
    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({
      status: 502,
      message: "The service returned an unsupported response.",
    });
  });
});
