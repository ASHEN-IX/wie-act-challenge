import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { LessonBlockV2 } from "@ednova/shared/ednova/learningDocumentV2";
import {
  buildPublishedPresentation,
  type PresentationBuildInput,
} from "@ednova/shared/ednova/presentationDocument";
import { PresentationView } from "./presentation-view";

const courseId = "0123456789abcdef01234567";
const revisionId = "rev_formula_test";
const contentHash = "sha256:" + "a".repeat(64);
const documentId = "doc-1";
const evidence = [
  { chunkId: "chunk-1", documentId, pageNumber: 4, lineStart: 1, lineEnd: 2 },
];
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
const media: LessonBlockV2 = {
  type: "media",
  id: "media-1",
  mediaType: "image",
  alt: "Missing diagram",
  evidence: ["chunk-1"],
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
            unreviewedMath,
            media,
          ],
        },
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

describe("published presentation surface", () => {
  it("renders lessons from the contract with the fixed disclosure", () => {
    const html = renderToStaticMarkup(
      <PresentationView presentation={buildPublishedPresentation(fixture)} />,
    );
    expect(html).toContain('data-presentation-view="true"');
    expect(html).toContain('data-presentation-status="unreviewed"');
    expect(html).toContain("Discrete Structures");
    expect(html).toContain("Summations");
    expect(html).toContain("Closed forms");
    expect(html).toContain("Apply summation identities.");
    expect(html).toContain("not semantically verified");
    expect(html).toContain("display formulas have instructor review");
    expect(html).toContain("1 render from the original document");
  });

  it("marks unreviewed formulas and missing media as source-faithful fallbacks", () => {
    const html = renderToStaticMarkup(
      <PresentationView presentation={buildPublishedPresentation(fixture)} />,
    );
    expect(html).toContain('data-presentation-policy="source_faithful"');
    expect(html).toContain('data-presentation-reason="unreviewed_formula"');
    expect(html).toContain('data-presentation-reason="missing_source_asset"');
    expect(html).toContain("Automatic transcription is unverified");
    expect(html).toContain("/learn?revisionId=rev_formula_test");
  });

  it("never interprets source text as markup", () => {
    const html = renderToStaticMarkup(
      <PresentationView presentation={buildPublishedPresentation(fixture)} />,
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain('<script>alert("x")</script>');
  });
});
