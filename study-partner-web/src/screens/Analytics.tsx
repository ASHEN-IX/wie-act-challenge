'use client';
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";
import { analyticsAPI } from "../services/api";
import { useNavigate } from "@/navigation";

const DAY_OPTIONS = [7, 30, 90];

const retryRequest = async (requestFn: any, retries = 2, baseDelayMs = 500) => {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await requestFn();
    } catch (error: any) {
      lastError = error;
      const status = error?.response?.status;
      const retryable = !status || status >= 500;
      if (!retryable || attempt === retries) break;
      const waitMs = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastError;
};

const eventLabels: Record<string, string> = {
  study_session_started: "Session Started",
  study_session_completed: "Session Completed",
  task_created: "Task Created",
  task_completed: "Task Completed",
  course_ingested: "Course Ingested",
  plan_generated: "Plan Generated",
  focus_tracked: "Focus Tracked",
  login: "Login",
  profile_updated: "Profile Updated",
};

const Skeleton = ({ className }: any) => (
  <div className={`animate-pulse bg-muted/50 rounded-xl ${className}`} />
);

const StatCard = ({ label, value, hint }: any) => (
  <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-5">
    <p className="text-xs uppercase tracking-wider text-muted-foreground">
      {label}
    </p>
    <p className="text-3xl font-black mt-2 text-foreground">{value}</p>
    {hint && <p className="text-xs mt-2 text-muted-foreground">{hint}</p>}
  </div>
);

function formatDate(dateStr: any) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatHour(hour: any) {
  if (hour === 0) return "12a";
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return "12p";
  return `${hour - 12}p`;
}

function formatDuration(minutes: any) {
  if (!minutes || minutes < 1) return "-";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getAccentColor() {
  if (typeof document === "undefined") return "#4fb8ce";
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue("--accent-color-dynamic")
      .trim() || "#4fb8ce"
  );
}

const CustomDailyTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-sm shadow-lg">
      <p className="font-bold text-foreground mb-1">{formatDate(data.date)}</p>
      <p className="text-muted-foreground">Events: {data.totalEvents}</p>
      {data.sessions > 0 && (
        <p className="text-muted-foreground">Sessions: {data.sessions}</p>
      )}
      {data.tasks > 0 && (
        <p className="text-muted-foreground">Tasks: {data.tasks}</p>
      )}
      {data.duration > 0 && (
        <p className="text-muted-foreground">
          Duration: {formatDuration(data.duration)}
        </p>
      )}
    </div>
  );
};

