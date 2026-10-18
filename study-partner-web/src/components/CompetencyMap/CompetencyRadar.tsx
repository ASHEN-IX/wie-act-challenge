import React from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const LEVELS = [
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
];

const LEVEL_LABELS = {
  remember: "Remember",
  understand: "Understand",
  apply: "Apply",
  analyze: "Analyze",
  evaluate: "Evaluate",
  create: "Create",
};

function getAccentColor() {
  if (typeof document === "undefined") return "#4fb8ce";
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue("--accent-color-dynamic")
      .trim() || "#4fb8ce"
  );
}

/**
 * BLOOM-11 — Radar chart of one topic's six Bloom levels (0..1 scores).
 * Axes that have no competency data (score null/undefined) render at 0 and
 * the chart is skipped entirely when there is no data at all.
 *
 * @param {object} props
 * @param {Array<object>} props.levels — [{ bloomLevel, score, confidence, count }]
 * @param {string} [props.accentColor]
 */
export default function CompetencyRadar({ levels, accentColor }: any) {
  const color = accentColor || getAccentColor();

  const data = LEVELS.map((level) => {
    const row = (levels || []).find(
      (l: any) => String(l.bloomLevel).toLowerCase() === level,
    );
    return {
      level: (LEVEL_LABELS as any)[level],
      score: row && row.score != null ? Math.round(row.score * 100) : 0,
      confidence: row ? row.confidence : 0,
      count: row ? row.count : 0,
    };
  });

  const hasAnyData = data.some((d) => d.score > 0);
  if (!hasAnyData) return null;

  return (
    <div
      aria-label="Bloom levels radar"
      role="img"
      data-testid="competency-radar"
    >
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data} outerRadius="70%">
          <PolarGrid stroke="rgba(128,128,128,0.25)" />
          <PolarAngleAxis
            dataKey="level"
            tick={{ fontSize: 11, fill: "#888" }}
          />
          <Tooltip formatter={(value) => [`${value}%`, "Score"]} />
          <Radar
            dataKey="score"
            stroke={color}
            fill={color}
            fillOpacity={0.3}
            dot={{ r: 3, fill: color, strokeWidth: 0 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
