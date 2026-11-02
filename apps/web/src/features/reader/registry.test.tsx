import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { LessonBlockV2 } from "@ednova/shared/ednova/learningDocumentV2";
import { LearningBlockView } from "./registry";

const context = { title: "Course", revisionId: "rev-1" };

describe("trusted learning block registry", () => {
  it("escapes uploaded markup and never interprets it as HTML", () => {
    const block: LessonBlockV2 = {
      type: "paragraph",
      id: "p-1",
      text: '<img src=x onerror="alert(1)">',
      evidence: ["chunk-1"],
    };
    const html = renderToStaticMarkup(<LearningBlockView block={block} context={context} />);
    expect(html).toContain("&lt;img src=x");
    expect(html).not.toContain("<img src=x");
  });

  it("renders source code as text with no execution element", () => {
    const block: LessonBlockV2 = {
      type: "code",
      id: "code-1",
      language: "javascript",
      code: '<script>alert("executed")</script>',
    };
    const html = renderToStaticMarkup(<LearningBlockView block={block} context={context} />);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain('<script>alert("executed")</script>');
  });

  it("rejects an external media path at the renderer boundary", () => {
    const block: LessonBlockV2 = {
      type: "media",
      id: "media-1",
      mediaType: "image",
      src: "https://untrusted.example/image.png",
      alt: "Untrusted image",
    };
    const html = renderToStaticMarkup(<LearningBlockView block={block} context={context} />);
    expect(html).toContain("This media source is unavailable");
    expect(html).not.toContain("untrusted.example");
  });

  it("renders a validated chart with an accessible data-table fallback", () => {
    const block: LessonBlockV2 = {
      type: "chart",
      id: "chart-1",
      title: "Comparisons by input size",
      kind: "bar",
      categories: ["16", "1,024"],
      series: [{ label: "Comparisons", values: [4, 10] }],
      evidence: ["chunk-1"],
    };
    const html = renderToStaticMarkup(<LearningBlockView block={block} context={context} />);
    expect(html).toContain("Comparisons by input size");
    expect(html).toContain("View data table");
    expect(html).toContain("role=\"img\"");
    expect(html).toContain("<table");
  });

  it("renders a line chart as an accessible responsive visual", () => {
    const block: LessonBlockV2 = {
      type: "chart",
      id: "chart-line",
      title: "Search growth",
      kind: "line",
      categories: ["8", "64"],
      series: [{ label: "Search steps", values: [3, 6] }],
      evidence: ["chunk-1"],
    };
    const html = renderToStaticMarkup(<LearningBlockView block={block} context={context} />);
    expect(html).toContain("<svg");
    expect(html).toContain("<polyline");
    expect(html).toContain('role="img"');
    expect(html).toContain("View data table");
  });

  it("renders source tables and syntax tokens without executing either", () => {
    const table: LessonBlockV2 = {
      type: "table",
      id: "table-1",
      columns: ["Message", "Purpose"],
      rows: [["SYN", "Open"], ["ACK", "Confirm"]],
      evidence: ["chunk-1"],
    };
    const code: LessonBlockV2 = {
      type: "code",
      id: "code-1",
      language: "python",
      code: "def search(items):\n    return items[0]",
    };
    expect(renderToStaticMarkup(<LearningBlockView block={table} context={context} />)).toContain(
      "<table",
    );
    const codeHtml = renderToStaticMarkup(
      <LearningBlockView block={code} context={context} />,
    );
    expect(codeHtml).toContain("text-sky-300");
    expect(codeHtml).not.toContain("<script");
  });
});

it("uses original equation imagery for unreviewed plain extraction, preserving text without a verification claim", () => {
  const block: Extract<LessonBlockV2, { type: "math" }> = {
    id: "unreviewed", type: "math", expression: "∫ f x a b", notation: "plain",
    sourceMeta: { page: 2, regionId: "region_aaaaaaaaaaaaaaaaaaaa", reviewRequired: true },
  };
  const html = renderToStaticMarkup(<LearningBlockView block={block} context={{ title: "Math", revisionId: "rev_1", mathCropHref: () => "/api/v1/study/courses/aaaaaaaaaaaaaaaaaaaaaaaa/revisions/rev_1/sources/doc_aaaaaaaaaaaaaaaa/regions/region_aaaaaaaaaaaaaaaaaaaa" }} />);
  expect(html).toContain("<img");
  expect(html).toContain("Automatic transcription is unverified");
  expect(html).toContain("∫ f x a b");
  expect(html).not.toContain("Instructor-approved");
  expect(html).not.toContain("class=\"katex");
});