export default function Analytics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [dailyActivity, setDailyActivity] = useState<any[]>([]);
  const [accentColor, setAccentColor] = useState("#4fb8ce");
  const primaryColor = "#ff295b";

  useEffect(() => {
    const value = getAccentColor();
    setAccentColor(value);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const [summaryRes, insightsRes, timelineRes, dailyRes] =
          await Promise.allSettled([
            retryRequest(() =>
              analyticsAPI.getSummary({ startDate: startDate.toISOString() })
            ),
            retryRequest(() => analyticsAPI.getInsights({ days })),
            retryRequest(() => analyticsAPI.getTimeline({ limit: 20 })),
            retryRequest(() => analyticsAPI.getDailyActivity({ days })),
          ]);

        if (cancelled) return;

        const summaryData =
          summaryRes.status === "fulfilled"
            ? summaryRes.value?.data || {}
            : {};
        const insightsData =
          insightsRes.status === "fulfilled"
            ? insightsRes.value?.data?.insights || null
            : null;
        const timelineData =
          timelineRes.status === "fulfilled"
            ? timelineRes.value?.data?.events || []
            : [];
        const dailyData =
          dailyRes.status === "fulfilled"
            ? dailyRes.value?.data?.dailyActivity || []
            : [];

        setSummary(summaryData);
        setInsights(insightsData);
        setTimeline(timelineData);
        setDailyActivity(dailyData);

        const anySuccess =
          summaryRes.status === "fulfilled" ||
          insightsRes.status === "fulfilled" ||
          dailyRes.status === "fulfilled" ||
          timelineRes.status === "fulfilled";

        const authError = [
          summaryRes,
          insightsRes,
          timelineRes,
          dailyRes,
        ].some(
          (r) =>
            r.status === "rejected" && r.reason?.response?.status === 401
        );

        if (authError) {
          setError("Session expired. Please log in again.");
        } else if (!anySuccess) {
          setError("Failed to load analytics data.");
        } else if (
          [summaryRes, insightsRes, dailyRes].some(
            (r) => r.status === "rejected"
          )
        ) {
          setError(
            "Some analytics data is unavailable. Showing partial results."
          );
        }
      } catch (err: any) {
        if (!cancelled) {
          if (err?.response?.status === 401) {
            setError("Session expired. Please log in again.");
          } else {
            setError(
              err?.response?.data?.error || "Failed to load analytics data."
            );
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [days]);

  const topEvents = useMemo(() => {
    const map = summary?.eventCounts || {};
    return Object.entries(map)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 5);
  }, [summary]);

  const hasData = (summary?.totalEvents || 0) > 0;
  const isEmpty = !loading && !error && !hasData;

  const dailyTickInterval = useMemo(() => {
    const len = dailyActivity.length;
    if (len <= 7) return 0;
    if (len <= 14) return 2;
    if (len <= 30) return 4;
    return 6;
  }, [dailyActivity]);

  const chartGridStyle = { stroke: "hsl(var(--border))", opacity: 0.5 };
  const chartAxisStyle = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };

  if (loading) {
    return (
      <div className="min-h-screen px-6 py-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-5 w-80" />
          </div>
          <div className="flex gap-2">
            {DAY_OPTIONS.map((d) => (
              <Skeleton key={d} className="h-8 w-12" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72 mb-8" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error && !hasData) {
    // Show the page layout but with an error banner on top
  }

  return (
    <div className="min-h-screen px-6 py-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-foreground">
              Learning Analytics
            </h1>
            <p className="text-muted-foreground mt-2">
              {days}-day behavior, consistency, and productivity trends.
            </p>
          </div>
          <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  days === d
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {error && (
        <div className="mb-6 p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {isEmpty && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-5 rounded-2xl border border-border bg-card/60 backdrop-blur-sm flex flex-col sm:flex-row items-center gap-4"
        >
          <div className="text-4xl">📊</div>
          <div className="flex-1 text-center sm:text-left">
            <p className="font-bold text-foreground">No study data yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Complete your first study session to start seeing analytics, charts, and insights here.
            </p>
          </div>
          <button
            onClick={() => navigate("/session-setup")}
            className="shrink-0 px-5 py-2.5 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90"
            style={{ backgroundColor: accentColor }}
          >
            Start Studying
          </button>
        </motion.div>
      )}

      <div className="space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Total Events" value={summary?.totalEvents || 0} />
          <StatCard label="Active Days" value={summary?.activeDays || 0} />
          <StatCard
            label="Current Streak"
            value={summary?.currentStreak || 0}
            hint="days"
          />
          <StatCard
            label="Longest Streak"
            value={summary?.longestStreak || 0}
            hint="days"
          />
        </section>

        {dailyActivity.length > 0 && (
          <section className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-5">
            <h2 className="text-lg font-bold text-foreground mb-4">
              Daily Activity
            </h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={dailyActivity}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" {...chartGridStyle} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  interval={dailyTickInterval}
                  {...chartAxisStyle}
                />
                <YAxis allowDecimals={false} {...chartAxisStyle} />
                <Tooltip content={<CustomDailyTooltip />} />
                <Bar
                  dataKey="totalEvents"
                  fill={accentColor}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {insights?.dayOfWeekBreakdown && (
            <section className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-5">
              <h2 className="text-lg font-bold text-foreground mb-4">
                Day of Week Breakdown
              </h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={insights.dayOfWeekBreakdown}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" {...chartGridStyle} />
                  <XAxis
                    dataKey="day"
                    tickFormatter={(d) => d.slice(0, 3)}
                    {...chartAxisStyle}
                  />
                  <YAxis allowDecimals={false} {...chartAxisStyle} />
                  <Tooltip
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <div className="bg-card border border-border rounded-lg p-3 text-sm shadow-lg">
                          <p className="font-bold text-foreground mb-1">
                            {label}
                          </p>
                          <p className="text-muted-foreground">
                            Sessions: {payload[0].payload.sessions}
                          </p>
                          <p className="text-muted-foreground">
                            Duration:{" "}
                            {formatDuration(payload[0].payload.totalDuration)}
                          </p>
                        </div>
                      ) : null
                    }
                  />
                  <Bar
                    dataKey="sessions"
                    fill={accentColor}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}

          {insights?.hourlyActivity && (
            <section className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-5">
              <h2 className="text-lg font-bold text-foreground mb-4">
                Hourly Activity
              </h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={insights.hourlyActivity}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" {...chartGridStyle} />
                  <XAxis
                    dataKey="hour"
                    tickFormatter={formatHour}
                    interval={2}
                    {...chartAxisStyle}
                  />
                  <YAxis allowDecimals={false} {...chartAxisStyle} />
                  <Tooltip
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <div className="bg-card border border-border rounded-lg p-3 text-sm shadow-lg">
                          <p className="font-bold text-foreground mb-1">
                            {label}:00
                          </p>
                          <p className="text-muted-foreground">
                            Sessions: {payload[0].payload.count}
                          </p>
                          <p className="text-muted-foreground">
                            Duration:{" "}
                            {formatDuration(
                              payload[0].payload.totalDuration
                            )}
                          </p>
                        </div>
                      ) : null
                    }
                  />
                  <Bar
                    dataKey="count"
                    fill={primaryColor}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-5">
            <h2 className="text-lg font-bold text-foreground">Top Activities</h2>
            <div className="mt-4 space-y-3">
              {topEvents.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No events yet.
                </p>
              )}
              {topEvents.map(([eventType, count]) => (
                <div
                  key={eventType}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm text-foreground">
                    {eventLabels[eventType] || eventType}
                  </span>
                  <span className="text-sm font-bold text-primary">
                    {String(count)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-5">
            <h2 className="text-lg font-bold text-foreground">Key Metrics</h2>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">
                  Study Sessions
                </span>
                <span className="text-sm font-bold text-foreground">
                  {insights?.studySessions || 0}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">
                  Completed Tasks
                </span>
                <span className="text-sm font-bold text-foreground">
                  {insights?.completedTasks || 0}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">
                  Total Study Time
                </span>
                <span className="text-sm font-bold text-foreground">
                  {formatDuration(insights?.totalStudyTime)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">
                  Avg Session Time
                </span>
                <span className="text-sm font-bold text-foreground">
                  {formatDuration(insights?.avgStudyTime)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">
                  Peak Study Hour
                </span>
                <span className="text-sm font-bold text-foreground">
                  {insights?.peakStudyHour || "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">
                  Weekly Consistency
                </span>
                <span className="text-sm font-bold text-foreground">
                  {insights?.weeklyConsistency || 0}%
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">
                  Productivity
                </span>
                <span className="text-sm font-bold text-foreground">
                  {insights?.productivity || 0}%
                </span>
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-5">
          <h2 className="text-lg font-bold text-foreground">
            Recent Activity
          </h2>
          <div className="mt-4 divide-y divide-border">
            {timeline.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No timeline events yet.
              </p>
            )}
            {timeline.map((event: any) => (
              <div
                key={event._id}
                className="py-3 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="text-sm text-foreground">
                    {eventLabels[event.eventType] || event.eventType}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
