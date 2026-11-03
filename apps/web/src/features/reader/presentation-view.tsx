"use client";
import { useState } from "react";
import Link from "next/link";
import { BookOpen, FileText, ShieldAlert } from "lucide-react";
import type { LessonBlockV2 } from "@ednova/shared/ednova/learningDocumentV2";
import type { PublishedPresentationV1 } from "@ednova/shared/ednova/presentationDocument";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LearningBlockView, type ReaderContext } from "./registry";

type SourceTarget = {
  page: number | null;
  href: string;
  cropHref?: string;
};

/**
 * Learner surface for the versioned presentation contract. It never reads the
 * stored canonical document directly and never claims verification: every
 * disclosure string comes from the contract's fixed vocabulary. Unreviewed
 * formulas are projected as `source_faithful` and the shared registry renders
 * the preserved crop plus explicitly unverified text.
 */
export function PresentationView({ presentation }: { presentation: PublishedPresentationV1 }) {
  const [sourceTarget, setSourceTarget] = useState<SourceTarget | null>(null);
  const sources = new Map(presentation.sources.map((source) => [source.documentId, source]));
  const cropHref = (
    block: Extract<LessonBlockV2, { type: "math" }>,
  ): string | undefined => {
    const provenance = block.provenance?.[0];
    if (!provenance || !block.sourceMeta?.regionId) return undefined;
    return `/api/v1/study/courses/${encodeURIComponent(presentation.courseId)}/revisions/${encodeURIComponent(presentation.revisionId)}/sources/${encodeURIComponent(provenance.documentId)}/regions/${encodeURIComponent(block.sourceMeta.regionId)}`;
  };

  const onSource: NonNullable<ReaderContext["onSource"]> = (block) => {
    const provenance = block.provenance?.[0];
    if (!provenance) return;
    const source = sources.get(provenance.documentId);
    if (!source) return;
    setSourceTarget({
      page: provenance.pageNumber ?? block.sourceMeta?.page ?? null,
      href: `${source.href}${provenance.pageNumber ? `#page=${provenance.pageNumber}` : ""}`,
      ...(block.type === "math" && block.sourceMeta?.regionId
        ? { cropHref: cropHref(block) }
        : {}),
    });
  };

  const context: ReaderContext = {
    title: presentation.title,
    revisionId: presentation.revisionId,
    onSource,
    mathCropHref: cropHref,
  };

  return (
    <div
      data-presentation-view
      data-presentation-status={presentation.verification.status}
      className="mx-auto min-w-0 max-w-6xl"
    >
      <header className="border-b pb-7">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1.5">
            <BookOpen className="size-3" /> Published presentation
          </Badge>
          <Badge variant="outline">Revision {presentation.revisionId}</Badge>
          <Badge variant="outline">Structure v{presentation.schemaVersion}</Badge>
        </div>
        <h1 className="mt-4 max-w-3xl font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {presentation.title}
        </h1>
        {presentation.summary && (
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
            {presentation.summary}
          </p>
        )}

        <div
          role="note"
          aria-label="Content verification status"
          className="mt-5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-6"
        >
          <p className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span>{presentation.verification.disclosure}</span>
          </p>
          {presentation.verification.math.total > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {presentation.verification.math.reviewed} of{" "}
              {presentation.verification.math.total} display formulas have instructor review;{" "}
              {presentation.verification.math.sourceFallback} render from the original document.
            </p>
          )}
        </div>

        {presentation.warnings.map((warning) => (
          <p
            key={warning}
            role="status"
            className="mt-3 rounded-lg border px-4 py-3 text-sm leading-6 text-muted-foreground"
          >
            {warning}
          </p>
        ))}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={presentation.fallback.readerHref}>
              Deterministic source-faithful reader
            </Link>
          </Button>
          {presentation.sources.map((source, index) => (
            <Button key={source.documentId} asChild variant="ghost" size="sm">
              <a href={source.href}>
                <FileText data-icon="inline-start" /> Original source {index + 1}
              </a>
            </Button>
          ))}
        </div>
      </header>

      {presentation.objectives.length > 0 && (
        <section aria-labelledby="presentation-objectives" className="border-b py-7">
          <h2 id="presentation-objectives" className="font-heading text-xl font-semibold">
            What you will learn
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {presentation.objectives.slice(0, 8).map((objective) => (
              <li
                key={objective.objectiveId}
                className="rounded-lg bg-muted/45 p-3 text-sm leading-6"
              >
                {objective.statement}
              </li>
            ))}
          </ul>
        </section>
      )}

      {presentation.chapters.map((chapter) => (
        <section key={chapter.id} className="border-b py-8 last:border-0">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            {chapter.title}
          </h2>
          {chapter.summary && (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {chapter.summary}
            </p>
          )}
          {chapter.lessons.map((lesson) => (
            <section
              key={lesson.id}
              data-presentation-lesson={lesson.id}
              className="mt-7 rounded-2xl border bg-card/40 p-5 sm:p-6"
            >
              <h3 className="font-heading text-xl font-semibold tracking-tight">
                {lesson.title}
              </h3>
              {lesson.summary && (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {lesson.summary}
                </p>
              )}
              <div className="mt-4">
                {lesson.blocks.map((entry) => (
                  <div
                    key={entry.id}
                    data-presentation-policy={entry.render}
                    data-presentation-reason={entry.reason}
                  >
                    <LearningBlockView block={entry.block} context={context} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </section>
      ))}

      {sourceTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setSourceTarget(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="presentation-source-title"
            className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="presentation-source-title" className="font-heading text-xl font-semibold">
                  Source reference
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Source provenance is linked to the preserved document. Extraction fidelity
                  and mathematical correctness are not independently verified.
                </p>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setSourceTarget(null)}
                aria-label="Close source reference"
              >
                ×
              </Button>
            </div>
            <p className="mt-5 text-sm leading-6">
              {sourceTarget.page
                ? `Page ${sourceTarget.page} of the original document.`
                : "Text source; the original has no page number."}
            </p>
            {sourceTarget.cropHref && (
              <div className="mt-4">
                <img
                  className="max-h-80 max-w-full rounded border bg-white object-contain"
                  src={sourceTarget.cropHref}
                  alt="Original formula region"
                />
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild>
                <a href={sourceTarget.href} target="_blank" rel="noreferrer">
                  <FileText data-icon="inline-start" /> Open original
                </a>
              </Button>
              <Button variant="outline" onClick={() => setSourceTarget(null)}>
                Back to reading
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
