import { describe, expect, it, vi } from "vitest";
import {
  applyProposalToFlagged,
  autoReviewAndPublish,
  type AutoPublishDeps,
} from "./auto-publish";
import type { DraftReviewResult } from "./studio-actions";
import type { DraftTopic } from "./types";

const topics: DraftTopic[] = [
  {
    id: "t1",
    title: "Chapter",
    subtopics: [
      {
        id: "s1",
        title: "The sum of the series is then",
        learning_objectives: [],
      },
      {
        id: "s2",
        title: "Good title",
        learning_objectives: [
          { id: "o", statement: "Explain X well", bloomLevel: "understand" },
        ],
      },
    ],
  },
];
const proposal = {
  chapters: [{ id: "t1", title: "Renamed chapter" }],
  lessons: [
    {
      id: "s1",
      title: "Series sums",
      objectives: [
        {
          statement: "Compute the sum of a geometric series",
          bloomLevel: "apply",
        },
      ],
    },
    {
      id: "s2",
      title: "Rewritten good title",
      objectives: [
        { statement: "Something else entirely here", bloomLevel: "understand" },
      ],
    },
  ],
  notes: [],
};
const review = (over: Partial<DraftReviewResult> = {}): DraftReviewResult => ({
  revisionTag: "r1",
  verdict: "needs_attention",
  findings: [
    {
      code: "TITLE_CUT_OFF",
      severity: "warning",
      message: "x",
      subtopicId: "s1",
      topicId: "t1",
    },
  ],
  counts: { chapters: 1, lessons: 2, objectives: 1 },
  ai: { status: "proposed", proposal },
  ...over,
});

function deps(over: Partial<AutoPublishDeps> = {}): AutoPublishDeps {
  return {
    topics,
    needsSave: false,
    save: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue({ revisionTag: "r1", topics }),
    review: vi
      .fn()
      .mockResolvedValueOnce(review())
      .mockResolvedValue(
        review({ findings: [], verdict: "ready", ai: { status: "skipped" } }),
      ),
    approve: vi.fn().mockResolvedValue({ ok: true }),
    prepare: vi.fn().mockResolvedValue({}),
    publish: vi.fn().mockResolvedValue({ revisionTag: "r1" }),
    ...over,
  };
}

describe("applyProposalToFlagged", () => {
  it("rewrites only the lessons the checks flagged and leaves chapters alone", () => {
    const out = applyProposalToFlagged(topics, review(), proposal);
    expect(out.changed).toBe(1);
    expect(out.topics[0].title).toBe("Chapter");
    expect(out.topics[0].subtopics![0].title).toBe("Series sums");
    expect(out.topics[0].subtopics![1].title).toBe("Good title");
  });
});

describe("autoReviewAndPublish", () => {
  it("fixes flagged lessons, then approves, prepares and publishes in order", async () => {
    const d = deps();
    const result = await autoReviewAndPublish(d);
    expect(result).toEqual({
      status: "published",
      revisionTag: "r1",
      fixed: 1,
      remaining: 0,
      aiStatus: "proposed",
    });
    const order = [d.approve, d.prepare, d.publish].map(
      (f) => (f as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect((d.save as ReturnType<typeof vi.fn>).mock.calls.at(-1)![1]).toBe(
      true,
    );
  });

  it("never confirms low-confidence source regions: it fixes what it can and holds", async () => {
    const d = deps({
      review: vi.fn().mockResolvedValue(
        review({
          findings: [
            {
              code: "SOURCE_REVIEW_PENDING",
              severity: "blocker",
              message: "source",
            },
          ],
          verdict: "blocked",
          ai: { status: "skipped" },
        }),
      ),
    });
    const result = await autoReviewAndPublish(d);
    expect(result.status).toBe("held");
    expect(d.approve).not.toHaveBeenCalled();
    expect(d.publish).not.toHaveBeenCalled();
  });

  it("holds on any other blocker without saving as reviewed", async () => {
    const d = deps({
      review: vi.fn().mockResolvedValue(
        review({
          findings: [
            { code: "NO_CONTENT", severity: "blocker", message: "empty" },
          ],
          verdict: "blocked",
          ai: { status: "skipped" },
        }),
      ),
    });
    const result = await autoReviewAndPublish(d);
    expect(result).toMatchObject({ status: "held", reason: "empty" });
    expect(d.save).not.toHaveBeenCalled();
  });

  it("still publishes when the AI is unavailable and only warnings remain", async () => {
    const d = deps({
      review: vi
        .fn()
        .mockResolvedValue(
          review({ ai: { status: "unavailable", reason: "down" } }),
        ),
    });
    const result = await autoReviewAndPublish(d);
    expect(result).toMatchObject({
      status: "published",
      fixed: 0,
      remaining: 1,
      aiStatus: "unavailable",
    });
  });

  it("stops before approving when the learner opts out or edits mid-run", async () => {
    const d = deps({ canContinue: () => false });
    const result = await autoReviewAndPublish(d);
    expect(result.status).toBe("held");
    expect(d.approve).not.toHaveBeenCalled();
    expect(d.publish).not.toHaveBeenCalled();
    const reviewedSaves = (d.save as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => call[1] === true,
    );
    expect(reviewedSaves).toHaveLength(0);
  });

  it("saves first when there are unsaved edits or lessons without ids", async () => {
    const d = deps({ needsSave: true });
    await autoReviewAndPublish(d);
    expect((d.save as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBe(false);
  });

  it("reports a refused approval or a failed publish instead of throwing", async () => {
    expect(
      await autoReviewAndPublish(
        deps({
          approve: vi.fn().mockResolvedValue({ ok: false, error: "nope" }),
        }),
      ),
    ).toMatchObject({ status: "held", reason: "nope" });
    expect(
      await autoReviewAndPublish(
        deps({ publish: vi.fn().mockResolvedValue({ error: "stale" }) }),
      ),
    ).toMatchObject({ status: "held", reason: "stale" });
    expect(
      await autoReviewAndPublish(
        deps({ prepare: vi.fn().mockRejectedValue(new Error("boom")) }),
      ),
    ).toMatchObject({ status: "held", reason: "boom" });
  });
});
