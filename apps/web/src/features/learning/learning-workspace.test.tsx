import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("./journey-actions", () => ({ learningProgress: vi.fn() }));
import { LearningWorkspace } from "./learning-workspace";

describe("student practice availability", () => {
  it("explains unavailable practice before a click and hides internal revisions", () => {
    const catalog = {
      context: { courseId: "course", revisionId: "internal_revision", title: "Mathematics", topics: [
        { topicId: "topic", objectives: [{ objectiveId: "objective", statement: "Explain a quadratic" }] },
      ] },
      activities: [],
    } as unknown as Parameters<typeof LearningWorkspace>[0]["catalog"];
    const html = renderToStaticMarkup(<LearningWorkspace catalog={catalog} userId="learner" />);
    expect(html).toContain("There is no reviewed practice activity");
    expect(html).toMatch(/disabled=""[^>]*>Start practice/);
    expect(html).not.toContain("internal_revision");
    expect(html).not.toContain("Check my understanding");
  });
});
