"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, Image as ImageIcon, ImageOff, LineChart } from "lucide-react";
import type { LessonBlockV2 } from "@ednova/shared/ednova/learningDocumentV2";
import { tokenizeCode } from "../code-highlight";

type CodeBlock = Extract<LessonBlockV2, { type: "code" }>;
type TableBlock = Extract<LessonBlockV2, { type: "table" }>;
type MediaBlock = Extract<LessonBlockV2, { type: "media" }>;
type DiagramBlock = Extract<LessonBlockV2, { type: "diagram" }>;
type ChartBlock = Extract<LessonBlockV2, { type: "chart" }>;

/** Exact source code with syntax highlighting. Whitespace is preserved
 * character for character; nothing is executed. */
export function CodeViewer({ block }: { block: CodeBlock }) {
  const [copied, setCopied] = useState(false);
  const lines = block.code.split("\n");
  return (
    <figure className="my-6 overflow-hidden rounded-xl border bg-slate-950 text-slate-100 dark:bg-black">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
        <span className="text-xs font-medium text-slate-300">{block.language || "text"}</span>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={() =>
            navigator.clipboard
              ?.writeText(block.code)
              .then(() => setCopied(true))
              .catch(() => {})
          }
          aria-label="Copy code to clipboard"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <pre className="min-w-max p-4 text-left text-sm leading-6">
          <code dir="ltr">
            {lines.map((line, index) => (
              <span key={index} className="block">
                <span aria-hidden="true" className="mr-4 inline-block w-8 select-none text-right text-slate-500">
                  {index + 1}
                </span>
                {tokenizeCode(line, block.language).map((token, tokenIndex) => (
                  <span key={tokenIndex} className={token.className}>
                    {token.text}
                  </span>
                ))}
                {line === "" ? " " : null}
              </span>
            ))}
          </code>
        </pre>
      </div>
      {block.caption && (
        <figcaption className="border-t border-white/10 px-4 py-2 text-xs text-slate-300">
          {block.caption}
        </figcaption>
      )}
    </figure>
  );
}

