/** Batch 4 RC: the window *after* storeAcceptedPlan succeeds.
 *
 * The previous closure moved persistence before the `validated` write. That
 * leaves a new window: the plan record is committed but the request row has not
 * yet been promoted to `validated`. The process dies there.
 *
 * What must hold afterwards:
 *
 *   1. the accepted plan is still valid and retrievable
 *   2. request-state recovery is consistent (no permanent in-flight state)
 *   3. no false success is returned
 *   4. no automatic redispatch
 *   5. no additional reservation
 *   6. a possibly chargeable attempt retains correct accounting
 *   7. concurrent recovery cannot create conflicting terminal states
 *
 * This script drives the real code against real MongoDB. No provider call.
 */
import mongoose from 'mongoose';
import { ExperiencePlanRequest } from '../modules/study/src/models/ExperiencePlanRequest';
import { ExperiencePlanRecord } from '../modules/study/src/models/ExperiencePlanRecord';
import {
  checkStoredPlanAvailability,
  peekStoredPlan,
  storeAcceptedPlan,
} from '../modules/study/src/services/experiencePlanStore';
import {
  generateExperiencePlan,
  planningIdentity,
  recoverStalePlanningRequests,
} from '../modules/study/src/services/experiencePlanGeneration';
import {
  experienceContextFingerprint,
  type ExperiencePlanValidationContext,
} from '../shared/ednova/experiencePlan';
import { validateExperiencePlan } from '../shared/ednova/experiencePlanValidator';
import { COMPONENT_REGISTRY_VERSION } from '../shared/ednova/componentRegistry';
import { buildPlanningContext } from '../shared/ednova/planningContext';

const URI = process.env.M47_MONGO || 'mongodb://127.0.0.1:27017';
const DB = `test_m47_poststore_${process.pid}`;
const courseId = 'a57d9f30-21c4-58ff-b48c-1e9e140f4c6d';
const revisionId = 'rev_poststore';
const lessonId = 'lesson-1';
const mode = 'guided';
const contentHash = 'sha256:' + 'b'.repeat(64);

process.env.LLM_BUDGET_MONGODB_URI = URI;
process.env.LLM_BUDGET_DB_NAME = DB;

function context(): ExperiencePlanValidationContext {
  return {
    courseId,
    revisionId,
    contentHash,
    lessonId,
    mode,
    contextFingerprint: experienceContextFingerprint({
      courseId,
      revisionId,
      contentHash,
      lessonId,
      mode,
      blockIds: ['h1'],
    }),
    allowedPlanners: [{ implementation: 'mock_experience_planner', version: '1.0.0' }],
    blocks: [
      {
        blockId: 'h1',
        blockType: 'heading',
        render: 'primary',
        hasEvidence: true,
        hasSourceRegion: false,
        isReviewedFormula: false,
        hasStructuredFixture: false,
      },
    ],
    assets: [],
  };
}

function proposal(ctx: ExperiencePlanValidationContext) {
  return {
    schemaVersion: '1.0.0',
    planId: 'plan-poststore',
    claims: {
      courseId,
      revisionId,
      contentHash,
      lessonId,
      mode,
      registryVersion: COMPONENT_REGISTRY_VERSION,
      presentationSchemaVersion: '1.0.0',
      contextFingerprint: ctx.contextFingerprint,
    },
    planner: { implementation: 'mock_experience_planner', version: '1.0.0' },
    placements: [
      {
        placementId: 'p-1',
        kind: 'canonical',
        block: { lessonId, blockId: 'h1' },
        component: 'SectionHeading',
        componentVersion: '1.0.0',
        group: 'none',
        disclosure: 'expanded',
        fallback: 'ConceptExplanation',
      },
    ],
    notes: [],
  };
}

const scope = { courseId, revisionId, lessonId, mode };

/** The planning-context input, and the fingerprint the generator derives from
 * it. Identity is keyed on *this* fingerprint, not the validation one. */
