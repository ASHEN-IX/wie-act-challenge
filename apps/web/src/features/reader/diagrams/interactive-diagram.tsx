"use client";
import { useId, useState } from "react";
import { Info } from "lucide-react";

export type DiagramNode = {
  id: string;
  label: string;
  /** Percentage position within the diagram canvas. */
  x: number;
  y: number;
  /** Trusted explanation shown when the node is selected. */
  detail?: string;
  kind?: "host" | "router" | "switch" | "service" | "store" | "client";
};

export type DiagramLink = {
  from: string;
  to: string;
  label?: string;
};

export type InteractiveDiagramProps = {
  title: string;
  description: string;
  nodes: DiagramNode[];
  links: DiagramLink[];
  /** Optional source image behind the annotation layer. */
  imageSrc?: string;
  imageAlt?: string;
  caption?: string;
};

const MAX_NODES = 80;
const MAX_LINKS = 160;

const kindColor: Record<NonNullable<DiagramNode["kind"]>, string> = {
  host: "bg-brand-cyan/20 border-brand-cyan/60 text-brand-cyan",
  router: "bg-brand-violet/25 border-brand-violet/60 text-brand-violet-soft",
  switch: "bg-brand-amber/20 border-brand-amber/60 text-brand-amber",
  service: "bg-emerald-500/20 border-emerald-500/60 text-emerald-300",
  store: "bg-pink-500/20 border-pink-500/60 text-pink-300",
  client: "bg-sky-500/20 border-sky-500/60 text-sky-300",
};

/**
 * Trusted topology or architecture view. Positions, labels and links come from
 * validated structured data — connectivity is never inferred from an image.
 */
export function InteractiveDiagram({
  title,
  description,
  nodes,
  links,
  imageSrc,
  imageAlt,
  caption,
}: InteractiveDiagramProps) {
  const id = useId();
  const [selected, setSelected] = useState<string | null>(null);
  const safeNodes = nodes.slice(0, MAX_NODES);
  const safeLinks = links.slice(0, MAX_LINKS);
  const byId = new Map(safeNodes.map((node) => [node.id, node]));
  const active = selected ? byId.get(selected) : undefined;

  return (
    <figure className="rounded-xl border bg-card p-4 sm:p-5" data-component="InteractiveDiagram">
      <figcaption className="font-heading text-base font-semibold">{title}</figcaption>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>

      <div className="relative mt-4 overflow-hidden rounded-lg border bg-background/60">
        {imageSrc && (
          <img
            src={imageSrc}
            alt={imageAlt ?? ""}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-contain opacity-25"
          />
        )}
        <div className="relative h-64 w-full sm:h-56">
          <svg className="absolute inset-0 size-full" aria-hidden="true">
            {safeLinks.map((link, index) => {
              const from = byId.get(link.from);
              const to = byId.get(link.to);
              if (!from || !to) return null;
              const isActive = selected === link.from || selected === link.to;
              return (
                <line
                  key={`${link.from}-${link.to}-${index}`}
                  x1={`${from.x}%`}
                  y1={`${from.y}%`}
                  x2={`${to.x}%`}
                  y2={`${to.y}%`}
                  className={isActive ? "stroke-brand-cyan" : "stroke-border"}
                  strokeWidth={isActive ? 2.5 : 1.5}
                />
              );
            })}
          </svg>
          {safeNodes.map((node) => {
            const isActive = selected === node.id;
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelected((value) => (value === node.id ? null : node.id))}
                aria-pressed={isActive}
                aria-describedby={isActive ? `${id}-detail` : undefined}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-lg border px-2.5 py-1.5 text-xs font-medium shadow-sm transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                  node.kind ? kindColor[node.kind] : "bg-secondary text-secondary-foreground border-border"
                } ${isActive ? "ring-2 ring-brand-cyan ring-offset-1 ring-offset-background" : "hover:brightness-125"}`}
              >
                {node.label}
              </button>
            );
          })}
        </div>
      </div>

      <div id={`${id}-detail`} className="mt-3 min-h-11 rounded-lg bg-muted/40 px-3 py-2 text-sm leading-6">
        {active ? (
          <p>
            <span className="font-medium">{active.label}.</span>{" "}
            {active.detail ?? "No reviewed explanation is attached to this element."}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Info className="size-3.5 shrink-0" /> Select an element to read its reviewed description.
          </p>
        )}
      </div>

      <details className="mt-3 rounded-lg bg-muted/40 p-3 text-xs">
        <summary className="cursor-pointer font-medium">Diagram elements and connections as text</summary>
        <ul className="mt-2 space-y-1">
          {safeNodes.map((node) => {
            const outgoing = safeLinks.filter((link) => link.from === node.id);
            return (
              <li key={node.id}>
                <span className="font-medium">{node.label}</span>
                {outgoing.length > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    → {outgoing.map((link) => byId.get(link.to)?.label ?? link.to).join(", ")}
                  </span>
                )}
                {node.detail && <span className="block text-muted-foreground">{node.detail}</span>}
              </li>
            );
          })}
        </ul>
      </details>

      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {caption ??
          "Elements and connections come from validated structured data. Nothing is inferred from the picture."}
      </p>
    </figure>
  );
}

export default InteractiveDiagram;
