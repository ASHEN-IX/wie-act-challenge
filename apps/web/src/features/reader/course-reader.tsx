"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type {
  LessonBlockV2,
  ReadingDocumentV2,
} from "@ednova/shared/ednova/learningDocumentV2";
import {
  ArrowDown,
  BookOpen,
  Check,
  FileText,
  GraduationCap,
  ListTree,
  Menu,
  MessageCircleQuestion,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LearningBlockView, type ReaderContext } from "./registry";

export function CourseReader({
  document,
  practiceHref,
}: {
  document: ReadingDocumentV2;
  practiceHref: string;
}) {
  const [activeSectionId, setActiveSection] = useState(document.sections[0]?.id || "");
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [readPercent, setReadPercent] = useState(0);
  const [sourceTarget, setSourceTarget] = useState<{
    page: number | null;
    documentId: string;
    href: string;
  } | null>(null);
  const article = useRef<HTMLElement>(null);
  const seen = useRef(new Set<string>());
  const sectionTitles = useMemo(
    () => new Map(document.sections.map((section) => [section.id, section.title])),
    [document.sections],
  );

  function onSource(
    block: Extract<LessonBlockV2, { type: "paragraph" | "list" | "quote" | "table" | "callout" }>,
  ) {
    const match = document.sections
      .flatMap((section) => section.evidence)
      .find((item) => block.evidence.includes(item.chunkId));
    if (!match) return;
    const source = document.sources.find(
      (item) => item.documentId === match.documentId,
    );
    if (source)
      setSourceTarget({
        documentId: source.documentId,
        page: match.pageNumber,
        href: `${source.href}${match.pageNumber ? `#page=${match.pageNumber}` : ""}`,
      });
  }

  useEffect(() => {
    const root = article.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) seen.current.add(entry.target.id);
        setReadPercent(
          Math.round((seen.current.size / Math.max(1, document.sections.length)) * 100),
        );
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: 0.01 },
    );
    root.querySelectorAll("[data-reader-section]").forEach((node) =>
      observer.observe(node),
    );
    return () => observer.disconnect();
  }, [document.sections.length]);

  const context: ReaderContext = {
    title: document.title,
    revisionId: document.revisionId,
    onSource,
    mappings: new Map(document.canonical.mappings.map((mapping) => [mapping.chunkId, mapping])),
  };
  const activeTitle = sectionTitles.get(activeSectionId) || "Course overview";

  return (
    <div className="min-w-0">
      <div className="sticky top-16 z-10 mb-5 border-b bg-background/90 py-2.5 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOutlineOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={outlineOpen}
          >
            <Menu data-icon="inline-start" /> Outline
          </Button>
          <span className="truncate text-xs text-muted-foreground">{activeTitle}</span>
        </div>
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_15rem] xl:gap-12">
        <article ref={article} className="min-w-0">
          <header className="border-b pb-7">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1.5">
                <BookOpen className="size-3" /> Course reader
              </Badge>
              <Badge variant="outline">Revision {document.revisionId}</Badge>
            </div>
            <h1 className="mt-4 max-w-3xl font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              {document.title}
            </h1>
            {document.generated.summary && (
              <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
                {document.generated.summary}
              </p>
            )}
            {document.warnings.map((warning) => (
              <p key={warning} role="status" className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
                {warning}
              </p>
            ))}
            {document.canonical.mappings.some((mapping) => mapping.status === "unmapped") && (
              <p className="mt-4 rounded-lg border border-sky-500/30 bg-sky-500/5 px-4 py-3 text-sm leading-6">
                <strong className="font-medium">Source mapping notice.</strong>{" "}
                Some source passages are not linked to an exact lesson yet. They remain in their original order below.
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild size="sm">
                <a href="#course-source"><ArrowDown data-icon="inline-start" /> Read source material</a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href="#practice-and-tutor"><GraduationCap data-icon="inline-start" /> Practice and tutor</a>
              </Button>
            </div>
          </header>

          {document.generated.objectives.length > 0 && (
            <section aria-labelledby="learning-goals" className="border-b py-7">
              <h2 id="learning-goals" className="font-heading text-xl font-semibold">
                What you will learn
              </h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {document.generated.objectives.slice(0, 8).map((objective) => (
                  <li key={objective.objectiveId} className="flex gap-2.5 rounded-lg bg-muted/45 p-3 text-sm leading-6">
                    <Check className="mt-1 size-4 shrink-0 text-primary" />
                    {objective.statement}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {document.sections.filter((section) => section.id !== "course-source").map((section, index, lessons) => (
            <section
              key={section.id}
              id={section.id}
              data-reader-section
              className="scroll-mt-24 border-b py-8 last:border-0"
              aria-labelledby={`${section.id}-title`}
            >
              <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <span>Lesson {index + 1}</span>
                {section.mappingStatus === "exact" ? (
                  <span className="rounded-full border border-emerald-500/30 px-2 py-0.5 text-[10px] normal-case tracking-normal text-emerald-700 dark:text-emerald-300">Mapped to source</span>
                ) : section.mappingStatus === "inferred_review_required" ? (
                  <span className="rounded-full border border-amber-500/30 px-2 py-0.5 text-[10px] normal-case tracking-normal text-amber-700 dark:text-amber-300">Mapping needs review</span>
                ) : section.id !== "course-source" ? (
                  <span className="rounded-full border px-2 py-0.5 text-[10px] normal-case tracking-normal">Outline only</span>
                ) : null}
                {section.evidence.length > 0 && (
                  <span className="normal-case tracking-normal">· {section.evidence.length} verified passages</span>
                )}
              </div>
              <h2 id={`${section.id}-title`} className="font-heading text-2xl font-semibold tracking-tight">
                {section.title}
              </h2>
              {section.id === "course-source" ? (
                <details className="group mt-5 rounded-xl border bg-muted/15">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-medium">
                    <span>Read the complete verified source</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {section.evidence.length} {section.evidence.length === 1 ? "passage" : "passages"}
                    </span>
                  </summary>
                  <div className="space-y-1 border-t px-4 pb-4 pt-2">
                    {section.blocks.map((block) => (
                      <LearningBlockView key={block.id} block={block} context={context} />
                    ))}
                  </div>
                </details>
              ) : (
                <div className="mt-6 space-y-1">
                  {section.blocks.map((block) => (
                    <LearningBlockView key={block.id} block={block} context={context} />
                  ))}
                </div>
              )}
            </section>
          ))}

          {/* Raw extracted passages stay available as an audit trail. They
              follow the curated lessons instead of reading as a third chapter. */}
          {document.sections.filter((section) => section.id === "course-source").map((section) => (
            <section key={section.id} id={section.id} data-reader-section className="scroll-mt-24 border-b py-8">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Source audit</p>
              <h2 className="font-heading text-2xl font-semibold tracking-tight">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Original extracted passages, preserved for verification.</p>
              <details className="group mt-5 rounded-xl border bg-muted/15">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-medium">
                  <span>Open the extracted source</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {section.evidence.length} {section.evidence.length === 1 ? "passage" : "passages"}
                  </span>
                </summary>
                <div className="space-y-1 border-t px-4 pb-4 pt-2">
                  {section.blocks.map((block) => (
                    <LearningBlockView key={block.id} block={block} context={context} />
                  ))}
                </div>
              </details>
            </section>
          ))}

          <section className="mt-8 rounded-2xl border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-heading text-xl font-semibold">Keep learning</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Apply this material with reviewed practice, hints, and source-grounded questions.
                </p>
              </div>
              <Button asChild>
                <a href="#practice-and-tutor"><GraduationCap data-icon="inline-start" /> Open practice</a>
              </Button>
            </div>
          </section>
        </article>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-6">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <ListTree className="size-4" /> Course outline
              </div>
              <nav aria-label="Course outline" className="space-y-0.5 border-l">
                {document.sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    aria-current={activeSectionId === section.id ? "location" : undefined}
                    className={`-ml-px block border-l-2 py-1.5 pl-3 text-sm leading-5 transition-colors ${activeSectionId === section.id ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  >
                    {section.title}
                  </a>
                ))}
              </nav>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex items-center justify-between text-xs font-medium"><span>Reading progress</span><span>{readPercent}%</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border" aria-hidden="true"><div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${readPercent}%` }} /></div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">Tracks sections viewed in this visit. It is not a grade or mastery record.</p>
            </div>
            <div className="space-y-2">
              {document.sources.map((source, index) => (
                <a key={source.documentId} href={source.href} className="flex items-start gap-2 text-xs leading-5 text-muted-foreground hover:text-foreground">
                  <FileText className="mt-0.5 size-3.5 shrink-0" /> Original source {index + 1}
                </a>
              ))}
              <Link href={practiceHref} className="flex items-start gap-2 text-xs leading-5 text-muted-foreground hover:text-foreground">
                <MessageCircleQuestion className="mt-0.5 size-3.5 shrink-0" /> Ask from sources
              </Link>
            </div>
          </div>
        </aside>
      </div>

      {outlineOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 lg:hidden" onMouseDown={(event) => { if (event.currentTarget === event.target) setOutlineOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="mobile-outline" className="mx-auto mt-16 max-w-sm rounded-2xl border bg-card p-5 shadow-xl">
            <div className="flex items-center justify-between"><h2 id="mobile-outline" className="font-heading text-lg font-semibold">Course outline</h2><Button size="icon-sm" variant="ghost" onClick={() => setOutlineOpen(false)} aria-label="Close outline"><X /></Button></div>
            <nav aria-label="Mobile course outline" className="mt-4 max-h-[65vh] space-y-1 overflow-y-auto">
              {document.sections.map((section) => <a key={section.id} href={`#${section.id}`} onClick={() => setOutlineOpen(false)} className="block rounded-md px-3 py-2 text-sm hover:bg-muted">{section.title}</a>)}
            </nav>
          </div>
        </div>
      )}

      {sourceTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onMouseDown={(event) => { if (event.currentTarget === event.target) setSourceTarget(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="source-preview-title" className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4"><div><h2 id="source-preview-title" className="font-heading text-xl font-semibold">Source reference</h2><p className="mt-1 text-sm text-muted-foreground">This passage comes from the verified course material.</p></div><Button size="icon-sm" variant="ghost" onClick={() => setSourceTarget(null)} aria-label="Close source reference"><X /></Button></div>
            <p className="mt-5 text-sm leading-6">{sourceTarget.page ? `Page ${sourceTarget.page} of the original document.` : "Text source; the original has no page number."}</p>
            <div className="mt-5 flex flex-wrap gap-2"><Button asChild><a href={sourceTarget.href} target="_blank" rel="noreferrer"><FileText data-icon="inline-start" /> Open original</a></Button><Button variant="outline" onClick={() => setSourceTarget(null)}>Back to reading</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
