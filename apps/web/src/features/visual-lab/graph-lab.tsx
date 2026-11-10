"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  graphTrace,
  parseWeightedGraphScenario,
} from "@noveris/shared/visualLab/graph";
import {
  VISUAL_LAB_LIMITS,
  type WeightedGraphScenario,
} from "@noveris/shared/visualLab/types";
import { GraphCanvas } from "./graph-canvas";

const name = (scenario: WeightedGraphScenario, id: string) =>
  scenario.nodes.find((n) => n.id === id)?.label ?? id;

export function GraphLab({
  scenario,
  onStateChange,
}: {
  scenario: WeightedGraphScenario;
  onStateChange?: (state: unknown) => void;
}) {
  const parsed = useMemo(() => {
    try {
      return { scenario: parseWeightedGraphScenario(scenario), error: "" };
    } catch (error) {
      return {
        scenario: null,
        error: error instanceof Error ? error.message : "Unsupported graph.",
      };
    }
  }, [scenario]);

  const [weights, setWeights] = useState<number[]>(
    () => parsed.scenario?.edges.map((edge) => edge.weight) ?? [],
  );
  const [start, setStart] = useState(parsed.scenario?.source ?? "");
  const [target, setTarget] = useState(parsed.scenario?.target ?? "");
  const [step, setStep] = useState(0);

  if (!parsed.scenario)
    return (
      <p role="alert">{parsed.error || "This lab could not be displayed."}</p>
    );
  const base = parsed.scenario;

  const edited: WeightedGraphScenario = {
    ...base,
    edges: base.edges.map((edge, index) => ({
      ...edge,
      weight: weights[index] ?? edge.weight,
    })),
  };
  let trace = graphTrace(edited);
  let error = "";
  if (start === target) {
    // Keep the last valid trace visible; the message is actionable.
    error = "The start and destination must be different nodes.";
    trace = graphTrace({
      ...edited,
      source: edited.source,
      target: edited.target,
    });
  } else {
    try {
      trace = graphTrace({ ...edited, source: start, target });
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Unsupported graph.";
      trace = graphTrace(edited);
    }
  }

  const current = trace.steps[Math.min(step, trace.steps.length - 1)];
  const path = trace.path;
  const maxStep = trace.steps.length - 1;

  function publish(
    nextWeights: number[],
    nextStart: string,
    nextTarget: string,
  ) {
    try {
      graphTrace({
        ...base,
        edges: base.edges.map((edge, index) => ({
          ...edge,
          weight: nextWeights[index] ?? edge.weight,
        })),
        source: nextStart,
        target: nextTarget,
      });
      onStateChange?.(
        base.edges.map((edge, index) => nextWeights[index] ?? edge.weight),
      );
    } catch {
      /* invalid intermediate state: the visible message explains it */
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <GraphCanvas
        scenario={edited}
        weights={weights}
        trace={trace}
        step={step}
        path={path}
        start={start}
        target={target}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="lab-start">Start node</Label>
          <select
            id="lab-start"
            value={start}
            onChange={(event) => {
              setStart(event.target.value);
              setStep(0);
              publish(weights, event.target.value, target);
            }}
            className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            {base.nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="lab-target">Destination</Label>
          <select
            id="lab-target"
            value={target}
            onChange={(event) => {
              setTarget(event.target.value);
              setStep(0);
              publish(weights, start, event.target.value);
            }}
            className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            {base.nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">Edge weights</legend>
        <p className="text-sm text-muted-foreground">
          Weights are whole numbers from {VISUAL_LAB_LIMITS.weight.min} to{" "}
          {VISUAL_LAB_LIMITS.weight.max}. Changing one resets the walkthrough.
        </p>
        {base.edges.map((edge, index) => {
          const id = `weight-${edge.source}-${edge.target}-${index}`;
          return (
            <div key={id} className="flex flex-wrap items-center gap-3">
              <Label htmlFor={id} className="min-w-40 flex-1 font-normal">
                {name(edited, edge.source)} ↔ {name(edited, edge.target)}
              </Label>
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={VISUAL_LAB_LIMITS.weight.min}
                max={VISUAL_LAB_LIMITS.weight.max}
                step={1}
                value={weights[index] ?? edge.weight}
                className="w-24"
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setStep(0);
                  if (
                    !Number.isInteger(value) ||
                    value < VISUAL_LAB_LIMITS.weight.min ||
                    value > VISUAL_LAB_LIMITS.weight.max
                  ) {
                    setWeights((all) =>
                      all.map((currentValue, i) =>
                        i === index ? value : currentValue,
                      ),
                    );
                    return;
                  }
                  const next = weights.map((currentValue, i) =>
                    i === index ? value : currentValue,
                  );
                  setWeights(next);
                  publish(next, start, target);
                }}
              />
            </div>
          );
        })}
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <section
        aria-label="Algorithm walkthrough"
        aria-live="polite"
        className="flex flex-col gap-3 rounded-lg border p-4"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            Step {Math.min(step, maxStep)} of {maxStep}
          </Badge>
          {trace.totalCost === null ? (
            <Badge variant="destructive">No route</Badge>
          ) : (
            <Badge>
              Lowest cost {trace.totalCost}
              {path.length ? ` · ${path.join(" → ")}` : ""}
            </Badge>
          )}
        </div>
        <p className="text-sm leading-6">{current?.explanation}</p>
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          {Object.entries(current?.distances || {}).map(([id, distance]) => (
            <div key={id} className="rounded-md bg-muted/50 px-2 py-1">
              <dt className="text-xs text-muted-foreground">
                {name(edited, id)}
              </dt>
              <dd className="font-medium">
                {distance === null ? "unreachable" : distance}
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={step === 0}
            onClick={() => setStep(step - 1)}
          >
            Previous step
          </Button>
          <Button
            size="sm"
            disabled={step >= maxStep}
            onClick={() => setStep(step + 1)}
          >
            Next step
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setStep(0)}>
            Reset walkthrough
          </Button>
        </div>
      </section>
    </div>
  );
}
