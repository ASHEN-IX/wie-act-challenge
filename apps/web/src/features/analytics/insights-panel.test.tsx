import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InstructorInsightsPanel } from "./insights-panel";
import type { InstructorInsights } from "./types";

const insights: InstructorInsights = {
  course: {
    courseId: "a".repeat(24),
    title: "Reviewed algorithms",
    revisionId: "rev_one",
  },
  policy: { minimumCohort: null, status: "provisional" },
  suppressed: true,
  suppressionReason: "policy_pending",
  summary: null,
  activityBreakdown: [],
  trends: [],
};

describe("Instructor aggregate privacy states", () => {
  it("explains pending policy without rendering counts or result tables", () => {
    const html = renderToStaticMarkup(
      <InstructorInsightsPanel insights={insights} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("configure its learner privacy policy");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("Learners with accepted objective evidence");
  });

  it("keeps a below-threshold cohort hidden with a distinct accessible explanation", () => {
    const html = renderToStaticMarkup(
      <InstructorInsightsPanel
        insights={{
          ...insights,
          suppressionReason: "small_cohort",
          policy: { minimumCohort: 5, status: "provisional" },
        }}
      />,
    );
    expect(html).toContain("minimum group size");
    expect(html).not.toContain("Active enrolled learners");
  });

  it("labels sparse cells as suppressed and exposes semantic completed-week summaries", () => {
    const html = renderToStaticMarkup(
      <InstructorInsightsPanel
        insights={{
          ...insights,
          suppressed: false,
          suppressionReason: null,
          summary: {
            enrolledLearners: 20,
            practicedLearners: 6,
            masteredLearners: null,
          },
          activityBreakdown: [
            { activityType: "InteractiveQuiz", practicedLearners: 6 },
            { activityType: "GuidedProblem", practicedLearners: null },
          ],
          trends: [{ week: "2026-W40", practicedLearners: null }],
        }}
      />,
    );
    expect(html).toContain("Suppressed");
    expect(html).toContain("not academic attainment");
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
    expect(html).toContain("2026-W40");
    expect(html).not.toContain("<script");
  });
});
