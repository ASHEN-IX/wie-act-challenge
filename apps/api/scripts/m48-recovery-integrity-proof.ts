/** Batch 4 RC: recovery integrity across the `uncertain` → `validated` repair.
 *
 * The pilot-readiness repair originally promoted an `uncertain` request to
 * `validated` when `peekStoredPlan()` returned true. That check is existence +
 * version stamps only: no content hash, no context fingerprint, no re-parse, no
 * live asset/review authority, no digest match. A tampered, stale,
 * wrong-revision or review-revoked plan would have been advertised as validated.
 *
 * The repair now runs the same trusted contract the learner read path uses
 * (`loadAcceptedPlan`). This script proves each scenario against real MongoDB.
 *
 * No provider call. No live AI service.
 */
import mongoose from 'mongoose';
import assert from 'node:assert/strict';
import { closeBudgetClient } from '../modules/study/src/services/planningBudget';
import { parseStructuredAsset } from '../shared/ednova/structuredAsset';
import { assetContentHash } from '../modules/study/src/services/assetReviewProvenance';
import { verifyAssetBindingsWithProvenance } from '../modules/study/src/services/experiencePlanning';
import { StructuredAssetReview } from '../modules/study/src/models/StructuredAssetReview';
import { ExperiencePlanRequest } from '../modules/study/src/models/ExperiencePlanRequest';
import { ExperiencePlanRecord } from '../modules/study/src/models/ExperiencePlanRecord';
import {
  checkStoredPlanAvailability,
  peekStoredPlan,
  loadAcceptedPlan,
  storeAcceptedPlan
} from '../modules/study/src/services/experiencePlanStore';
import {
  generateExperiencePlan,
  planningIdentity,
  recoverStalePlanningRequests
} from '../modules/study/src/services/experiencePlanGeneration';
import {
  experienceContextFingerprint,
  type ExperiencePlanValidationContext
} from '../shared/ednova/experiencePlan';
import { validateExperiencePlan } from '../shared/ednova/experiencePlanValidator';
import { buildPlanningContext } from '../shared/ednova/planningContext';
import { COMPONENT_REGISTRY_VERSION } from '../shared/ednova/componentRegistry';

const URI = process.env.M48_MONGO || 'mongodb://127.0.0.1:27017';
const DB = `test_m48_recovery_${process.pid}`;
const courseId = '0123456789abcdef01234567';
const revisionId = 'rev_m48';
const lessonId = 'lesson-1';
const mode = 'guided';
const contentHash = 'sha256:' + 'b'.repeat(64);
const KEY_SHA = 'a'.repeat(64);
const PLANNER = { implementation: 'mock_experience_planner', version: 'mock/1.0.0' };

process.env.LLM_BUDGET_MONGODB_URI = URI;
process.env.LLM_BUDGET_DB_NAME = DB;

function context(overrides: Partial<ExperiencePlanValidationContext> = {}) {
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
      blockIds: ['h1']
    }),
    allowedPlanners: [{ implementation: PLANNER.implementation, version: '1.0.0' }],
    blocks: [
      {
        blockId: 'h1',
        blockType: 'heading',
        render: 'primary',
        hasEvidence: true,
        hasSourceRegion: false,
        isReviewedFormula: false,
        hasStructuredFixture: false
      }
    ],
    assets: [],
    ...overrides
  } as ExperiencePlanValidationContext;
}

function proposal(ctx: ExperiencePlanValidationContext) {
  return {
    schemaVersion: '1.0.0',
    planId: 'plan-m48',
    claims: {
      courseId: ctx.courseId,
      revisionId: ctx.revisionId,
      contentHash: ctx.contentHash,
      lessonId: ctx.lessonId,
      mode: ctx.mode,
      registryVersion: COMPONENT_REGISTRY_VERSION,
      presentationSchemaVersion: '1.0.0',
      contextFingerprint: ctx.contextFingerprint
    },
    planner: { implementation: PLANNER.implementation, version: '1.0.0' },
    placements: [
      {
        placementId: 'p-1',
        kind: 'canonical',
        block: { lessonId, blockId: 'h1' },
        component: 'SectionHeading',
        componentVersion: '1.0.0',
        group: 'none',
        disclosure: 'expanded',
        fallback: 'ConceptExplanation'
      }
    ],
    notes: []
  };
}

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
      hasStructuredFixture: false
    }
  ],
  assets: [],
  capabilities: []
};
const PLANNING_FINGERPRINT = buildPlanningContext(CONTEXT_INPUT).fingerprint;

