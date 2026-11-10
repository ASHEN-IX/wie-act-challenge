import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FormattedText,
  TutorThread,
  cleanExcerpt,
  segmentAnswer,
  type TutorCitation,
} from "./tutor-answer";

const chunkA = "chk_" + "a".repeat(64);
const chunkB = "chk_" + "b".repeat(64);
const citations: TutorCitation[] = [
  { documentId: "doc_1", pageNumber: 2, chunkId: chunkA, quote: "Quoted A" },
  { documentId: "doc_1", pageNumber: null, chunkId: chunkB, quote: "Quoted B" },
];

describe("segmentAnswer", () => {
  it("turns known markers into stable numbered citations", () => {
    const answer = `Sums converge [doc:doc_1, p:2, chunk:${chunkA}]. Also [doc:doc_1, chunk:${chunkB}] and again [doc:doc_1, p:2, chunk:${chunkA}].`;
    const cites = segmentAnswer(answer, citations).filter((s) => "cite" in s);
    expect(cites).toEqual([{ cite: 0 }, { cite: 1 }, { cite: 0 }]);
  });

  it("drops markers that do not match a returned citation instead of inventing a source", () => {
    const answer = `Claim [doc:doc_9, p:1, chunk:chk_${"c".repeat(64)}].`;
    const segments = segmentAnswer(answer, citations);
    expect(segments.some((s) => "cite" in s)).toBe(false);
    expect(segments.map((s) => ("text" in s ? s.text : "")).join("")).not.toContain("[doc:");
  });
});

describe("cleanExcerpt", () => {
  it("collapses PDF line breaks and removes markers", () => {
    expect(cleanExcerpt(`line one\n  line two [doc:d, p:1, chunk:${chunkA}]`)).toBe("line one line two");
  });
});

describe("TutorThread", () => {
  const base = {
    question: "What converges?",
    pending: false,
    error: null,
    sourceHref: (c: TutorCitation) => `/src/${c.documentId}`,
    onFollowUp: () => undefined,
  };

  it("renders a verified model answer with citation chips, source links and follow-ups", () => {
    const html = renderToStaticMarkup(
      <TutorThread
        {...base}
        answer={{
          status: "verified",
          citationsValid: true,
          executionMode: "REAL_APPROVED",
          answer: `A series converges when partial sums do [doc:doc_1, p:2, chunk:${chunkA}].\n\n- First point\n- Second **point**`,
          citations,
        }}
      />,
    );
    expect(html).toContain('data-testid="tutor-answer"');
    expect(html).toContain("Checked against your sources");
    expect(html).toContain('aria-label="Go to source 1"');
    expect(html).toContain("<li>First point</li>");
    expect(html).toContain("<strong>point</strong>");
    expect(html).toContain('href="/src/doc_1"');
    expect(html).toContain("page 2");
    expect(html).toContain("Quiz me on this");
    expect(html).not.toContain("[doc:");
  });

  it("does not offer model-only follow-ups or claim a check for fallback excerpts", () => {
    const html = renderToStaticMarkup(
      <TutorThread
        {...base}
        answer={{
          status: "verified",
          citationsValid: true,
          executionMode: "DETERMINISTIC_FALLBACK",
          answer: "raw\nexcerpt",
          citations,
        }}
      />,
    );
    expect(html).toContain("Closest passage");
    expect(html).not.toContain("Checked against your sources");
    expect(html).not.toContain("Quiz me on this");
  });

  it("explains an unanswerable question without fabricating text", () => {
    const html = renderToStaticMarkup(
      <TutorThread
        {...base}
        answer={{ status: "insufficient_evidence", executionMode: "REAL_APPROVED", citations: [] }}
      />,
    );
    expect(html).toContain("couldn’t find this in your course material");
    expect(html).not.toContain("Quiz me on this");
  });

  it("renders nothing before the first question", () => {
    expect(
      renderToStaticMarkup(
        <TutorThread {...base} question={null} answer={null} />,
      ),
    ).toBe("");
  });
});

describe("FormattedText", () => {
  it("renders fenced code literally and headings as bold, without raw markdown", () => {
    const html = renderToStaticMarkup(
      <FormattedText
        text={"### Solution\n```\nStudent(**ID**, Code)\n```\n- **Check:** one value per cell"}
      />,
    );
    expect(html).toContain("<strong>Solution</strong>");
    expect(html).toContain('<pre dir="ltr"');
    expect(html).toContain("Student(**ID**, Code)");
    expect(html).toContain("<li><strong>Check:</strong> one value per cell</li>");
    expect(html).not.toContain("```");
    expect(html).not.toContain("###");
  });

  it("renders single-asterisk emphasis instead of raw asterisks", () => {
    const html = renderToStaticMarkup(
      <FormattedText
        text={"that cell would be a *group* of values. 1NF says: *keep every cell atomic.*"}
      />,
    );
    expect(html).toContain("a <em>group</em> of values");
    expect(html).toContain("<em>keep every cell atomic.</em>");
    expect(html).not.toContain("*");
  });

  it("keeps literal asterisks inside code fences", () => {
    const html = renderToStaticMarkup(
      <FormattedText text={"```\nSELECT * FROM t\n```"} />,
    );
    expect(html).toContain("SELECT * FROM t");
  });
});
