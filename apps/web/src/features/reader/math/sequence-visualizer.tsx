"use client";
import { useId, useMemo, useState } from "react";
import { ExpressionError, parseExpression, evaluateExpression } from "./expression";

const WIDTH = 640;
const HEIGHT = 300;
const PADDING = 46;
const MAX_TERMS = 120;

export type SequenceSpec = {
  /** Restricted expression in n. */
  term: string;
  title: string;
  caption?: string;
  /** First index to plot (defaults to 1). */
  from?: number;
  /** Trusted statement about the known behaviour, if the course supplies one. */
  behaviour?: string;
};

type Mode = "terms" | "partial_sums";

type Computed = {
  terms: number[];
  sums: number[];
  invalid: number;
};

function compute(term: string, from: number, count: number): Computed | { error: string } {
  let parsed;
  try {
    parsed = parseExpression(term);
  } catch (error) {
    return {
      error:
        error instanceof ExpressionError
          ? error.message
          : "This term cannot be evaluated safely.",
    };
  }
  if (parsed.variables.length && !parsed.variables.every((name) => name === "n"))
    return { error: "The term may only use the index n." };

  const terms: number[] = [];
  const sums: number[] = [];
  let running = 0;
  let invalid = 0;
  const budget = { steps: 0 };
  for (let index = 0; index < count; index += 1) {
    const n = from + index;
    const value = evaluateExpression(parsed.ast, { n }, {}, budget);
    if (value === null) {
      invalid += 1;
      terms.push(Number.NaN);
      sums.push(Number.NaN);
      continue;
    }
    running += value;
    terms.push(value);
    sums.push(running);
  }
  return { terms, sums, invalid };
}

function niceScale(min: number, max: number): { min: number; max: number } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  if (min === max) return { min: min - 1, max: max + 1 };
  const pad = (max - min) * 0.08;
  return { min: min - pad, max: max + pad };
}

