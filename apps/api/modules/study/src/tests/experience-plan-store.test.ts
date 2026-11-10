/** Batch 4 M4.3 gate 1.3: a stored plan is never trusted on read.
 *
 * The M4.2 lifecycle kept only a digest, so a completed plan could not be
 * retrieved. M4.3 persists the accepted body — but persistence is not
 * authority. The validated-plan brand is a module-private symbol and does not
 * survive serialization, so every read re-runs the whole trusted pipeline.
 *
 * These tests simulate that boundary explicitly: the record is plain JSON, and
 * the only thing that can make it usable is the live validator against live
 * data.
 */
jest.mock('../models/ExperiencePlanRecord', () => ({
  ExperiencePlanRecord: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateMany: jest.fn()
  }
}));

import { ExperiencePlanRecord } from '../models/ExperiencePlanRecord';
import {
  loadAcceptedPlan,
  storeAcceptedPlan,
  experiencePlanId,
  invalidateStoredPlans
} from '../services/experiencePlanStore';
import {
  experienceContextFingerprint,
  isValidatedExperiencePlan,
  type ExperiencePlanValidationContext
} from '../../../../shared/ednova/experiencePlan';
import { validateExperiencePlan } from '../../../../shared/ednova/experiencePlanValidator';
import {
  planMockExperience,
  type MockPlannerContext
} from '../../../../shared/ednova/mockExperiencePlanner';
import { projectExperiencePlan } from '../services/experiencePlanning';
import { COMPONENT_REGISTRY_VERSION } from '../../../../shared/ednova/componentRegistry';
import { EXPERIENCE_PLAN_SCHEMA_VERSION } from '../../../../shared/ednova/experiencePlan';
import { PRESENTATION_SCHEMA_VERSION } from '../../../../shared/ednova/presentationDocument';

const courseId = 'a57d9f30-21c4-58ff-b48c-1e9e140f4c6d';
const revisionId = 'rev_m43';
const contentHash = 'sha256:' + 'b'.repeat(64);

const findOne = ExperiencePlanRecord.findOne as jest.Mock;
const findOneAndUpdate = ExperiencePlanRecord.findOneAndUpdate as jest.Mock;
const updateMany = ExperiencePlanRecord.updateMany as jest.Mock;

const facts: ExperiencePlanValidationContext['blocks'] = [
  {
    blockId: 'h1',
    blockType: 'heading',
    render: 'primary',
    hasEvidence: true,
    hasSourceRegion: false,
    isReviewedFormula: false,
    hasStructuredFixture: false
  },
  {
    blockId: 'p1',
    blockType: 'paragraph',
    render: 'primary',
    hasEvidence: true,
    hasSourceRegion: false,
    isReviewedFormula: false,
    hasStructuredFixture: false
  }
];

function context(
  overrides: Partial<ExperiencePlanValidationContext> = {}
): ExperiencePlanValidationContext {
  const blocks = overrides.blocks ?? facts;
  return {
    courseId,
    revisionId,
    contentHash,
    lessonId: 'lesson-1',
    mode: 'guided',
    contextFingerprint: experienceContextFingerprint({
      courseId,
      revisionId,
      contentHash,
      lessonId: 'lesson-1',
      mode: 'guided',
      blockIds: blocks.map((b) => b.blockId)
    }),
    allowedPlanners: [{ implementation: 'mock_experience_planner', version: '1.0.0' }],
    blocks,
    assets: [],
    ...overrides
  };
}

function plannerContext(ctx: ExperiencePlanValidationContext): MockPlannerContext {
  return {
    courseId: ctx.courseId,
    revisionId: ctx.revisionId,
    contentHash: ctx.contentHash,
    lessonId: ctx.lessonId,
    mode: ctx.mode,
    blocks: ctx.blocks.map((b) => ({
      blockId: b.blockId,
      blockType: b.blockType,
      ...(b.role !== undefined ? { role: b.role } : {}),
      render: b.render,
      hasEvidence: b.hasEvidence,
      hasSourceRegion: b.hasSourceRegion,
      isReviewedFormula: b.isReviewedFormula,
      hasStructuredFixture: b.hasStructuredFixture
    })),
    assets: []
  };
}

/** A validated plan, produced the real way. */
function validatedPlan(ctx = context()) {
  const result = planMockExperience('valid_mathematics', plannerContext(ctx));
  if (!result.ok) throw new Error('planner failed');
  return validateExperiencePlan(result.proposal, ctx);
}