async function seedGovernance() {
  const db = mongoose.connection.db!;
  await db.collection('courses').insertOne({
    _id: new mongoose.Types.ObjectId(courseId),
    ownerUserId: 'author-a',
    userId: 'author-a'
  } as never);
  await db.collection('experience_planning_consents').insertOne({
    courseId,
    revisionId,
    purpose: 'experience_planning',
    provider: PLANNER.implementation,
    revoked: false,
    expiresAt: new Date(Date.now() + 3600_000)
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
    maxTokens: 100_000
  } as never);
}

/** A request row in the exact post-crash state, plus a stored plan. */
async function seedWindow(ctx: ExperiencePlanValidationContext) {
  await mongoose.connection.dropDatabase();
  await seedGovernance();
  const plan = validateExperiencePlan(proposal(ctx) as never, ctx);
  await mongoose.connection.db!.collection('llm_approval_budgets').insertOne({
    _id: 'approval-1' as never,
    task: 'experience_planning',
    model: PLANNER.version,
    maxTokens: 100_000,
    usedTokens: 32768,
    usedRequests: 1,
    expiresAt: Math.floor(Date.now() / 1000) + 3600
  });
  await ExperiencePlanRequest.create({
    requestId: 'req-m48',
    identity: planningIdentity({
      courseId,
      revisionId,
      lessonId,
      mode,
      contextFingerprint: PLANNING_FINGERPRINT,
      provider: PLANNER.implementation,
      model: PLANNER.version
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
    updatedAt: new Date(Date.now() - 10 * 60_000)
  });
  const stored = await storeAcceptedPlan({
    plan,
    generatedBy: 'author-a',
    contextFingerprint: ctx.contextFingerprint,
    mode
  });
  const recoveries = await Promise.all([
    recoverStalePlanningRequests(0),
    recoverStalePlanningRequests(0),
    recoverStalePlanningRequests(0)
  ]);
  assert.equal(
    recoveries.reduce((sum, count) => sum + count, 0),
    1
  );
  return stored;
}

function spy() {
  let calls = 0;
  let reservations = 0;
  let reconciliations = 0;
  return {
    provider: {
      identity: { provider: PLANNER.implementation, model: PLANNER.version },
      isEnabled: () => true,
      plan: async () => {
        calls += 1;
        throw new Error('must never dispatch during a repair');
      }
    } as never,
    reserve: async () => {
      reservations += 1;
      return { approvalId: 'approval-2', reservedTokens: 32768 };
    },
    reconcile: async () => {
      reconciliations += 1;
      return { chargedTokens: 0, refunded: 0, usageReported: false };
    },
    reconciliations: () => reconciliations,
    calls: () => calls,
    reservations: () => reservations
  };
}

async function attempt(ctx: ExperiencePlanValidationContext) {
  const s = spy();
  const ledger = () => mongoose.connection.db!.collection('llm_approval_budgets').find().toArray();
  const beforeLedger = await ledger();
  const before = await ExperiencePlanRequest.findOne({ requestId: 'req-m48' }).lean();
  const outcome = await generateExperiencePlan({
    actor: 'author-a',
    provider: s.provider,
    courseId,
    revisionId,
    lessonId,
    mode,
    keySha256: KEY_SHA,
    contextInput: CONTEXT_INPUT,
    validationContext: ctx,
    reserve: s.reserve,
    reconcile: s.reconcile
  });
  const row = await ExperiencePlanRequest.findOne({ requestId: 'req-m48' }).lean();
  assert.equal(s.calls(), 0, 'recovery dispatched a provider');
  assert.equal(s.reservations(), 0, 'recovery reserved again');
  assert.equal(s.reconciliations(), 0, 'recovery reconciled/refunded again');
  assert.deepEqual(await ledger(), beforeLedger, 'durable ledger changed');
  for (const key of ['reservedTokens', 'reportedTokens', 'usageReported', 'approvalId'] as const)
    assert.deepEqual(row?.[key], before?.[key], `request accounting changed: ${key}`);
  if (outcome.status === 'already_accepted') {
    const loaded = await loadAcceptedPlan({
      courseId,
      revisionId,
      lessonId,
      mode,
      contentHash: ctx.contentHash,
      contextFingerprint: ctx.contextFingerprint,
      validationContext: ctx
    });
    assert.equal(loaded.status, 'available', 'adopted plan is not retrievable');
    if (loaded.status === 'available') {
      assert.equal(loaded.plan.digest, outcome.planDigest);
      assert.equal(loaded.plan.digest, row?.planDigest);
      assert.equal(loaded.plan.revisionId, revisionId);
    }
  }
  if (process.env.M48_DEBUG)
    console.error('[DBG]', String(row?.state), JSON.stringify(outcome).slice(0, 160));
  return { outcome, state: row?.state, calls: s.calls(), reservations: s.reservations() };
}

const rows: Array<Record<string, unknown>> = [];

async function main() {
  await mongoose.connect(URI + '/' + DB);

  // ---- 1. valid durable plan -------------------------------------------
  {
    const ctx = context();
    await seedWindow(ctx);
    const r = await attempt(ctx);
    rows.push({
      scenario: 'valid durable plan',
      outcome: r.outcome.status,
      state: r.state,
      dispatch: r.calls,
      reserved: r.reservations,
      verdict:
        r.outcome.status === 'already_accepted' &&
        r.state === 'validated' &&
        r.calls === 0 &&
        r.reservations === 0
          ? 'PASS: adopted, no dispatch, no reservation'
          : 'FAIL'
    });
  }

  // ---- 2. tampered plan (stored body altered) ---------------------------
  {
    const ctx = context();
    await seedWindow(ctx);
    await ExperiencePlanRecord.updateOne(
      { courseId },
      { $set: { 'plan.canonical.0.component': 'UnknownWidget' } }
    );
    const r = await attempt(ctx);
    rows.push({
      scenario: 'tampered plan',
      outcome: r.outcome.status,
      state: r.state,
      dispatch: r.calls,
      reserved: r.reservations,
      verdict:
        r.outcome.status !== 'already_accepted' && r.state === 'uncertain' && r.calls === 0
          ? 'PASS: refused; request stays uncertain'
          : 'FAIL: tampered plan was adopted'
    });
  }

  // ---- 3. stale plan (content hash changed) -----------------------------
  {
    const ctx = context();
    await seedWindow(ctx);
    await ExperiencePlanRecord.updateOne(
      { courseId },
      { $set: { contentHash: 'sha256:' + 'f'.repeat(64) } }
    );
    const r = await attempt(ctx);
    rows.push({
      scenario: 'stale plan (content hash)',
      outcome: r.outcome.status,
      state: r.state,
      verdict:
        r.outcome.status !== 'already_accepted' && r.state === 'uncertain'
          ? 'PASS: refused'
          : 'FAIL: stale plan was adopted'
    });
  }

  // ---- 4. persisted asset approval, then revoke the exact review ---------
  {
    const ctx = context();
    await seedWindow(ctx);
    const asset = parseStructuredAsset({
      schemaVersion: '1.0.0',
      assetId: 'asset-walkthrough',
      courseId,
      revisionId,
      lessonId,
      blockId: 'code1',
      registryVersion: COMPONENT_REGISTRY_VERSION,
      component: 'CodeWalkthrough',
      payload: {
        component: 'CodeWalkthrough',
        language: 'python',
        code: 'a=1',
        annotations: [{ line: 0, explanation: 'Assign one.' }]
      },
      provenance: 'instructor_authored',
      review: {
        status: 'instructor_reviewed',
        reviewedBy: 'author-a',
        reviewedAt: '2026-11-08T00:00:00Z'
      },
      audience: 'course',
      fallback: 'CodeViewer',
      disclosure: 'Instructor walkthrough.'
    });
    await StructuredAssetReview.create({
      reviewId: 'review-m48',
      courseId,
      revisionId,
      lessonId,
      assetId: asset.assetId,
      contentHash: assetContentHash(asset),
      decision: 'approved',
      reviewerUserId: 'author-a',
      reviewerRole: 'owner',
      decidedAt: new Date()
    });
    const binding = { courseId, revisionId, lessonId, authorizedDocumentIds: new Set<string>() };
    const approved = await verifyAssetBindingsWithProvenance([asset], binding);
    assert.equal(approved.bindings[0].reviewVerified, true);
    const reviewedCtx = context({
      blocks: [...ctx.blocks, { ...ctx.blocks[0], blockId: 'code1', blockType: 'code' }],
      assets: approved.bindings
    });
    const raw = proposal(reviewedCtx);
    raw.placements.push({
      ...raw.placements[0],
      placementId: 'p-code',
      block: { lessonId, blockId: 'code1' },
      component: 'CodeViewer',
      fallback: 'CodeViewer'
    });
    const withAsset = {
      ...raw,
      placements: [
        ...raw.placements,
        {
          placementId: 's-code',
          kind: 'supplemental',
          block: { lessonId, blockId: 'code1' },
          component: 'CodeWalkthrough',
          componentVersion: '1.0.0',
          assetId: asset.assetId,
          group: 'example',
          disclosure: 'expanded',
          fallback: 'CodeViewer'
        }
      ]
    };
    const plan = validateExperiencePlan(withAsset, reviewedCtx);
    assert.equal(
      (
        await storeAcceptedPlan({
          plan,
          generatedBy: 'author-a',
          contextFingerprint: reviewedCtx.contextFingerprint,
          mode
        })
      ).stored,
      true
    );
    const before = await loadAcceptedPlan({
      courseId,
      revisionId,
      lessonId,
      mode,
      contentHash,
      contextFingerprint: reviewedCtx.contextFingerprint,
      validationContext: reviewedCtx
    });
    assert.equal(before.status, 'available', 'reviewed asset must round-trip before revocation');
    // Change the persisted authority without invalidating the plan row. This
    // forces the trusted validator to catch revocation itself.
    await StructuredAssetReview.updateOne(
      { reviewId: 'review-m48' },
      { $set: { revokedAt: new Date(), revokedByUserId: 'author-a' } }
    );
    const revoked = await verifyAssetBindingsWithProvenance([asset], binding);
    assert.equal(revoked.provenance.get(asset.assetId)?.reason, 'revoked');
    const r = await attempt({ ...reviewedCtx, assets: revoked.bindings });
    rows.push({
      scenario: 'persisted review revoked',
      outcome: r.outcome.status,
      state: r.state,
      verdict: r.outcome.status === 'failed' && r.state === 'uncertain' ? 'PASS: refused' : 'FAIL'
    });
  }

  // ---- 5. wrong revision -----------------------------------------------
  {
    const ctx = context();
    await seedWindow(ctx);
    await ExperiencePlanRecord.updateOne(
      { courseId },
      { $set: { 'plan.revisionId': 'rev_other' } }
    );
    const r = await attempt(ctx);
    rows.push({
      scenario: 'wrong revision',
      outcome: r.outcome.status,
      state: r.state,
      verdict:
        r.outcome.status !== 'already_accepted' && r.state !== 'validated'
          ? 'PASS: refused'
          : 'FAIL: wrong-revision plan adopted'
    });
  }

  // ---- 6. concurrent recovery ------------------------------------------
  {
    const ctx = context();
    await seedWindow(ctx);
    const [a, b, c] = await Promise.all([attempt(ctx), attempt(ctx), attempt(ctx)]);
    const row = await ExperiencePlanRequest.findOne({ requestId: 'req-m48' }).lean();
    const count = await ExperiencePlanRequest.countDocuments({ requestId: 'req-m48' });
    const plans = await ExperiencePlanRecord.countDocuments({
      courseId,
      revisionId,
      lessonId,
      mode
    });
    const adopted = [a, b, c].filter((x) => x.outcome.status === 'already_accepted').length;
    rows.push({
      scenario: '3 concurrent adoptions',
      outcome: `${adopted} adopted`,
      state: row?.state,
      dispatch: a.calls + b.calls + c.calls,
      reserved: a.reservations + b.reservations + c.reservations,
      verdict:
        row?.state === 'validated' &&
        count === 1 &&
        plans === 1 &&
        adopted === 3 &&
        a.calls + b.calls + c.calls === 0 &&
        a.reservations + b.reservations + c.reservations === 0
          ? 'PASS: one terminal state, no dispatch, no reservation'
          : 'FAIL'
    });
  }

  // ---- 7. peek is not sufficient (documents the defect it replaced) -----
  {
    const ctx = context();
    await seedWindow(ctx);
    await ExperiencePlanRecord.updateOne(
      { courseId },
      { $set: { contentHash: 'sha256:' + 'f'.repeat(64) } }
    );
    const peek = await peekStoredPlan({ courseId, revisionId, lessonId, mode });
    const availability = await checkStoredPlanAvailability({
      courseId,
      revisionId,
      lessonId,
      mode
    });
    const r = await attempt(ctx);
    rows.push({
      scenario: 'weak check vs trusted contract',
      outcome: `peek=${peek} avail=${availability}`,
      state: r.state,
      verdict:
        peek === true && r.outcome.status !== 'already_accepted'
          ? 'PASS: peek would have adopted a stale plan; trusted contract refused it'
          : 'INCONCLUSIVE: peek did not diverge'
    });
  }

  for (const [name, mutation] of [
    ['record revision', { revisionId: 'rev_other' }],
    ['context fingerprint', { contextFingerprint: 'fnv1a64:0000000000000000' }],
    ['body fingerprint', { 'plan.contextFingerprint': 'fnv1a64:0000000000000000' }],
    ['plan schema', { planSchemaVersion: '0.0.0' }],
    ['registry version', { registryVersion: '0.0.0' }],
    ['presentation schema', { presentationSchemaVersion: '0.0.0' }],
    ['record digest', { planDigest: 'fnv1a64:0000000000000000' }],
    ['body digest', { 'plan.digest': 'fnv1a64:0000000000000000' }],
    // Well-formed and still valid, but no longer the accepted digest.
    ['body disclosure tampering', { 'plan.canonical.0.disclosure': 'collapsed' }]
  ] as const) {
    const ctx = context();
    await seedWindow(ctx);
    await ExperiencePlanRecord.updateOne({ courseId }, { $set: mutation });
    const r = await attempt(ctx);
    rows.push({
      scenario: name,
      outcome: r.outcome.status,
      state: r.state,
      verdict: r.outcome.status === 'failed' && r.state === 'uncertain' ? 'PASS: refused' : 'FAIL'
    });
  }

  // ---- 8. no durable plan at all ---------------------------------------
  {
    const ctx = context();
    await mongoose.connection.dropDatabase();
    await seedGovernance();
    await ExperiencePlanRequest.create({
      requestId: 'req-m48',
      identity: planningIdentity({
        courseId,
        revisionId,
        lessonId,
        mode,
        contextFingerprint: PLANNING_FINGERPRINT,
        provider: PLANNER.implementation,
        model: PLANNER.version
      }),
      courseId,
      revisionId,
      lessonId,
      mode,
      actor: 'author-a',
      provider: PLANNER.implementation,
      providerModel: PLANNER.version,
      contextFingerprint: ctx.contextFingerprint,
      state: 'uncertain',
      reservedTokens: 32768,
      approvalId: 'approval-1',
      dispatchAt: new Date(Date.now() - 10 * 60_000),
      updatedAt: new Date(Date.now() - 10 * 60_000)
    });
    const r = await attempt(ctx);
    rows.push({
      scenario: 'no durable plan',
      outcome: r.outcome.status,
      state: r.state,
      dispatch: r.calls,
      verdict:
        r.outcome.status === 'failed' && r.state === 'uncertain' && r.calls === 0
          ? 'PASS: honest failure, no dispatch, no refund'
          : 'FAIL'
    });
  }

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.table(rows);
  const failed = rows.filter((r) => String(r.verdict).startsWith('FAIL'));
  console.log(
    failed.length === 0
      ? `ALL ${rows.length} SCENARIOS PASS`
      : `${failed.length} of ${rows.length} SCENARIOS FAIL`
  );
  if (failed.length) process.exitCode = 1;
}

void main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await closeBudgetClient();
  });