const CONTEXT_INPUT = {
  courseTitle: 'Course',
  courseId,
  revisionId,
  lessonId,
  lessonTitle: 'Lesson',
  mode,
  blocks: [
    {
      blockId: 'h1',
      block: { type: 'heading' as const, id: 'h1', level: 2 as const, text: 'Title' },
      render: 'primary' as const,
      hasSourceRegion: false,
      isReviewedFormula: false,
      hasStructuredFixture: false,
    },
  ],
  assets: [],
  capabilities: [],
};
const PLANNING_FINGERPRINT = buildPlanningContext(CONTEXT_INPUT).fingerprint;
const rows: Array<Record<string, unknown>> = [];
const KEY_SHA = 'a'.repeat(64);
const PLANNER = { implementation: 'mock_experience_planner', version: 'mock/1.0.0' };

/** Consent + eligibility records the governance gate requires. */
async function seedGovernance() {
  const db = mongoose.connection.db!;
  await db.collection('courses').insertOne({
    id: new mongoose.Types.ObjectId(courseId),
    ownerUserId: 'author-a',
    userId: 'author-a',
  } as never);
  await db.collection('experience_planning_consents').insertOne({
    courseId,
    revisionId,
    purpose: 'experience_planning',
    provider: PLANNER.implementation,
    revoked: false,
    expiresAt: new Date(Date.now() + 3600_000),
  } as never);
  await db.collection('experience_planner_eligibility').insertOne({
    provider: PLANNER.implementation,
    model: PLANNER.version,
    revoked: false,
    billingAttached: false,
    freeTier: true,
    expiresAt: new Date(Date.now() + 3600_000),
    verifiedBy: 'ops',
    projectId: 'pilot-1',
    keySha256: KEY_SHA,
    approvalId: 'approval-1',
    maxTokens: 100_000,
  } as never);
}

/** Counts provider dispatches and reservations without letting either happen. */
function jestSpy() {
  let calls = 0;
  let reservations = 0;
  return {
    provider: {
      identity: { provider: PLANNER.implementation, model: PLANNER.version },
      isEnabled: () => true,
      plan: async () => {
        calls += 1;
        throw new Error('must never dispatch during a repair');
      },
    } as never,
    reserve: async () => {
      reservations += 1;
      return { approvalId: 'approval-2', reservedTokens: 32768 };
    },
    reconcile: async () => ({ chargedTokens: 0, refunded: 0, usageReported: false }),
    calls: () => calls,
    reservations: () => reservations,
  };
}

