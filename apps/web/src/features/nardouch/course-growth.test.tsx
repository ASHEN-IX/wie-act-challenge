import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CourseNardouchJourney } from "@ednova/shared/ednova/nardouchGrowth";
vi.mock("./course-growth-actions", () => ({
  loadCourseNardouch: vi.fn(),
  finishNardouchLesson: vi.fn(),
}));
import { CourseNardouchView } from "./course-growth";

const journey: CourseNardouchJourney = {
  courseId: "course",
  revisionId: "revision",
  stage: "baby",
  lessons: [{ id: "lesson", title: "Recursion" }],
  completedLessonIds: [],
  readingPercent: 0,
  passedChecks: 0,
  totalChecks: 1,
  graduated: false,
};
const render = (data = journey) =>
  renderToStaticMarkup(
    <CourseNardouchView
      journey={data}
      onComplete={() => {}}
      practiceHref="/checks"
    />,
  );

describe("course Nardouch", () => {
  it("starts with the supplied Baby artwork and an explicit lesson action", () => {
    const html = render();
    expect(html).toContain('data-nardouch-stage="baby"');
    expect(html).toContain("nardouch-baby-transparent.png");
    expect(html).toContain("Complete lesson");
    expect(html).toContain("0 / 1 objective checks passed");
    expect(html).not.toContain("revision");
  });
  it("reserves Graduate for assessed completion and offers existing checks after reading", () => {
    const html = render({
      ...journey,
      stage: "expert",
      readingPercent: 100,
      completedLessonIds: ["lesson"],
    });
    expect(html).toContain('href="/checks"');
    expect(html).toContain("Open course checks");
    expect(html).not.toContain('data-nardouch-stage="graduate"');
    const graduated = render({
      ...journey,
      stage: "graduate",
      readingPercent: 100,
      completedLessonIds: ["lesson"],
      passedChecks: 1,
      graduated: true,
    });
    expect(graduated).toContain("nardouch-graduate-transparent.png");
    expect(graduated).toContain("You grew together!");
    expect(graduated).not.toContain("Complete lesson");
  });
  it("explains courses without reviewed checks instead of awarding a cap", () => {
    expect(
      render({
        ...journey,
        stage: "expert",
        readingPercent: 100,
        totalChecks: 0,
      }),
    ).toContain("Reviewed checks are not available yet");
  });
});
