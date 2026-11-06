"use client";
import { lazy, Suspense, useId, useState } from "react";
import { ChevronLeft, ChevronRight, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";

const MathContent = lazy(() => import("../math-content"));

export type DerivationStep = {
  /** Reviewed LaTeX for this step. Steps are shown, never generated. */
  expression: string;
  /** Optional source-backed explanation of the step. */
  explanation?: string;
};

export type DerivationStepperProps = {
  title: string;
  steps: DerivationStep[];
  caption?: string;
  /** Where the steps came from, for the source inspector. */
  provenanceNote?: string;
};

/**
 * Step navigation over reviewed derivation lines. The canonical order is the
 * source order: nothing is reordered, and a missing step is never filled in.
 */
export function DerivationStepper({ title, steps, caption, provenanceNote }: DerivationStepperProps) {
  const [index, setIndex] = useState(0);
  const id = useId();
  const total = steps.length;
  const safeIndex = Math.min(index, Math.max(0, total - 1));
  const current = steps[safeIndex];

  if (!total)
    return (
      <div role="status" className="rounded-lg border p-4 text-sm">
        This derivation has no reviewed steps to display.
      </div>
    );

  return (
    <figure className="rounded-xl border bg-card p-4 sm:p-5" data-component="DerivationStepper">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <figcaption className="font-heading text-base font-semibold">{title}</figcaption>
        <span className="text-xs tabular-nums text-muted-foreground">
          Step {safeIndex + 1} of {total}
        </span>
      </div>
      {caption && <p className="mt-1 text-sm leading-6 text-muted-foreground">{caption}</p>}

      <div
        role="group"
        aria-labelledby={`${id}-step`}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowDown") {
            event.preventDefault();
            setIndex((value) => Math.min(total - 1, value + 1));
          }
          if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            event.preventDefault();
            setIndex((value) => Math.max(0, value - 1));
          }
          if (event.key === "Home") {
            event.preventDefault();
            setIndex(0);
          }
          if (event.key === "End") {
            event.preventDefault();
            setIndex(total - 1);
          }
        }}
        className="mt-4 rounded-lg border bg-background/50 p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <p id={`${id}-step`} className="sr-only" aria-live="polite">
          Step {safeIndex + 1} of {total}
        </p>
        <Suspense
          fallback={
            <pre className="whitespace-pre-wrap break-words text-sm" dir="ltr">
              {current.expression}
            </pre>
          }
        >
          <MathContent expression={current.expression} notation="latex" />
        </Suspense>
        {current.explanation && (
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{current.explanation}</p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
          disabled={safeIndex === 0}
        >
          <ChevronLeft data-icon="inline-start" /> Previous step
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setIndex((value) => Math.min(total - 1, value + 1))}
          disabled={safeIndex === total - 1}
        >
          Next step <ChevronRight data-icon="inline-end" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setIndex(0)}
          disabled={safeIndex === 0}
        >
          <ListOrdered data-icon="inline-start" /> Restart
        </Button>
      </div>

      <details className="mt-4 rounded-lg bg-muted/40 p-3 text-xs">
        <summary className="cursor-pointer font-medium">All steps as text</summary>
        <ol className="mt-2 space-y-2">
          {steps.map((step, stepIndex) => (
            <li key={stepIndex} className="grid gap-1">
              <span className="font-medium">Step {stepIndex + 1}</span>
              <code dir="ltr" className="whitespace-pre-wrap break-words">
                {step.expression}
              </code>
              {step.explanation && <span className="text-muted-foreground">{step.explanation}</span>}
            </li>
          ))}
        </ol>
      </details>

      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {provenanceNote ??
          "Steps are reproduced from the reviewed source. Missing steps are not generated."}
      </p>
    </figure>
  );
}

export default DerivationStepper;
