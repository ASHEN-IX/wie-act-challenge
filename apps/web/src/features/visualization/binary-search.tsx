"use client";
import { useEffect, useState } from "react";
import {
  binarySearchTrace,
  DEFAULT_BINARY_SEARCH,
  parseBinarySearchState,
  type BinarySearchState,
} from "@study-partner/shared/visualization";
import { Button } from "@/components/ui/button";

export function BinarySearchVisualizer({
  state: externalState,
  onChange,
  readOnly = false,
  busy = false,
}: {
  state?: BinarySearchState;
  onChange?: (state: BinarySearchState) => void | Promise<void>;
  readOnly?: boolean;
  busy?: boolean;
}) {
  const [local, setLocal] = useState<BinarySearchState>(() => ({
    ...DEFAULT_BINARY_SEARCH,
    values: [...DEFAULT_BINARY_SEARCH.values],
  }));
  const [valuesInput, setValuesInput] = useState(
    DEFAULT_BINARY_SEARCH.values.join(", "),
  );
  const [targetInput, setTargetInput] = useState(
    String(DEFAULT_BINARY_SEARCH.target),
  );
  const [error, setError] = useState("");
  useEffect(() => {
    if (externalState) {
      setValuesInput(externalState.values.join(", "));
      setTargetInput(String(externalState.target));
    }
  }, [externalState]);
  let state: BinarySearchState;
  try {
    state = parseBinarySearchState(externalState || local);
  } catch {
    return (
      <p role="alert">
        This visualization state is unsupported. Use the textual reviewed
        activity instead.
      </p>
    );
  }
  const trace = binarySearchTrace(state.values, state.target),
    current = trace[state.step];
  async function change(next: BinarySearchState) {
    setError("");
    try {
      const validated = parseBinarySearchState(next);
      if (onChange) await onChange(validated);
      else setLocal(validated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Visualization unavailable");
    }
  }
  return (
    <section
      aria-label="Binary search visualization"
      data-testid="binary-search-visualizer"
      className="space-y-4 rounded-lg border p-4"
    >
      <h2 className="text-lg font-semibold">
        Binary search, one comparison at a time
      </h2>
      <p className="text-sm text-muted-foreground">
        An illustrative worked example awaiting curriculum review. This
        demonstration creates no learning evidence, mastery or XP.
      </p>
      <p>
        Target: <strong>{state.target}</strong>. Step {state.step} of{" "}
        {trace.length - 1}.
      </p>
      <ol
        aria-label="Sorted values and search interval"
        className="flex flex-wrap gap-2"
      >
        {state.values.map((value, index) => (
          <li
            key={index}
            className={`min-w-14 rounded border p-2 text-center ${
              current.foundIndex === index
                ? "border-primary bg-primary/10"
                : index >= current.low && index <= current.high
                  ? "bg-muted"
                  : "border-dashed text-muted-foreground"
            }`}
          >
            <span className="block text-xs">Index {index}</span>
            <strong className="block">{value}</strong>
            {current.foundIndex === index ? (
              <span className="text-xs">Match</span>
            ) : current.comparedIndex === index ? (
              <span className="text-xs">Compared</span>
            ) : (
              <span className="text-xs">
                {index >= current.low && index <= current.high
                  ? "Searching"
                  : "Excluded"}
              </span>
            )}
          </li>
        ))}
      </ol>
      <p role="status" aria-live="polite" aria-atomic="true">
        {current.explanation}
      </p>
      <div
        className="flex flex-wrap gap-2"
        aria-label="Visualization step controls"
      >
        <Button
          variant="outline"
          disabled={busy || readOnly || state.step === 0}
          onClick={() => void change({ ...state, step: state.step - 1 })}
        >
          Previous step
        </Button>
        <Button
          disabled={busy || readOnly || state.step === trace.length - 1}
          onClick={() => void change({ ...state, step: state.step + 1 })}
        >
          Next step
        </Button>
        <Button
          variant="outline"
          disabled={busy || readOnly || state.step === 0}
          onClick={() => void change({ ...state, step: 0 })}
        >
          Reset visualization
        </Button>
      </div>
      {readOnly ? (
        <p className="text-sm">
          The presenter controls the shared example. Your private answers remain
          separate.
        </p>
      ) : (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              !/^-?\d+(?:\s*,\s*-?\d+)*$/.test(valuesInput.trim()) ||
              !/^-?\d+$/.test(targetInput.trim())
            ) {
              setError(
                "Enter a comma-separated sorted integer list and an integer target.",
              );
              return;
            }
            void change({
              exampleId: "binary-search-v1",
              values: valuesInput.split(",").map(Number),
              target: Number(targetInput),
              step: 0,
            });
          }}
        >
          <label className="grid gap-1 text-sm">
            Sorted integer list
            <input
              aria-label="Sorted integer list"
              value={valuesInput}
              maxLength={90}
              className="rounded border bg-background p-2"
              onChange={(e) => setValuesInput(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Search target
            <input
              aria-label="Search target"
              inputMode="numeric"
              value={targetInput}
              maxLength={4}
              className="w-28 rounded border bg-background p-2"
              onChange={(e) => setTargetInput(e.target.value)}
            />
          </label>
          <Button variant="outline" type="submit" disabled={busy}>
            Apply bounded example
          </Button>
          <p className="w-full text-xs text-muted-foreground">
            Use 1–12 sorted integers from -999 to 999. Controls work with Tab
            and Enter/Space. No animation is used.
          </p>
        </form>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
