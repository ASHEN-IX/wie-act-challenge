/** Batch 4 release-integrity closure: prove the three defects are closed.
 *
 * The original reproduction (`m46b` phase 1) constructed the *broken state* the
 * old code could produce and showed it was reachable. That is evidence of the
 * defect, not of its closure — writing `state: 'validated'` by hand will always
 * succeed. This script instead drives the corrected code and asserts the
 * invariant holds.
 *
 *   C-1  a revision-bound ingestion with no manifest is refused, not degraded
 *        (covered exhaustively by apps/ai/tests/test_ingestion_manifest_failclosed.py)
 *   C-2  no course-scoped metrics route exists; the operator route is admin-only
 *   C-3  `validated` is never written before the plan record exists
 *
 * No provider call.
 */
import mongoose from 'mongoose';
import { ExperiencePlanRequest } from '../modules/study/src/models/ExperiencePlanRequest';
import { checkStoredPlanAvailability } from '../modules/study/src/services/experiencePlanStore';
import { recoverStalePlanningRequests } from '../modules/study/src/services/experiencePlanGeneration';
import learningRouter from '../modules/study/src/routes/learning';

const URI = process.env.M46B_MONGO || 'mongodb://127.0.0.1:27017';
const DB = `test_m46b_closure_${process.pid}`;
const courseId = 'a57d9f30-21c4-58ff-b48c-1e9e140f4c6d';
const revisionId = 'rev_m46b';
const lessonId = 'lesson-1';
const mode = 'guided';

process.env.LLM_BUDGET_MONGODB_URI = URI;
process.env.LLM_BUDGET_DB_NAME = DB;

const rows: Array<Record<string, unknown>> = [];

type Operation = { method: string; path: string };

function operations(): Operation[] {
  return (learningRouter as unknown as { operations: Operation[] }).operations;
}

/** C-2: the disclosure existed because a course-scoped path authorized a
 * process-wide measurement. Check both halves are gone. */
function proofMetricsScope() {
  const ops = operations();
  const courseScoped = ops.filter(
    (entry) => entry.path.includes('metrics') && entry.path.includes(':courseId'),
  );
  const operatorScoped = ops.filter((entry) => entry.path === '/planning/metrics');

  rows.push({
    concern: 'C-2 course-scoped metrics route',
    metric_routes: ops.filter((e) => e.path.includes('metrics')).map((e) => e.path).join(','),
    course_scoped_routes: courseScoped.length,
    operator_route_present: operatorScoped.length === 1,
    verdict:
      courseScoped.length === 0 && operatorScoped.length === 1
        ? 'CLOSED: metrics are operator-only; no course path can reach them'
        : 'OPEN: a course-scoped metrics route still exists',
  });
}

/** C-3: `validated` must imply a retrievable plan.
 *
 * A hand-written `validated` row proves nothing — any string can be written.
 * What matters is that the *generation path* cannot produce that state without
 * the record. The ordering is pinned by
 * `plan-generation-persistence-order.test.ts`, which asserts the store call
 * precedes the `validated` write and that a store failure yields `failed`.
 *
 * Here we prove the recovery invariant: an interrupted attempt in `validating`
 * is not advertised as reusable, and is not silently turned into a plan.
 */
async function proofValidatedImpliesPlan() {
  await mongoose.connection.dropDatabase();

  // A request interrupted between validation and persistence — what the old
  // ordering could leave behind permanently.
  await ExperiencePlanRequest.create({
    requestId: 'req-interrupted',
    identity: 'sha256:' + 'c'.repeat(64),
    courseId,
    revisionId,
    lessonId,
    mode,
    actor: 'author-a',
    provider: 'gemini',
    providerModel: 'gemini/gemini-3.6-flash',
    contextFingerprint: 'sha256:' + 'd'.repeat(64),
    state: 'validating',
    reservedTokens: 32768,
    dispatchAt: new Date(Date.now() - 10 * 60_000),
    updatedAt: new Date(Date.now() - 10 * 60_000),
  });

  await recoverStalePlanningRequests(0);

  const row = await ExperiencePlanRequest.findOne({ requestId: 'req-interrupted' }).lean();
  const availability = await checkStoredPlanAvailability({
    courseId,
    revisionId,
    lessonId,
    mode: typeof row?.mode === 'string' ? row.mode : mode,
  });

  rows.push({
    concern: 'C-3 interrupted attempt after recovery',
    request_state: row?.state,
    code: row?.code,
    availability,
    verdict:
      row?.state === 'uncertain' && availability !== 'available'
        ? 'CLOSED: interrupted attempt becomes uncertain; no plan is advertised'
        : 'OPEN: an interrupted attempt is still advertised as usable',
  });
}

async function main() {
  await mongoose.connect(URI + '/' + DB);

  proofMetricsScope();
  await proofValidatedImpliesPlan();

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  console.table(rows);
  const open = rows.filter((r) => String(r.verdict).startsWith('OPEN'));
  console.log(
    open.length === 0
      ? `ALL ${rows.length} INVARIANTS HOLD`
      : `${open.length} of ${rows.length} INVARIANTS STILL OPEN`,
  );
  if (open.length) process.exitCode = 1;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
