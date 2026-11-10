"use client";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  PROJECTILE_3D,
  niceExtent,
  parseSpatialScenario,
  projectileOutput,
  type ProjectileValues,
} from "@noveris/shared/visualLab/spatial-models";
import type { SpatialScenario } from "@noveris/shared/visualLab/types";

// WebGL only exists in the browser; the readouts below work without it.
const SpatialScene = dynamic(() => import("./spatial-scene"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-sm text-muted-foreground">
      Loading the 3D view…
    </div>
  ),
});

const GRAVITY_PRESETS = [
  { label: "Moon", value: 1.6 },
  { label: "Mars", value: 3.7 },
  { label: "Earth", value: 9.8 },
  { label: "Jupiter", value: 24.8 },
] as const;

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export function SpatialLab({
  scenario,
  onStateChange,
}: {
  scenario: SpatialScenario;
  onStateChange?: (state: unknown) => void;
}) {
  const parsed = useMemo(() => {
    try {
      return { scenario: parseSpatialScenario(scenario), error: "" };
    } catch (error) {
      return {
        scenario: null,
        error: error instanceof Error ? error.message : "Unsupported scene.",
      };
    }
  }, [scenario]);
  const [values, setValues] = useState<ProjectileValues>(
    () => parsed.scenario?.values ?? { ...PROJECTILE_3D.defaults },
  );
  const [runId, setRunId] = useState(0);
  const [error, setError] = useState("");
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

  if (!parsed.scenario)
    return (
      <p role="alert">{parsed.error || "This lab could not be displayed."}</p>
    );

  const output = projectileOutput(values);
  const extent = niceExtent(Math.max(output.range, output.maxHeight * 1.5));

  function update(key: keyof ProjectileValues, next: number) {
    const spec = PROJECTILE_3D.parameters.find((p) => p.key === key)!;
    if (!Number.isFinite(next) || next < spec.min || next > spec.max) {
      setError(
        `${spec.label} must be between ${spec.min} and ${spec.max} ${spec.unit}.`,
      );
      return;
    }
    setError("");
    const nextValues = { ...values, [key]: next };
    setValues(nextValues);
    onStateChange?.(nextValues);
  }

  function reset() {
    setError("");
    setValues({ ...PROJECTILE_3D.defaults });
    onStateChange?.({ ...PROJECTILE_3D.defaults });
    setRunId((id) => id + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        className="relative h-[320px] overflow-hidden rounded-xl border sm:h-[420px]"
        data-testid="spatial-canvas"
      >
        <SpatialScene
          values={values}
          runId={runId}
          reduceMotion={reduceMotion}
        />
        <p className="pointer-events-none absolute bottom-2 left-3 rounded bg-background/80 px-2 py-0.5 text-xs text-muted-foreground">
          Each grid square = {round(extent / 8, 1)} m · drag to orbit
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setRunId((id) => id + 1)}>
          Launch
        </Button>
        <Button size="sm" variant="ghost" onClick={reset}>
          Reset experiment
        </Button>
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Gravity presets"
        >
          {GRAVITY_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              size="xs"
              variant={
                values.gravity === preset.value ? "secondary" : "outline"
              }
              aria-pressed={values.gravity === preset.value}
              onClick={() => update("gravity", preset.value)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {PROJECTILE_3D.parameters.map((spec) => {
          const id = `spatial-${spec.key}`;
          return (
            <div key={spec.key} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Label htmlFor={id}>{spec.label}</Label>
                <span className="font-mono text-sm">
                  {round(values[spec.key], 1)} {spec.unit}
                </span>
              </div>
              <input
                id={id}
                type="range"
                min={spec.min}
                max={spec.max}
                step={spec.step}
                value={values[spec.key]}
                onChange={(event) =>
                  update(spec.key, Number(event.target.value))
                }
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                aria-describedby={`${id}-hint`}
              />
              <p id={`${id}-hint`} className="text-xs text-muted-foreground">
                {spec.description}. Range {spec.min}–{spec.max} {spec.unit}.
              </p>
            </div>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <section
        aria-label="Computed trajectory"
        aria-live="polite"
        className="grid gap-4 rounded-lg border p-4 sm:grid-cols-3"
      >
        <Readout
          label="Range"
          value={round(output.range)}
          unit="m"
          formula="v² sin 2θ / g"
        />
        <Readout
          label="Peak height"
          value={round(output.maxHeight)}
          unit="m"
          formula="v² sin² θ / 2g"
        />
        <Readout
          label="Flight time"
          value={round(output.timeOfFlight)}
          unit="s"
          formula="2 v sin θ / g"
        />
        <p className="text-sm text-muted-foreground sm:col-span-3">
          Launched at {round(values.speed, 1)} m/s, {round(values.elevation, 1)}
          ° up, heading {round(values.heading, 1)}°, it lands{" "}
          {round(output.landing.x)} m east and {round(output.landing.z)} m south
          of the launch point. Ideal projectile: no air resistance.
        </p>
      </section>
    </div>
  );
}

function Readout({
  label,
  value,
  unit,
  formula,
}: {
  label: string;
  value: number;
  unit: string;
  formula: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-2xl font-semibold tabular-nums">
        {value}{" "}
        <span className="text-sm font-normal text-muted-foreground">
          {unit}
        </span>
      </span>
      <span className="font-mono text-xs text-muted-foreground">{formula}</span>
    </div>
  );
}