async function main() {
  await mongoose.connect(URI + '/' + DB);
  const ctx = context();

  // ---- crash exactly between store and the `validated` write --------------
  {
    await mongoose.connection.dropDatabase();

    const plan = validateExperiencePlan(proposal(ctx) as never, ctx);

    // The request row as it exists at the moment of the crash: dispatched,
    // reconciling done, `validating` written, plan store committed.
    await ExperiencePlanRequest.create({
      requestId: 'req-poststore',
      // The real identity: a fabricated one makes the generator upsert a new
      // row instead of finding this attempt, which would test nothing.
      identity: planningIdentity({
        courseId,
        revisionId,
        lessonId,
        mode,
        contextFingerprint: PLANNING_FINGERPRINT,
        provider: PLANNER.implementation,
        model: PLANNER.version,
      }),
      courseId,
      revisionId,
      lessonId,
      mode,
      actor: 'author-a',
      provider: PLANNER.implementation,
      providerModel: PLANNER.version,
      contextFingerprint: ctx.contextFingerprint,
      state: 'validating',
      reservedTokens: 32768,
      approvalId: 'approval-1',
      dispatchAt: new Date(Date.now() - 10 * 60_000),
      updatedAt: new Date(Date.now() - 10 * 60_000),
    });

    const stored = await storeAcceptedPlan({
      plan,
      generatedBy: 'author-a',
      contextFingerprint: ctx.contextFingerprint,
      mode,
    });

    // <<< process dies here >>>

    const availability = await checkStoredPlanAvailability(scope);
    const records = await ExperiencePlanRecord.countDocuments({
      ...scope,
      supersededAt: { $exists: false },
    });

    rows.push({
      point: 'at crash',
      plan_stored: stored.stored,
      plan_records: records,
      availability,
      request_state: 'validating',
      verdict:
        stored.stored && availability === 'available' && records === 1
          ? 'plan is durable before the state write'
          : 'DEFECT: plan not retrievable after store',
    });
  }

  // ---- recovery after the crash ------------------------------------------
  {
    const first = await recoverStalePlanningRequests(0);
    const row = await ExperiencePlanRequest.findOne({ requestId: 'req-poststore' }).lean();
    const availability = await checkStoredPlanAvailability(scope);
    const reservedTokens = Number(row?.reservedTokens ?? 0);

    rows.push({
      point: 'after recovery',
      recovered: first,
      request_state: row?.state,
      code: row?.code,
      availability,
      reserved_tokens: reservedTokens,
      verdict:
        row?.state === 'uncertain' && availability === 'available'
          ? 'state honest (uncertain); plan still retrievable'
          : 'DEFECT: recovery lost the plan or left a bad state',
    });
  }

  // ---- concurrent recovery ------------------------------------------------
  {
    // Re-create the same window so two recoveries race on one row.
    await ExperiencePlanRequest.updateOne(
      { requestId: 'req-poststore' },
      {
        $set: {
          state: 'validating',
          dispatchAt: new Date(Date.now() - 10 * 60_000),
          updatedAt: new Date(Date.now() - 10 * 60_000),
        },
        $unset: { code: 1, finishedAt: 1 },
      },
    );

    const [a, b, c] = await Promise.all([
      recoverStalePlanningRequests(0),
      recoverStalePlanningRequests(0),
      recoverStalePlanningRequests(0),
    ]);
    const row = await ExperiencePlanRequest.findOne({ requestId: 'req-poststore' }).lean();
    const terminals = await ExperiencePlanRequest.countDocuments({
      requestId: 'req-poststore',
    });

    rows.push({
      point: '3 concurrent recoveries',
      counts: `${a}/${b}/${c}`,
      request_state: row?.state,
      rows_for_request: terminals,
      verdict:
        row?.state === 'uncertain' && terminals === 1
          ? 'one terminal state, no conflicting transitions'
          : 'DEFECT: concurrent recovery produced a conflicting state',
    });
  }

  // ---- the author returns after recovery ---------------------------------
  {
    // Recovery left the request `uncertain` while the plan record is intact.
    // A new authorised attempt must NOT dispatch: it adopts the durable plan.
    //
    // Governance is seeded so this proof can reach the repair path. Authorising
    // a real attempt is out of scope here; what is under test is what happens
    // *after* authorisation when a durable plan already exists.
    await seedGovernance();
    const planSpy = jestSpy();
    const outcome = await generateExperiencePlan({
      actor: 'author-a',
      provider: planSpy.provider,
      courseId,
      revisionId,
      lessonId,
      mode,
      keySha256: KEY_SHA,
      contextInput: CONTEXT_INPUT,
      validationContext: ctx,
      reserve: planSpy.reserve,
      reconcile: planSpy.reconcile,
    });

    const row = await ExperiencePlanRequest.findOne({ requestId: 'req-poststore' }).lean();
    rows.push({
      point: 'author returns after recovery',
      recovered: outcome.status,
      refusal: 'code' in outcome ? String(outcome.code) : '',
      request_state: row?.state,
      provider_calls: planSpy.calls(),
      reservations: planSpy.reservations(),
      verdict:
        outcome.status === 'already_accepted' &&
        planSpy.calls() === 0 &&
        planSpy.reservations() === 0 &&
        row?.state === 'validated'
          ? 'adopted durable plan: no dispatch, no reservation, state repaired'
          : 'DEFECT: repair dispatched, reserved, or left the wrong state',
    });
  }

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.table(rows);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
