"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  GraduationCap,
  ListTree,
  MessageCircleQuestion,
  PanelRight,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import type { LessonBlockV2 } from "@ednova/shared/ednova/learningDocumentV2";
import type {
  PublishedPresentationV1,
  PresentationLessonV1,
} from "@ednova/shared/ednova/presentationDocument";
import type { ReaderMode } from "@ednova/shared/ednova/presentationPlan";
import type { PublishedStructuredAssetV1 } from "@ednova/shared/ednova/structuredAsset";
import type { PublishedExperiencePlanV1 } from "@ednova/shared/ednova/publishedExperiencePlan";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PlannedBlockView,
  StructuredAssetView,
  FunctionGraph,
  SequenceVisualizer,
  DerivationStepper,
  CodeWalkthrough,
  InteractiveDiagram,
  Suspense,
  LoadingBlock,
  type ReaderContext,
} from "./components/registry";
import {
  EXPLORATION_DISCLOSURE,
  explorationsForLesson,
  type Exploration,
} from "./explorations";

type SourceTarget = {
  page: number | null;
  href: string;
  cropHref?: string;
  blockId: string;
};

export type LessonReaderProps = {
  presentation: PublishedPresentationV1;
  /** Currently selected lesson; the URL is the source of truth. */
  lessonId: string;
  /** Reader mode from the URL, so a mode is deep-linkable too. */
  initialMode: ReaderMode;
  /** Existing practice + tutor surface, rendered inside the tools panel. */
  practiceHref: string;
  /** Existing deterministic reader for the same pinned revision. */
  fallbackHref: string;
  /** Route this reader is mounted at. Defaults to the production lesson route;
   * the preview mounts it elsewhere and passes its own path. */
  basePath?: string;
  /** A validated AI experience plan (Batch 4, M4.1). Optional and additive: it
   * may only change *which trusted component* renders a block, never whether
   * the block renders. Absent means the deterministic Batch 3 plan is used. */
  experiencePlan?: PublishedExperiencePlanV1;
};

const MODE_LABELS: Record<ReaderMode, string> = {
  read: "Read",
  explore: "Explore",
  practice: "Practice",
};

const MODE_HINTS: Record<ReaderMode, string> = {
  read: "Source-faithful reading with interactions collapsed.",
  explore: "Trusted interactive components for this lesson.",
  practice: "Open the lesson's exercises and practice tools.",
};

function flattenLessons(presentation: PublishedPresentationV1) {
  return presentation.chapters.flatMap((chapter) =>
    chapter.lessons.map((lesson) => ({
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      lesson,
    })),
  );
}

/**
 * The learner workspace: course outline, focused reading surface and a
 * contextual tools panel. Selection lives in the URL so every lesson is
 * deep-linkable and the browser's back/forward buttons work.
 */
