"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type {
  LessonBlockV2,
  ReadingDocumentV2,
} from "@ednova/shared/ednova/learningDocumentV2";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  FileText,
  GraduationCap,
  Menu,
  MessageCircleQuestion,
  X,
} from "lucide-react";
import { CourseNardouch } from "@/features/nardouch/course-growth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LearningBlockView, type ReaderContext } from "./registry";
import { structureLesson, type LessonStep } from "./lesson-structure";
import { DoneToggle, StepView, type TutorTarget } from "./lesson-step";

export function CourseReader({
  document,
  practiceHref,
  tutor = null,
}: {
  document: ReadingDocumentV2;
  practiceHref: string;
  /** Where in-lesson tutor help is asked; omitted when the course has no published objective. */
  tutor?: TutorTarget | null;
}) {
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [sourceTarget, setSourceTarget] = useState<{
    page: number | null;
    documentId: string;
    href: string;
    cropHref?: string;
  } | null>(null);
  const stepTop = useRef<HTMLDivElement>(null);
  const lessons = useMemo(
    () => document.sections.filter((section) => section.id !== "course-source"),
    [document.sections],
  );
  // Presentation only: the canonical sections are regrouped into steps, nothing
  // is removed from the source, and page furniture stays in the original.
  const { steps, omitted } = useMemo(() => {
    const all: LessonStep[] = [];
    let hidden = 0;
    lessons.forEach((section, index) => {
      const result = structureLesson(section.blocks, section.title);
      hidden += result.omitted;
      for (const step of result.steps)
        all.push({
          ...step,
          id: `${index + 1}-${step.id}`,
          group: step.group ?? (lessons.length > 1 ? section.title : null),
        });
    });
    return { steps: all, omitted: hidden };
  }, [lessons]);
  const storageKey = `noveris:understood:${document.courseId}:${document.revisionId}`;

  function onSource(
    block: Extract<LessonBlockV2, { type: "paragraph" | "list" | "quote" | "table" | "callout" | "math" }>,
  ) {
    const match = block.provenance?.[0] || document.sections
      .flatMap((section) => section.evidence)
      .find((item) => block.evidence?.includes(item.chunkId));
    if (!match) return;
    const source = document.sources.find(
      (item) => item.documentId === match.documentId,
    );
    if (source)
      setSourceTarget({
        documentId: source.documentId,
        page: match.pageNumber,
        ...(block.type === 'math' && block.sourceMeta?.regionId ? {cropHref:`/api/v1/study/courses/${document.courseId}/revisions/${document.revisionId}/sources/${source.documentId}/regions/${block.sourceMeta.regionId}`} : {}),
        href: `${source.href}${match.pageNumber ? `#page=${match.pageNumber}` : ""}`,
      });
  }

  // Understood marks are a convenience kept on this device, never a grade.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(saved)) setDone(new Set(saved.filter((id): id is string => typeof id === "string")));
    } catch { /* storage unavailable: the page works without it */ }
  }, [storageKey]);
  useEffect(() => {
    const fromHash = steps.findIndex((step) => `#${step.id}` === window.location.hash);
    if (fromHash > 0) {
      setActiveIndex(fromHash);
      window.requestAnimationFrame(() => stepTop.current?.scrollIntoView({ block: "start" }));
    }
  }, [steps]);
  const go = useCallback(
    (index: number) => {
      const next = Math.max(0, Math.min(steps.length - 1, index));
      setActiveIndex(next);
      setOutlineOpen(false);
      if (steps[next]) window.history.replaceState(null, "", `#${steps[next].id}`);
      stepTop.current?.scrollIntoView({ block: "start" });
      window.requestAnimationFrame(() => window.document.getElementById("step-title")?.focus({ preventScroll: true }));
    },
    [steps],
  );
  function toggleDone(id: string) {
    setDone((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  const context: ReaderContext = {
    title: document.title,
    revisionId: document.revisionId,
    compact: true,
    onSource,
    mathCropHref: (block) => {
      const source = document.sources.find((item) => item.documentId === block.provenance?.[0]?.documentId);
      return source && block.sourceMeta?.regionId ? `/api/v1/study/courses/${document.courseId}/revisions/${document.revisionId}/sources/${source.documentId}/regions/${block.sourceMeta.regionId}` : undefined;
    },
    mappings: new Map(document.canonical.mappings.map((mapping) => [mapping.chunkId, mapping])),
  };
  const unmapped = document.canonical.mappings.some((mapping) => mapping.status === "unmapped");
  const step = steps[Math.min(activeIndex, steps.length - 1)];
  const percent = steps.length ? Math.round((done.size / steps.length) * 100) : 0;
  const sourceHref = (c: { documentId: string; pageNumber: number | null }) => {
    const source = document.sources.find((item) => item.documentId === c.documentId);
    return `${source?.href ?? `/api/v1/study/courses/${encodeURIComponent(document.courseId)}/revisions/${encodeURIComponent(document.revisionId)}/sources/${encodeURIComponent(c.documentId)}`}${c.pageNumber ? `#page=${c.pageNumber}` : ""}`;
  };
  const groups = steps.reduce<Array<{ name: string | null; items: Array<{ step: LessonStep; index: number }> }>>((acc, item, index) => {
    const last = acc[acc.length - 1];
    if (last && last.name === item.group) last.items.push({ step: item, index });
    else acc.push({ name: item.group, items: [{ step: item, index }] });
    return acc;
  }, []);
  const outlineNav = (
    <nav aria-label="Lesson steps" className="space-y-4">
      {groups.map((group, g) => (
        <div key={g}>
          {group.name && <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.name}</p>}
          <ol className="space-y-0.5">
            {group.items.map(({ step: s, index }) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => go(index)}
                  aria-current={index === activeIndex ? "step" : undefined}
                  className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm leading-5 transition-colors ${index === activeIndex ? "bg-primary/10 font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                >
                  <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${done.has(s.id) ? "border-primary bg-primary text-primary-foreground" : ""}`}>
                    {done.has(s.id) ? <Check className="size-3" aria-label="Understood" /> : index + 1}
                  </span>
                  <span>{s.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-w-0">
      <header className="border-b pb-6">
        <Badge variant="secondary" className="gap-1.5"><BookOpen className="size-3" /> Course reader</Badge>
        <h1 className="mt-3 max-w-3xl font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{document.title}</h1>
        {document.generated.summary && (
          <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">{document.generated.summary}</p>
        )}
        {(document.warnings.length > 0 || unmapped) && (
          <details className="group mt-3 max-w-3xl rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2" role="status">
              <span>This lesson was read automatically from your source, so formulas and layout can contain errors. Compare with the original when in doubt.</span>
              <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              {document.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              {unmapped && <li>Some source passages are not linked to an exact lesson yet. They remain in their original order.</li>}
            </ul>
          </details>
        )}
        {document.generated.objectives.length > 0 && (
          <details className="group mt-4 max-w-3xl">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
              What you will learn <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
            </summary>
            <ul className="mt-3 space-y-2">
              {document.generated.objectives.slice(0, 8).map((objective) => (
                <li key={objective.objectiveId} className="flex gap-2.5 text-sm leading-6">
                  <Check className="mt-1 size-4 shrink-0 text-primary" /> {objective.statement}
                </li>
              ))}
            </ul>
          </details>
        )}
      </header>

      {!step ? (
        <p role="status" className="py-10 text-sm text-muted-foreground">
          This course has no readable lesson content yet. The original source is available below.
        </p>
      ) : (
        <div className="grid gap-8 pt-6 lg:grid-cols-[16rem_minmax(0,1fr)] xl:gap-12">
          <aside className="hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] space-y-5 overflow-y-auto pr-1">
              <div>
                <div className="flex items-center justify-between text-xs font-medium"><span>Your progress</span><span>{done.size}/{steps.length} understood</span></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-label="Steps marked understood" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} /></div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Saved on this device. It is not a grade or a mastery record.</p>
              </div>
              {outlineNav}
              <div className="space-y-2 border-t pt-4 text-xs">
                {omitted > 0 && <p className="leading-5 text-muted-foreground">{omitted} page headers, footers and contents lines are hidden here and kept in the original source.</p>}
                <button type="button" onClick={() => { setShowSource(true); window.requestAnimationFrame(() => window.document.getElementById("course-source")?.scrollIntoView({ behavior: "smooth" })); }} className="flex items-start gap-2 text-left leading-5 text-muted-foreground hover:text-foreground">
                  <FileText className="mt-0.5 size-3.5 shrink-0" /> Original source text
                </button>
                {document.sources.map((source, index) => (
                  <a key={source.documentId} href={source.href} className="flex items-start gap-2 leading-5 text-muted-foreground hover:text-foreground">
                    <FileText className="mt-0.5 size-3.5 shrink-0" /> Original file {index + 1}
                  </a>
                ))}
                <Link href={practiceHref} className="flex items-start gap-2 leading-5 text-muted-foreground hover:text-foreground">
                  <MessageCircleQuestion className="mt-0.5 size-3.5 shrink-0" /> Practice and tutor
                </Link>
              </div>
            </div>
          </aside>

          <div ref={stepTop} className="min-w-0 scroll-mt-20">
            <div className="sticky top-16 z-10 -mx-1 mb-5 border-b bg-background/90 px-1 py-2.5 backdrop-blur-md lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
              <div className="flex items-center justify-between gap-3">
                <Button type="button" variant="ghost" size="sm" className="lg:hidden" onClick={() => setOutlineOpen(true)} aria-haspopup="dialog" aria-expanded={outlineOpen}>
                  <Menu data-icon="inline-start" /> Steps
                </Button>
                <p className="text-xs font-medium text-muted-foreground" aria-live="polite">Step {activeIndex + 1} of {steps.length}</p>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-border lg:mt-1.5" aria-hidden="true"><div className="h-full bg-primary/70 transition-[width] duration-300" style={{ width: `${((activeIndex + 1) / steps.length) * 100}%` }} /></div>
            </div>

            <article key={step.id}>
              <StepView step={step} context={context} tutor={tutor} sourceHref={sourceHref} />
            </article>

            <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t pt-6">
              <Button type="button" variant="outline" disabled={activeIndex === 0} onClick={() => go(activeIndex - 1)}>
                <ArrowLeft data-icon="inline-start" /> Previous
              </Button>
              <DoneToggle done={done.has(step.id)} onToggle={() => toggleDone(step.id)} />
              {activeIndex < steps.length - 1 ? (
                <Button type="button" onClick={() => { if (!done.has(step.id)) toggleDone(step.id); go(activeIndex + 1); }}>
                  Next: {steps[activeIndex + 1].title.length > 28 ? "next step" : steps[activeIndex + 1].title} <ArrowRight data-icon="inline-end" />
                </Button>
              ) : (
                <Button asChild><a href={practiceHref}><GraduationCap data-icon="inline-start" /> Go to practice</a></Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-12"><CourseNardouch courseId={document.courseId} revisionId={document.revisionId} practiceHref={practiceHref} /></div>

      {document.sections.filter((section) => section.id === "course-source").map((section) => (
        <section key={section.id} id={section.id} className="mt-12 scroll-mt-24 border-t pt-6">
          <details open={showSource} onToggle={(event) => setShowSource(event.currentTarget.open)} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium">
              <span>Original extracted source (audit trail)</span>
              <span className="text-xs font-normal text-muted-foreground">{section.evidence.length} {section.evidence.length === 1 ? "passage" : "passages"}</span>
            </summary>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Revision-bound source passages, including any labelled instructor-reviewed representations, preserved for inspection.</p>
            <div className="space-y-1 border-t pt-2">
              {section.blocks.map((block) => (<LearningBlockView key={block.id} block={block} context={{ ...context, compact: false }} />))}
            </div>
          </details>
        </section>
      ))}

      <section className="mt-10 border-t pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-heading text-xl font-semibold">Keep learning</h2>
            <p className="mt-1 text-sm text-muted-foreground">Apply this material with reviewed practice, hints, and source-grounded questions.</p>
          </div>
          <Button asChild><a href={practiceHref}><GraduationCap data-icon="inline-start" /> Open practice</a></Button>
        </div>
      </section>

      {outlineOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 lg:hidden" onMouseDown={(event) => { if (event.currentTarget === event.target) setOutlineOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="mobile-outline" className="mx-auto mt-16 max-w-sm rounded-2xl border bg-card p-5 shadow-xl">
            <div className="flex items-center justify-between"><h2 id="mobile-outline" className="font-heading text-lg font-semibold">Lesson steps</h2><Button size="icon-sm" variant="ghost" onClick={() => setOutlineOpen(false)} aria-label="Close outline"><X /></Button></div>
            <div className="mt-4 max-h-[65vh] overflow-y-auto">{outlineNav}</div>
          </div>
        </div>
      )}

      {sourceTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onMouseDown={(event) => { if (event.currentTarget === event.target) setSourceTarget(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="source-preview-title" className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4"><div><h2 id="source-preview-title" className="font-heading text-xl font-semibold">Source reference</h2><p className="mt-1 text-sm text-muted-foreground">Source provenance is linked to the preserved document. Extraction fidelity and mathematical correctness are not independently verified.</p></div><Button size="icon-sm" variant="ghost" onClick={() => setSourceTarget(null)} aria-label="Close source reference"><X /></Button></div>
            <p className="mt-5 text-sm leading-6">{sourceTarget.page ? `Page ${sourceTarget.page} of the original document.` : "Text source; the original has no page number."}</p>
            <div className="mt-4">{sourceTarget.cropHref && <img className="max-h-80 max-w-full rounded border bg-white object-contain" src={sourceTarget.cropHref} alt="Original PDF formula region" />}</div><div className="mt-5 flex flex-wrap gap-2"><Button asChild><a href={sourceTarget.href} target="_blank" rel="noreferrer"><FileText data-icon="inline-start" /> Open original</a></Button><Button variant="outline" onClick={() => setSourceTarget(null)}>Back to reading</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
