"use client";
import {
  Component,
  Suspense,
  lazy,
  useId,
  useState,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from "react";
import type {
  LessonBlockV2,
} from "@ednova/shared/ednova/learningDocumentV2";
import { AlertCircle, ChevronDown, Image as ImageIcon, LineChart, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tokenizeCode } from "./code-highlight";

const MathContent = lazy(() => import("./math-content"));

export type ReaderContext = {
  title: string;
  revisionId: string;
  onSource?: (block: Extract<LessonBlockV2, { type: "paragraph" | "list" | "quote" | "table" | "callout" | "math" }>) => void;
  mathCropHref?: (block: Extract<LessonBlockV2, { type: "math" }>) => string | undefined;
  mappings?: Map<string, { status: "exact" | "inferred_review_required" | "unmapped"; topicId: string | null }>;
};

function FormulaSourceFallback({ block, href }: { block: Extract<LessonBlockV2, { type: "math" }>; href?: string }) {
  const [failed, setFailed] = useState(false);
  return <figure className="space-y-3 rounded-lg border p-4">
    <figcaption className="text-sm text-muted-foreground">Original equation image. Automatic transcription is unverified. The crop may omit nearby material; inspect the original PDF.</figcaption>
    {href && !failed ? <img src={href} alt={`Original equation from PDF${block.sourceMeta?.page ? `, page ${block.sourceMeta.page}` : ""}. Extracted text is available below.`} loading="lazy" decoding="async" className="max-h-96 max-w-full rounded bg-white object-contain" onError={() => setFailed(true)} /> : <p role="status" className="text-sm">Equation image unavailable. Inspect the original document or the extracted text below.</p>}
    <details><summary className="cursor-pointer text-sm">Original extracted text (unverified)</summary><pre className="mt-2 whitespace-pre-wrap break-words text-sm">{block.expression}</pre></details>
  </figure>;
}

function LoadingBlock() {
  return (
    <div role="status" className="my-6 flex items-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" /> Preparing this content…
    </div>
  );
}

class BlockBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Component diagnostics stay local. Do not show source or runtime details.
  }
  render() {
    if (this.state.failed)
      return (
        <div role="alert" className="my-5 flex gap-2 rounded-lg border p-4 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          This item cannot be displayed. The original source remains available.
        </div>
      );
    return this.props.children;
  }
}

function SourceAction({
  evidence,
  onSource,
  block,
}: {
  evidence: string[];
  onSource?: ReaderContext["onSource"];
  block: Extract<LessonBlockV2, { type: "paragraph" | "list" | "quote" | "table" | "callout" }>;
}) {
  if (block.sourceMeta?.reviewRequired)
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
        <span>Source extraction needs review{block.sourceMeta.page ? ` · page ${block.sourceMeta.page}` : ""}.</span>
        {evidence.length > 0 && onSource && (
          <Button type="button" variant="ghost" size="xs" onClick={() => onSource(block)}>
            Inspect source
          </Button>
        )}
      </div>
    );
  if (!evidence.length || !onSource) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="mt-1 text-muted-foreground"
      onClick={() => onSource(block)}
    >
      View source
    </Button>
  );
}

function Heading({ block }: { block: Extract<LessonBlockV2, { type: "heading" }> }) {
  const Tag = (`h${Math.min(4, block.level + 1)}` as "h2" | "h3" | "h4");
  return (
    <Tag id={block.id} className="scroll-mt-24 pt-4 font-heading text-xl font-semibold tracking-tight text-foreground">
      {block.text}
    </Tag>
  );
}

function Paragraph({ block, context }: { block: Extract<LessonBlockV2, { type: "paragraph" }>; context: ReaderContext }) {
  return (
    <div>
      <p className="whitespace-pre-wrap text-[1.02rem] leading-8 text-foreground/90">{block.text}</p>
      <SourceAction block={block} evidence={block.evidence} onSource={context.onSource} />
    </div>
  );
}

function List({ block, context }: { block: Extract<LessonBlockV2, { type: "list" }>; context: ReaderContext }) {
  const Tag = block.ordered ? "ol" : "ul";
  return (
    <div>
      <Tag className={block.ordered ? "list-decimal space-y-2 pl-6 leading-8" : "list-disc space-y-2 pl-6 leading-8"}>
        {block.items.map((item, index) => <li key={index} className="pl-1">{item}</li>)}
      </Tag>
      <SourceAction block={block} evidence={block.evidence} onSource={context.onSource} />
    </div>
  );
}

