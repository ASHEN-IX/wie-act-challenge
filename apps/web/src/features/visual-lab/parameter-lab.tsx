"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  getParameterModel,
  parameterOutput,
  parseParameterScenario,
} from "@noveris/shared/visualLab/parameter-models";
import type { ParameterScenario } from "@noveris/shared/visualLab/types";

const BAR_MAX = 200;
const round = (value: number) => Math.round(value * 100) / 100;

export function ParameterLab({
  scenario,
  onStateChange,
}: {
  scenario: ParameterScenario;
  onStateChange?: (state: unknown) => void;
}) {
  const parsed = useMemo(() => {
    try {
      return { scenario: parseParameterScenario(scenario), error: "" };
    } catch (error) {
      return {
        scenario: null,
        error:
          error instanceof Error ? error.message : "Unsupported experiment.",
      };
    }
  }, [scenario]);

  const [error, setError] = useState("");

  if (!parsed.scenario)
    return (
      <p role="alert">{parsed.error || "This lab could not be displayed."}</p>
    );
  const model = getParameterModel(parsed.scenario.modelId);
  return (
    <ParameterExperiment
      model={model}
      initial={parsed.scenario.values}
      onStateChange={onStateChange}
      error={error}
      setError={setError}
    />
  );
}

function ParameterExperiment({
  model,
  initial,
  onStateChange,
  error,
  setError,
}: {
  model: ReturnType<typeof getParameterModel>;
  initial: { force: number; mass: number };
  onStateChange?: (state: unknown) => void;
  error: string;
  setError: (value: string) => void;
}) {
  const [values, setValues] = useState(initial);

  let output: { acceleration: number } | null = null;
  try {
    output = parameterOutput({ modelId: model.id, values }).output;
  } catch {
    output = null;
  }
  const acceleration = output?.acceleration ?? 0;
  const barWidth = Math.min(100, (acceleration / BAR_MAX) * 100);

  function update(key: "force" | "mass", next: number) {
    const spec = model.parameters.find((p) => p.key === key)!;
    if (!Number.isFinite(next) || next < spec.min || next > spec.max) {
      setError(
        `${spec.label} must be between ${spec.min} and ${spec.max} ${spec.unit}.`,
      );
      setValues({ ...values, [key]: next });
      return;
    }
    setError("");
    const nextValues = { ...values, [key]: next };
    setValues(nextValues);
    try {
      const computed = parameterOutput({
        modelId: model.id,
        values: nextValues,
      });
      onStateChange?.({
        modelId: model.id,
        formula: model.output.formula,
        values: nextValues,
        acceleration: computed.output.acceleration,
      });
    } catch {
      /* the boundary message above is the feedback */
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-5">
        {model.parameters.map((spec) => {
          const id = `param-${spec.key}`;
          return (
            <div key={spec.key} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Label htmlFor={id}>{spec.label}</Label>
                <span className="font-mono text-sm">
                  {round(values[spec.key])} {spec.unit}
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

      <section
        aria-label="Computed acceleration"
        aria-live="polite"
        className="flex flex-col gap-3 rounded-lg border p-4"
      >
        <p className="font-mono text-sm text-muted-foreground">
          {model.output.formula}
        </p>
        <p className="text-3xl font-semibold tabular-nums">
          {round(acceleration)}{" "}
          <span className="text-base font-normal text-muted-foreground">
            {model.output.unit}
          </span>
        </p>
        <div
          className="h-3 w-full overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={`Acceleration ${round(acceleration)} ${model.output.unit}`}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none"
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {round(values.force)} N applied to {round(values.mass)} kg gives{" "}
          {round(acceleration)} m/s².
        </p>
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setError("");
              setValues({ ...model.defaults });
              onStateChange?.({
                modelId: model.id,
                formula: model.output.formula,
                values: { ...model.defaults },
                acceleration: parameterOutput({
                  modelId: model.id,
                  values: { ...model.defaults },
                }).output.acceleration,
              });
            }}
          >
            Reset experiment
          </Button>
        </div>
      </section>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
