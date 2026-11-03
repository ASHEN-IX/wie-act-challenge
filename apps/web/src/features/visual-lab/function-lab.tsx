"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  QUADRATIC_FUNCTION,
  parseFunctionScenario,
  quadraticCurve,
  quadraticOutput,
  type QuadraticValues,
} from "@ednova/shared/visualLab/function-models";
import type { FunctionScenario } from "@ednova/shared/visualLab/types";

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

// Fixed window so moving a coefficient visibly moves the curve.
const X_MIN = -10;
const X_MAX = 10;
const Y_MIN = -20;
const Y_MAX = 20;
const W = 480;
const H = 320;
const px = (x: number) => ((x - X_MIN) / (X_MAX - X_MIN)) * W;
const py = (y: number) => H - ((y - Y_MIN) / (Y_MAX - Y_MIN)) * H;

export function FunctionLab({
  scenario,
  onStateChange,
}: {
  scenario: FunctionScenario;
  onStateChange?: (state: unknown) => void;
}) {
  const parsed = useMemo(() => {
    try {
      return { scenario: parseFunctionScenario(scenario), error: "" };
    } catch (error) {
      return {
        scenario: null,
        error: error instanceof Error ? error.message : "Unsupported function.",
      };
    }
  }, [scenario]);
  const [values, setValues] = useState<QuadraticValues>(
    () => parsed.scenario?.values ?? { ...QUADRATIC_FUNCTION.defaults },
  );
  const [error, setError] = useState("");

  if (!parsed.scenario)
    return (
      <p role="alert">{parsed.error || "This lab could not be displayed."}</p>
    );

  const output = quadraticOutput(values);
  // Every sample is drawn; the clip path hides what leaves the window.
  const path = quadraticCurve(values, X_MIN, X_MAX)
    .map((p, index) => `${index === 0 ? "M" : "L"}${px(p.x)},${py(p.y)}`)
    .join(" ");

  function update(key: keyof QuadraticValues, next: number) {
    const spec = QUADRATIC_FUNCTION.parameters.find((p) => p.key === key)!;
    if (!Number.isFinite(next) || next < spec.min || next > spec.max) {
      setError(`${spec.label} must be between ${spec.min} and ${spec.max}.`);
      return;
    }
    if (key === "a" && next === 0) {
      setError("a cannot be 0 — that would be a straight line, not a parabola.");
      return;
    }
    setError("");
    const nextValues = { ...values, [key]: next };
    setValues(nextValues);
    onStateChange?.(nextValues);
  }

  function reset() {
    setError("");
    setValues({ ...QUADRATIC_FUNCTION.defaults });
    onStateChange?.({ ...QUADRATIC_FUNCTION.defaults });
  }

  const vertexVisible =
    output.vertex.y >= Y_MIN && output.vertex.y <= Y_MAX;

  return (
    <div className="flex flex-col gap-6">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Graph of y = ${values.a}x² + ${values.b}x + ${values.c}`}
        className="w-full max-w-xl self-center rounded-xl border bg-background"
        data-testid="function-plot"
      >
        <line x1={0} x2={W} y1={py(0)} y2={py(0)} className="stroke-muted-foreground/50" />
        <line x1={px(0)} x2={px(0)} y1={0} y2={H} className="stroke-muted-foreground/50" />
        <defs>
          <clipPath id="function-window">
            <rect x={0} y={0} width={W} height={H} />
          </clipPath>
        </defs>
        <path
          d={path}
          fill="none"
          strokeWidth={2.5}
          clipPath="url(#function-window)"
          className="stroke-primary"
        />
        {output.roots.map((r) => (
          <circle key={r} cx={px(r)} cy={py(0)} r={5} className="fill-destructive" />
        ))}
        {vertexVisible && (
          <circle cx={px(output.vertex.x)} cy={py(output.vertex.y)} r={5} className="fill-foreground" />
        )}
        <circle cx={px(0)} cy={py(values.c)} r={4} className="fill-primary" />
      </svg>
      <p className="text-center text-xs text-muted-foreground">
        Window x ∈ [{X_MIN}, {X_MAX}], y ∈ [{Y_MIN}, {Y_MAX}] · dark dot = vertex · red = x-axis crossings
      </p>

      <div className="grid gap-5 sm:grid-cols-3">
        {QUADRATIC_FUNCTION.parameters.map((spec) => {
          const id = `function-${spec.key}`;
          return (
            <div key={spec.key} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor={id}>{spec.label}</Label>
                <span className="font-mono text-sm">{round(values[spec.key], 1)}</span>
              </div>
              <input
                id={id}
                type="range"
                min={spec.min}
                max={spec.max}
                step={spec.step}
                value={values[spec.key]}
                onChange={(event) => update(spec.key, Number(event.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                aria-describedby={`${id}-hint`}
              />
              <p id={`${id}-hint`} className="text-xs text-muted-foreground">
                {spec.description}.
              </p>
            </div>
          );
        })}
      </div>
      <div>
        <Button size="sm" variant="outline" onClick={reset}>
          Reset experiment
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <section
        aria-label="Computed curve"
        aria-live="polite"
        className="grid gap-4 rounded-lg border p-4 sm:grid-cols-3"
      >
        <Readout
          label="Vertex"
          value={`(${round(output.vertex.x)}, ${round(output.vertex.y)})`}
          formula="x = −b / 2a"
        />
        <Readout
          label="Real roots"
          value={
            output.roots.length
              ? output.roots.map((r) => round(r)).join(", ")
              : "none"
          }
          formula="b² − 4ac = "
          suffix={String(round(output.discriminant))}
        />
        <Readout label="Y-intercept" value={String(round(output.yIntercept))} formula="y at x = 0" />
        <p className="text-sm text-muted-foreground sm:col-span-3">
          The parabola opens {output.opensUp ? "upward" : "downward"}.
          {output.roots.length === 0
            ? " It never reaches the x-axis because the discriminant is negative."
            : output.roots.length === 1
              ? " It just touches the x-axis at its vertex."
              : " It crosses the x-axis twice."}
        </p>
      </section>
    </div>
  );
}

function Readout({
  label,
  value,
  formula,
  suffix = "",
}: {
  label: string;
  value: string;
  formula: string;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      <span className="font-mono text-xs text-muted-foreground">
        {formula}
        {suffix}
      </span>
    </div>
  );
}
