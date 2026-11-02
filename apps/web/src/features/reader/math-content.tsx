"use client";
import katex from "katex";
import "katex/dist/katex.min.css";
import { useEffect, useRef, useState } from "react";

export default function MathContent({
  expression,
  notation,
  caption,
}: {
  expression: string;
  notation: "latex" | "plain";
  caption?: string;
}) {
  const target = useRef<HTMLSpanElement>(null);
  const [rendered, setRendered] = useState(false);
  useEffect(() => {
    if (!target.current) return;
    try {
      katex.render(expression, target.current, {
        displayMode: true,
        throwOnError: true,
        strict: "error",
        trust: false,
        maxExpand: 50,
        output: "htmlAndMathml",
      });
      setRendered(true);
    } catch {
      setRendered(false);
    }
  }, [expression, notation]);
  return (
    <figure className="my-6 overflow-x-auto rounded-xl border bg-muted/25 px-4 py-5 text-center">
      <span
        ref={target}
        aria-label={notation === "latex" ? "Mathematical formula" : "Formula"}
        className={rendered ? "inline-block max-w-full" : "hidden"}
      />
      {!rendered && (
        <code dir="ltr" className="whitespace-pre-wrap break-words text-sm">
          {expression}
        </code>
      )}
      {caption && (
        <figcaption className="mt-3 text-xs text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
