import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("./studio-actions", () => ({ reviewDraft: vi.fn() }));

import { CourseReviewPanel } from "./course-review-panel";

describe("CourseReviewPanel", () => {
  it("offers both review modes and states what it will not do", () => {
    const html = renderToStaticMarkup(
      <CourseReviewPanel courseId="c1" dirty={false} onApply={vi.fn()} />,
    );
    expect(html).toContain("Run checks");
    expect(html).toContain("Review with AI");
    expect(html).toContain("only you can confirm the source review");
    expect(html).not.toContain("Save your changes first");
  });

  it("asks for a save and disables review while edits are unsaved", () => {
    const html = renderToStaticMarkup(
      <CourseReviewPanel courseId="c1" dirty onApply={vi.fn()} />,
    );
    expect(html).toContain("Save your changes first");
    expect(html.match(/disabled=""/g)?.length).toBe(2);
  });
});
