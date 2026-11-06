import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { LessonBlockV2 } from "@ednova/shared/ednova/learningDocumentV2";
import {
  buildPublishedPresentation,
  type PresentationBuildInput,
} from "@ednova/shared/ednova/presentationDocument";
import { LessonReader, lessonHref } from "./lesson-reader";
import { COMPONENT_REGISTRY_VERSION } from "@ednova/shared/ednova/componentRegistry";
import type { PublishedExperiencePlanV1 } from "@ednova/shared/ednova/publishedExperiencePlan";

const courseId = "0123456789abcdef01234567";
const revisionId = "rev_formula_test";
const contentHash = "sha256:" + "a".repeat(64);
const documentId = "doc-1";
const evidence = [{ chunkId: "chunk-1", documentId, pageNumber: 4, lineStart: 1, lineEnd: 2 }];
const sourceMeta = {
  regionId: "region_1",
  page: 4,
  bbox: [1, 2, 30, 40] as [number, number, number, number],
  extractionMethod: "text" as const,
  confidence: 0.8,
  reviewRequired: false,
  issues: [],
};

const unreviewedMath: LessonBlockV2 = {
  type: "math",
  id: "m1",
  expression: "S_n = sum u_p",
  notation: "plain",
  evidence: ["chunk-1"],
  provenance: evidence,
  sourceMeta,
};
const reviewedMath: LessonBlockV2 = {
  type: "math",
  id: "m2",
  expression: "S_n = \\sum_{p=0}^{n} u_p",
  notation: "latex",
  evidence: ["chunk-1"],
  provenance: evidence,
  sourceMeta,
  review: {
    state: "corrected",
    originalExpression: "S_n = sum u_p",
    modelExpression: "S_n = \\sum u_p",
    reviewer: "instructor-1",
  },
};
const definition: LessonBlockV2 = {
  type: "callout",
  id: "d1",
  kind: "definition",
  title: "Convergent series",
  text: "A series converges when its partial sums converge.",
  evidence: ["chunk-1"],
  provenance: evidence,
};
const proof: LessonBlockV2 = {
  type: "callout",
  id: "pr1",
  kind: "proof",
  title: "Proof",
  text: "By the comparison test.",
  evidence: ["chunk-1"],
  provenance: evidence,
};
const exercise: LessonBlockV2 = {
  type: "callout",
  id: "ex1",
  kind: "exercise",
  title: "Exercise 3.1",
  text: "Show that the series diverges.",
  evidence: ["chunk-1"],
  provenance: evidence,
};

const fixture: PresentationBuildInput = {
  courseId,
  revisionId,
  contentHash,
  canonicalContentHash: contentHash,
  title: "Discrete Structures",
  summary: "Pinned published revision.",
  objectives: [
    { objectiveId: "obj-1", statement: "Apply summation identities.", bloomLevel: "apply" },
  ],
  chapters: [
    {
      id: "chapter-1",
      title: "Summations",
      summary: "Chapter summary.",
      lessons: [
        {
          id: "lesson-1",
          title: "Closed forms",
          summary: "Lesson summary.",
          blocks: [
            {
              type: "paragraph",
              id: "p1",
              text: '<script>alert("x")</script> extracted paragraph',
              evidence: ["chunk-1"],
              provenance: evidence,
            },
            definition,
            reviewedMath,
            unreviewedMath,
            proof,
            exercise,
          ],
        },
        { id: "lesson-2", title: "Convergence tests", summary: "", blocks: [] },
      ],
    },
  ],
  sources: [
    {
      documentId,
      contentHash,
      pageNumber: null,
      href: `/api/v1/study/courses/${courseId}/revisions/${revisionId}/sources/${documentId}`,
    },
  ],
  warnings: ["Extraction fidelity is unverified."],
};

const render = (lessonId = "lesson-1", mode: "read" | "explore" | "practice" = "read") =>
  renderToStaticMarkup(
    <LessonReader
      presentation={buildPublishedPresentation(fixture)}
      lessonId={lessonId}
      initialMode={mode}
      practiceHref={`/courses/${courseId}/learn?revisionId=${revisionId}#practice-and-tutor`}
      fallbackHref={`/courses/${courseId}/learn?revisionId=${revisionId}`}
    />,
  );

