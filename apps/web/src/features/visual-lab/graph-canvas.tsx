"use client";
/**
 * Weighted graph canvas: plain SVG, no new dependency.
 *
 * Layout is a deterministic circle so the same graph always draws identically
 * (no random force simulation, no layout thrash on every slider change).
 */
import {
  edgeLabel,
  type GraphTrace,
} from "@noveris/shared/visualLab/graph";
import type { WeightedGraphScenario } from "@noveris/shared/visualLab/types";

const SIZE = 360;
const PADDING = 46;
const RADIUS = (SIZE - PADDING * 2) / 2;

export function nodePositions(scenario: WeightedGraphScenario) {
  const count = scenario.nodes.length;
  return new Map(
    scenario.nodes.map((node, index) => {
      const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
      return [
        node.id,
        {
          x: SIZE / 2 + RADIUS * Math.cos(angle),
          y: SIZE / 2 + RADIUS * Math.sin(angle),
        },
      ] as const;
    }),
  );
}

export function GraphCanvas({
  scenario,
  weights,
  trace,
  step,
  path,
  start,
  target,
}: {
  scenario: WeightedGraphScenario;
  weights: number[];
  trace: GraphTrace;
  step: number;
  path: string[];
  start: string;
  target: string;
}) {
  const positions = nodePositions(scenario);
  const current = trace.steps[Math.min(step, trace.steps.length - 1)];
  const settled = new Set(current?.finalized || []);
  const onPath = new Set(path);
  const pathPairs = new Set(
    path.slice(1).map((node, index) => [path[index], node].sort().join("|")),
  );
  // Crossing edges (e.g. both diagonals of a square) share a midpoint. Slide the
  // weight label along its edge, in opposite directions, so none is hidden.
  const midpoints = scenario.edges.map((edge) => {
    const from = positions.get(edge.source);
    const to = positions.get(edge.target);
    return from && to
      ? { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
      : null;
  });
  const labelFraction = (index: number) => {
    const mid = midpoints[index];
    if (!mid) return 0.5;
    const clash = midpoints.some(
      (other, i) =>
        i !== index &&
        other &&
        Math.hypot(other.x - mid.x, other.y - mid.y) < 26,
    );
    return clash ? (index % 2 === 0 ? 0.3 : 0.7) : 0.5;
  };
  const name = (id: string) =>
    scenario.nodes.find((n) => n.id === id)?.label ?? id;

  return (
    <figure className="flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`Weighted graph with ${scenario.nodes.length} nodes and ${scenario.edges.length} edges. ${current?.explanation ?? ""}`}
        className="mx-auto w-full max-w-[420px] rounded-xl bg-muted/30"
      >
        <title>Weighted graph</title>
        {scenario.edges.map((edge, index) => {
          const from = positions.get(edge.source);
          const to = positions.get(edge.target);
          if (!from || !to) return null;
          const weight = weights[index] ?? edge.weight;
          const mine = pathPairs.has(
            [edge.source, edge.target].sort().join("|"),
          );
          const relaxed = current?.relaxations.some(
            (r) =>
              (r.from === edge.source && r.to === edge.target) ||
              (r.from === edge.target && r.to === edge.source),
          );
          const t = labelFraction(index);
          const mx = from.x + (to.x - from.x) * t;
          const my = from.y + (to.y - from.y) * t;
          return (
            <g key={`${edge.source}-${edge.target}-${index}`}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                strokeWidth={mine ? 4 : 2}
                strokeLinecap="round"
                className={
                  mine
                    ? "stroke-primary"
                    : relaxed
                      ? "stroke-chart-2"
                      : "stroke-border"
                }
              />
              <circle
                cx={mx}
                cy={my}
                r={13}
                className="fill-background stroke-border"
                strokeWidth={1}
              />
              <text
                x={mx}
                y={my + 4}
                textAnchor="middle"
                className="fill-foreground text-[11px] font-semibold"
              >
                {weight}
              </text>
            </g>
          );
        })}
        {scenario.nodes.map((node) => {
          const position = positions.get(node.id)!;
          const isCurrent = current?.current === node.id;
          const isSettled = settled.has(node.id);
          return (
            <g key={node.id}>
              <circle
                cx={position.x}
                cy={position.y}
                r={isCurrent ? 25 : 21}
                strokeWidth={isCurrent ? 3 : 2}
                className={
                  node.id === start
                    ? "fill-primary stroke-primary"
                    : node.id === target
                      ? "fill-destructive/15 stroke-destructive"
                      : onPath.has(node.id)
                        ? "fill-primary/15 stroke-primary"
                        : isSettled
                          ? "fill-muted stroke-muted-foreground/50"
                          : "fill-background stroke-border"
                }
              />
              <text
                x={position.x}
                y={position.y + 4}
                textAnchor="middle"
                className={`text-[12px] font-semibold ${
                  node.id === start
                    ? "fill-primary-foreground"
                    : "fill-foreground"
                }`}
              >
                {node.id}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">
        {scenario.edges
          .map(
            (edge, index) =>
              `${edgeLabel(edge, scenario.nodes)} weight ${weights[index] ?? edge.weight}`,
          )
          .join("; ")}
        . Start {name(start)}, destination {name(target)}.
      </figcaption>
    </figure>
  );
}