export function EducationalTable({ block }: { block: TableBlock }) {
  return (
    <figure className="my-6 overflow-hidden rounded-xl border">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          {block.caption && (
            <caption className="border-b px-4 py-3 text-left font-medium">{block.caption}</caption>
          )}
          <thead className="bg-muted/60">
            <tr>
              {block.columns.map((column, index) => (
                <th key={index} scope="col" className="border-b px-4 py-3 font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b last:border-0">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-3 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

export function FigureViewer({ block }: { block: MediaBlock }) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  // A non-image response (error JSON, expired authorization) must not leave a
  // broken-image icon where a figure belongs.
  const checkDecoded = () => {
    const node = imgRef.current;
    if (node && node.complete && node.naturalWidth === 0) setFailed(true);
  };
  useEffect(() => {
    checkDecoded();
  }, [block.src]);
  if (failed)
    return (
      <figure className="my-6 rounded-xl border border-dashed bg-muted/15 p-5">
        {block.caption && (
          <figcaption className="mb-2 text-sm leading-6 text-foreground/85">{block.caption}</figcaption>
        )}
        <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
          <ImageOff className="size-4 shrink-0" />
          The source figure could not be loaded. {block.alt}
        </p>
      </figure>
    );
  if (!block.src)
    return (
      <figure className="my-6 rounded-xl border border-dashed bg-muted/15 p-5">
        {block.caption && (
          <figcaption className="mb-2 text-sm leading-6 text-foreground/85">{block.caption}</figcaption>
        )}
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ImageIcon className="size-4 shrink-0" />
          {block.alt} · the source asset is not attached to this revision
        </p>
      </figure>
    );
  // Only server-authorized API paths can reach this component.
  if (!block.src.startsWith("/api/v1/"))
    return (
      <div role="alert" className="my-6 rounded-xl border p-5 text-sm">
        This media source is unavailable.
      </div>
    );
  if (block.mediaType === "audio")
    return (
      <figure className="my-6 space-y-2 rounded-xl border p-4">
        <audio controls src={block.src} className="w-full" />
        <figcaption className="text-xs text-muted-foreground">{block.alt}</figcaption>
      </figure>
    );
  if (block.mediaType === "video")
    return (
      <figure className="my-6 space-y-2">
        <video controls src={block.src} aria-label={block.alt} className="w-full rounded-xl border" />
        {block.caption && <figcaption className="text-xs text-muted-foreground">{block.caption}</figcaption>}
      </figure>
    );
  return (
    <figure className="my-6 space-y-2">
      <img
        ref={imgRef}
        src={block.src}
        alt={block.alt}
        loading="lazy"
        decoding="async"
        className="mx-auto max-h-[34rem] w-full rounded-xl border bg-white object-contain"
        onError={() => setFailed(true)}
        onLoad={checkDecoded}
      />
      {block.caption && (
        <figcaption className="text-center text-xs text-muted-foreground">{block.caption}</figcaption>
      )}
    </figure>
  );
}

/** Validated process steps. The step list is structure the source carries, so
 * it renders as an ordered walkthrough rather than an inferred diagram. */
export function ProcessDiagram({ block }: { block: DiagramBlock }) {
  return (
    <figure className="my-6 rounded-xl border bg-card p-5">
      <figcaption className="font-heading text-base font-semibold">{block.title}</figcaption>
      {block.description && (
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{block.description}</p>
      )}
      <ol className="mt-4 space-y-3">
        {block.steps.map((step, index) => (
          <li key={step.id} className="flex gap-3">
            {/* The step number is text, not decoration: it must meet the text
                contrast threshold, so it uses the lighter violet token. */}
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-brand-violet/35 bg-brand-violet/15 text-xs font-semibold text-brand-violet-soft">
              {index + 1}
            </span>
            <span>
              <span className="block text-sm font-medium">{step.label}</span>
              {step.detail && (
                <span className="mt-0.5 block text-sm leading-6 text-muted-foreground">{step.detail}</span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

export function DataChart({ block }: { block: ChartBlock }) {
  const allValues = block.series.flatMap((series) => series.values);
  const min = Math.min(0, ...allValues);
  const max = Math.max(1, ...allValues);
  const span = Math.max(1, max - min);
  const lineColors = ["stroke-primary", "stroke-emerald-500", "stroke-amber-500"];
  const barColors = ["bg-primary", "bg-emerald-500", "bg-amber-500"];
  const description = `${block.title}: ${block.series
    .map((series) => `${series.label}, ${series.values.join(", ")}`)
    .join("; ")}`;
  const pointX = (index: number) =>
    block.categories.length === 1 ? 320 : 44 + (index / (block.categories.length - 1)) * 552;
  const pointY = (value: number) => 18 + ((max - value) / span) * 174;

  return (
    <figure className="my-6 rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2">
        <LineChart className="size-4 text-primary" />
        <figcaption className="font-semibold">{block.title}</figcaption>
      </div>
      {block.caption && <p className="mt-1 text-sm text-muted-foreground">{block.caption}</p>}
      <div role="img" aria-label={description} className="mt-5">
        {block.kind === "line" ? (
          <div>
            <svg viewBox="0 0 640 230" className="h-auto w-full" aria-hidden="true">
              {[0, 0.5, 1].map((fraction) => (
                <line
                  key={fraction}
                  x1="44"
                  x2="596"
                  y1={18 + fraction * 174}
                  y2={18 + fraction * 174}
                  className="stroke-border"
                  strokeDasharray="3 4"
                />
              ))}
              {block.series.map((series, seriesIndex) => (
                <g key={series.label}>
                  <polyline
                    fill="none"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={lineColors[seriesIndex % lineColors.length]}
                    points={series.values.map((value, index) => `${pointX(index)},${pointY(value)}`).join(" ")}
                  />
                  {series.values.map((value, index) => (
                    <circle
                      key={index}
                      cx={pointX(index)}
                      cy={pointY(value)}
                      r="3.5"
                      className={`${lineColors[seriesIndex % lineColors.length]} fill-background`}
                      strokeWidth="2"
                    />
                  ))}
                </g>
              ))}
              {block.categories.map((category, index) => (
                <text
                  key={category}
                  x={pointX(index)}
                  y="216"
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {category}
                </text>
              ))}
            </svg>
          </div>
        ) : (
          <div className="space-y-4">
            {block.categories.map((category, categoryIndex) => (
              <div key={category}>
                <div className="mb-1 text-xs font-medium">{category}</div>
                <div className="space-y-1">
                  {block.series.map((series, seriesIndex) => {
                    const value = series.values[categoryIndex] ?? 0;
                    const width = Math.max(0, Math.min(100, ((value - min) / span) * 100));
                    return (
                      <div key={series.label} className="flex items-center gap-2 text-xs">
                        <span className="w-20 shrink-0 truncate text-muted-foreground">{series.label}</span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${barColors[seriesIndex % barColors.length]}`}
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <span className="w-12 text-right tabular-nums">{value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <details className="mt-4 rounded-lg bg-muted/45 p-3 text-xs">
        <summary className="cursor-pointer font-medium">View data table</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th scope="col" className="border-b px-2 py-1">Category</th>
                {block.series.map((series) => (
                  <th key={series.label} scope="col" className="border-b px-2 py-1">
                    {series.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.categories.map((category, index) => (
                <tr key={category}>
                  <th scope="row" className="border-b px-2 py-1 font-normal">
                    {category}
                  </th>
                  {block.series.map((series) => (
                    <td key={series.label} className="border-b px-2 py-1 tabular-nums">
                      {series.values[index]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