/** The exact record the store writes, as it comes back from MongoDB: plain JSON. */
function storedRecord(overrides: Record<string, unknown> = {}) {
  const ctx = context();
  const plan = projectExperiencePlan(validatedPlan(ctx));
  return {
    planId: experiencePlanId({
      courseId,
      revisionId,
      lessonId: 'lesson-1',
      mode: 'guided',
      contextFingerprint: ctx.contextFingerprint
    }),
    courseId,
    revisionId,
    lessonId: 'lesson-1',
    mode: 'guided',
    contentHash,
    contextFingerprint: ctx.contextFingerprint,
    planSchemaVersion: EXPERIENCE_PLAN_SCHEMA_VERSION,
    registryVersion: COMPONENT_REGISTRY_VERSION,
    presentationSchemaVersion: PRESENTATION_SCHEMA_VERSION,
    provider: plan.planner.implementation,
    providerModel: plan.planner.version,
    plannerImplementation: plan.planner.implementation,
    plannerVersion: plan.planner.version,
    planDigest: plan.digest,
    plan: JSON.parse(JSON.stringify(plan)),
    generatedBy: '04b3da2d-ec14-5643-bf49-e43f550168bf',
    generatedAt: new Date(),
    ...overrides
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  findOneAndUpdate.mockResolvedValue({});
  updateMany.mockResolvedValue({ modifiedCount: 1 });
});

describe('storing an accepted plan', () => {
  it('stores only a branded validated plan', async () => {
    const plan = validatedPlan();
    const outcome = await storeAcceptedPlan({
      plan,
      generatedBy: 'author',
      contextFingerprint: context().contextFingerprint,
      mode: 'guided'
    });
    expect(outcome.stored).toBe(true);
  });

  it('refuses a deserialized plan, which is not branded', async () => {
    const plan = validatedPlan();
    const roundTripped = JSON.parse(JSON.stringify(plan));
    expect(isValidatedExperiencePlan(roundTripped)).toBe(false);
    const outcome = await storeAcceptedPlan({
      plan: roundTripped,
      generatedBy: 'author',
      contextFingerprint: context().contextFingerprint,
      mode: 'guided'
    });
    expect(outcome).toEqual({ stored: false, reason: 'not_validated' });
  });

  it('refuses a plan whose fingerprint does not match the request', async () => {
    const plan = validatedPlan();
    const outcome = await storeAcceptedPlan({
      plan,
      generatedBy: 'author',
      contextFingerprint: 'fnv1a64:0000000000000000',
      mode: 'guided'
    });
    expect(outcome).toEqual({ stored: false, reason: 'identity_mismatch' });
  });

  it('supersedes the previous plan for the same scope', async () => {
    await storeAcceptedPlan({
      plan: validatedPlan(),
      generatedBy: 'author',
      contextFingerprint: context().contextFingerprint,
      mode: 'guided'
    });
    const [filter] = updateMany.mock.calls[0];
    expect(filter.supersededAt).toEqual({ $exists: false });
  });

  it('binds the record to course, revision, lesson, mode and both versions', async () => {
    await storeAcceptedPlan({
      plan: validatedPlan(),
      generatedBy: 'author',
      contextFingerprint: context().contextFingerprint,
      mode: 'guided'
    });
    const [, update] = findOneAndUpdate.mock.calls[0];
    const set = update.$set;
    expect(set).toMatchObject({
      courseId,
      revisionId,
      lessonId: 'lesson-1',
      mode: 'guided',
      contentHash,
      planSchemaVersion: EXPERIENCE_PLAN_SCHEMA_VERSION,
      registryVersion: COMPONENT_REGISTRY_VERSION
    });
  });
});

