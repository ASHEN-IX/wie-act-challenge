"use client";

import { useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Lightbulb, MessageCircleQuestion, Sparkles } from "lucide-react";
import type { LessonBlockV2 } from "@ednova/shared/ednova/learningDocumentV2";
import { Button } from "@/components/ui/button";
import { askLearningTutor } from "@/features/learning/journey-actions";
import { learningErrorMessage } from "@/features/learning/learning-errors";
import {
  TutorThread,
  type TutorAnswerData,
  type TutorCitation,
} from "@/features/learning/tutor-answer";
import { HELP_ACTIONS, buildHelpQuestion, helpLabel, type HelpMode } from "./lesson-help";
import { clean, isRecallKind, type ConceptKind, type LessonStep, type StepItem } from "./lesson-structure";
import { LearningBlockView, type ReaderContext } from "./registry";

export type TutorTarget = { courseId: string; revisionId: string; topicId: string; objectiveId: string };

type Paragraph = Extract<LessonBlockV2, { type: "paragraph" }>;
type OnHelp = (mode: HelpMode, focus?: { title: string; text?: string }) => void;

const KIND: Record<ConceptKind, { label: string; bar: string; chip: string }> = {
  definition: { label: "Definition", bar: "border-sky-500", chip: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  theorem: { label: "Theorem", bar: "border-violet-500", chip: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  proposition: { label: "Proposition", bar: "border-violet-500", chip: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  lemma: { label: "Lemma", bar: "border-violet-500", chip: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  corollary: { label: "Corollary", bar: "border-violet-500", chip: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  example: { label: "Example", bar: "border-emerald-500", chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  exercise: { label: "Exercise", bar: "border-amber-500", chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  remark: { label: "Remark", bar: "border-slate-400", chip: "bg-slate-500/10 text-slate-700 dark:text-slate-300" },
  proof: { label: "Proof", bar: "border-slate-400", chip: "bg-slate-500/10 text-slate-700 dark:text-slate-300" },
  note: { label: "Note", bar: "border-slate-400", chip: "bg-slate-500/10 text-slate-700 dark:text-slate-300" },
};

const PROSE = "max-w-[68ch] text-[1.0625rem] leading-8 text-foreground/90";

function SourceButton({ block, context }: { block: Paragraph; context: ReaderContext }) {
  if (!block.evidence.length || !context.onSource) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="ml-1 align-baseline text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover/prose:opacity-100 max-md:opacity-100"
      onClick={() => context.onSource?.(block)}
      aria-label="View source of this paragraph"
    >
      Source
    </Button>
  );
}

function Items({ items, context, onHelp }: { items: StepItem[]; context: ReaderContext; onHelp: OnHelp }): ReactNode {
  return items.map((item) => {
    switch (item.kind) {
      case "prose":
        return (
          <div key={item.id} className="group/prose">
            <p className={PROSE}>
              {item.text}
              <SourceButton block={item.block} context={context} />
            </p>
            {item.reviewRequired && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                The automatic reading of this passage needs review. Check it against the original.
              </p>
            )}
          </div>
        );
      case "bullets":
        return (
          <ul key={item.id} className={`${PROSE} list-disc space-y-1.5 pl-6`}>
            {item.items.map((text, i) => <li key={i} className="pl-1">{text}</li>)}
          </ul>
        );
      case "concept":
        return <ConceptCard key={item.id} item={item} context={context} onHelp={onHelp} />;
      default:
        return <LearningBlockView key={item.id} block={item.block} context={context} />;
    }
  });
}

function ConceptCard({
  item,
  context,
  onHelp,
}: {
  item: Extract<StepItem, { kind: "concept" }>;
  context: ReaderContext;
  onHelp: OnHelp;
}) {
  const style = KIND[item.conceptKind];
  const [open, setOpen] = useState(item.conceptKind !== "proof");
  const focus = { title: item.title, text: item.text || undefined };
  return (
    <section id={`concept-${item.id}`} aria-label={item.title} className={`scroll-mt-28 rounded-r-lg border-l-4 bg-muted/30 py-3 pl-4 pr-3 ${style.bar}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${style.chip}`}>{style.label}</span>
        <h3 className="font-heading text-base font-semibold">{item.title}</h3>
        {item.conceptKind === "proof" && (
          <Button type="button" size="xs" variant="ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? "Hide proof" : "Show proof"}
            <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
          </Button>
        )}
      </div>
      {open && (
        <div className="mt-2 space-y-3">
          {item.text && <p className={`${PROSE} whitespace-pre-line`}>{item.text}</p>}
          {item.body.length > 0 && <Items items={item.body} context={context} onHelp={onHelp} />}
          {item.conceptKind === "exercise" && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button type="button" size="sm" variant="outline" onClick={() => onHelp("hint", focus)}>
                <Lightbulb data-icon="inline-start" /> Give me a hint
              </Button>
              <span className="text-xs text-muted-foreground">Try it on paper first. The tutor hints, it does not solve it.</span>
            </div>
          )}
          {item.conceptKind === "example" && (
            <Button type="button" size="sm" variant="ghost" onClick={() => onHelp("steps", focus)}>
              <MessageCircleQuestion data-icon="inline-start" /> Walk me through it
            </Button>
          )}
          {item.conceptKind === "definition" && (
            <Button type="button" size="sm" variant="ghost" onClick={() => onHelp("simpler", focus)}>
              <MessageCircleQuestion data-icon="inline-start" /> Explain simply
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

/** Retrieval practice: say it from memory, then check. No grading is claimed. */
function RecallCheck({ step }: { step: LessonStep }) {
  const recall = step.concepts.filter((c) => isRecallKind(c.kind) && c.text).slice(0, 4);
  const [shown, setShown] = useState<Set<string>>(new Set());
  if (!recall.length) return null;
  return (
    <section aria-labelledby={`${step.id}-recall`} className="space-y-3 border-t pt-6">
      <div>
        <h3 id={`${step.id}-recall`} className="font-heading text-lg font-semibold">Check yourself</h3>
        <p className="text-sm text-muted-foreground">Say each one out loud or write it down before you reveal it. Recalling it is what makes it stick.</p>
      </div>
      <ul className="space-y-2">
        {recall.map((c) => {
          const open = shown.has(c.id);
          return (
            <li key={c.id} className="rounded-lg border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">State: {c.title}</span>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  aria-expanded={open}
                  onClick={() => setShown((prev) => { const next = new Set(prev); if (!next.delete(c.id)) next.add(c.id); return next; })}
                >
                  {open ? "Hide" : "Reveal"}
                </Button>
              </div>
              {open && <p className="mt-2 whitespace-pre-line text-sm leading-7">{c.text}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type Thread = { question: string | null; asking: boolean; answer: TutorAnswerData | null; error: string | null };

function useStepHelp(tutor: TutorTarget | null, step: LessonStep) {
  const [thread, setThread] = useState<Thread>({ question: null, asking: false, answer: null, error: null });
  const panel = useRef<HTMLElement | null>(null);
  const busy = useRef(false);
  const ask: OnHelp = (mode, focus) => run(mode, focus);
  function run(mode: HelpMode, focus?: { title: string; text?: string }, free?: string) {
    if (!tutor || busy.current) return;
    busy.current = true;
    const shownTitle = focus?.title ?? step.title;
    setThread({ question: helpLabel(mode, shownTitle, free), asking: true, answer: null, error: null });
    panel.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    askLearningTutor(tutor.courseId, {
      revisionId: tutor.revisionId,
      topicId: tutor.topicId,
      objectiveId: tutor.objectiveId,
      question: buildHelpQuestion(mode, { stepTitle: step.title, focusTitle: focus?.title, focusText: focus?.text, question: free }),
    })
      .then((answer) => setThread((t) => ({ ...t, asking: false, answer })))
      .catch((e) => setThread((t) => ({ ...t, asking: false, error: learningErrorMessage(e) })))
      .finally(() => { busy.current = false; });
  }
  return { thread, panel, ask, free: (text: string) => run("free", undefined, text) };
}

function HelpPanel({
  help,
  sourceHref,
  title,
}: {
  help: ReturnType<typeof useStepHelp>;
  sourceHref: (c: TutorCitation) => string;
  title: string;
}) {
  const [text, setText] = useState("");
  const { thread } = help;
  return (
    <section ref={help.panel} aria-labelledby="step-help" className="space-y-3 border-t pt-6">
      <div className="flex items-center gap-2">
        <Sparkles aria-hidden className="size-4 text-primary" />
        <h3 id="step-help" className="font-heading text-lg font-semibold">Stuck on “{title}”?</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {HELP_ACTIONS.map((a) => (
          <Button key={a.mode} type="button" size="sm" variant="outline" disabled={thread.asking} onClick={() => help.ask(a.mode)}>
            {a.label}
          </Button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); if (text.trim()) { help.free(text); setText(""); } }}
      >
        <input
          aria-label="Ask about this part"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask about this part in your own words"
          maxLength={500}
          className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={thread.asking || !text.trim()}>Ask</Button>
      </form>
      <TutorThread
        question={thread.question}
        pending={thread.asking}
        answer={thread.answer}
        error={thread.error}
        sourceHref={sourceHref}
        onFollowUp={(followUp) => help.free(followUp)}
      />
    </section>
  );
}

export function StepView({
  step,
  context,
  tutor,
  sourceHref,
}: {
  step: LessonStep;
  context: ReaderContext;
  tutor: TutorTarget | null;
  sourceHref: (c: TutorCitation) => string;
}) {
  const help = useStepHelp(tutor, step);
  const onHelp: OnHelp = (mode, focus) => (tutor ? help.ask(mode, focus) : undefined);
  const { counts } = step;
  const facts = [
    counts.definitions && `${counts.definitions} ${counts.definitions === 1 ? "definition" : "definitions"}`,
    counts.results && `${counts.results} ${counts.results === 1 ? "result" : "results"}`,
    counts.examples && `${counts.examples} ${counts.examples === 1 ? "example" : "examples"}`,
    counts.exercises && `${counts.exercises} ${counts.exercises === 1 ? "exercise" : "exercises"}`,
  ].filter(Boolean) as string[];
  const outline = step.concepts.filter((c) => c.kind !== "proof" && c.kind !== "note");

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        {step.group && <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{step.group}</p>}
        <h2 id="step-title" tabIndex={-1} className="font-heading text-2xl font-semibold tracking-tight outline-none sm:text-3xl">
          {step.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          About {step.minutes} min{facts.length ? ` · ${facts.join(" · ")}` : ""}
        </p>
        {outline.length >= 2 && (
          <nav aria-label="In this part" className="flex flex-wrap gap-1.5 pt-1">
            {outline.slice(0, 12).map((c) => (
              <a key={c.id} href={`#concept-${c.id}`} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                {clean(c.title)}
              </a>
            ))}
          </nav>
        )}
      </header>
      <div className="space-y-5">
        <Items items={step.items} context={context} onHelp={onHelp} />
      </div>
      <RecallCheck step={step} />
      {tutor && <HelpPanel help={help} sourceHref={sourceHref} title={step.title} />}
    </div>
  );
}

export function DoneToggle({ done, onToggle }: { done: boolean; onToggle: () => void }) {
  return (
    <Button type="button" variant={done ? "secondary" : "outline"} onClick={onToggle} aria-pressed={done}>
      <Check data-icon="inline-start" /> {done ? "Marked as understood" : "Mark as understood"}
    </Button>
  );
}

