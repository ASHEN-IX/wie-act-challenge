"use client";

import { Fragment, useId, useState, type ReactNode } from "react";
import {
  BookOpenCheck,
  Check,
  ChevronDown,
  Copy,
  FileText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AiModeNote, AiWaitStatus } from "@/features/ai-status/ai-status-view";

export type TutorCitation = {
  documentId: string;
  pageNumber: number | null;
  chunkId?: string;
  quote?: string;
  [key: string]: unknown;
};

export type TutorAnswerData = {
  status: string;
  answer?: string;
  executionMode?: string;
  citationsValid?: boolean;
  citations?: TutorCitation[];
  [key: string]: unknown;
};

const FOLLOW_UPS = [
  "Explain this more simply",
  "Give me a worked example",
  "Quiz me on this",
] as const;

// Citation markers are produced by the AI service: [doc:ID, p:PAGE, chunk:CHUNK].
const MARKER = /\[doc:[A-Za-z0-9_-]+(?:, p:\d+)?, chunk:(chk_[a-f0-9]{64})\]/g;

type Segment = { text: string } | { cite: number };

/** Splits an answer into text and numbered citation references. */
export function segmentAnswer(
  answer: string,
  citations: TutorCitation[],
): Segment[] {
  const order: string[] = [];
  const number = (chunk: string) => {
    let index = order.indexOf(chunk);
    if (index < 0) index = order.push(chunk) - 1;
    return index;
  };
  const known = new Set(citations.map((c) => c.chunkId));
  const segments: Segment[] = [];
  let last = 0;
  for (const match of answer.matchAll(MARKER)) {
    if (match.index > last) segments.push({ text: answer.slice(last, match.index) });
    if (known.has(match[1])) segments.push({ cite: number(match[1]) });
    last = match.index + match[0].length;
  }
  if (last < answer.length) segments.push({ text: answer.slice(last) });
  return segments;
}

/** Removes citation markers and collapses PDF line breaks into readable prose. */
export function cleanExcerpt(text: string): string {
  return text
    .replace(MARKER, "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function inline(text: string, keyBase: string): ReactNode[] {
  // **bold** and `code` only; everything else stays literal text.
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      return <strong key={`${keyBase}-${i}`}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
      return (
        <code
          key={`${keyBase}-${i}`}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    return <Fragment key={`${keyBase}-${i}`}>{part}</Fragment>;
  });
}