describe('reading a stored plan', () => {
  const load = (record: unknown, ctx = context()) => {
    findOne.mockReturnValue({ lean: async () => record });
    return loadAcceptedPlan({
      courseId,
      revisionId,
      lessonId: 'lesson-1',
      mode: 'guided',
      contentHash: ctx.contentHash,
      contextFingerprint: ctx.contextFingerprint,
      validationContext: ctx
    });
  };

  it('returns absent when no record exists', async () => {
    findOne.mockReturnValue({ lean: async () => null });
    const outcome = await loadAcceptedPlan({
      courseId,
      revisionId,
      lessonId: 'lesson-1',
      mode: 'guided',
      contentHash,
      contextFingerprint: context().contextFingerprint,
      validationContext: context()
    });
    expect(outcome.status).toBe('absent');
  });

  it('returns the plan when the stored body still validates', async () => {
    const record = storedRecord();
    // Use the exact JSON shape persisted by storeAcceptedPlan, without a
    // test-only conversion that could conceal a broken reader.
    findOne.mockReturnValue({ lean: async () => record });
    const outcome = await loadAcceptedPlan({
      courseId,
      revisionId,
      lessonId: 'lesson-1',
      mode: 'guided',
      contentHash,
      contextFingerprint: context().contextFingerprint,
      validationContext: context()
    });
    expect(outcome.status).toBe('available');
    if (outcome.status === 'available')
      expect(outcome.plan.canonical.map((e) => e.blockId)).toEqual(['h1', 'p1']);
  });

  it('rejects a stale plan when the canonical content hash changed', async () => {
    const record = storedRecord({ contentHash: 'sha256:' + 'f'.repeat(64) });
    expect((await load(record)).status).toBe('stale');
  });

  it('rejects a stale plan when the planning fingerprint changed', async () => {
    const record = storedRecord({ contextFingerprint: 'fnv1a64:0000000000000000' });
    expect((await load(record)).status).toBe('stale');
  });

  it('rejects a plan written under a different registry version', async () => {
    const record = storedRecord({ registryVersion: '0.9.0' });
    const outcome = await load(record);
    expect(outcome).toMatchObject({ status: 'stale', reason: 'REGISTRY_VERSION_CHANGED' });
  });

  it('rejects a plan written under a different plan schema', async () => {
    const record = storedRecord({ planSchemaVersion: '0.9.0' });
    expect(await load(record)).toMatchObject({
      status: 'stale',
      reason: 'PLAN_SCHEMA_CHANGED'
    });
  });

  it('rejects a tampered body that no longer parses', async () => {
    const record = storedRecord();
    findOne.mockReturnValue({ lean: async () => ({ ...record, plan: { not: 'a plan' } }) });
    const outcome = await loadAcceptedPlan({
      courseId,
      revisionId,
      lessonId: 'lesson-1',
      mode: 'guided',
      contentHash,
      contextFingerprint: context().contextFingerprint,
      validationContext: context()
    });
    expect(outcome).toMatchObject({ status: 'rejected', code: 'PLAN_SCHEMA_INVALID' });
  });

  it('rejects a tampered body that drops a canonical block', async () => {
    const record = storedRecord();
    record.plan.canonical = record.plan.canonical.slice(0, 1);
    findOne.mockReturnValue({ lean: async () => record });
    const outcome = await loadAcceptedPlan({
      courseId,
      revisionId,
      lessonId: 'lesson-1',
      mode: 'guided',
      contentHash,
      contextFingerprint: context().contextFingerprint,
      validationContext: context()
    });
    expect(outcome.status).toBe('rejected');
    if (outcome.status === 'rejected') expect(outcome.code).toBe('PLAN_SCHEMA_INVALID');
  });

  it('rejects a stored plan whose live context no longer covers it', async () => {
    // The live lesson gained a block after the plan was accepted: coverage fails.
    const record = storedRecord();
    const grown = context({
      blocks: [
        ...facts,
        {
          blockId: 'p2',
          blockType: 'paragraph',
          render: 'primary',
          hasEvidence: true,
          hasSourceRegion: false,
          isReviewedFormula: false,
          hasStructuredFixture: false
        }
      ],
      contextFingerprint: context().contextFingerprint
    });
    findOne.mockReturnValue({
      lean: async () => ({ ...record, plan: record.plan })
    });
    const outcome = await loadAcceptedPlan({
      courseId,
      revisionId,
      lessonId: 'lesson-1',
      mode: 'guided',
      contentHash,
      contextFingerprint: grown.contextFingerprint,
      validationContext: grown
    });
    expect(outcome.status).toBe('rejected');
  });

  it('rejects when the stored digest does not match the revalidated plan', async () => {
    const record = storedRecord();
    findOne.mockReturnValue({
      lean: async () => ({
        ...record,
        planDigest: 'fnv1a64:0000000000000000',
        plan: record.plan
      })
    });
    const outcome = await loadAcceptedPlan({
      courseId,
      revisionId,
      lessonId: 'lesson-1',
      mode: 'guided',
      contentHash,
      contextFingerprint: context().contextFingerprint,
      validationContext: context()
    });
    expect(outcome).toMatchObject({ status: 'stale', reason: 'PLAN_DIGEST_CHANGED' });
  });

  it('ignores a superseded or invalidated record', async () => {
    findOne.mockReturnValue({ lean: async () => null });
    // The query itself excludes them, so the read must not fall back to a
    // superseded row if one somehow matched.
    const outcome = await loadAcceptedPlan({
      courseId,
      revisionId,
      lessonId: 'lesson-1',
      mode: 'guided',
      contentHash,
      contextFingerprint: context().contextFingerprint,
      validationContext: context()
    });
    expect(outcome.status).toBe('absent');
  });
});

describe('identity and invalidation', () => {
  it('derives a stable plan id from the scope', () => {
    const a = experiencePlanId({
      courseId,
      revisionId,
      lessonId: 'lesson-1',
      mode: 'guided',
      contextFingerprint: 'fnv1a64:1'
    });
    const b = experiencePlanId({
      courseId,
      revisionId,
      lessonId: 'lesson-1',
      mode: 'guided',
      contextFingerprint: 'fnv1a64:1'
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^plan_[a-f0-9]{32}$/);
  });

  it('changes the plan id when the mode changes', () => {
    const base = {
      courseId,
      revisionId,
      lessonId: 'lesson-1',
      contextFingerprint: 'fnv1a64:1'
    };
    expect(experiencePlanId({ ...base, mode: 'guided' })).not.toBe(
      experiencePlanId({ ...base, mode: 'deep_dive' })
    );
  });

  it('invalidates every plan for a revision', async () => {
    const count = await invalidateStoredPlans({
      courseId,
      revisionId,
      reason: 'REVISION_DEPRECATED'
    });
    expect(count).toBe(1);
    const [, update] = updateMany.mock.calls[0];
    expect(update.$set.invalidationReason).toBe('REVISION_DEPRECATED');
  });
});
