import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  graphTrace,
  parseWeightedGraphScenario,
} from "@ednova/shared/visualLab/graph";
import {
  fallbackCandidate,
  buildStoredLab,
  toPublicLab,
} from "@ednova/shared/visualLab/definition";
import {
  decodeVisualLab,
  decodeCheckResult,
  LabContractError,
} from "./contracts";
import { GraphLab } from "./graph-lab";
import { ParameterLab } from "./parameter-lab";
import { SpatialLab } from "./spatial-lab";
import { nodePositions } from "./graph-canvas";
import { summarizeLab } from "./lab-summary";

function publicLab(
  engine:
    "weighted_graph" | "parameter_model" | "spatial_3d" = "weighted_graph",
) {
  return toPublicLab(
    buildStoredLab({
      labId: "lab_abcdef0123456789abcd",
      candidate: fallbackCandidate(engine),
      sourceContext: { mode: "topic", topic: "Test" },
      generationMode: "AI_PLANNED",
      createdAt: "2026-11-01T10:00:00.000Z",
    }),
  );
}

describe("Visual lab browser contract", () => {
  it("round-trips the server projection and never exposes the answer key", () => {
    const payload = JSON.parse(JSON.stringify(publicLab()));
    const decoded = decodeVisualLab({ lab: payload });
    expect(decoded.labId).toBe("lab_abcdef0123456789abcd");
    expect(decoded.definition.engine).toBe("weighted_graph");
    expect(decoded.check.options.length).toBeGreaterThan(1);
    expect(JSON.stringify(payload)).not.toContain("correctOptionId");
    expect(JSON.stringify(payload)).not.toContain("explanation");
  });

  it("rejects unknown engines, empty option sets and unsupported versions", () => {
    const good = JSON.parse(JSON.stringify(publicLab()));
    const reject = (mutate: (lab: Record<string, unknown>) => void) => {
      const copy = JSON.parse(JSON.stringify(good));
      mutate(copy);
      expect(() => decodeVisualLab({ lab: copy })).toThrow(LabContractError);
    };
    reject((lab) => {
      lab.definition = { engine: "react_component", scenario: {} };
    });
    reject((lab) => {
      (lab.check as { options: unknown[] }).options = [];
    });
    reject((lab) => {
      lab.schemaVersion = 2;
    });
    reject((lab) => {
      (lab.definition as { scenario: Record<string, unknown> }).scenario = {
        nodes: [{ id: "A", label: "A" }],
        edges: [{ source: "A", target: "A", weight: 1 }],
        source: "A",
        target: "A",
      };
    });
  });

  it("rejects a check result that claims to have recorded evidence", () => {
    expect(() =>
      decodeCheckResult({
        correct: true,
        correctOptionId: "correct",
        explanation: "Because.",
        recordedAsEvidence: true,
        policy: "visual_lab_practice_only",
      }),
    ).toThrow(LabContractError);
    expect(
      decodeCheckResult({
        correct: false,
        correctOptionId: "correct",
        explanation: "Because.",
        recordedAsEvidence: false,
        policy: "visual_lab_practice_only",
      }).correct,
    ).toBe(false);
  });
});