function Quote({ block, context }: { block: Extract<LessonBlockV2, { type: "quote" }>; context: ReaderContext }) {
  return (
    <blockquote className="border-l-2 border-primary/45 pl-5 text-base italic leading-8 text-muted-foreground">
      {block.text}
      <SourceAction block={block} evidence={block.evidence} onSource={context.onSource} />
    </blockquote>
  );
}

function CodeBlock({ block }: { block: Extract<LessonBlockV2, { type: "code" }> }) {
  const [copied, setCopied] = useState(false);
  const tokens = tokenizeCode(block.code, block.language);
  return (
    <figure className="overflow-hidden rounded-xl border bg-slate-950 text-slate-100 dark:bg-black">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-slate-300">
        <span>{block.language || "text"}</span>
        <button
          type="button"
          className="rounded px-2 py-1 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={() => navigator.clipboard?.writeText(block.code).then(() => setCopied(true)).catch(() => {})}
          aria-label="Copy code"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-5 text-left text-sm leading-6"><code dir="ltr">
        {tokens.map((token, index) => (
          <span key={index} className={token.className}>
            {token.text}
          </span>
        ))}
      </code></pre>
      {block.caption && <figcaption className="border-t border-white/10 px-4 py-2 text-xs text-slate-300">{block.caption}</figcaption>}
    </figure>
  );
}

function Table({ block, context }: { block: Extract<LessonBlockV2, { type: "table" }>; context: ReaderContext }) {
  return (
    <figure className="overflow-x-auto rounded-xl border">
      <table className="w-full border-collapse text-left text-sm">
        {block.caption && <caption className="px-4 py-3 text-left font-medium">{block.caption}</caption>}
        <thead className="bg-muted/60"><tr>{block.columns.map((column, i) => <th key={i} scope="col" className="border-b px-4 py-3 font-semibold">{column}</th>)}</tr></thead>
        <tbody>{block.rows.map((row, i) => <tr key={i} className="border-b last:border-0">{row.map((cell, j) => <td key={j} className="px-4 py-3">{cell}</td>)}</tr>)}</tbody>
      </table>
      <SourceAction block={block} evidence={block.evidence} onSource={context.onSource} />
    </figure>
  );
}

function Media({ block }: { block: Extract<LessonBlockV2, { type: "media" }> }) {
  if (!block.src)
    return (
      <figure className="rounded-xl border border-dashed bg-muted/15 p-5">
        {block.caption && <figcaption className="mb-3 text-sm leading-6 text-foreground/85">{block.caption}</figcaption>}
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><ImageIcon className="size-4 shrink-0" /><span>{block.alt} · source asset not attached</span></div>
      </figure>
    );
  // Only server-authorized API paths can reach this component. External and
  // data URLs are rejected at the renderer boundary.
  if (!block.src.startsWith("/api/v1/"))
    return <div role="alert" className="rounded-xl border p-5 text-sm">This media source is unavailable.</div>;
  if (block.mediaType === "image") return <figure className="space-y-2"><img src={block.src} alt={block.alt} loading="lazy" decoding="async" className="max-h-[34rem] w-full rounded-xl border object-contain" />{block.caption && <figcaption className="text-xs text-muted-foreground">{block.caption}</figcaption>}</figure>;
  if (block.mediaType === "audio") return <figure className="space-y-2 rounded-xl border p-4"><audio controls src={block.src} className="w-full" /><figcaption className="text-xs text-muted-foreground">{block.alt}</figcaption></figure>;
  return <figure className="space-y-2"><video controls src={block.src} aria-label={block.alt} className="w-full rounded-xl border" />{block.caption && <figcaption className="text-xs text-muted-foreground">{block.caption}</figcaption>}</figure>;
}

