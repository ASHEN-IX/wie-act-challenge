import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("./formula-actions", () => ({ loadFormulaWorkspace: vi.fn() }));

vi.mock("./studio-actions", () => ({
  loadStudio: vi.fn(),
  prepareStudio: vi.fn(),
  uploadStudioSource: vi.fn(),
  studioIngestStatus: vi.fn(),
}));

vi.mock("./actions", () => ({
  updateDraftAction: vi.fn(),
  publishRevisionAction: vi.fn(),
  generateCandidateActivity: vi.fn(),
  registerCandidateActivity: vi.fn(),
}));

import { CourseStudio } from "./course-studio";
import type { CourseDraft } from "./types";

const mockUnreviewedDraft: CourseDraft = {
  courseId: "64f1a2b3c4d5e6f7a8b9c0d1",
  revisionTag: "rev_20261023_01",
  contentHash:
    "sha256:1111111111111111111111111111111111111111111111111111111111111111",
  status: "draft",
  isInstructorReviewed: false,
  summary: "Draft curriculum covering fundamental algorithms.",
  topics: [
    {
      id: "topic_1",
      title: "Asymptotic Analysis",
      description: "Big-O and Big-Theta notation.",
      subtopics: [
        {
          id: "sub_1_1",
          title: "Worst-Case Complexity",
          summary: "Deriving upper bounds.",
          provenance: "extracted",
          learning_objectives: [
            {
              id: "obj_1_1_1",
              statement:
                "Formulate worst-case recurrence relations for recursive algorithms.",
              bloomLevel: "apply",
              provenance: "extracted",
            },
          ],
        },
      ],
    },
  ],
};

const mockReviewedDraft: CourseDraft = {
  ...mockUnreviewedDraft,
  isInstructorReviewed: true,
};

describe("CourseStudio Component (ED-31 / M15)", () => {
  it("keeps raw source text behind one bounded inspector and exposes review", () => {
    const html = renderToStaticMarkup(
      <CourseStudio
        courseId={mockUnreviewedDraft.courseId}
        courseTitle="Algorithms & Data Structures"
        initialDraft={mockUnreviewedDraft}
        currentUserId="usr_instructor_1"
      />,
    );

    expect(html).toContain("Source review and advanced tools");
    expect(html).toContain("Source passage");
    expect(html).not.toContain("Normalized text");
    expect(html).not.toContain("extracted regions</summary>");
  });

  it("renders course title, active revision tag, and unreviewed status badge", () => {
    const html = renderToStaticMarkup(
      <CourseStudio
        courseId={mockUnreviewedDraft.courseId}
        courseTitle="Algorithms & Data Structures"
        initialDraft={mockUnreviewedDraft}
        currentUserId="usr_instructor_1"
      />,
    );

    expect(html).toContain("Algorithms &amp; Data Structures");
    expect(html).not.toContain("rev_20261023_01");
    expect(html).toContain("Upload");
    expect(html).toContain("Review");
    expect(html).toContain("Needs Review");
    expect(html).toContain("Save Draft");
    expect(html).toContain("Publish course");
    expect(html).toContain("Draft ready for review.");
    expect(html).not.toContain("Choose a source to begin.");
  });

  it("renders reviewed status badge when isInstructorReviewed is true", () => {
    const html = renderToStaticMarkup(
      <CourseStudio
        courseId={mockReviewedDraft.courseId}
        courseTitle="Algorithms & Data Structures"
        initialDraft={mockReviewedDraft}
        currentUserId="usr_instructor_1"
      />,
    );

    expect(html).toContain("Reviewed");
  });

  it("renders draft hierarchy topics, subtopics, and learning objectives", () => {
    const html = renderToStaticMarkup(
      <CourseStudio
        courseId={mockUnreviewedDraft.courseId}
        courseTitle="Algorithms & Data Structures"
        initialDraft={mockUnreviewedDraft}
        currentUserId="usr_instructor_1"
      />,
    );

    expect(html).toContain("Asymptotic Analysis");
    expect(html).toContain("Worst-Case Complexity");
    expect(html).toContain("1 objective");
    expect(html).toContain('aria-expanded="false"');
  });

  it("renders activity proposal studio controls with InteractiveQuiz and GuidedProblem options", () => {
    const html = renderToStaticMarkup(
      <CourseStudio
        courseId={mockUnreviewedDraft.courseId}
        courseTitle="Algorithms & Data Structures"
        initialDraft={mockUnreviewedDraft}
        currentUserId="usr_instructor_1"
      />,
    );

    expect(html).toContain("Activity Proposal Studio");
    expect(html).toContain("InteractiveQuiz");
    expect(html).toContain("GuidedProblem");
    expect(html).toContain("Activity type");
  });
});
