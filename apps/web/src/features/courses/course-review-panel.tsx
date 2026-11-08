"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  reviewDraft,
  type DraftReviewProposal,
  type DraftReviewResult,
} from "./studio-actions";

const VERDICT = {
  ready: { label: "Ready to publish", tone: "text-emerald-600" },
  needs_attention: { label: "Needs attention", tone: "text-amber-600" },
  blocked: { label: "Blocked", tone: "text-destructive" },
} as const;

/**
 * Automatic checks plus an optional AI proposal for titles and objectives.
 * It only reports and proposes; the instructor applies, saves and confirms.
 */
export function CourseReviewPanel({
  courseId,
  dirty,
  onApply,
}: {
  courseId: string;
  dirty: boolean;
  onApply: (proposal: DraftReviewProposal) => number;
}) {
  const [review, setReview] = useState<DraftReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<number | null>(null);
  const [pending, start] = useTransition();

  const run = (useAi: boolean) => {
    setError(null);
    setApplied(null);
    start(async () => {
      try {
        setReview(await reviewDraft(courseId, useAi));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Review failed.");
      }
    });
  };

  const proposal = review?.ai.proposal;
  const verdict = review ? VERDICT[review.verdict] : null;

  return (
    <section
      aria-label="Automated review"
      className="flex flex-col gap-4 rounded-xl border bg-card p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">
            Automated review
          </h2>
          <p className="text-sm text-muted-foreground">
            Checks structure, titles and objectives. It never publishes, and
            only you can confirm the source review.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={pending || dirty}
            onClick={() => run(false)}
          >
            {pending ? "Checking…" : "Run checks"}
          </Button>
          <Button disabled={pending || dirty} onClick={() => run(true)}>
            {pending ? "Reviewing…" : "Review with AI"}
          </Button>
        </div>
      </div>

      {dirty && (
        <p className="text-sm text-muted-foreground">
          Review reads your last saved draft. Save your changes first.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {applied !== null && !review && (
        <p role="status" className="text-sm">
          {applied
            ? `Updated ${applied} items in the editor. Save Draft, then run the checks again.`
            : "Nothing needed changing."}
        </p>
      )}

      {review && verdict && (
        <div className="flex flex-col gap-4" aria-live="polite">
          <p className="text-sm">
            <span className={`font-semibold ${verdict.tone}`}>
              {verdict.label}
            </span>{" "}
            <span className="text-muted-foreground">
              · {review.counts.chapters} chapters, {review.counts.lessons}{" "}
              lessons, {review.counts.objectives} objectives
            </span>
          </p>
          {review.findings.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {review.findings.map((f, i) => (
                <li key={`${f.code}-${f.subtopicId ?? i}`} className="flex gap-2 text-sm">
                  <Badge
                    variant={f.severity === "blocker" ? "destructive" : "outline"}
                    className="h-fit shrink-0"
                  >
                    {f.severity}
                  </Badge>
                  <span>{f.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No structural problems found.
            </p>
          )}

          {review.ai.status === "proposed" && proposal && (
            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <p className="text-sm font-medium">
                AI suggests {proposal.chapters.length} chapter titles and{" "}
                {proposal.lessons.length} lessons with rewritten titles and
                objectives.
              </p>
              <p className="text-xs text-muted-foreground">
                Suggestions use only the extracted text. They replace titles and
                objectives in the editor; nothing is saved or published until
                you do it. Read them before you save.
              </p>
              {proposal.notes.length > 0 && (
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  {proposal.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setApplied(onApply(proposal));
                    setReview(null);
                  }}
                >
                  Apply to editor
                </Button>
              </div>
            </div>
          )}
          {(review.ai.status === "unavailable" ||
            review.ai.status === "invalid") && (
            <p className="text-sm text-muted-foreground">
              {/^AI review/i.test(review.ai.reason ?? "") ? "" : "AI review: "}
              {review.ai.reason?.replace(/\.$/, "")}. The automatic checks above still
              apply.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