export function SequenceVisualizer({ term, title, caption, from = 1, behaviour }: SequenceSpec) {
  const id = useId();
  const [mode, setMode] = useState<Mode>("partial_sums");
  const [count, setCount] = useState(24);

  const result = useMemo(() => compute(term, from, count), [term, from, count]);
  const computed = "error" in result ? null : result;

  const series = mode === "terms" ? computed?.terms ?? [] : computed?.sums ?? [];
  const finite = series.filter((value) => Number.isFinite(value));
  const scale = niceScale(Math.min(0, ...finite), Math.max(1e-9, ...finite));

  const sx = (index: number) =>
    PADDING + (index / Math.max(1, count - 1)) * (WIDTH - PADDING * 2);
  const sy = (value: number) =>
    HEIGHT - PADDING - ((value - scale.min) / (scale.max - scale.min)) * (HEIGHT - PADDING * 2);

  const label = mode === "terms" ? "Term value u(n)" : "Partial sum S(n)";
  const lastFinite = [...series].reverse().find((value) => Number.isFinite(value));

  return (
    <figure className="rounded-xl border bg-card p-4 sm:p-5" data-component="SequenceVisualizer">
      <figcaption className="font-heading text-base font-semibold">{title}</figcaption>
      {caption && <p className="mt-1 text-sm leading-6 text-muted-foreground">{caption}</p>}

      {!computed ? (
        <p role="alert" className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          {"error" in result ? result.error : "The sequence cannot be plotted."} No values are shown
          rather than inventing a series.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <div role="group" aria-label="Sequence display mode" className="flex rounded-lg border p-0.5">
              <button
                type="button"
                onClick={() => setMode("terms")}
                aria-pressed={mode === "terms"}
                className={`rounded-md px-2.5 py-1 transition-colors ${mode === "terms" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Terms
              </button>
              <button
                type="button"
                onClick={() => setMode("partial_sums")}
                aria-pressed={mode === "partial_sums"}
                className={`rounded-md px-2.5 py-1 transition-colors ${mode === "partial_sums" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Partial sums
              </button>
            </div>
            <label htmlFor={`${id}-count`} className="ml-2 text-muted-foreground">
              Terms shown
            </label>
            <input
              id={`${id}-count`}
              type="range"
              min={4}
              max={MAX_TERMS}
              step={4}
              value={count}
              onChange={(event) => setCount(Number(event.target.value))}
              className="accent-primary h-1.5 w-32 cursor-pointer"
            />
            <span className="tabular-nums text-muted-foreground">{count}</span>
          </div>

          <div
            className="mt-3 overflow-hidden rounded-lg bg-background/60"
            role="img"
            aria-label={`${title}. ${label} for n from ${from} to ${from + count - 1}.`}
          >
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" aria-hidden="true">
              {scale.min <= 0 && scale.max >= 0 && (
                <line x1={PADDING} x2={WIDTH - PADDING} y1={sy(0)} y2={sy(0)} className="stroke-muted-foreground" strokeWidth="1.5" />
              )}
              <line x1={PADDING} x2={PADDING} y1={PADDING} y2={HEIGHT - PADDING} className="stroke-border" strokeWidth="1" />
              {mode === "terms" ? (
                series.map((value, index) =>
                  Number.isFinite(value) ? (
                    <line
                      key={index}
                      x1={sx(index)}
                      x2={sx(index)}
                      y1={sy(0)}
                      y2={sy(value)}
                      className="stroke-primary"
                      strokeWidth="2"
                    />
                  ) : null,
                )
              ) : (
                <>
                  <polyline
                    fill="none"
                    className="stroke-primary"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    points={series
                      .map((value, index) =>
                        Number.isFinite(value) ? `${sx(index)},${sy(value)}` : null,
                      )
                      .filter(Boolean)
                      .join(" ")}
                  />
                  {series.map((value, index) =>
                    Number.isFinite(value) ? (
                      <circle key={index} cx={sx(index)} cy={sy(value)} r="2.5" className="fill-primary" />
                    ) : null,
                  )}
                </>
              )}
              <text x={PADDING - 8} y={PADDING + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
                {scale.max.toFixed(2)}
              </text>
              <text x={PADDING - 8} y={HEIGHT - PADDING} textAnchor="end" className="fill-muted-foreground text-[10px]">
                {scale.min.toFixed(2)}
              </text>
              <text x={WIDTH / 2} y={HEIGHT - 12} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                n
              </text>
            </svg>
          </div>

          <p className="mt-2 text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {label}: {lastFinite !== undefined ? lastFinite.toFixed(4) : "no defined value"} at n ={" "}
            {from + count - 1}
            {computed.invalid > 0 ? ` · ${computed.invalid} term(s) undefined in the real domain` : ""}
          </p>

          <details className="mt-3 rounded-lg bg-muted/40 p-3 text-xs">
            <summary className="cursor-pointer font-medium">View values as a table</summary>
            <div className="mt-2 max-h-44 overflow-y-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr>
                    <th scope="col" className="border-b px-2 py-1">n</th>
                    <th scope="col" className="border-b px-2 py-1">u(n)</th>
                    <th scope="col" className="border-b px-2 py-1">S(n)</th>
                  </tr>
                </thead>
                <tbody>
                  {computed.terms.map((value, index) => (
                    <tr key={index}>
                      <td className="border-b px-2 py-1 tabular-nums">{from + index}</td>
                      <td className="border-b px-2 py-1 tabular-nums">
                        {Number.isFinite(value) ? value.toFixed(4) : "—"}
                      </td>
                      <td className="border-b px-2 py-1 tabular-nums">
                        {Number.isFinite(computed.sums[index]) ? computed.sums[index].toFixed(4) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}

      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {behaviour ??
          "A finite plot shows sampled terms only. It does not establish that a series converges."}
      </p>
    </figure>
  );
}

export default SequenceVisualizer;
