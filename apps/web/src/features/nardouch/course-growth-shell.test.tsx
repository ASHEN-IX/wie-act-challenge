/** Batch 4 M4.1 closure: the companion's pre-fetch state.
 *
 * This suite covers only what a static render can prove: before the effect
 * runs, the shell shows a status message and no error. The *post-fetch*
 * behaviour is asserted in the browser instead, because the resolution depends
 * on an effect and this project has no DOM test environment.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("./course-growth-actions", () => ({
  loadCourseNardouch: vi.fn(),
  finishNardouchLesson: vi.fn(),
}));

import { CourseNardouch } from "./course-growth";

describe("course companion pre-fetch state", () => {
  it("shows a status message, not an error, before data arrives", () => {
    const html = renderToStaticMarkup(
      <CourseNardouch courseId="course" revisionId="revision" lessonId="lesson" />,
    );
    expect(html).toContain("Loading your course companion");
    expect(html).toContain('role="status"');
    expect(html).not.toContain('role="alert"');
  });

  it("renders no companion content until a journey is loaded", () => {
    const html = renderToStaticMarkup(
      <CourseNardouch courseId="course" revisionId="revision" lessonId="lesson" />,
    );
    expect(html).not.toContain("data-nardouch-stage");
  });
});