describe("Graph lab rendering", () => {
  const lab = publicLab("weighted_graph");
  if (lab.definition.engine !== "weighted_graph")
    throw new Error("wrong engine");
  const scenario = lab.definition.scenario;

  it("draws every node, edge weight and the computed learning summary", () => {
    const html = renderToStaticMarkup(<GraphLab scenario={scenario} />);
    for (const node of scenario.nodes) expect(html).toContain(`>${node.id}<`);
    for (const edge of scenario.edges)
      expect(html).toContain(`>${edge.weight}<`);
    const trace = graphTrace(scenario);
    expect(html).toContain(`Lowest cost ${trace.totalCost}`);
    expect(html).toContain("Step 0 of");
    expect(html).toContain("Previous step");
    expect(html).toContain("Next step");
    expect(html).toContain("Reset walkthrough");
    // Accessible labels exist for every control.
    expect(html).toContain('for="lab-start"');
    expect(html).toContain('for="lab-target"');
    for (const edge of scenario.edges)
      expect(html).toContain(`weight-${edge.source}-${edge.target}`);
  });

  it("lays out deterministically (no random force simulation)", () => {
    const first = nodePositions(scenario);
    const second = nodePositions(scenario);
    expect([...first.entries()]).toEqual([...second.entries()]);
    expect(first.size).toBe(scenario.nodes.length);
  });

  it("describes an unreachable destination instead of inventing a cost", () => {
    const parsed = parseWeightedGraphScenario({
      nodes: [
        { id: "A", label: "A" },
        { id: "B", label: "B" },
        { id: "C", label: "C" },
      ],
      edges: [{ source: "A", target: "B", weight: 3 }],
      source: "A",
      target: "C",
    });
    const html = renderToStaticMarkup(<GraphLab scenario={parsed} />);
    expect(html).toContain("No route");
    expect(html).toContain("unreachable");
  });

  it("shows a recoverable message for an unsupported graph", () => {
    const html = renderToStaticMarkup(
      <GraphLab
        scenario={
          {
            nodes: [{ id: "A", label: "A" }],
            edges: [],
            source: "A",
            target: "A",
          } as unknown as typeof scenario
        }
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("nodes");
  });
});

describe("Parameter lab rendering", () => {
  const lab = publicLab("parameter_model");
  if (lab.definition.engine !== "parameter_model")
    throw new Error("wrong engine");

  it("renders bounded sliders and the verified computation", () => {
    const html = renderToStaticMarkup(
      <ParameterLab scenario={lab.definition.scenario} />,
    );
    expect(html).toContain('type="range"');
    expect(html).toContain('min="0"');
    expect(html).toContain('max="200"');
    expect(html).toContain('min="0.5"');
    expect(html).toContain('max="50"');
    expect(html).toContain("5");
    expect(html).toContain("m/s²");
    expect(html).toContain("a = F / m");
    expect(html).toContain("Reset experiment");
    expect(html).toContain("aria-live");
  });

  it("renders an alert for out-of-range stored values", () => {
    const html = renderToStaticMarkup(
      <ParameterLab
        scenario={{
          modelId: "newtons_second_law",
          values: { force: 400, mass: 8 },
        }}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("must be between 0 and 200 N");
  });
});

describe("Lab summary", () => {
  it("reports the source mode honestly", () => {
    expect(summarizeLab(publicLab())).toMatchObject({
      source: "Topic example, not course material",
      engine: "weighted_graph",
    });
  });
});

describe("3D explorer", () => {
  it("round-trips through the browser decoder", () => {
    const payload = JSON.parse(JSON.stringify(publicLab("spatial_3d")));
    const decoded = decodeVisualLab({ lab: payload });
    expect(decoded.engine).toBe("spatial_3d");
    expect(JSON.stringify(decoded)).not.toContain("correctOptionId");
  });

  it("rejects an unregistered scene or out-of-range value", () => {
    const payload = JSON.parse(JSON.stringify(publicLab("spatial_3d")));
    payload.definition.scenario.sceneId = "n_body";
    expect(() => decodeVisualLab({ lab: payload })).toThrow(LabContractError);
  });

  it("renders deterministic readouts and accessible controls without WebGL", () => {
    const html = renderToStaticMarkup(
      <SpatialLab
        scenario={{
          sceneId: "projectile_3d",
          values: { speed: 20, elevation: 45, heading: 0, gravity: 10 },
        }}
      />,
    );
    expect(html).toContain("40"); // range = v² sin 2θ / g
    expect(html).toContain("10"); // peak height
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Launch");
    expect(html).toContain("Gravity presets");
  });

  it("renders an alert for out-of-range stored values", () => {
    const html = renderToStaticMarkup(
      <SpatialLab
        scenario={{
          sceneId: "projectile_3d",
          values: { speed: 20, elevation: 120, heading: 0, gravity: 10 },
        }}
      />,
    );
    expect(html).toContain('role="alert"');
  });
});
