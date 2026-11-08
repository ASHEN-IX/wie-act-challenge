import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CourseJourney, courseJourney } from "./course-journey";

const ID = "6af0828d13939199bb8badec";

describe("course journey", () => {
  it("offers the visual step only when the course has concepts to show", () => {
    expect(courseJourney(ID, 0).map((step) => step.label)).not.toContain(
      "Explore visually",
    );
    const withVisual = courseJourney(ID, 2);
    expect(withVisual.map((step) => step.label)).toContain("Explore visually");
    expect(withVisual.find((s) => s.label === "Explore visually")?.hint).toBe(
      "2 concepts from this course",
    );
  });

  it("keeps the course in context for every course-scoped step", () => {
    const hrefs = courseJourney(ID, 1).map((step) => step.href);
    expect(hrefs).toContain(`/courses/${ID}/learn#practice-and-tutor`);
    expect(hrefs).toContain(`/study-together?courseId=${ID}`);
    expect(hrefs).toContain("/progress");
  });

  it("preserves the chosen revision across lesson steps", () => {
    const hrefs = courseJourney(ID, 1, "rev one").map((step) => step.href);
    expect(hrefs).toContain(`/courses/${ID}/learn?revisionId=rev%20one#explore-visually`);
    expect(hrefs).toContain(`/courses/${ID}/learn?revisionId=rev%20one#practice-and-tutor`);
  });

  it("renders an ordered, labelled list and marks the current step", () => {
    const html = renderToStaticMarkup(
      <CourseJourney courseId={ID} visualConcepts={1} current="Read" />,
    );
    expect(html).toContain('aria-label="Learning steps for this course"');
    expect(html).toContain("<ol");
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("1 concept from this course");
  });
});