describe("lesson reader", () => {
  it("renders the selected lesson, its chapter context and the outline", () => {
    const html = render();
    expect(html).toContain('data-lesson-id="lesson-1"');
    expect(html).toContain("Closed forms");
    expect(html).toContain("Summations");
    expect(html).toContain("Lesson 1 of 2");
    expect(html).toContain("Convergence tests");
    // Outline is navigation, not a second copy of every lesson body.
    expect(html).toContain('aria-label="Course outline"');
  });

  it("renders only the selected lesson, never the whole course at once", () => {
    const html = render("lesson-2");
    expect(html).toContain('data-lesson-id="lesson-2"');
    expect(html).not.toContain("A series converges when its partial sums converge.");
  });

  it("shows the fixed verification disclosure for unreviewed mathematics", () => {
    const html = render();
    expect(html).toContain("not semantically verified");
    expect(html).toContain("display formulas have instructor review");
    expect(html).toContain("data-uncertain-math");
    expect(html).toContain("Unverified transcription");
    expect(html).not.toContain("Instructor-approved representation");
  });

  it("scopes the mathematics disclosure to the lesson being read", () => {
    const withMath = render("lesson-1");
    expect(withMath).toContain("This lesson: 1 of 2 display formulas");
    // A lesson with no mathematics in a revision that has some must not claim
    // that this page contains unverified formulas.
    const withoutMath = render("lesson-2");
    expect(withoutMath).not.toContain("Content verification status");
    expect(withoutMath).not.toContain("display formulas have instructor review");
  });

  it("distinguishes reviewed formulas from unreviewed ones", () => {
    const html = render();
    expect(html).toContain("Instructor-corrected");
    expect(html).toContain("not independently verified");
  });

  it("gives definitions, proofs and exercises distinct semantic treatments", () => {
    const html = render();
    expect(html).toContain('data-component="DefinitionCard"');
    expect(html).toContain('data-component="ProofBlock"');
    expect(html).toContain('data-component="ExerciseBlock"');
    expect(html).toContain("not graded here");
  });

  it("never interprets source text as markup", () => {
    const html = render();
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain('<script>alert("x")</script>');
  });

  it("keeps the source-faithful reader one link away", () => {
    const html = render();
    expect(html).toContain(`/learn?revisionId=${revisionId}`);
  });

  it("does not claim completion or mastery from reading", () => {
    for (const mode of ["read", "explore", "practice"] as const) {
      const html = render("lesson-1", mode);
      expect(html).not.toMatch(/\blesson completed\b/i);
      expect(html).not.toMatch(/\bmark as (complete|mastered)\b/i);
      expect(html).not.toContain("data-lesson-complete");
    }
    // Where practice is offered, the disclaimer that denies it is explicit.
    expect(render("lesson-1", "practice")).toContain("does not record completion or mastery");
  });

  it("offers practice through the existing surface, not a new grader", () => {
    const html = render("lesson-1", "practice");
    expect(html).toContain("Open practice and tutor");
    expect(html).toContain("#practice-and-tutor");
  });

  it("builds deep-linkable lesson URLs pinned to the revision", () => {
    const presentation = buildPublishedPresentation(fixture);
    expect(lessonHref(presentation, "lesson-2", "read")).toBe(
      `/courses/${courseId}/present?revisionId=${revisionId}&lesson=lesson-2`,
    );
    expect(lessonHref(presentation, "lesson-2", "explore")).toContain("mode=explore");
    // Read is the default and stays out of the URL.
    expect(lessonHref(presentation, "lesson-2", "read")).not.toContain("mode=");
  });

  it("uses the route it is mounted at, not a hard-coded one", () => {
    const presentation = buildPublishedPresentation(fixture);
    expect(lessonHref(presentation, "lesson-2", "read", "/reader-preview")).toBe(
      `/reader-preview?revisionId=${revisionId}&lesson=lesson-2`,
    );
  });

  it("handles an unknown lesson with a meaningful empty state", () => {
    const html = render("missing-lesson");
    expect(html).toContain("This lesson is not in this revision");
  });
});