function Prose({
  segments,
  onCite,
}: {
  segments: Segment[];
  onCite: (n: number) => void;
}) {
  // Blocks are split on blank lines; list lines are grouped. Citation chips
  // stay attached to the text that precedes them.
  const blocks: Array<{ kind: "p" | "ul" | "ol"; items: Segment[][] }> = [];
  let current: Segment[] = [];
  const flush = () => {
    if (current.length) blocks.push({ kind: "p", items: [current] });
    current = [];
  };
  for (const segment of segments) {
    if ("cite" in segment) {
      current.push(segment);
      continue;
    }
    const lines = segment.text.split("\n");
    lines.forEach((line, i) => {
      if (i > 0 && line.trim() === "" && lines[i - 1].trim() === "") return;
      const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
      const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
      if (bullet || numbered) {
        flush();
        const kind = bullet ? "ul" : "ol";
        const item: Segment[] = [{ text: (bullet ?? numbered)![1] }];
        const previous = blocks[blocks.length - 1];
        if (previous && previous.kind === kind) previous.items.push(item);
        else blocks.push({ kind, items: [item] });
      } else if (line.trim() === "") {
        flush();
      } else {
        current.push({ text: (current.length ? " " : "") + line.trim() });
      }
    });
  }
  flush();

  const render = (parts: Segment[], key: string) =>
    parts.map((part, i) =>
      "cite" in part ? (
        <button
          key={`${key}-${i}`}
          type="button"
          onClick={() => onCite(part.cite)}
          aria-label={`Go to source ${part.cite + 1}`}
          className="mx-0.5 inline-flex size-5 -translate-y-0.5 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary align-middle hover:bg-primary/25 focus-visible:ring-2 focus-visible:ring-ring"
        >
          {part.cite + 1}
        </button>
      ) : (
        <Fragment key={`${key}-${i}`}>{inline(part.text, `${key}-${i}`)}</Fragment>
      ),
    );

  return (
    <div className="space-y-3 text-[15px] leading-7">
      {blocks.map((block, b) =>
        block.kind === "p" ? (
          <p key={b}>{render(block.items[0], `b${b}`)}</p>
        ) : block.kind === "ul" ? (
          <ul key={b} className="list-disc space-y-1 pl-5">
            {block.items.map((item, i) => (
              <li key={i}>{render(item, `b${b}-${i}`)}</li>
            ))}
          </ul>
        ) : (
          <ol key={b} className="list-decimal space-y-1 pl-5">
            {block.items.map((item, i) => (
              <li key={i}>{render(item, `b${b}-${i}`)}</li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}

function SourceCard({
  id,
  index,
  citation,
  href,
}: {
  id: string;
  index: number;
  citation: TutorCitation;
  href: string;
}) {
  const [open, setOpen] = useState(false);
  const quote = cleanExcerpt(String(citation.quote ?? ""));
  return (
    <li
      id={id}
      tabIndex={-1}
      className="scroll-mt-24 rounded-xl border bg-muted/30 p-3 target:ring-2 target:ring-primary/40"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
          {index + 1}
        </span>
        <FileText aria-hidden className="size-4 text-muted-foreground" />
        <a
          href={href}
          className="text-sm font-medium underline-offset-4 hover:underline"
        >
          Open original
          {citation.pageNumber ? `, page ${citation.pageNumber}` : " (text; no page)"}
        </a>
      </div>
      {quote && (
        <>
          <p
            className={`mt-2 text-sm leading-6 text-muted-foreground ${open ? "" : "line-clamp-3"}`}
          >
            “{quote}”
          </p>
          {quote.length > 220 && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {open ? "Show less" : "Show more"}
              <ChevronDown
                aria-hidden
                className={`size-3 transition-transform ${open ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </>
      )}
    </li>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

/**
 * Chat-style presentation of one source-grounded tutor exchange: the learner's
 * question, then the tutor's reply with numbered, verifiable source cards.
 */
export function TutorThread({
  question,
  pending,
  answer,
  error,
  sourceHref,
  onFollowUp,
}: {
  question: string | null;
  pending: boolean;
  answer: TutorAnswerData | null;
  error: string | null;
  sourceHref: (citation: TutorCitation) => string;
  onFollowUp: (text: string) => void;
}) {
  const scope = useId();
  if (!question && !pending && !answer && !error) return null;

  const citations = answer?.citations ?? [];
  const mode = answer?.executionMode;
  const excerptOnly = mode === "DETERMINISTIC_FALLBACK" || mode === "UNAVAILABLE";
  const noEvidence = answer?.status === "insufficient_evidence";
  const verified = answer?.status === "verified" && answer.citationsValid === true;
  const sourceId = (n: number) => `${scope}-source-${n}`;
  const goToSource = (n: number) => {
    const el = document.getElementById(sourceId(n));
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus?.();
  };

  const plain = answer?.answer ? cleanExcerpt(answer.answer) : "";

  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Tutor conversation"
      className="mt-4 space-y-4"
    >
      {question && (
        <div className="flex justify-end">
          <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] leading-6 text-primary-foreground">
            {question}
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <span
          aria-hidden
          className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
        >
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Course tutor</span>
            {excerptOnly && !noEvidence && (
              <Badge variant="outline">Closest passage</Badge>
            )}
            {verified && !excerptOnly && (
              <Badge variant="secondary">
                <ShieldCheck data-icon="inline-start" aria-hidden />
                Checked against your sources
              </Badge>
            )}
            {answer && !verified && !excerptOnly && !noEvidence && (
              <Badge variant="outline">Tentative</Badge>
            )}
          </div>

          {pending && !answer && (
            <div className="rounded-2xl rounded-tl-md border bg-card px-4 py-3">
              <AiWaitStatus />
            </div>
          )}

          {error && !pending && (
            <p
              role="alert"
              className="rounded-2xl rounded-tl-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          {answer && (
            <div data-testid="tutor-answer" className="space-y-3">
              <div className="rounded-2xl rounded-tl-md border bg-card px-4 py-3">
                {noEvidence ? (
                  <div className="flex gap-2 text-[15px] leading-7">
                    <BookOpenCheck
                      aria-hidden
                      className="mt-1 size-4 shrink-0 text-muted-foreground"
                    />
                    <p>
                      I couldn’t find this in your course material. Try rephrasing
                      with a term from the lesson, or ask about a specific section.
                    </p>
                  </div>
                ) : excerptOnly ? (
                  <div className="space-y-2">
                    <p className="text-[15px] leading-7">
                      I can’t write an explanation right now, so here is the
                      closest passage from your course
                      {citations.length > 0 ? ", shown below as a source." : "."}
                    </p>
                    {citations.length === 0 && (
                      <p className="line-clamp-6 rounded-lg border-l-2 border-primary/50 bg-muted/40 px-3 py-2 text-sm leading-6 text-muted-foreground">
                        {plain || "No verified answer available."}
                      </p>
                    )}
                  </div>
                ) : (
                  <Prose
                    segments={segmentAnswer(answer.answer ?? "", citations)}
                    onCite={(n) => goToSource(n)}
                  />
                )}
                <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2">
                  <div className="text-xs text-muted-foreground">
                    <AiModeNote mode={mode} />
                  </div>
                  {!excerptOnly && !noEvidence && answer.answer && (
                    <CopyButton text={cleanExcerpt(answer.answer)} />
                  )}
                </div>
              </div>

              {citations.length > 0 && (
                <section aria-label="Sources" className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Sources
                  </h4>
                  <ol className="space-y-2">
                    {citations.map((citation, i) => (
                      <SourceCard
                        key={`${citation.chunkId ?? citation.documentId}-${i}`}
                        id={sourceId(i)}
                        index={i}
                        citation={citation}
                        href={sourceHref(citation)}
                      />
                    ))}
                  </ol>
                </section>
              )}

              {!noEvidence && !excerptOnly && (
                <div className="flex flex-wrap gap-2" aria-label="Follow-up ideas">
                  {FOLLOW_UPS.map((text) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => onFollowUp(text)}
                      className="rounded-full border bg-background px-3 py-1 text-xs font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {text}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
