'use client';
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Brain, RefreshCw } from "lucide-react";
import { competencyAPI } from "../services/api";
import LoadingSpinner from "../components/shared/LoadingSpinner";
import EmptyState from "../components/shared/EmptyState";
import CompetencyRadar from "../components/CompetencyMap/CompetencyRadar";
import TopicDetailPanel from "../components/CompetencyMap/TopicDetailPanel";

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

/**
 * BLOOM-11 — Competency Map page.
 *
 * Visualises the user's six Bloom levels per subject (radar), with drill-down
 * to a per-topic score list and a topic detail panel. Loading/error/empty
 * states follow the app's UX conventions; axe accessibility is covered by the
 * test suite.
 */
export default function CompetencyMap() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subjects, setSubjects] = useState<any[]>([]);
  const [accentColor, setAccentColor] = useState("#4fb8ce");
  const [selectedSubjectId, setSelectedSubjectId] = useState<any>(null);
  const [detailTopic, setDetailTopic] = useState<any>(null);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue("--accent-color-dynamic")
        .trim();
      if (value) setAccentColor(value);
    }
  }, []);

  const load = () => {
    setLoading(true);
    setError("");
    competencyAPI
      .getCompetencyMap()
      .then((data) => {
        setSubjects(data.competencies || []);
      })
      .catch((err: any) => {
        setError(
          err?.response?.status === 404
            ? "No competency data yet."
            : "Failed to load your competency map. Please try again.",
        );
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const selectedSubject = useMemo(
    () =>
      subjects.find((s) => String(s.subjectId) === String(selectedSubjectId)) ||
      subjects[0] ||
      null,
    [subjects, selectedSubjectId],
  );

  // Aggregate all topic levels across the selected subject into a 6-axis radar.
  const subjectRadarData = useMemo(() => {
    const acc: Record<string, any[]> = {};
    LEVELS.forEach((lvl: any) => (acc[lvl] = []));
    for (const topic of selectedSubject?.topics || []) {
      for (const level of topic.levels || []) {
        const key = String(level.bloomLevel).toLowerCase();
        if (acc[key] && level.score != null) acc[key].push(level.score);
      }
    }
    return LEVELS.map((lvl: any) => {
      const scores = acc[lvl] || [];
      const avg = scores.length
        ? Math.round((scores.reduce((s: any, v: any) => s + v, 0) / scores.length) * 100)
        : 0;
      return { level: (LEVEL_LABELS as any)[lvl], score: avg, count: scores.length };
    });
  }, [selectedSubject]);

  const openTopic = (topicId: any) => {
    setDetailTopic(null);
    competencyAPI
      .getTopicDetail(topicId)
      .then((data) => setDetailTopic(data.topic))
      .catch(() =>
        setDetailTopic({ topicId, topicName: "Unavailable", competencies: [] }),
      );
  };

  const selectSubject = (id: any) => setSelectedSubjectId(id);

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-foreground flex items-center gap-3">
            <Brain className="w-8 h-8 text-[var(--accent-color-dynamic)]" />
            Competency Map
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Your cognitive profile across six Bloom's Taxonomy levels. See your
            strengths and gaps per subject, and the objectives your study plans
            are targeting.
          </p>
          <button
            onClick={load}
            className="mt-3 inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {loading && (
          <div className="py-20">
            <LoadingSpinner text="Loading competency map…" />
          </div>
        )}

        {!loading && error && (
          <EmptyState
            icon={Brain}
            title="Couldn't load your competency map"
            description={error}
            action={load}
            actionLabel="Try again"
          />
        )}

        {!loading && !error && subjects.length === 0 && (
          <EmptyState
            icon={Brain}
            title="No competency data yet"
            description={
              <>
                This is based on Bloom's Taxonomy — Remember, Understand, Apply,
                Analyze, Evaluate, and Create. Complete exercises and
                evaluations on your courses to generate your profile.
              </>
            }
          />
        )}

        {!loading && !error && subjects.length > 0 && selectedSubject && (
          <>
            {/* Subject selector */}
            <div
              className="flex flex-wrap gap-2 mb-6"
              role="tablist"
              aria-label="Choose a subject"
            >
              {subjects.map((s) => {
                const active =
                  String(s.subjectId) === String(selectedSubject.subjectId);
                return (
                  <button
                    key={s.subjectId}
                    role="tab"
                    aria-selected={active}
                    onClick={() => selectSubject(s.subjectId)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {s.subjectName || "Subject"}
                  </button>
                );
              })}
            </div>

            <motion.div
              key={selectedSubject.subjectId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid md:grid-cols-2 gap-6"
            >
              {/* Subject-level radar */}
              <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-6">
                <h2 className="text-lg font-bold text-foreground mb-1">
                  {selectedSubject.subjectName || "Subject"} overview
                </h2>
                <p className="text-xs text-muted-foreground mb-4">
                  Average score across the six Bloom levels
                </p>
                <CompetencyRadar
                  levels={subjectRadarData
                    .filter((d) => d.count > 0)
                    .map((d) => ({
                      bloomLevel: d.level,
                      score: d.score / 100,
                    }))}
                  accentColor={accentColor}
                />
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {subjectRadarData.map((d) => (
                    <div
                      key={d.level}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">{d.level}</span>
                      <span className="font-bold text-foreground">
                        {d.score}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Topic list with per-topic scores */}
              <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-6">
                <h2 className="text-lg font-bold text-foreground mb-4">
                  Topics
                </h2>
                {selectedSubject.topics.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No topics with competency data yet.
                  </p>
                )}
                <ul className="space-y-3" data-testid="topic-list">
                  {selectedSubject.topics.map((topic: any) => (
                    <li key={topic.topicId}>
                      <button
                        onClick={() => openTopic(topic.topicId)}
                        className="w-full text-left border border-border rounded-xl p-4 hover:border-[var(--accent-color-dynamic)] transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-foreground">
                            {topic.topicName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {topic.parentTopic || ""}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {[0, 1, 2, 3, 4, 5].map((i) => {
                            const lvl = topic.levels[i];
                            const key = lvl
                              ? String(lvl.bloomLevel).toLowerCase()
                              : null;
                            const score = key
                              ? subjectItemScore(topic, key)
                              : 0;
                            return (
                              <span
                                key={i}
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  score >= 70
                                    ? "bg-[var(--accent-color-dynamic)]/20 text-[var(--accent-color-dynamic)]"
                                    : "bg-white/10 text-white/60"
                                }`}
                              >
                                {String((LEVEL_LABELS as any)[key || ""] || "—")} {score}%
                              </span>
                            );
                          })}
                        </div>
                        <p className="text-xs text-primary mt-2">
                          View details →
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </>
        )}
      </div>

      <TopicDetailPanel
        topic={detailTopic}
        onClose={() => setDetailTopic(null)}
      />
    </div>
  );
}

// Per-topic score for a given level key (mirror of subjectRadarData helper).
function subjectItemScore(topic: any, key: any) {
  const row = (topic.levels || []).find(
    (l: any) => String(l.bloomLevel).toLowerCase() === key,
  );
  return row && row.score != null ? Math.round(row.score * 100) : 0;
}
