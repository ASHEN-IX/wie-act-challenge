import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { LessonBlockV2 } from "@noveris/shared/ednova/learningDocumentV2";
import { tokenizeCode } from "../code-highlight";
import { PlannedBlockView, type ReaderContext } from "./registry";

const context: ReaderContext = { title: "Course", revisionId: "rev-1", explore: false };
const exploreContext: ReaderContext = { ...context, explore: true };

const render = (component: string, block: LessonBlockV2, ctx = context) =>
  renderToStaticMarkup(
    <PlannedBlockView component={component as never} block={block} context={ctx} />,
  );

const definition: LessonBlockV2 = {
  type: "callout",
  id: "def-1",
  kind: "definition",
  title: "Convergent series",
  text: "A series converges when its partial sums converge.",
  evidence: ["c1"],
};

const theorem: LessonBlockV2 = {
  type: "callout",
  id: "thm-1",
  kind: "theorem",
  title: "Comparison test",
  text: "If terms are bounded by a convergent series, the series converges.",
  evidence: ["c1"],
};

const proof: LessonBlockV2 = {
  type: "callout",
  id: "proof-1",
  kind: "proof",
  title: "Proof",
  text: "Apply the comparison test term by term.",
  evidence: ["c1"],
};

const exercise: LessonBlockV2 = {
  type: "callout",
  id: "ex-1",
  kind: "exercise",
  title: "Exercise 3.1",
  text: "Show that the harmonic series diverges.",
  evidence: ["c1"],
};

const code: LessonBlockV2 = {
  type: "code",
  id: "code-1",
  language: "python",
  code: "def search(items):\n    return items[0]\n",
};

describe("semantic educational components", () => {
  it("renders a definition with its own label", () => {
    const html = render("DefinitionCard", definition);
    expect(html).toContain('data-component="DefinitionCard"');
    expect(html).toContain("Definition");
    expect(html).toContain("Convergent series");
  });

  it("labels a theorem by its actual semantic kind", () => {
    const proposition: LessonBlockV2 = { ...theorem, kind: "proposition" } as LessonBlockV2;
    expect(render("TheoremCard", theorem)).toContain("Theorem");
    expect(render("TheoremCard", proposition)).toContain("Proposition");
  });

  it("keeps a collapsed proof reachable for assistive technology", () => {
    const html = render("ProofBlock", proof);
    expect(html).toContain("aria-expanded");
    expect(html).toContain("aria-controls");
    expect(html).toContain("Apply the comparison test term by term.");
  });

  it("marks an exercise as source content that is not graded here", () => {
    const html = render("ExerciseBlock", exercise);
    expect(html).toContain("not graded here");
    expect(html).toContain("Show that the harmonic series diverges.");
  });

  it("does not render an exercise as an assessment input", () => {
    const html = render("ExerciseBlock", exercise);
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<button");
  });
});

describe("mathematical components", () => {
  it("states instructor review without claiming independent verification", () => {
    const reviewed: LessonBlockV2 = {
      type: "math",
      id: "m1",
      expression: "S_n = \\sum_{p=0}^{n} u_p",
      notation: "latex",
      review: {
        state: "accepted",
        originalExpression: "S_n = sum u_p",
        modelExpression: "\\sum u_p",
        reviewer: "instructor",
      },
    };
    const html = render("ReviewedFormula", reviewed);
    expect(html).toContain("Instructor-accepted");
    expect(html).toContain("not independently verified");
    expect(html).not.toContain("verified formula");
  });

  it("never typesets unreviewed mathematics", () => {
    const unreviewed: LessonBlockV2 = {
      type: "math",
      id: "m2",
      expression: "∫ f x a b",
      notation: "plain",
      sourceMeta: {
        regionId: "region_aaaaaaaaaaaaaaaaaaaa",
        page: 2,
        bbox: [0, 0, 1, 1],
        extractionMethod: "text",
        confidence: 0.4,
        reviewRequired: true,
        issues: [],
      },
    };
    const html = render("SourceMathFallback", unreviewed, {
      ...context,
      cropHref: () => "/api/v1/study/courses/a/revisions/r/sources/d/regions/region_aaaaaaaaaaaaaaaaaaaa",
    });
    expect(html).toContain("data-uncertain-math");
    expect(html).toContain("Unverified transcription");
    expect(html).toContain("∫ f x a b");
    expect(html).not.toContain("Instructor-accepted");
    expect(html).not.toContain("katex");
  });

  it("handles a missing crop without losing the extracted text", () => {
    const unreviewed: LessonBlockV2 = {
      type: "math",
      id: "m3",
      expression: "x^2 + y^2",
      notation: "plain",
    };
    const html = render("SourceMathFallback", unreviewed, context);
    expect(html).toContain("original crop is unavailable");
    expect(html).toContain("x^2 + y^2");
  });
});