describe("validated experience plan integration (M4.1)", () => {
  const presentation = buildPublishedPresentation(fixture);
  const lesson = presentation.chapters[0].lessons[0];

  /** A plan bound to this revision and lesson, choosing different (but still
   * trusted) components for two blocks. */
  const boundPlan = (
    overrides: Partial<PublishedExperiencePlanV1> = {},
  ): PublishedExperiencePlanV1 => ({
    schemaVersion: "1.0.0",
    planId: "plan-test",
    courseId,
    revisionId,
    contentHash,
    lessonId: "lesson-1",
    mode: "read",
    registryVersion: COMPONENT_REGISTRY_VERSION,
    contextFingerprint: "fnv1a64:0123456789abcdef",
    planner: { implementation: "mock_experience_planner", version: "1.0.0" },
    digest: "fnv1a64:fedcba9876543210",
    // Start from the deterministic plan's own selection so the fixture is a
    // plan the real validator would accept, then override one block.
    canonical: (presentation.plan?.lessons[0].instances ?? []).map((instance, index) => ({
      placementId: `p-${index + 1}`,
      blockId: instance.blockId,
      blockType: instance.blockType,
      // A definition normally renders DefinitionCard; ImportantNote is a
      // registry-valid alternative for a callout, so honouring the plan is
      // observable without changing the content.
      component: instance.blockId === "d1" ? "ImportantNote" : instance.component,
      componentVersion: "1.0.0",
      group: "none",
      disclosure: "expanded",
      fallback: instance.component,
    })),
    supplemental: [],
    disclosure: "Mock plan.",
    ...overrides,
  });

  const renderWithPlan = (plan?: PublishedExperiencePlanV1) =>
    renderToStaticMarkup(
      <LessonReader
        presentation={presentation}
        lessonId="lesson-1"
        initialMode="read"
        practiceHref={`/courses/${courseId}/learn?revisionId=${revisionId}#practice-and-tutor`}
        fallbackHref={`/courses/${courseId}/learn?revisionId=${revisionId}`}
        {...(plan ? { experiencePlan: plan } : {})}
      />,
    );

  it("labels a planned layout with its provenance", () => {
    const html = renderWithPlan(boundPlan());
    expect(html).toContain('data-experience-plan="plan-test"');
    expect(html).toContain('data-experience-plan-planner="mock_experience_planner"');
    expect(html).toContain("Planned layout");
  });

  it("renders the plan's chosen trusted component", () => {
    const html = renderWithPlan(boundPlan());
    // The definition block is rendered as the plan asked (ImportantNote), not
    // as the deterministic plan would (DefinitionCard). A renderer whose
    // component cannot accept the block renders nothing, so the pairing is
    // observable per block.
    const definitionBlock = html.slice(html.indexOf('data-block-type="callout"'));
    expect(definitionBlock.slice(0, 120)).toContain('data-component="ImportantNote"');
  });

  it("keeps every canonical block present under a plan", () => {
    const html = renderWithPlan(boundPlan());
    // Every canonical block still appears; the plan changed component choice,
    // never coverage. The block wrappers are the coverage evidence.
    expect(html.match(/data-block-type=/g)?.length).toBe(lesson.blocks.length);
    expect(html).toContain("Convergent series");
    // The reviewed formula keeps its review disclosure under a plan.
    expect(html).toContain("not independently verified");
  });

  it("ignores a plan bound to another revision", () => {
    const html = renderWithPlan(boundPlan({ revisionId: "rev_other" }));
    expect(html).not.toContain('data-experience-plan="plan-test"');
    expect(html).not.toContain('data-component="ImportantNote"');
  });

  it("ignores a plan bound to another lesson", () => {
    const html = renderWithPlan(boundPlan({ lessonId: "lesson-2" }));
    expect(html).not.toContain('data-experience-plan="plan-test"');
  });

  it("ignores a plan bound to another course", () => {
    const html = renderWithPlan(boundPlan({ courseId: "fedcba9876543210fedcba98" }));
    expect(html).not.toContain('data-experience-plan="plan-test"');
  });

  it("renders the deterministic presentation when no plan is supplied", () => {
    const html = renderWithPlan(undefined);
    expect(html).not.toContain("data-experience-plan=");
    expect(html).toContain("Closed forms");
  });
});
