/** Batch 4 M4.5 Phase J: bounded local load measurement.
 *
 * Exercises the *reader retrieval* path against real MongoDB: the work the
 * system does on every page load, which is where caching should show. It does
 * not call a provider and does not measure the AI service.
 *
 * Bounded on purpose: fixed concurrency levels, fixed duration, no unbounded
 * ramping, no effect on other local projects. A local run is not a capacity
 * certification.
 */
import { performance } from 'node:perf_hooks';
import mongoose from 'mongoose';
import { ExperiencePlanRecord } from '../modules/study/src/models/ExperiencePlanRecord';
import { checkStoredPlanAvailability } from '../modules/study/src/services/experiencePlanStore';
import { recordLatency, resetMetrics, summarizeMetrics } from '../modules/study/src/services/planningMetrics';
import { COMPONENT_REGISTRY_VERSION } from '../shared/ednova/componentRegistry';

const URI = process.env.M45_MONGO || 'mongodb://127.0.0.1:27017';
const DB = `test_m45_load_${process.pid}`;
const COURSE = '0123456789abcdef01234567';
const MODES = ['guided', 'explore', 'practice', 'deep_dive'] as const;

process.env.LLM_BUDGET_MONGODB_URI = URI;
process.env.LLM_BUDGET_DB_NAME = DB;

type Snapshot = {
  rssMb: number;
  eventLoopMs: number;
  heapMb: number;
};

function sampleProcess(): Snapshot {
  const memory = process.memoryUsage();
  return {
    rssMb: Math.round(memory.rss / 1024 / 1024),
    heapMb: Math.round(memory.heapUsed / 1024 / 1024),
    eventLoopMs: 0,
  };
}

/** Event-loop responsiveness: how long a timer scheduled for `ms` actually
 * takes. A blocked loop shows up here before it shows up anywhere else. */
async function eventLoopLag(ms = 10): Promise<number> {
  const start = performance.now();
  await new Promise((resolve) => setTimeout(resolve, ms));
  return Math.round((performance.now() - start - ms) * 100) / 100;
}

async function seedPlans(count: number) {
  const docs = [];
  for (let index = 0; index < count; index += 1) {
    docs.push({
      planId: `plan_load_${index}`,
      courseId: COURSE,
      revisionId: 'rev_load',
      lessonId: `lesson-${index % 10}`,
      mode: MODES[index % MODES.length],
      contentHash: 'sha256:' + 'a'.repeat(64),
      contextFingerprint: 'fnv1a64:0123456789abcdef',
      planSchemaVersion: '1.0.0',
      registryVersion: COMPONENT_REGISTRY_VERSION,
      presentationSchemaVersion: '1.0.0',
      provider: 'mock_experience_planner',
      providerModel: '1.0.0',
      plannerImplementation: 'mock_experience_planner',
      plannerVersion: '1.0.0',
      planDigest: `fnv1a64:${String(index).padStart(16, '0')}`,
      plan: {},
      generatedBy: 'load',
      generatedAt: new Date(),
    });
  }
  await ExperiencePlanRecord.insertMany(docs);
}

async function runLevel(concurrency: number, perWorker: number) {
  const latencies: number[] = [];
  let errors = 0;
  const start = performance.now();

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      for (let index = 0; index < perWorker; index += 1) {
        const lessonId = `lesson-${index % 10}`;
        const mode = MODES[index % MODES.length];
        const t0 = performance.now();
        try {
          await checkStoredPlanAvailability({
            courseId: COURSE,
            revisionId: 'rev_load',
            lessonId,
            mode,
          });
          recordLatency('availability', performance.now() - t0);
        } catch {
          errors += 1;
        }
        latencies.push(performance.now() - t0);
      }
    }),
  );

  const elapsed = performance.now() - start;
  latencies.sort((a, b) => a - b);
  const pct = (p: number) => latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))];
  const snap = sampleProcess();
  return {
    concurrency,
    requests: latencies.length,
    elapsed_ms: Math.round(elapsed),
    rps: Math.round((latencies.length / elapsed) * 1000),
    p50_ms: Math.round(pct(50) * 100) / 100,
    p95_ms: Math.round(pct(95) * 100) / 100,
    p99_ms: Math.round(pct(99) * 100) / 100,
    errors,
    rss_mb: snap.rssMb,
    heap_mb: snap.heapMb,
    event_loop_lag_ms: await eventLoopLag(),
  };
}

async function main() {
  await mongoose.connect(URI + '/' + DB);
  resetMetrics();
  await seedPlans(40);

  const results = [];
  for (const [concurrency, perWorker] of [
    [1, 100],
    [10, 20],
    [25, 8],
  ] as const)
    results.push(await runLevel(concurrency, perWorker));

  // Cache-hit path: same query repeated, which is what a reload does.
  resetMetrics();
  const hits = await runLevel(10, 20);
  const summary = summarizeMetrics();

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  console.table(results);
  console.log(JSON.stringify({ hits, metrics: summary }, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
