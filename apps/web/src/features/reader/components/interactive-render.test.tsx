import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DerivationStepper } from "../math/derivation-stepper";
import { CodeWalkthrough } from "../code/code-walkthrough";
import { InteractiveDiagram } from "../diagrams/interactive-diagram";
import { SequenceVisualizer } from "../math/sequence-visualizer";
import { FunctionGraph } from "../math/function-graph";

/**
 * These components are client-only in the app, but their initial markup is
 * server-renderable. Rendering it here proves they mount, carry accessible
 * alternatives and bound their inputs — without a browser.
 */

describe("interactive mathematics", () => {
  it("plots a validated function with a text alternative and value table", () => {
    const html = renderToStaticMarkup(
      <FunctionGraph expression="x^2" title="Square function" />,
    );
    expect(html).toContain('data-component="FunctionGraph"');
    expect(html).toContain("Square function");
    expect(html).toContain("<svg");
    expect(html).toContain('role="img"');
    expect(html).toContain("Accessible description and values");
    expect(html).toContain("not a proof");
  });

  it("refuses an unsupported expression instead of plotting something else", () => {
    for (const expression of ["process.exit(1)", "constructor", "eval('1+1')"]) {
      const html = renderToStaticMarkup(
        <FunctionGraph expression={expression} title="Unsafe" />,
      );
      expect(html, expression).toContain(
        "The graph is not shown rather than plotting an invented function.",
      );
      expect(html, expression).not.toContain("<svg");
    }
  });

  it("renders bounded parameter controls with labels", () => {
    const html = renderToStaticMarkup(
      <FunctionGraph
        expression="a * sin(x)"
        title="Amplitude"
        parameters={[
          { name: "a", label: "Amplitude a", min: 0, max: 5, step: 0.1, defaultValue: 1 },
        ]}
      />,
    );
    expect(html).toContain("Amplitude a");
    expect(html).toContain('type="range"');
    expect(html).toContain('max="5"');
  });

  it("shows a sequence with terms, partial sums and a data table", () => {
    const html = renderToStaticMarkup(
      <SequenceVisualizer term="1 / n" title="Harmonic partial sums" />,
    );
    expect(html).toContain('data-component="SequenceVisualizer"');
    expect(html).toContain("Partial sums");
    expect(html).toContain("View values as a table");
    expect(html).toContain("does not establish that a series converges");
  });

  it("refuses a sequence term that uses an unexpected variable", () => {
    const html = renderToStaticMarkup(
      <SequenceVisualizer term="k * 2" title="Bad index" />,
    );
    expect(html).toContain("may only use the index n");
    expect(html).not.toContain("<svg");
  });

  it("steps through a derivation and lists every step as text", () => {
    const html = renderToStaticMarkup(
      <DerivationStepper
        title="Convergence proof"
        steps={[
          { expression: "S_n = \\sum_{p=0}^{n} u_p", explanation: "Definition." },
          { expression: "S_n \\le M", explanation: "Bounded." },
        ]}
      />,
    );
    expect(html).toContain('data-component="DerivationStepper"');
    expect(html).toContain("Step 1 of 2");
    expect(html).toContain("All steps as text");
    expect(html).toContain("Missing steps are not generated");
  });
});

describe("interactive programming", () => {
  it("walks through annotated lines with keyboard controls and a state panel", () => {
    const html = renderToStaticMarkup(
      <CodeWalkthrough
        title="Binary search"
        language="python"
        code={"def search(items):\n    return items[0]"}
        annotations={[
          { line: 0, explanation: "Declares the function.", state: [{ name: "items", value: "[1, 2]" }] },
          { line: 1, explanation: "Returns the first item." },
        ]}
      />,
    );
    expect(html).toContain('data-component="CodeWalkthrough"');
    expect(html).toContain("Declares the function.");
    expect(html).toContain("items");
    expect(html).toContain("[1, 2]");
    expect(html).toContain("never executed");
    expect(html).toContain('data-current-line="true"');
  });

  it("reports missing annotations instead of inventing a walkthrough", () => {
    const html = renderToStaticMarkup(
      <CodeWalkthrough title="Unannotated" language="python" code="x = 1" annotations={[]} />,
    );
    expect(html).toContain("no reviewed walkthrough annotations");
  });
});

describe("interactive engineering", () => {
  it("renders a trusted topology with keyboard-selectable elements", () => {
    const html = renderToStaticMarkup(
      <InteractiveDiagram
        title="Client to server"
        description="A validated request path."
        nodes={[
          { id: "client", label: "Client", x: 10, y: 50, kind: "client", detail: "Sends the request." },
          { id: "server", label: "Server", x: 80, y: 50, kind: "service" },
        ]}
        links={[{ from: "client", to: "server", label: "HTTPS" }]}
      />,
    );
    expect(html).toContain('data-component="InteractiveDiagram"');
    expect(html).toContain("Client");
    expect(html).toContain("Server");
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("Diagram elements and connections as text");
    expect(html).toContain("Nothing is inferred from the picture");
  });

  it("lists validated connections as text for assistive technology", () => {
    const html = renderToStaticMarkup(
      <InteractiveDiagram
        title="Topology"
        description="d"
        nodes={[
          { id: "a", label: "Router", x: 20, y: 20 },
          { id: "b", label: "Switch", x: 70, y: 20 },
        ]}
        links={[{ from: "a", to: "b" }]}
      />,
    );
    expect(html).toContain("→ Switch");
  });

  it("bounds an oversized topology instead of rendering every node", () => {
    const nodes = Array.from({ length: 120 }, (_, index) => ({
      id: `n${index}`,
      label: `Node ${index}`,
      x: index % 10 * 10,
      y: Math.floor(index / 10) * 10,
    }));
    const html = renderToStaticMarkup(
      <InteractiveDiagram title="Large" description="d" nodes={nodes} links={[]} />,
    );
    expect(html).toContain("Node 79");
    expect(html).not.toContain("Node 80");
  });
});
