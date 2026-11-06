"use client";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ExpressionError,
  parseExpression,
  sampleFunction,
  type ParsedExpression,
} from "./expression";

const WIDTH = 640;
const HEIGHT = 380;
const PADDING = 44;
const SAMPLES = 320;
const MAX_ZOOM = 8;
const MIN_ZOOM = 0.25;

export type GraphParameter = {
  name: string;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
};

export type FunctionGraphProps = {
  /** Restricted arithmetic expression in `variable`. Never executed as code. */
  expression: string;
  variable?: string;
  domain?: { from: number; to: number };
  parameters?: GraphParameter[];
  title: string;
  caption?: string;
  /** Trusted note about what the plot does and does not establish. */
  disclosure?: string;
};

type Viewport = { xMin: number; xMax: number; yMin: number; yMax: number };

function toPath(points: Array<{ x: number; y: number | null }>, view: Viewport): string {
  const sx = (x: number) => PADDING + ((x - view.xMin) / (view.xMax - view.xMin)) * (WIDTH - PADDING * 2);
  const sy = (y: number) => HEIGHT - PADDING - ((y - view.yMin) / (view.yMax - view.yMin)) * (HEIGHT - PADDING * 2);
  let path = "";
  let pen = false;
  for (const point of points) {
    if (point.y === null) {
      pen = false;
      continue;
    }
    // A jump larger than the viewport height is a discontinuity, not a line.
    const y = sy(point.y);
    const outside = point.y < view.yMin || point.y > view.yMax;
    if (outside) {
      pen = false;
      continue;
    }
    path += `${pen ? "L" : "M"}${sx(point.x).toFixed(2)},${y.toFixed(2)} `;
    pen = true;
  }
  return path.trim();
}

function ticks(min: number, max: number, count = 5): number[] {
  const span = max - min;
  const raw = span / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(raw) || 1)));
  const step = Math.ceil(raw / magnitude) * magnitude;
  const first = Math.ceil(min / step) * step;
  const values: number[] = [];
  for (let value = first; value <= max + step * 1e-6; value += step)
    values.push(Number(value.toFixed(10)));
  return values;
}

