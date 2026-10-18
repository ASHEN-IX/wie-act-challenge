import React from "react";
import { X } from "lucide-react";

const LEVEL_LABELS = {
  remember: "Remember",
  understand: "Understand",
  apply: "Apply",
  analyze: "Analyze",
  evaluate: "Evaluate",
  create: "Create",
};

function formatLevel(value: any) {
  const key = String(value || "").toLowerCase();
  return (LEVEL_LABELS as any)[key] || value || "-";
}

function formatScore(value: any) {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

/**
 * BLOOM-11 — Drill-down panel showing one topic's competency rows, grouped by
 * knowledge type, with evidence excerpts. The `needsReview` internal signal is
 * deliberately NOT surfaced to students (BLOOM-09 instructor-only convention).
 *
 * @param {object} props
 * @param {object|null} props.topic — from competencyAPI.getTopicDetail()
 * @param {function} props.onClose
 */
export default function TopicDetailPanel({ topic, onClose }: any) {
  if (!topic) return null;

  const { topicName, parentTopic, competencies = [] } = topic;

  return (
    <div
      data-testid="topic-detail-panel"
      role="dialog"
      aria-modal="true"
      aria-label={`${topicName} details`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e: any) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-border sticky top-0 bg-card">
          <div>
            <h2 className="text-xl font-bold text-foreground">{topicName}</h2>
            {parentTopic && (
              <p className="text-sm text-muted-foreground">{parentTopic}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close topic details"
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {competencies.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No competency data for this topic yet.
            </p>
          )}

          {competencies.map((row: any, i: any) => (
            <div
              key={i}
              className="border border-border rounded-xl p-4"
              data-testid="topic-competency-row"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold capitalize text-foreground">
                  {formatLevel(row.bloomLevel)}
                </span>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {row.knowledgeType}
                </span>
              </div>

              <div className="flex items-center gap-4 mb-3">
                <div
                  className="h-2 flex-1 rounded-full bg-muted overflow-hidden"
                  role="progressbar"
                  aria-valuenow={Math.round((row.score || 0) * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${formatLevel(row.bloomLevel)} score`}
                >
                  <div
                    className="h-full bg-[var(--accent-color-dynamic)]"
                    style={{ width: `${Math.round((row.score || 0) * 100)}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-foreground w-12 text-right">
                  {formatScore(row.score)}
                </span>
              </div>

              {(row.evidence || []).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Evidence
                  </p>
                  {row.evidence.slice(-3).map((e: any, j: any) => (
                    <div
                      key={j}
                      className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2"
                    >
                      <span className="text-foreground capitalize">
                        {formatLevel(e.demonstratedBloomLevel)}
                      </span>
                      {e.masteryScore != null && (
                        <> · score {formatScore(e.masteryScore)}</>
                      )}
                      {e.objectiveId && (
                        <> · obj {String(e.objectiveId).slice(0, 28)}</>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
