"use client";
import { useId, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tokenizeCode } from "../code-highlight";

export type WalkthroughAnnotation = {
  /** Zero-based line index in the source. */
  line: number;
  /** Trusted explanation for this line. */
  explanation: string;
  /** Approved state snapshot shown with the line, never derived at runtime. */
  state?: Array<{ name: string; value: string }>;
};

export type CodeWalkthroughProps = {
  title: string;
  language: string;
  code: string;
  annotations: WalkthroughAnnotation[];
  caption?: string;
};

/**
 * Guided progression over annotated source lines. The source is never
 * executed; explanations and state snapshots come from the trusted fixture.
 */
export function CodeWalkthrough({
  title,
  language,
  code,
  annotations,
  caption,
}: CodeWalkthroughProps) {
  const id = useId();
  const lines = useMemo(() => code.split("\n"), [code]);
  const ordered = useMemo(
    () => [...annotations].sort((a, b) => a.line - b.line).filter((a) => a.line >= 0 && a.line < lines.length),
    [annotations, lines.length],
  );
  const [step, setStep] = useState(0);
  const current = ordered[Math.min(step, Math.max(0, ordered.length - 1))];

  if (!ordered.length)
    return (
      <div role="status" className="rounded-lg border p-4 text-sm">
        This code block has no reviewed walkthrough annotations.
      </div>
    );

  return (
    <figure className="overflow-hidden rounded-xl border bg-card" data-component="CodeWalkthrough">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <figcaption className="font-heading text-base font-semibold">{title}</figcaption>
          {caption && <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>}
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          Line {current.line + 1} of {lines.length} · step {step + 1} of {ordered.length}
        </span>
      </div>

      <div
        role="group"
        aria-labelledby={`${id}-current`}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowDown") {
            event.preventDefault();
            setStep((value) => Math.min(ordered.length - 1, value + 1));
          }
          if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            event.preventDefault();
            setStep((value) => Math.max(0, value - 1));
          }
        }}
        className="overflow-x-auto bg-slate-950 text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring dark:bg-black"
      >
        <pre className="min-w-max p-4 text-left text-sm leading-6">
          <code dir="ltr">
            {lines.map((line, index) => {
              const isCurrent = current.line === index;
              return (
                <span
                  key={index}
                  data-current-line={isCurrent ? "true" : undefined}
                  className={`block ${isCurrent ? "bg-brand-violet/25 -mx-4 px-4" : ""}`}
                >
                  <span aria-hidden="true" className="mr-4 inline-block w-8 select-none text-right text-slate-500">
                    {index + 1}
                  </span>
                  {tokenizeCode(line, language).map((token, tokenIndex) => (
                    <span key={tokenIndex} className={token.className}>
                      {token.text}
                    </span>
                  ))}
                  {line === "" ? " " : null}
                </span>
              );
            })}
          </code>
        </pre>
      </div>

      <div className="border-t px-4 py-3">
        <p id={`${id}-current`} className="text-sm leading-6" aria-live="polite">
          <span className="font-medium">Line {current.line + 1}: </span>
          {current.explanation}
        </p>
        {current.state && current.state.length > 0 && (
          <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
            {current.state.map((entry) => (
              <div key={entry.name} className="flex gap-1.5">
                <dt className="text-muted-foreground">{entry.name}</dt>
                <dd className="font-mono tabular-nums">{entry.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setStep((value) => Math.max(0, value - 1))}
            disabled={step === 0}
          >
            <ChevronLeft data-icon="inline-start" /> Previous
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setStep((value) => Math.min(ordered.length - 1, value + 1))}
            disabled={step === ordered.length - 1}
          >
            Next <ChevronRight data-icon="inline-end" />
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setStep(0)} disabled={step === 0}>
            <ListOrdered data-icon="inline-start" /> Restart
          </Button>
        </div>
      </div>

      <p className="border-t px-4 py-2 text-xs text-muted-foreground">
        Annotations come from the reviewed source. Code is displayed only and is never executed.
      </p>
    </figure>
  );
}

export default CodeWalkthrough;
