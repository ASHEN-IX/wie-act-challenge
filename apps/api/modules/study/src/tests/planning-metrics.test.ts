/** Batch 4 M4.5 Phase I: bounded, privacy-preserving operational metrics.
 *
 * The property that matters is what the snapshot *cannot* contain: no learner,
 * course, request, prompt or credential. These tests check that directly rather
 * than trusting the comment above the module.
 */
import {
  LATENCY_BUCKETS_MS,
  PLANNING_EVENT,
  percentile,
  recordEvent,
  recordLatency,
  resetMetrics,
  snapshotMetrics,
  summarizeMetrics,
  timed,
} from '../services/planningMetrics';

beforeEach(() => resetMetrics());

describe('counters', () => {
  it('counts a known event', () => {
    recordEvent('planning_request');
    recordEvent('planning_request');
    expect(snapshotMetrics().counters.planning_request).toBe(2);
  });

  it('ignores an unknown event rather than creating a label', () => {
    recordEvent('not_a_real_event' as never);
    expect(Object.keys(snapshotMetrics().counters)).toHaveLength(0);
  });

  it('accepts a bounded increment', () => {
    recordEvent('stale_recovered', 3);
    expect(snapshotMetrics().counters.stale_recovered).toBe(3);
  });

  it('exposes only the closed event vocabulary', () => {
    for (const event of PLANNING_EVENT) recordEvent(event);
    const keys = Object.keys(snapshotMetrics().counters).sort();
    expect(keys).toEqual([...PLANNING_EVENT].sort());
  });
});

describe('latency histograms', () => {
  it('places a value in the first bucket that contains it', () => {
    recordLatency('retrieval', 3);
    const histogram = snapshotMetrics().latencies.retrieval;
    expect(histogram.total).toBe(1);
    // 3ms falls in the bucket bounded by 5.
    expect(histogram.buckets[LATENCY_BUCKETS_MS.indexOf(5)]).toBe(1);
  });

  it('puts an extreme value in the overflow bucket', () => {
    recordLatency('retrieval', 120_000);
    const histogram = snapshotMetrics().latencies.retrieval;
    expect(histogram.buckets[LATENCY_BUCKETS_MS.length]).toBe(1);
  });

  it('ignores a negative or non-finite observation', () => {
    recordLatency('retrieval', -1);
    recordLatency('retrieval', Number.NaN);
    expect(snapshotMetrics().latencies.retrieval).toBeUndefined();
  });

  it('bounds the number of distinct latency names', () => {
    for (let index = 0; index < 20; index += 1) recordLatency(`name-${index}`, 5);
    // MAX_LATENCY_NAMES is 8; extra names are dropped rather than growing without
    // limit.
    expect(Object.keys(snapshotMetrics().latencies).length).toBe(8);
  });

  it('computes percentiles from the buckets', () => {
    for (let index = 0; index < 100; index += 1) recordLatency('planning', index < 95 ? 8 : 400);
    const summary = summarizeMetrics().latency as Record<string, Record<string, number>>;
    expect(summary.planning.count).toBe(100);
    expect(summary.planning.p50).toBe(10);
    // p95 sits at the boundary of the fast tail; p99 must reach the slow one.
    expect(summary.planning.p99).toBe(500);
  });

  it('returns null for an empty histogram', () => {
    expect(percentile({ buckets: [0, 0], total: 0, sum: 0 }, 50)).toBeNull();
  });

  it('records latency even when the operation throws', async () => {
    await expect(
      timed('planning', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(snapshotMetrics().latencies.planning.total).toBe(1);
  });
});

describe('privacy', () => {
  it('never records an identifier', () => {
    recordEvent('planning_request');
    recordEvent('cache_hit');
    recordLatency('planning', 12);
    const serialized = JSON.stringify(snapshotMetrics());
    // Nothing that could identify a learner, a course, a request or a secret.
    for (const forbidden of [
      'userId',
      'courseId',
      'revisionId',
      'lessonId',
      'requestId',
      'attemptId',
      'email',
      'token',
      'apiKey',
      'prompt',
      'answer',
    ])
      expect(serialized).not.toContain(forbidden);
  });

  it('keeps the summary free of identifiers too', () => {
    recordEvent('provider_dispatch');
    const serialized = JSON.stringify(summarizeMetrics());
    expect(serialized).not.toMatch(/userId|courseId|email|token|apiKey/);
  });

  it('resets cleanly', () => {
    recordEvent('planning_request');
    resetMetrics();
    expect(Object.keys(snapshotMetrics().counters)).toHaveLength(0);
  });
});
