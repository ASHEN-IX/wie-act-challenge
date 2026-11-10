/** Bounded operational metrics for the planning path (Batch 4, M4.5).
 *
 * Deliberately small and privacy-preserving. It counts *events*, never people:
 * no learner id, no course id, no request id, no prompt, no answer and no
 * credential ever enters a metric label. That keeps cardinality low and means a
 * shared dashboard cannot expose a private identifier.
 *
 * In-process and bounded. A restart resets the counters, which is honest for an
 * operations aid; durable retention belongs to whatever metrics backend a
 * deployment adopts, not to this module.
 */

/** The closed set of things worth counting. Each answerable question is a
 * distinct counter rather than a free-form label, so cardinality cannot drift. */
export const PLANNING_EVENT = [
  'planning_request',
  'cache_hit',
  'cache_miss',
  'already_accepted_reuse',
  'validation_accept',
  'validation_reject',
  'provider_dispatch',
  'known_failure',
  'uncertain_outcome',
  'budget_reservation',
  'reconcile_reported',
  'reconcile_unreported',
  'duplicate_suppressed',
  'stale_recovered',
  'plan_invalidated',
  'reader_fallback',
  'adaptation_recommended',
  'adaptation_neutral'
] as const;

export type PlanningEvent = (typeof PLANNING_EVENT)[number];

/** Latency buckets rather than raw values: a histogram keeps memory bounded and
 * avoids recording anything that could correlate with a specific request. */
export const LATENCY_BUCKETS_MS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000, 30000] as const;

type Histogram = {
  /** Count per bucket, plus a final overflow count. */
  buckets: number[];
  total: number;
  sum: number;
};

type Snapshot = {
  counters: Record<string, number>;
  latencies: Record<string, Histogram>;
  since: string;
};

const MAX_LATENCY_NAMES = 8;

let counters = new Map<string, number>();
let latencies = new Map<string, Histogram>();
const since = new Date();

/** Increment a counter. Unknown events are ignored rather than creating a new
 * label, so a typo cannot quietly inflate cardinality. */
export function recordEvent(event: PlanningEvent, by = 1): void {
  if (!(PLANNING_EVENT as readonly string[]).includes(event)) return;
  counters.set(event, (counters.get(event) ?? 0) + by);
}

/** Record one latency observation into a fixed histogram. */
export function recordLatency(name: string, ms: number): void {
  if (!latencies.has(name) && latencies.size >= MAX_LATENCY_NAMES) return;
  if (!Number.isFinite(ms) || ms < 0) return;
  let histogram = latencies.get(name);
  if (!histogram) {
    histogram = { buckets: new Array(LATENCY_BUCKETS_MS.length + 1).fill(0), total: 0, sum: 0 };
    latencies.set(name, histogram);
  }
  const index = LATENCY_BUCKETS_MS.findIndex((bound) => ms <= bound);
  histogram.buckets[index === -1 ? LATENCY_BUCKETS_MS.length : index] += 1;
  histogram.total += 1;
  histogram.sum += ms;
}

/** Run a function and record its latency, even when it throws. */
export async function timed<T>(name: string, run: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    return await run();
  } finally {
    recordLatency(name, Date.now() - start);
  }
}

/** Nearest-rank percentile from the bucket histogram. Approximate by design:
 * buckets are coarse, which is enough to spot a regression and small enough to
 * keep in memory. */
export function percentile(histogram: Histogram, p: number): number | null {
  if (histogram.total === 0) return null;
  const target = Math.ceil((p / 100) * histogram.total);
  let seen = 0;
  for (let index = 0; index < histogram.buckets.length; index += 1) {
    seen += histogram.buckets[index];
    if (seen >= target)
      return index < LATENCY_BUCKETS_MS.length
        ? LATENCY_BUCKETS_MS[index]
        : LATENCY_BUCKETS_MS[LATENCY_BUCKETS_MS.length - 1];
  }
  return LATENCY_BUCKETS_MS[LATENCY_BUCKETS_MS.length - 1];
}

/** A snapshot for diagnostics. Carries counts and bucket bounds only — nothing
 * that identifies a learner, a course or a request. */
export function snapshotMetrics(): Snapshot {
  return {
    counters: Object.fromEntries(counters),
    latencies: Object.fromEntries(
      [...latencies].map(([name, histogram]) => [
        name,
        {
          buckets: [...histogram.buckets],
          total: histogram.total,
          sum: histogram.sum
        }
      ])
    ),
    since: since.toISOString()
  };
}

/** Human-readable summary for logs and the QA harness. */
export function summarizeMetrics(): Record<string, unknown> {
  const countersOut = Object.fromEntries(counters);
  const latencyOut: Record<string, unknown> = {};
  for (const [name, histogram] of latencies)
    latencyOut[name] = {
      count: histogram.total,
      p50: percentile(histogram, 50),
      p95: percentile(histogram, 95),
      p99: percentile(histogram, 99)
    };
  return { counters: countersOut, latency: latencyOut, since: since.toISOString() };
}

/** Reset. For tests and for a deliberate operator action; never automatic. */
export function resetMetrics(): void {
  counters = new Map();
  latencies = new Map();
}