export function FunctionGraph({
  expression,
  variable = "x",
  domain = { from: -6, to: 6 },
  parameters = [],
  title,
  caption,
  disclosure,
}: FunctionGraphProps) {
  const id = useId();
  const [zoom, setZoom] = useState(1);
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(parameters.map((parameter) => [parameter.name, parameter.defaultValue])),
  );
  const [cursor, setCursor] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  const parsed = useMemo<{ ok: true; value: ParsedExpression } | { ok: false; message: string }>(() => {
    try {
      return { ok: true, value: parseExpression(expression) };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof ExpressionError
            ? error.message
            : "This expression cannot be plotted safely.",
      };
    }
  }, [expression]);

  const halfY = 5 / zoom;
  const view: Viewport = useMemo(
    () => ({
      xMin: domain.from,
      xMax: domain.to,
      yMin: -halfY,
      yMax: halfY,
    }),
    [domain.from, domain.to, halfY],
  );

  const points = useMemo(() => {
    if (!parsed.ok) return [];
    return sampleFunction(parsed.value, {
      variable,
      from: view.xMin,
      to: view.xMax,
      samples: SAMPLES,
      parameters: values,
      maxSamples: SAMPLES,
    });
  }, [parsed, variable, view.xMin, view.xMax, values]);

  const path = useMemo(() => (parsed.ok ? toPath(points, view) : ""), [parsed.ok, points, view]);
  const missing = points.filter((point) => point.y === null).length;

  const onPointer = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      if (!bounds.width) return;
      const ratio = (event.clientX - bounds.left) / bounds.width;
      const x = view.xMin + ratio * (view.xMax - view.xMin);
      setCursor(x);
    },
    [view.xMin, view.xMax],
  );

  const cursorValue = useMemo(() => {
    if (!parsed.ok || cursor === null) return null;
    const nearest = points.reduce<{ x: number; y: number | null } | null>((best, point) => {
      if (!best) return point;
      return Math.abs(point.x - cursor) < Math.abs(best.x - cursor) ? point : best;
    }, null);
    return nearest?.y ?? null;
  }, [parsed.ok, cursor, points]);

  const sx = (x: number) => PADDING + ((x - view.xMin) / (view.xMax - view.xMin)) * (WIDTH - PADDING * 2);
  const sy = (y: number) => HEIGHT - PADDING - ((y - view.yMin) / (view.yMax - view.yMin)) * (HEIGHT - PADDING * 2);

  const description = parsed.ok
    ? `${title}. Plot of ${expression} over ${variable} from ${view.xMin} to ${view.xMax}.${
        missing ? ` ${missing} sampled points are outside the real domain and are not plotted.` : ""
      }`
    : `${title}. The expression is not a supported mathematical formula.`;

  return (
    <figure className="rounded-xl border bg-card p-4 sm:p-5" data-component="FunctionGraph">
      <figcaption className="font-heading text-base font-semibold">{title}</figcaption>
      {caption && <p className="mt-1 text-sm leading-6 text-muted-foreground">{caption}</p>}

      {!parsed.ok ? (
        <p role="alert" className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          {parsed.message} The graph is not shown rather than plotting an invented function.
        </p>
      ) : (
        <>
          <div
            className="mt-4 overflow-hidden rounded-lg bg-background/60"
            role="img"
            aria-label={description}
          >
            <svg
              ref={svg}
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="h-auto w-full touch-none"
              aria-hidden="true"
              onPointerMove={onPointer}
              onPointerLeave={() => setCursor(null)}
            >
              {ticks(view.xMin, view.xMax).map((x) => (
                <line key={`gx${x}`} x1={sx(x)} x2={sx(x)} y1={PADDING} y2={HEIGHT - PADDING} className="stroke-border" strokeWidth="1" />
              ))}
              {ticks(view.yMin, view.yMax).map((y) => (
                <line key={`gy${y}`} x1={PADDING} x2={WIDTH - PADDING} y1={sy(y)} y2={sy(y)} className="stroke-border" strokeWidth="1" />
              ))}
              {view.yMin <= 0 && view.yMax >= 0 && (
                <line x1={PADDING} x2={WIDTH - PADDING} y1={sy(0)} y2={sy(0)} className="stroke-muted-foreground" strokeWidth="1.5" />
              )}
              {view.xMin <= 0 && view.xMax >= 0 && (
                <line x1={sx(0)} x2={sx(0)} y1={PADDING} y2={HEIGHT - PADDING} className="stroke-muted-foreground" strokeWidth="1.5" />
              )}
              {ticks(view.xMin, view.xMax).map((x) => (
                <text key={`tx${x}`} x={sx(x)} y={HEIGHT - PADDING + 16} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                  {x}
                </text>
              ))}
              {ticks(view.yMin, view.yMax).map((y) => (
                <text key={`ty${y}`} x={PADDING - 8} y={sy(y) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
                  {y}
                </text>
              ))}
              <path d={path} fill="none" className="stroke-primary" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {cursor !== null && (
                <>
                  <line x1={sx(cursor)} x2={sx(cursor)} y1={PADDING} y2={HEIGHT - PADDING} className="stroke-brand-cyan" strokeDasharray="3 3" strokeWidth="1.5" />
                  {cursorValue !== null && (
                    <circle cx={sx(cursor)} cy={sy(cursorValue)} r="4" className="fill-brand-cyan" />
                  )}
                </>
              )}
            </svg>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="tabular-nums" aria-live="polite">
              {cursor !== null
                ? cursorValue !== null
                  ? `${variable} = ${cursor.toFixed(2)}, f(${variable}) = ${cursorValue.toFixed(3)}`
                  : `${variable} = ${cursor.toFixed(2)}, outside the real domain`
                : `Point to the plot to read a value. Domain ${view.xMin} to ${view.xMax}.`}
            </span>
            <span className="flex-1" />
            <Button type="button" size="xs" variant="ghost" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.5))} aria-label="Zoom in">
              <ZoomIn />
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z / 1.5))} aria-label="Zoom out">
              <ZoomOut />
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => {
                setZoom(1);
                setValues(Object.fromEntries(parameters.map((parameter) => [parameter.name, parameter.defaultValue])));
                setCursor(null);
              }}
            >
              <RotateCcw data-icon="inline-start" /> Reset
            </Button>
          </div>

          {parameters.length > 0 && (
            <div className="mt-4 grid gap-3 border-t pt-4">
              {parameters.map((parameter) => {
                const inputId = `${id}-${parameter.name}`;
                const current = values[parameter.name] ?? parameter.defaultValue;
                return (
                  <div key={parameter.name} className="grid gap-1.5">
                    <label htmlFor={inputId} className="flex items-center justify-between text-xs font-medium">
                      <span>{parameter.label}</span>
                      <span className="tabular-nums text-muted-foreground">{current}</span>
                    </label>
                    <input
                      id={inputId}
                      type="range"
                      min={parameter.min}
                      max={parameter.max}
                      step={parameter.step}
                      value={current}
                      onChange={(event) =>
                        setValues((previous) => ({ ...previous, [parameter.name]: Number(event.target.value) }))
                      }
                      className="accent-primary h-1.5 w-full cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>
          )}

          <details className="mt-4 rounded-lg bg-muted/40 p-3 text-xs">
            <summary className="cursor-pointer font-medium">Accessible description and values</summary>
            <p className="mt-2 leading-6">{description}</p>
            <div className="mt-2 max-h-40 overflow-y-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr>
                    <th scope="col" className="border-b px-2 py-1">{variable}</th>
                    <th scope="col" className="border-b px-2 py-1">f({variable})</th>
                  </tr>
                </thead>
                <tbody>
                  {points.filter((_, index) => index % Math.ceil(points.length / 20) === 0).map((point) => (
                    <tr key={point.x}>
                      <td className="border-b px-2 py-1 tabular-nums">{point.x.toFixed(3)}</td>
                      <td className="border-b px-2 py-1 tabular-nums">
                        {point.y === null ? "not defined" : point.y.toFixed(3)}
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
        {disclosure ??
          "A plot illustrates behaviour; numerical sampling is not a proof of a limit, convergence or a theorem."}
      </p>
    </figure>
  );
}

export default FunctionGraph;
