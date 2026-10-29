"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AI_WAIT_STAGES, describeAiMode, waitStageIndex } from "./ai-status";

/** Staged progress for an AI request. Mount it only while the request is pending. */
export function AiWaitStatus() {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(
      () => setElapsedMs(Date.now() - startedAt),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);

  const stage = AI_WAIT_STAGES[waitStageIndex(elapsedMs)];
  return (
    <div role="status" aria-live="polite" className="space-y-2">
      <p className="text-sm text-muted-foreground">{stage}…</p>
      <Skeleton className="h-1.5 w-full max-w-xs" />
    </div>
  );
}

/** What the learner should understand about the answer they just received. */
export function AiModeNote({ mode }: { mode: string | null | undefined }) {
  const note = describeAiMode(mode);
  return (
    <p data-tone={note.tone} className="text-sm">
      <span className="font-medium">{note.title}.</span> {note.detail}
    </p>
  );
}