function Diagram({ block }: { block: Extract<LessonBlockV2, { type: "diagram" }> }) {
  return (
    <figure className="rounded-xl border bg-card p-5">
      <figcaption className="font-semibold">{block.title}</figcaption>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{block.description}</p>
      <ol className="mt-4 space-y-3">
        {block.steps.map((step, i) => (
          <li key={step.id} className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
            <span><span className="block text-sm font-medium">{step.label}</span>{step.detail && <span className="mt-0.5 block text-sm leading-6 text-muted-foreground">{step.detail}</span>}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

function Chart({ block }: { block: Extract<LessonBlockV2, { type: "chart" }> }) {
  const allValues = block.series.flatMap((series) => series.values);
  const min = Math.min(0, ...allValues);
  const max = Math.max(1, ...allValues);
  const span = Math.max(1, max - min);
  const colors = ["bg-primary", "bg-emerald-500", "bg-amber-500"];
  const lineColors = ["stroke-primary", "stroke-emerald-500", "stroke-amber-500"];
  const description = `${block.title}: ${block.series.map((series) => `${series.label}, ${series.values.join(", ")}`).join("; ")}`;
  const pointX = (index: number) =>
    block.categories.length === 1 ? 320 : 44 + (index / (block.categories.length - 1)) * 552;
  const pointY = (value: number) => 18 + ((max - value) / span) * 174;
  return (
    <figure className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2">
        <LineChart className="size-4 text-primary" />
        <figcaption className="font-semibold">{block.title}</figcaption>
      </div>
      {block.caption && <p className="mt-1 text-sm text-muted-foreground">{block.caption}</p>}
      <div
        role="img"
        aria-label={description}
        className="mt-5"
      >
        {block.kind === "line" ? (
          <div>
            <svg viewBox="0 0 640 230" className="h-auto w-full" aria-hidden="true">
              {[0, 0.5, 1].map((fraction) => {
                const y = 18 + fraction * 174;
                return <line key={fraction} x1="44" x2="596" y1={y} y2={y} className="stroke-border" strokeDasharray="3 4" />;
              })}
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
                    <circle key={index} cx={pointX(index)} cy={pointY(value)} r="3.5" className={`${lineColors[seriesIndex % lineColors.length]} fill-background`} strokeWidth="2" />
                  ))}
                </g>
              ))}
              {block.categories.map((category, index) => (
                <text key={category} x={pointX(index)} y="216" textAnchor="middle" className="fill-muted-foreground text-[10px]">{category}</text>
              ))}
            </svg>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {block.series.map((series, index) => (
                <span key={series.label} className="inline-flex items-center gap-1.5"><span className={`size-2 rounded-full ${colors[index % colors.length]}`} />{series.label}</span>
              ))}
            </div>
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
                          <div className={`h-full rounded-full ${colors[seriesIndex % colors.length]}`} style={{ width: `${width}%` }} />
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
      {block.yLabel && <p className="mt-3 text-[11px] text-muted-foreground">Values: {block.yLabel}</p>}
      <details className="mt-4 rounded-lg bg-muted/45 p-3 text-xs">
        <summary className="cursor-pointer font-medium">View data table</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead><tr><th scope="col" className="border-b px-2 py-1">Category</th>{block.series.map((series) => <th key={series.label} scope="col" className="border-b px-2 py-1">{series.label}</th>)}</tr></thead>
            <tbody>{block.categories.map((category, index) => <tr key={category}><th scope="row" className="border-b px-2 py-1 font-normal">{category}</th>{block.series.map((series) => <td key={series.label} className="border-b px-2 py-1 tabular-nums">{series.values[index]}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </details>
      {block.evidence.length > 0 && <p className="mt-3 text-[11px] text-muted-foreground">Source:{block.evidence.map((id) => ` ${id}`).join(", ")}</p>}
    </figure>
  );
}

function Callout({ block, context }: { block: Extract<LessonBlockV2, { type: "callout" }>; context: ReaderContext }) {
  const [expanded, setExpanded] = useState(block.kind !== "proof");
  return (
    <aside className="rounded-xl border bg-muted/25 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-primary">{block.title || block.kind}</div>
        {block.kind === "proof" && <Button type="button" size="xs" variant="ghost" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>{expanded ? "Hide proof" : "Show proof"}<ChevronDown className="size-3" /></Button>}
      </div>
      {expanded && <p className="mt-2 whitespace-pre-wrap text-sm leading-7">{block.text}</p>}
      <SourceAction block={block} evidence={block.evidence} onSource={context.onSource} />
    </aside>
  );
}

function UnsupportedBlock() {
  return <div role="alert" className="rounded-lg border p-4 text-sm">This content type is not supported by this reader version.</div>;
}

const registry = {
  heading: ({ block }: { block: Extract<LessonBlockV2, { type: "heading" }> }) => <Heading block={block} />,
  paragraph: ({ block, context }: { block: Extract<LessonBlockV2, { type: "paragraph" }>; context: ReaderContext }) => <Paragraph block={block} context={context} />,
  list: ({ block, context }: { block: Extract<LessonBlockV2, { type: "list" }>; context: ReaderContext }) => <List block={block} context={context} />,
  quote: ({ block, context }: { block: Extract<LessonBlockV2, { type: "quote" }>; context: ReaderContext }) => <Quote block={block} context={context} />,
  code: ({ block }: { block: Extract<LessonBlockV2, { type: "code" }> }) => <CodeBlock block={block} />,
  table: ({ block, context }: { block: Extract<LessonBlockV2, { type: "table" }>; context: ReaderContext }) => <Table block={block} context={context} />,
  media: ({ block }: { block: Extract<LessonBlockV2, { type: "media" }> }) => <Media block={block} />,
  diagram: ({ block }: { block: Extract<LessonBlockV2, { type: "diagram" }> }) => <Diagram block={block} />,
  callout: ({ block, context }: { block: Extract<LessonBlockV2, { type: "callout" }>; context: ReaderContext }) => <Callout block={block} context={context} />,
  chart: ({ block }: { block: Extract<LessonBlockV2, { type: "chart" }> }) => <Chart block={block} />,
  math: ({ block }: { block: Extract<LessonBlockV2, { type: "math" }> }) => <MathContent expression={block.expression} notation={block.notation} caption={block.caption} />,
} satisfies { [K in LessonBlockV2["type"]]: ComponentType<{ block: Extract<LessonBlockV2, { type: K }>; context: ReaderContext }> };

export function LearningBlockView({ block, context }: { block: LessonBlockV2; context: ReaderContext }) {
  const id = useId();
  const isMath = block.type === "math";
  return (
    <div data-block-type={block.type} className={block.type === "heading" ? "" : "my-5"}>
      <BlockBoundary>
        {isMath ? (
          <Suspense fallback={<LoadingBlock />}>
            <div className="space-y-2">
              {!block.review && block.notation === "plain" ? <FormulaSourceFallback block={block} href={context.mathCropHref?.(block)} /> : <MathContent expression={block.expression} notation={block.notation} caption={block.review ? `Instructor-approved ${block.review.state} representation; not independently verified.` : block.caption} />}
              {block.review && <details className="rounded border p-3 text-sm"><summary className="cursor-pointer">Formula review and original extraction</summary><p>Reviewer: {block.review.reviewer}</p><p>Original extraction:</p><pre className="whitespace-pre-wrap break-words">{block.review.originalExpression}</pre><p>Model proposal:</p><pre className="whitespace-pre-wrap break-words">{block.review.modelExpression}</pre></details>}
              {(block.sourceMeta?.reviewRequired || block.review || block.provenance?.length) && (
                <p role="status" className="text-center text-xs text-amber-700 dark:text-amber-300">
                  Original source evidence{block.sourceMeta?.page ? ` · page ${block.sourceMeta.page}` : ""}.
                  {block.provenance?.length && context.onSource ? (
                    <Button type="button" variant="ghost" size="xs" onClick={() => context.onSource?.(block)}>
                      Inspect formula source
                    </Button>
                  ) : null}
                </p>
              )}
            </div>
          </Suspense>
        ) : Object.hasOwn(registry, block.type) ? (
          // The registry is the only trusted component source; the id is for
          // React keying and never used as executable markup.
          <span id={id} data-renderer={block.type}>
            {(() => {
              const Renderer = registry[block.type] as ComponentType<{ block: LessonBlockV2; context: ReaderContext }>;
              return <Renderer block={block} context={context} />;
            })()}
          </span>
        ) : <UnsupportedBlock />}
      </BlockBoundary>
    </div>
  );
}