describe("code components", () => {
  it("preserves exact indentation and whitespace in the token stream", () => {
    // The tokenizer is the fidelity boundary: whitespace between tokens must
    // survive verbatim, since that is what the <pre> renders.
    const line = "    return items[0]";
    const tokens = tokenizeCode(line, "python");
    expect(tokens.map((token) => token.text).join("")).toBe(line);
    expect(tokens[0].text).toBe("    ");
    const html = render("CodeViewer", code);
    expect(html).toContain("python");
    expect(html).toContain("Copy code to clipboard");
    // Indentation survives into the rendered line, inside its own span.
    expect(html).toContain("<span>    </span>");
  });

  it("keeps every line of a multi-line block, including blank ones", () => {
    const multiline: LessonBlockV2 = {
      type: "code",
      id: "c3",
      language: "python",
      code: "a = 1\n\nb = 2\n",
    };
    const tokens = tokenizeCode(multiline.code, "python");
    expect(tokens.map((token) => token.text).join("")).toBe(multiline.code);
    const html = render("CodeViewer", multiline);
    // One rendered line per source line, including the blank one.
    expect((html.match(/<span class="block">/g) ?? []).length).toBe(4);
  });

  it("renders code as text and never as executable markup", () => {
    const dangerous: LessonBlockV2 = {
      type: "code",
      id: "c2",
      language: "javascript",
      code: '<script>alert("x")</script>',
    };
    const html = render("CodeViewer", dangerous);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain('<script>alert("x")</script>');
  });

  it("offers copy as a labelled control", () => {
    const html = render("CodeViewer", code);
    expect(html).toContain("Copy code to clipboard");
  });
});

describe("structured components", () => {
  it("renders a real table with header scope", () => {
    const table: LessonBlockV2 = {
      type: "table",
      id: "t1",
      caption: "Protocol messages",
      columns: ["Message", "Purpose"],
      rows: [
        ["SYN", "Open"],
        ["ACK", "Confirm"],
      ],
      evidence: ["c1"],
    };
    const html = render("EducationalTable", table);
    expect(html).toContain('scope="col"');
    expect(html).toContain("Protocol messages");
    expect(html).toContain("SYN");
    expect(html).toContain("Confirm");
  });

  it("renders a chart with an accessible data table", () => {
    const chart: LessonBlockV2 = {
      type: "chart",
      id: "ch1",
      title: "Comparisons by input size",
      kind: "bar",
      categories: ["16", "1024"],
      series: [{ label: "Comparisons", values: [4, 10] }],
      evidence: ["c1"],
    };
    const html = render("DataChart", chart);
    expect(html).toContain('role="img"');
    expect(html).toContain("View data table");
    expect(html).toContain("<table");
  });

  it("renders process steps in canonical order", () => {
    const diagram: LessonBlockV2 = {
      type: "diagram",
      id: "dg",
      title: "Connection setup",
      description: "How a connection is established.",
      steps: [
        { id: "s1", label: "Send SYN" },
        { id: "s2", label: "Receive SYN-ACK" },
        { id: "s3", label: "Send ACK" },
      ],
    };
    const html = render("ProcessDiagram", diagram);
    const syn = html.indexOf("Send SYN");
    const synAck = html.indexOf("Receive SYN-ACK");
    const ack = html.indexOf("Send ACK");
    expect(syn).toBeGreaterThan(-1);
    expect(syn).toBeLessThan(synAck);
    expect(synAck).toBeLessThan(ack);
  });

  it("shows a faithful missing-asset state instead of dropping a figure", () => {
    const figure: LessonBlockV2 = {
      type: "media",
      id: "f1",
      mediaType: "image",
      alt: "Band split diagram",
      caption: "Figure 3.1",
    };
    const html = render("FigureViewer", figure);
    expect(html).toContain("the source asset is not attached");
    expect(html).toContain("Figure 3.1");
  });

  it("rejects an external media path at the renderer boundary", () => {
    const figure: LessonBlockV2 = {
      type: "media",
      id: "f2",
      mediaType: "image",
      alt: "Untrusted",
      src: "https://untrusted.example/x.png",
    };
    const html = render("FigureViewer", figure);
    expect(html).toContain("This media source is unavailable");
    expect(html).not.toContain("untrusted.example");
  });
});

describe("trusted renderer boundary", () => {
  it("renders an unsupported component as a labelled notice, not nothing", () => {
    const html = render("ArchitectureDiagram", definition);
    expect(html).toContain("not supported by this reader version");
    expect(html).toContain("ArchitectureDiagram");
  });

  it("escapes uploaded markup in prose", () => {
    const paragraph: LessonBlockV2 = {
      type: "paragraph",
      id: "p1",
      text: '<img src=x onerror="alert(1)">',
      evidence: ["c1"],
    };
    const html = render("ConceptExplanation", paragraph);
    expect(html).toContain("&lt;img src=x");
    expect(html).not.toContain("<img src=x");
  });

  it("does not mount an interactive component in Read mode", () => {
    const html = render("ProofBlock", proof, context);
    expect(html).not.toContain("data-component=\"FunctionGraph\"");
  });

  it("keeps explore context available without changing the static render", () => {
    const html = render("DefinitionCard", definition, exploreContext);
    expect(html).toContain('data-component="DefinitionCard"');
  });
});
