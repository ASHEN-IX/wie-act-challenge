import React from "react";

const BLOOM_LEVEL_LABELS = {
  remember: "Remember",
  understand: "Understand",
  apply: "Apply",
  analyze: "Analyze",
  evaluate: "Evaluate",
  create: "Create",
};

const ACCENT_LEVELS = new Set(["apply", "analyze", "evaluate", "create"]);

/**
 * BLOOM-11 — Target-level badge shown on plan tasks.
 *
 * Renders the cognitive level a task targets (from the planner's BLOOM-10
 * weakest-first output). Falls back to the canonical label when the value is
 * lowercase taxonomy key, and renders nothing when absent (degraded plans).
 */
export function capitalizeBloomLevel(value: any) {
  if (!value) return null;
  const key = String(value).toLowerCase();
  if ((BLOOM_LEVEL_LABELS as any)[key]) return (BLOOM_LEVEL_LABELS as any)[key];
  // Defensive: already-capitalised or unknown values pass through
  return String(value)
    .replace(/_/g, " ")
    .replace(/(^|\s)\S/g, (m) => m.toUpperCase());
}

export default function PlanTaskBadge({ level, objectiveId }: any) {
  const label = capitalizeBloomLevel(level);
  if (!label) return null;

  const accent = ACCENT_LEVELS.has(String(level || "").toLowerCase());

  return (
    <span
      data-testid="plan-task-level-badge"
      className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-bold rounded ${
        accent
          ? "bg-[var(--accent-color-dynamic)]/20 text-[var(--accent-color-dynamic)]"
          : "bg-white/10 text-white/70"
      }`}
      title={objectiveId ? `Targets objective: ${objectiveId}` : undefined}
    >
      Target: {label}
    </span>
  );
}