export function LessonReader({
  presentation,
  lessonId,
  initialMode,
  practiceHref,
  fallbackHref,
  basePath = `/courses/${presentation.courseId}/present`,
  experiencePlan,
}: LessonReaderProps) {
  const hrefFor = (id: string, mode: ReaderMode) => lessonHref(presentation, id, mode, basePath);
  const flat = useMemo(() => flattenLessons(presentation), [presentation]);
  // An unknown lesson must not silently show a different one: the URL named a
  // lesson that is not in this revision, so the reader says so.
  const requestedIndex = flat.findIndex((entry) => entry.lesson.id === lessonId);
  const index = requestedIndex < 0 ? -1 : requestedIndex;
  const current = index >= 0 ? flat[index] : undefined;
  const previous = index > 0 ? flat[index - 1] : undefined;
  const next = index < flat.length - 1 ? flat[index + 1] : undefined;

  const [mode, setMode] = useState<ReaderMode>(initialMode);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sourceTarget, setSourceTarget] = useState<SourceTarget | null>(null);
  const outlineButton = useRef<HTMLButtonElement>(null);
  const toolsButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const sources = useMemo(
    () => new Map(presentation.sources.map((source) => [source.documentId, source])),
    [presentation.sources],
  );

  const cropHref = useCallback(
    (block: Extract<LessonBlockV2, { type: "math" }>) => {
      const provenance = block.provenance?.[0];
      if (!provenance || !block.sourceMeta?.regionId) return undefined;
      return `/api/v1/study/courses/${encodeURIComponent(presentation.courseId)}/revisions/${encodeURIComponent(presentation.revisionId)}/sources/${encodeURIComponent(provenance.documentId)}/regions/${encodeURIComponent(block.sourceMeta.regionId)}`;
    },
    [presentation.courseId, presentation.revisionId],
  );

  const onSource = useCallback(
    (block: Extract<LessonBlockV2, { type: "paragraph" | "list" | "quote" | "table" | "callout" | "math" }>) => {
      const provenance = block.provenance?.[0];
      if (!provenance) return;
      const source = sources.get(provenance.documentId);
      if (!source) return;
      setSourceTarget({
        blockId: block.id,
        page: provenance.pageNumber ?? block.sourceMeta?.page ?? null,
        // The source route serves the preserved file as a download; it is not
        // an HTML viewer, so a #page fragment would be a false promise.
        href: source.href,
        ...(block.type === "math" ? { cropHref: cropHref(block) } : {}),
      });
    },
    [sources, cropHref],
  );

  // Focus moves to the lesson heading on navigation, so keyboard and screen
  // reader users land at the new content instead of the top of the page.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
  }, [lessonId]);

  // Escape closes whichever overlay is open, and focus returns to its trigger.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (sourceTarget) {
        setSourceTarget(null);
        return;
      }
      if (outlineOpen) {
        setOutlineOpen(false);
        outlineButton.current?.focus();
        return;
      }
      if (toolsOpen) {
        setToolsOpen(false);
        toolsButton.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [outlineOpen, toolsOpen, sourceTarget]);

  const context: ReaderContext = {
    title: presentation.title,
    revisionId: presentation.revisionId,
    onSource,
    cropHref,
    explore: mode === "explore",
  };

  // The revision-level disclosure is correct but irrelevant to a lesson with no
  // display mathematics; showing it there would misdescribe the page.
  const lessonMath = useMemo(() => {
    const math =
      current?.lesson.blocks.filter(
        (entry): entry is typeof entry & { block: Extract<LessonBlockV2, { type: "math" }> } =>
          entry.block.type === "math",
      ) ?? [];
    return {
      total: math.length,
      reviewed: math.filter((entry) => Boolean(entry.block.review)).length,
    };
  }, [current]);

  // Assets for this lesson, grouped by the block they annotate. An asset with
  // no blockId is a lesson-level supplement and renders at the end.
  const assetsByBlock = useMemo(() => {
    const grouped = new Map<string, PublishedStructuredAssetV1[]>();
    const trailing: PublishedStructuredAssetV1[] = [];
    for (const asset of presentation.assets ?? []) {
      if (asset.lessonId !== current?.lesson.id) continue;
      if (!asset.blockId) {
        trailing.push(asset);
        continue;
      }
      const list = grouped.get(asset.blockId) ?? [];
      list.push(asset);
      grouped.set(asset.blockId, list);
    }
    return { grouped, trailing };
  }, [presentation.assets, current]);

  // The plan this reader will actually honour. Binding is checked once, here,
  // so the lookup below and the provenance label cannot disagree.
  const activePlan = useMemo(() => {
    if (!experiencePlan) return undefined;
    if (experiencePlan.courseId !== presentation.courseId) return undefined;
    if (experiencePlan.revisionId !== presentation.revisionId) return undefined;
    if (experiencePlan.lessonId !== current?.lesson.id) return undefined;
    return experiencePlan;
  }, [experiencePlan, presentation.courseId, presentation.revisionId, current]);

  const planByBlock = useMemo(() => {
    const map = new Map<string, { component: string; interactive: boolean }>();
    const plan = presentation.plan;
    if (plan)
      for (const lessonPlan of plan.lessons)
        for (const instance of lessonPlan.instances)
          map.set(instance.blockId, {
            component: instance.component,
            interactive: instance.interactive,
          });
    // A validated experience plan overrides component *choice* only. It is
    // applied only when it is bound to this exact revision and lesson: a plan
    // for another revision is ignored, never partially applied.
    if (activePlan)
      for (const placement of activePlan.canonical)
        map.set(placement.blockId, {
          component: placement.component,
          // A plan's disclosure is a presentation hint; interactivity remains a
          // property of the component, decided by the reader below.
          interactive: map.get(placement.blockId)?.interactive ?? false,
        });
    return map;
  }, [presentation.plan, activePlan]);

  if (!current)
    return (
      <div role="status" className="mx-auto max-w-3xl rounded-xl border p-8 text-center">
        <h1 className="font-heading text-xl font-semibold">This lesson is not in this revision</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The selected lesson is not part of the published revision. Open the first lesson instead.
        </p>
        <Button asChild className="mt-4">
          <Link href={hrefFor(flat[0]?.lesson.id ?? "", "read")}>
            Go to the first lesson
          </Link>
        </Button>
      </div>
    );

  const filtered = query.trim()
    ? flat.filter((entry) => {
        const needle = query.trim().toLowerCase();
        return (
          entry.lesson.title.toLowerCase().includes(needle) ||
          entry.chapterTitle.toLowerCase().includes(needle)
        );
      })
    : flat;

  const outline = (
    <nav aria-label="Course outline" className="space-y-4">
      {presentation.chapters.map((chapter) => {
        const chapterLessons = filtered.filter((entry) => entry.chapterId === chapter.id);
        if (!chapterLessons.length) return null;
        return (
          <div key={chapter.id}>
            <p className="px-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {chapter.title}
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {chapterLessons.map((entry) => {
                const isCurrent = entry.lesson.id === current.lesson.id;
                return (
                  <li key={entry.lesson.id}>
                    <Link
                      href={hrefFor(entry.lesson.id, mode)}
                      aria-current={isCurrent ? "page" : undefined}
                      onClick={() => setOutlineOpen(false)}
                      className={`block rounded-md px-2.5 py-1.5 text-sm leading-5 transition-colors ${
                        isCurrent
                          ? "bg-primary/15 font-medium text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {entry.lesson.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {filtered.length === 0 && (
        <p className="px-2 text-sm text-muted-foreground">No lesson matches “{query.trim()}”.</p>
      )}
    </nav>
  );

  return (
    <div
      className="min-w-0"
      data-reader-mode={mode}
      data-lesson-id={current.lesson.id}
      // Stable hooks the acceptance suite asserts on. They describe this
      // reader; nothing renders from them.
      data-presentation-view
      data-presentation-status={presentation.verification.status}
    >
      <div className="mx-auto grid min-w-0 max-w-[100rem] gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_19rem]">
        {/* A. Course navigation */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Course
              </p>
              <p className="mt-1 font-heading text-sm font-semibold leading-5">{presentation.title}</p>
            </div>
            <label htmlFor="outline-search" className="sr-only">
              Search the course outline
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="outline-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search lessons"
                className="h-8 pl-8 text-xs"
              />
            </div>
            <div className="max-h-[calc(100vh-16rem)] overflow-y-auto pr-1">{outline}</div>
            <p className="text-[0.68rem] leading-5 text-muted-foreground">
              {flat.length} lessons · revision {presentation.revisionId}
            </p>
          </div>
        </aside>

        {/* B. Main learning surface */}
        <main className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2 lg:hidden">
            <Button
              ref={outlineButton}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOutlineOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={outlineOpen}
            >
              <ListTree data-icon="inline-start" /> Outline
            </Button>
            <Button
              ref={toolsButton}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setToolsOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={toolsOpen}
            >
              <PanelRight data-icon="inline-start" /> Tools
            </Button>
          </div>

          <article className="min-w-0" data-presentation-lesson={current.lesson.id}>
            <header className="border-b pb-6">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="gap-1.5">
                  <BookOpen className="size-3" /> {current.chapterTitle}
                </Badge>
                <span>
                  Lesson {index + 1} of {flat.length}
                </span>
              </div>
              <h1
                ref={heading}
                tabIndex={-1}
                className="mt-3 scroll-mt-24 font-heading text-2xl font-semibold tracking-tight outline-none sm:text-3xl"
              >
                {current.lesson.title}
              </h1>
              {current.lesson.summary && (
                <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
                  {current.lesson.summary}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <div
                  role="group"
                  aria-label="Reader mode"
                  className="flex rounded-lg border p-0.5"
                >
                  {(Object.keys(MODE_LABELS) as ReaderMode[]).map((option) => (
                    <Link
                      key={option}
                      href={hrefFor(current.lesson.id, option)}
                      onClick={() => setMode(option)}
                      aria-current={mode === option ? "true" : undefined}
                      scroll={false}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                        mode === option
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {MODE_LABELS[option]}
                    </Link>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">{MODE_HINTS[mode]}</span>
              </div>

              {lessonMath.total > 0 && (
                <div
                  role="note"
                  aria-label="Content verification status"
                  className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm leading-6"
                >
                  <p className="flex items-start gap-2">
                    <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                    <span>{presentation.verification.disclosure}</span>
                  </p>
                  <p className="mt-1.5 pl-6 text-xs text-muted-foreground">
                    This lesson: {lessonMath.reviewed} of {lessonMath.total} display formulas have
                    instructor review. Across the revision:{" "}
                    {presentation.verification.math.reviewed} of{" "}
                    {presentation.verification.math.total}.
                  </p>
                </div>
              )}

              {/* A planned layout is a development/QA presentation, so it is
                  labelled rather than presented as ordinary course layout. The
                  label is deliberately small: it states provenance without
                  turning the lesson into a debugging surface. */}
              {activePlan && (
                <p
                  role="note"
                  data-experience-plan={activePlan.planId}
                  data-experience-plan-digest={activePlan.digest}
                  data-experience-plan-planner={activePlan.planner.implementation}
                  className="mt-4 flex items-start gap-2 rounded-lg border border-brand-cyan/40 bg-brand-cyan/[0.06] px-4 py-2.5 text-xs leading-5 text-muted-foreground"
                >
                  <ListTree className="mt-0.5 size-3.5 shrink-0 text-brand-cyan" />
                  <span>
                    Planned layout ({activePlan.planner.implementation} v
                    {activePlan.planner.version}). {activePlan.disclosure}
                  </span>
                </p>
              )}
            </header>

            {mode === "practice" && (
              <section className="border-b py-6" aria-labelledby="practice-in-lesson">
                <h2 id="practice-in-lesson" className="font-heading text-lg font-semibold">
                  Practice this lesson
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Practice uses the course&apos;s reviewed activities and the existing feedback
                  tools. Reading this lesson does not record completion or mastery.
                </p>
                <Button asChild className="mt-4">
                  <Link href={practiceHref}>
                    <GraduationCap data-icon="inline-start" /> Open practice and tutor
                  </Link>
                </Button>
              </section>
            )}

            {mode === "explore" && (
              <ExplorationPanel
                explorations={explorationsForLesson(
                  current.lesson.blocks.map((entry) => entry.block),
                  current.lesson.title,
                )}
              />
            )}

            <div className="py-2">
              {current.lesson.blocks.length === 0 ? (
                <p role="status" className="py-8 text-sm text-muted-foreground">
                  This lesson has no source content in this revision.
                </p>
              ) : (
                current.lesson.blocks.map((entry) => {
                  const planned = planByBlock.get(entry.id);
                  const component = planned?.component ?? "ConceptExplanation";
                  // Read mode is a reading projection: an interactive instance
                  // falls back to its static component rather than mounting it.
                  const effective =
                    !context.explore && planned?.interactive
                      ? staticFallback(component)
                      : component;
                  const blockAssets = assetsByBlock.grouped.get(entry.id) ?? [];
                  return (
                    <div
                      key={entry.id}
                      data-presentation-policy={entry.render}
                      data-presentation-reason={entry.reason}
                    >
                      <PlannedBlockView
                        component={effective as never}
                        block={entry.block}
                        context={context}
                      />
                      {/* A structured asset follows the block it annotates. It
                          is a labelled supplement, never a replacement. */}
                      {blockAssets.map((asset) => (
                        <StructuredAssetView key={asset.assetId} asset={asset} />
                      ))}
                    </div>
                  );
                })
              )}
              {assetsByBlock.trailing.map((asset) => (
                <StructuredAssetView key={asset.assetId} asset={asset} />
              ))}
            </div>

            <nav aria-label="Lesson navigation" className="mt-8 flex items-center justify-between gap-3 border-t pt-6">
              {previous ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={hrefFor(previous.lesson.id, mode)} rel="prev">
                    <ChevronLeft data-icon="inline-start" /> Previous lesson
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              {next ? (
                <Button asChild size="sm">
                  <Link href={hrefFor(next.lesson.id, mode)} rel="next">
                    Next lesson <ChevronRight data-icon="inline-end" />
                  </Link>
                </Button>
              ) : (
                <Button asChild size="sm" variant="outline">
                  <Link href={practiceHref}>
                    <GraduationCap data-icon="inline-start" /> Practise this course
                  </Link>
                </Button>
              )}
            </nav>
          </article>
        </main>

        {/* C. Contextual learning tools */}
        <aside className="hidden xl:block">
          <div className="sticky top-24 space-y-5">
            <section className="rounded-xl border bg-card/60 p-4">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <MessageCircleQuestion className="size-3.5" /> Learning tools
              </h2>
              <div className="mt-3 space-y-2">
                <Link
                  href={practiceHref}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <GraduationCap className="size-4 text-primary" /> Practice and tutor
                </Link>
                <Link
                  href={fallbackHref}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <FileText className="size-4 text-muted-foreground" /> Deterministic source-faithful reader
                </Link>
              </div>
            </section>

            <section className="rounded-xl border bg-card/60 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Original sources
              </h2>
              <ul className="mt-3 space-y-2">
                {presentation.sources.map((source, sourceIndex) => (
                  <li key={source.documentId}>
                    <a
                      href={source.href}
                      className="flex items-start gap-2 text-xs leading-5 text-muted-foreground hover:text-foreground"
                    >
                      <FileText className="mt-0.5 size-3.5 shrink-0" /> Original source{" "}
                      {sourceIndex + 1}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[0.68rem] leading-5 text-muted-foreground">
                Source links stay bound to revision {presentation.revisionId}.
              </p>
            </section>

            {presentation.objectives.length > 0 && (
              <section className="rounded-xl border bg-card/60 p-4">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  What you will learn
                </h2>
                <ul className="mt-3 space-y-2">
                  {presentation.objectives.slice(0, 6).map((objective) => (
                    <li key={objective.objectiveId} className="flex gap-2 text-xs leading-5">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      {objective.statement}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </aside>
      </div>

      {outlineOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 p-4 lg:hidden"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOutlineOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-outline-title"
            className="mx-auto mt-12 max-h-[80vh] max-w-sm overflow-y-auto rounded-2xl border bg-card p-5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 id="mobile-outline-title" className="font-heading text-lg font-semibold">
                Course outline
              </h2>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => {
                  setOutlineOpen(false);
                  outlineButton.current?.focus();
                }}
                aria-label="Close course outline"
              >
                <X />
              </Button>
            </div>
            <div className="mt-4">{outline}</div>
          </div>
        </div>
      )}

      {toolsOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 p-4 xl:hidden"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setToolsOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-tools-title"
            className="mx-auto mt-12 max-w-sm rounded-2xl border bg-card p-5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2 id="mobile-tools-title" className="font-heading text-lg font-semibold">
                Learning tools
              </h2>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => {
                  setToolsOpen(false);
                  toolsButton.current?.focus();
                }}
                aria-label="Close learning tools"
              >
                <X />
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              <Link
                href={practiceHref}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
              >
                <GraduationCap className="size-4 text-primary" /> Practice and tutor
              </Link>
              <Link
                href={fallbackHref}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
              >
                <FileText className="size-4 text-muted-foreground" /> Deterministic source-faithful reader
              </Link>
              {presentation.sources.map((source, sourceIndex) => (
                <a
                  key={source.documentId}
                  href={source.href}
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
                >
                  <FileText className="size-4 text-muted-foreground" /> Original source{" "}
                  {sourceIndex + 1}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {sourceTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setSourceTarget(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="source-dialog-title"
            className="w-full max-w-xl rounded-2xl border bg-card p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="source-dialog-title" className="font-heading text-xl font-semibold">
                  Source reference
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Bound to the preserved document of this revision. Extraction fidelity and
                  mathematical correctness are not independently verified.
                </p>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setSourceTarget(null)}
                aria-label="Close source reference"
              >
                <X />
              </Button>
            </div>
            <p className="mt-5 text-sm leading-6">
              {sourceTarget.page
                ? `Page ${sourceTarget.page} of the original document.`
                : "Text source; the original has no page number."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              The link downloads the preserved original file; open it in a PDF reader to reach that
              page.
            </p>
            {sourceTarget.cropHref && (
              <img
                className="mt-4 max-h-80 max-w-full rounded border bg-white object-contain"
                src={sourceTarget.cropHref}
                alt="Original region from the source document"
                loading="lazy"
              />
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

/** Explore-mode visualisations. Every one is explicitly a deterministic demo,
 * never source content and never a proof. A lesson with no match shows
 * nothing rather than a forced interaction. */
function ExplorationPanel({ explorations }: { explorations: Exploration[] }) {
  if (!explorations.length) return null;
  return (
    <section aria-labelledby="explorations-title" className="border-b py-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="explorations-title" className="font-heading text-lg font-semibold">
          Explore this lesson
        </h2>
        <Badge variant="outline" className="text-[0.68rem]">
          Deterministic demo
        </Badge>
      </div>
      <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
        {EXPLORATION_DISCLOSURE}
      </p>
      <div className="mt-4 space-y-5">
        {explorations.map((exploration) => (
          <Suspense key={exploration.id} fallback={<LoadingBlock />}>
            {exploration.kind === "function" ? (
              <FunctionGraph
                expression={exploration.expression}
                title={exploration.title}
                caption={exploration.caption}
                {...(exploration.variable ? { variable: exploration.variable } : {})}
                {...(exploration.domain ? { domain: exploration.domain } : {})}
                {...(exploration.parameters ? { parameters: exploration.parameters } : {})}
              />
            ) : exploration.kind === "sequence" ? (
              <SequenceVisualizer
                term={exploration.term}
                title={exploration.title}
                caption={exploration.caption}
                {...(exploration.behaviour ? { behaviour: exploration.behaviour } : {})}
              />
            ) : exploration.kind === "code" ? (
              <CodeWalkthrough
                title={exploration.title}
                caption={exploration.caption}
                language={exploration.language}
                code={exploration.code}
                annotations={exploration.annotations}
              />
            ) : exploration.kind === "topology" ? (
              <InteractiveDiagram
                title={exploration.title}
                description={exploration.caption}
                nodes={exploration.nodes}
                links={exploration.links}
              />
            ) : (
              <DerivationStepper
                title={exploration.title}
                caption={exploration.caption}
                steps={exploration.steps}
              />
            )}
          </Suspense>
        ))}
      </div>
    </section>
  );
}

/** Read mode substitutes the static component for an interactive instance. */
function staticFallback(component: string): string {
  switch (component) {
    case "DerivationBlock":
      return "DerivationBlock";
    case "ProofBlock":
      return "ProofBlock";
    case "ProcessDiagram":
      return "ProcessDiagram";
    case "DataChart":
      return "DataChart";
    default:
      return component;
  }
}

export function lessonHref(
  presentation: PublishedPresentationV1,
  lessonId: string,
  mode: ReaderMode,
  /** Route the reader is mounted at. The preview mounts it elsewhere, so the
   * links must not assume the production path. */
  basePath = `/courses/${presentation.courseId}/present`,
): string {
  const params = new URLSearchParams({ revisionId: presentation.revisionId, lesson: lessonId });
  if (mode !== "read") params.set("mode", mode);
  return `${basePath}?${params.toString()}`;
}
