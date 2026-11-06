"use client";
import { useState, type ReactNode } from "react";
import {
  BookMarked,
  ChevronDown,
  ClipboardList,
  Compass,
  Info,
  Lightbulb,
  ListChecks,
  Sigma,
} from "lucide-react";
import type { LessonBlockV2 } from "@ednova/shared/ednova/learningDocumentV2";
import { Button } from "@/components/ui/button";

type Callout = Extract<LessonBlockV2, { type: "callout" }>;

/** Shared shell. Roles are separated by surface and typographic weight, not by
 * a coloured side tab: a formal statement gets a quiet tinted panel, supporting
 * material sits directly on the page. This keeps the hierarchy legible without
 * reducing every block to the same decorated card. */
function SemanticShell({
  tone,
  className,
  icon,
  label,
  title,
  children,
  aside,
}: {
  /** `formal` = a stated result worth a surface; `aside` = supporting material
   * that should read as part of the flow. */
  tone: "formal" | "aside";
  /** Role tint. On a formal card it colours the surface; the icon inherits it. */
  className?: string;
  icon: ReactNode;
  label: string;
  title?: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  const surface =
    tone === "formal"
      ? "rounded-lg border border-current/15 px-4 py-3.5"
      : "border-l border-border/70 pl-4";
  return (
    <section className={["relative", surface, className].filter(Boolean).join(" ")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em]">
          {icon}
          {label}
        </span>
        {title && <span className="text-sm font-medium text-foreground">{title}</span>}
        {aside}
      </div>
      <div className="mt-2 text-[1.02rem] leading-8 text-foreground/90">{children}</div>
    </section>
  );
}

export function DefinitionCard({ block }: { block: Callout }) {
  return (
    <SemanticShell
      tone="formal"
      className="bg-emerald-500/[0.07] text-emerald-300"
      icon={<BookMarked className="size-3.5" />}
      label="Definition"
      title={block.title}
    >
      <p className="whitespace-pre-wrap">{block.text}</p>
    </SemanticShell>
  );
}

export function TheoremCard({ block }: { block: Callout }) {
  const kind = block.kind === "proposition" || block.kind === "lemma" || block.kind === "corollary"
    ? block.kind
    : "theorem";
  return (
    <SemanticShell
      tone="formal"
      className="bg-brand-violet/[0.09] text-brand-violet-soft"
      icon={<Sigma className="size-3.5" />}
      label={kind.charAt(0).toUpperCase() + kind.slice(1)}
      title={block.title}
    >
      <p className="whitespace-pre-wrap">{block.text}</p>
    </SemanticShell>
  );
}

export function ProofBlock({ block }: { block: Callout }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <SemanticShell
      tone="aside"
      icon={<Compass className="size-3.5 text-muted-foreground" />}
      label="Proof"
      title={block.title}
      aside={
        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={`proof-${block.id}`}
          className="ml-auto"
        >
          {expanded ? "Collapse" : "Expand"}
          <ChevronDown className={`size-3 transition-transform ${expanded ? "" : "-rotate-90"}`} />
        </Button>
      }
    >
      <div id={`proof-${block.id}`} hidden={!expanded}>
        <p className="whitespace-pre-wrap">{block.text}</p>
      </div>
      {!expanded && (
        <p className="text-sm text-muted-foreground">
          The proof is collapsed. It stays available to screen readers and can be expanded above.
        </p>
      )}
    </SemanticShell>
  );
}

export function ExampleBlock({ block }: { block: Callout }) {
  return (
    <SemanticShell
      tone="formal"
      className="bg-sky-500/[0.07] text-sky-300"
      icon={<Lightbulb className="size-3.5" />}
      label="Example"
      title={block.title}
    >
      <p className="whitespace-pre-wrap">{block.text}</p>
    </SemanticShell>
  );
}

export function ExerciseBlock({ block }: { block: Callout }) {
  return (
    <SemanticShell
      tone="formal"
      className="bg-brand-amber/[0.08] text-brand-amber"
      icon={<ListChecks className="size-3.5" />}
      label="Exercise"
      title={block.title}
      aside={
        <span className="ml-auto text-[0.7rem] text-muted-foreground">
          From the source · not graded here
        </span>
      }
    >
      <p className="whitespace-pre-wrap">{block.text}</p>
    </SemanticShell>
  );
}

export function ImportantNote({ block }: { block: Callout }) {
  return (
    <SemanticShell
      tone="aside"
      icon={<Info className="size-3.5 text-muted-foreground" />}
      label={block.kind === "note" ? "Note" : block.kind.replace(/_/g, " ")}
      title={block.title}
    >
      <p className="whitespace-pre-wrap">{block.text}</p>
    </SemanticShell>
  );
}

export function ExercisePlaceholder() {
  return (
    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      <ClipboardList className="mb-2 size-4" /> No source exercise in this lesson.
    </div>
  );
}
