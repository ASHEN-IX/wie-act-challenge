"use client";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { BadgeCheck, ImageOff, PencilRuler, ShieldQuestion } from "lucide-react";
import type { LessonBlockV2 } from "@noveris/shared/ednova/learningDocumentV2";
import { Badge } from "@/components/ui/badge";
import { cropAspect } from "../crop-aspect";
import { Button } from "@/components/ui/button";

const MathContent = lazy(() => import("../math-content"));

type MathBlock = Extract<LessonBlockV2, { type: "math" }>;

export type MathBlockContext = {
  cropHref?: (block: MathBlock) => string | undefined;
  onSource?: (block: MathBlock) => void;
};

function FormulaFigure({
  children,
  caption,
  status,
}: {
  children: React.ReactNode;
  caption?: string;
  status?: React.ReactNode;
}) {
  return (
    <figure className="my-6 overflow-x-auto rounded-xl border bg-muted/20 px-4 py-5">
      {status && <div className="mb-3 flex flex-wrap items-center justify-center gap-2">{status}</div>}
      <div className="text-center">{children}</div>
      {caption && <figcaption className="mt-3 text-center text-xs text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}

/** Reviewed display mathematics. Instructor review is stated exactly as that —
 * it is never presented as independent mathematical verification. */
export function ReviewedFormula({ block }: { block: MathBlock }) {
  const review = block.review!;
  const corrected = review.state === "corrected";
  return (
    <FormulaFigure
      caption={block.caption}
      status={
        <>
          <Badge variant={corrected ? "secondary" : "outline"} className="gap-1.5">
            {corrected ? <PencilRuler className="size-3" /> : <BadgeCheck className="size-3" />}
            {corrected ? "Instructor-corrected" : "Instructor-accepted"}
          </Badge>
          <span className="text-[0.7rem] text-muted-foreground">
            Reviewed representation · not independently verified
          </span>
        </>
      }
    >
      <Suspense
        fallback={
          <code dir="ltr" className="whitespace-pre-wrap break-words text-sm">
            {block.expression}
          </code>
        }
      >
        <MathContent expression={block.expression} notation={block.notation} />
      </Suspense>
      <details className="mt-3 rounded-lg border p-3 text-left text-sm">
        <summary className="cursor-pointer text-xs font-medium">
          Review record and original extraction
        </summary>
        <dl className="mt-2 grid gap-1 text-xs">
          <div>
            <dt className="inline font-medium">Reviewer: </dt>
            <dd className="inline text-muted-foreground">{review.reviewer}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Original extraction: </dt>
            <dd className="inline whitespace-pre-wrap break-words font-mono text-muted-foreground">
              {review.originalExpression}
            </dd>
          </div>
          <div>
            <dt className="inline font-medium">Model proposal: </dt>
            <dd className="inline whitespace-pre-wrap break-words font-mono text-muted-foreground">
              {review.modelExpression}
            </dd>
          </div>
        </dl>
      </details>
    </FormulaFigure>
  );
}

/** Unreviewed or unresolved mathematics: the preserved crop plus the exact
 * extracted text, with an explicit uncertainty statement. Never typeset as if
 * it were verified LaTeX. */
export function SourceMathFallback({
  block,
  context,
}: {
  block: MathBlock;
  context: MathBlockContext;
}) {
  const [failed, setFailed] = useState(false);
  const href = context.cropHref?.(block);
  // Reserve the crop's space from the detector's validated bounding box so the
  // image does not shift the page when it arrives.
  const aspect = cropAspect(block.sourceMeta?.bbox);
  // An <img> whose response is not an image (a 500 JSON body, an expired
  // authorization) still fires `load` in some browsers, so check the decoded
  // dimensions rather than trusting the event alone.
  const imgRef = useRef<HTMLImageElement>(null);
  const checkDecoded = () => {
    const node = imgRef.current;
    if (node && node.complete && node.naturalWidth === 0) setFailed(true);
  };
  useEffect(() => {
    // A cached failure can settle before React attaches handlers.
    checkDecoded();
  }, [href]);
  return (
    <figure className="my-6 rounded-xl border border-dashed bg-muted/15 p-4" data-uncertain-math>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1.5 text-amber-600 dark:text-amber-300">
          <ShieldQuestion className="size-3" /> Unverified transcription
        </Badge>
        <span className="text-[0.7rem] text-muted-foreground">
          Rendered from the original document{block.sourceMeta?.page ? ` · page ${block.sourceMeta.page}` : ""}
        </span>
        {context.onSource && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="ml-auto"
            onClick={() => context.onSource?.(block)}
          >
            Inspect source
          </Button>
        )}
      </div>
      {href && !failed ? (
        <img
          ref={imgRef}
          src={href}
          alt={`Original equation from the source document${block.sourceMeta?.page ? `, page ${block.sourceMeta.page}` : ""}. The automatic transcription is unverified.`}
          loading="lazy"
          decoding="async"
          className="mx-auto max-h-80 max-w-full rounded border bg-white object-contain"
          style={aspect.reserved ? { aspectRatio: aspect.ratio, width: "100%" } : undefined}
          onError={() => setFailed(true)}
          onLoad={checkDecoded}
        />
      ) : (
        <p role="status" className="flex items-center gap-2 rounded-lg border bg-background/60 px-3 py-2 text-sm">
          <ImageOff className="size-4 shrink-0" />
          The original crop is unavailable. The extracted text below is preserved exactly as
          extracted.
        </p>
      )}
      <details className="mt-3 rounded-lg bg-background/60 p-3 text-sm">
        <summary className="cursor-pointer text-xs font-medium">
          Extracted text (exactly as extracted, unverified)
        </summary>
        <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs">{block.expression}</pre>
      </details>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Automatic transcription is unverified. This formula has no instructor review and is not
        typeset, so nothing here claims a mathematical interpretation.
      </p>
    </figure>
  );
}

/** Display expression without a review record but with valid LaTeX notation is
 * still not trusted: this component is only used for reviewed content. */
export function FormulaBlock({ block }: { block: MathBlock }) {
  return <ReviewedFormula block={block} />;
}

/** A multiline derivation: every reviewed line in canonical order. */
export function DerivationBlock({ block }: { block: MathBlock }) {
  return (
    <FormulaFigure
      caption={block.caption}
      status={
        <Badge variant="outline" className="gap-1.5">
          <BadgeCheck className="size-3" /> Instructor-reviewed derivation
        </Badge>
      }
    >
      <Suspense
        fallback={
          <code dir="ltr" className="whitespace-pre-wrap break-words text-sm">
            {block.expression}
          </code>
        }
      >
        <MathContent expression={block.expression} notation={block.notation} />
      </Suspense>
    </FormulaFigure>
  );
}
