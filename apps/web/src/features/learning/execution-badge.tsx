"use client";
import { Badge } from "@/components/ui/badge";
import { describeExecutionMode } from "./execution-mode";

/**
 * Shows what produced an AI-backed answer. The challenge requires visible status
 * when shared inference is capped or falling back; a raw enum token does not meet
 * that bar, and silently presenting rule-based text as a model answer misstates
 * how the content was made.
 */
export function ExecutionBadge({
  mode,
  label,
}: {
  mode?: string | null;
  label?: string;
}) {
  const notice = describeExecutionMode(mode);
  return (
    <div className="flex flex-wrap items-center gap-2" data-execution-mode={notice.mode ?? "unknown"}>
      <Badge variant={notice.tone === "caution" ? "outline" : "secondary"}>
        {notice.label}
      </Badge>
      <span className="text-xs text-muted-foreground">{notice.description}</span>
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
}
