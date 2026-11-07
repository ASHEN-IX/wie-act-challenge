/** Batch 4 M4.2: generation lifecycle, idempotency and review provenance.
 *
 * Two things are proved here that nothing else can:
 *
 *   1. a request that may have reached the provider is never retried as though
 *      it were free
 *   2. review authority comes from a persisted decision, not from an asset's
 *      own claim (this is the C3 close)
 */
jest.mock('../models/ExperiencePlanRequest', () => ({
  ExperiencePlanRequest: {
    findOneAndUpdate: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(),
    updateMany: jest.fn(),
  },
  ACTIVE_STATES: ['requested', 'authorized', 'reserved', 'dispatched', 'validating'],
}));
jest.mock('../services/experiencePlanStore', () => ({
  peekStoredPlan: jest.fn(),
  storeAcceptedPlan: jest.fn(async () => ({ stored: true, planId: 'p' })),
}));
jest.mock('../models/StructuredAssetReview', () => ({
  StructuredAssetReview: { find: jest.fn(), findOneAndUpdate: jest.fn() },
}));
jest.mock('../services/resourceAccess', () => ({
  canAuthorCourse: jest.fn(),
  canManageCourse: jest.fn(),
}));
jest.mock('../services/planningGovernance', () => {
  const actual = jest.requireActual('../services/planningGovernance');
  return { ...actual, assertPlanningAuthorized: jest.fn() };
});

import { ExperiencePlanRequest } from '../models/ExperiencePlanRequest';
import { peekStoredPlan } from '../services/experiencePlanStore';
import { StructuredAssetReview } from '../models/StructuredAssetReview';
import { canAuthorCourse } from '../services/resourceAccess';
import {
  assertPlanningAuthorized,
  PlanningGovernanceError,
} from '../services/planningGovernance';
import {
  generateExperiencePlan,
  planningIdentity,
  recoverStalePlanningRequests,
} from '../services/experiencePlanGeneration';
import {
  assetContentHash,
  verifyReviewProvenance,
} from '../services/assetReviewProvenance';
import type { ExperiencePlannerProvider } from '../../../../shared/ednova/experiencePlannerProvider';
import type { StructuredAssetV1 } from '../../../../shared/ednova/structuredAsset';
import {
  experienceContextFingerprint,
  type ExperiencePlanValidationContext,
} from '../../../../shared/ednova/experiencePlan';

const courseId = '0123456789abcdef01234567';
const revisionId = 'rev_1';
const contentHash = 'sha256:' + 'b'.repeat(64);
const actor = 'aaaaaaaaaaaaaaaaaaaaaaaa';

const peek = peekStoredPlan as jest.Mock;
const find = ExperiencePlanRequest.find as jest.Mock;
const upsert = ExperiencePlanRequest.findOneAndUpdate as jest.Mock;
const findOne = ExperiencePlanRequest.findOne as jest.Mock;
const updateOne = ExperiencePlanRequest.updateOne as jest.Mock;
const updateMany = ExperiencePlanRequest.updateMany as jest.Mock;
const findReviews = StructuredAssetReview.find as jest.Mock;
const canAuthor = canAuthorCourse as jest.Mock;
const authorize = assertPlanningAuthorized as jest.Mock;

const facts: ExperiencePlanValidationContext['blocks'] = [
  {
    blockId: 'h1',
    blockType: 'heading',
    render: 'primary',
    hasEvidence: true,
    hasSourceRegion: false,
    isReviewedFormula: false,
    hasStructuredFixture: false,
  },
];

function validationContext(): ExperiencePlanValidationContext {
  return {
    courseId,
    revisionId,
    contentHash,
    lessonId: 'lesson-1',
    mode: 'read',
    contextFingerprint: experienceContextFingerprint({
      courseId,
      revisionId,
      contentHash,
      lessonId: 'lesson-1',
      mode: 'read',
      blockIds: ['h1'],
    }),
    allowedPlanners: [{ implementation: 'gemini', version: '1.0.0' }],
    blocks: facts,
    assets: [],
  };
}

function contextInput() {
  return {
    courseTitle: 'Course',
    courseId,
    revisionId,
    lessonId: 'lesson-1',
    lessonTitle: 'Lesson',
    mode: 'read',
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
}

const validProposal = () => ({
  schemaVersion: '1.0.0',
  planId: 'plan-1',
  claims: {
    courseId,
    revisionId,
    contentHash,
    lessonId: 'lesson-1',
    mode: 'read',
    registryVersion: '1.0.0',
    presentationSchemaVersion: '1.0.0',
    contextFingerprint: experienceContextFingerprint({
      courseId,
      revisionId,
      contentHash,
      lessonId: 'lesson-1',
      mode: 'read',
      blockIds: ['h1'],
    }),
  },
  planner: { implementation: 'gemini', version: '1.0.0' },
  placements: [
    {
      placementId: 'p-1',
      kind: 'canonical' as const,
      block: { lessonId: 'lesson-1', blockId: 'h1' },
      component: 'SectionHeading' as const,
      componentVersion: '1.0.0',
      group: 'none' as const,
      disclosure: 'expanded' as const,
      fallback: 'ConceptExplanation' as const,
    },
  ],
  notes: [],
});

function provider(overrides: Partial<ExperiencePlannerProvider> = {}): ExperiencePlannerProvider {
  return {
    identity: { provider: 'gemini', model: 'gemini/gemini-3.6-flash' },
    isEnabled: () => true,
    plan: jest.fn(async () => ({
      ok: true as const,
      proposal: validProposal() as never,
      usage: {
        usageReported: true,
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        reservedTokens: 32768,
        modelVersion: 'v1',
        costUsd: null,
      },
      identity: { provider: 'gemini', model: 'gemini/gemini-3.6-flash' },
    })),
    ...overrides,
  };
}

const reserve = jest.fn(async () => ({ approvalId: 'approval-1', reservedTokens: 32768 }));
const reconcile = jest.fn(async () => ({
  chargedTokens: 150,
  refunded: 32618,
  usageReported: true,
}));

function run(p: ExperiencePlannerProvider = provider()) {
  return generateExperiencePlan({
    actor,
    provider: p,
    courseId,
    revisionId,
    lessonId: 'lesson-1',
    mode: 'read',
    keySha256: 'a'.repeat(64),
    contextInput: contextInput(),
    validationContext: validationContext(),
    reserve,
    reconcile,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  peek.mockResolvedValue(false);
  authorize.mockResolvedValue({ approvalId: 'approval-1', maxTokens: 100_000 });
  canAuthor.mockResolvedValue(true);
  const row = {
    _id: 'row-1',
    requestId: 'req-1',
    state: 'requested',
    usageReported: false,
  };
  upsert.mockReturnValue({ lean: async () => row });
  findOne.mockResolvedValue({ requestId: 'req-1', state: 'validated', planDigest: 'd' });
  updateOne.mockResolvedValue({});
  updateMany.mockResolvedValue({ modifiedCount: 0 });
});

describe('generation lifecycle', () => {
  it('validates a well-formed provider proposal and returns the plan', async () => {
    const outcome = await run();
    expect(outcome.status).toBe('validated');
    if (outcome.status === 'validated') {
      expect(outcome.plan.canonical).toHaveLength(1);
      expect(outcome.usageReported).toBe(true);
    }
  });

  it('persists every state transition', async () => {
    await run();
    const states = updateOne.mock.calls.map((call) => call[1]?.$set?.state).filter(Boolean);
    // `authorized` is now written by the atomic claim (a conditional
    // findOneAndUpdate), not by a plain update, so it appears on that path.
    expect(updateMany.mock.calls.length + upsert.mock.calls.length).toBeGreaterThan(0);
    const claimed = upsert.mock.calls.some(
      (call) => call[1]?.$set?.state === 'authorized',
    );
    expect(claimed || states.includes('authorized')).toBe(true);
    expect(states).toContain('dispatched');
    expect(states).toContain('validating');
    expect(states).toContain('validated');
  });

  it('rejects a proposal that fails independent validation', async () => {
    const bad = provider({
      plan: jest.fn(async () => ({
        ok: true as const,
        proposal: { ...validProposal(), placements: [] } as never,
        usage: {
          usageReported: true,
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          reservedTokens: 32768,
          modelVersion: null,
          costUsd: null,
        },
        identity: { provider: 'gemini', model: 'gemini/gemini-3.6-flash' },
      })),
    });
    const outcome = await run(bad);
    expect(outcome.status).toBe('rejected');
    if (outcome.status === 'rejected') expect(outcome.code).toBe('PLAN_COVERAGE_BLOCK_MISSING');
  });

  it('marks an uncertain provider failure as uncertain and never retries it', async () => {
    const failing = provider({
      plan: jest.fn(async () => ({
        ok: false as const,
        code: 'PROVIDER_TIMEOUT_AFTER_DISPATCH' as const,
        failure: 'uncertain' as const,
        usage: null,
      })),
    });
    const outcome = await run(failing);
    expect(outcome).toMatchObject({ status: 'failed', uncertain: true });
    const states = updateOne.mock.calls.map((call) => call[1]?.$set?.state).filter(Boolean);
    expect(states).toContain('uncertain');
    expect(states).not.toContain('failed');
  });

  it('keeps a known pre-dispatch failure retryable', async () => {
    const failing = provider({
      plan: jest.fn(async () => ({
        ok: false as const,
        code: 'PROVIDER_BUDGET_UNAVAILABLE' as const,
        failure: 'known' as const,
        usage: null,
      })),
    });
    const outcome = await run(failing);
    expect(outcome).toMatchObject({ status: 'failed', uncertain: false });
    const states = updateOne.mock.calls.map((call) => call[1]?.$set?.state).filter(Boolean);
    expect(states).toContain('failed');
  });

  it('treats a provider that throws as uncertain', async () => {
    const throwing = provider({
      plan: jest.fn(async () => {
        throw new Error('adapter exploded');
      }),
    });
    const outcome = await run(throwing);
    expect(outcome).toMatchObject({ status: 'failed', uncertain: true });
  });

  it('refuses before dispatch when governance denies', async () => {
    authorize.mockRejectedValue(new PlanningGovernanceError('CONSENT_REVOKED'));
    const p = provider();
    const outcome = await run(p);
    expect(outcome).toMatchObject({ status: 'refused', code: 'CONSENT_REVOKED' });
    expect(p.plan).not.toHaveBeenCalled();
  });

  it('refuses when the provider is disabled', async () => {
    const p = provider({ isEnabled: () => false });
    const outcome = await run(p);
    expect(outcome).toMatchObject({ status: 'refused', code: 'PLANNING_DISABLED' });
    expect(p.plan).not.toHaveBeenCalled();
  });

  it('refuses when the budget cannot be reserved, before dispatch', async () => {
    reserve.mockRejectedValueOnce(new Error('no budget'));
    const p = provider();
    const outcome = await run(p);
    expect(outcome).toMatchObject({ status: 'refused', code: 'BUDGET_UNAVAILABLE' });
    expect(p.plan).not.toHaveBeenCalled();
  });

  it('returns duplicate for an attempt already in flight', async () => {
    upsert.mockReturnValue({ lean: async () => ({ _id: 'row-1', requestId: 'req-1', state: 'dispatched' }) });
    const p = provider();
    const outcome = await run(p);
    expect(outcome).toEqual({ status: 'duplicate', requestId: 'req-1' });
    expect(p.plan).not.toHaveBeenCalled();
  });

  it('refuses to replay a previously uncertain request', async () => {
    upsert.mockReturnValue({ lean: async () => ({ _id: 'row-1', requestId: 'req-1', state: 'uncertain' }) });
    const p = provider();
    const outcome = await run(p);
    expect(outcome).toMatchObject({ status: 'failed', code: 'PROVIDER_UNCERTAIN_PREVIOUS', uncertain: true });
    expect(p.plan).not.toHaveBeenCalled();
  });

  it('reuses a stored accepted plan instead of a second inference', async () => {
    // M4.5: a validated request whose plan record is still live must not be
    // regenerated. The caller reads the store; no second dispatch occurs.
    upsert.mockReturnValue({
      lean: async () => ({ _id: 'row-1', requestId: 'req-1', state: 'validated', planDigest: 'd' }),
    });
    peek.mockResolvedValue(true);
    const p = provider();
    const outcome = await run(p);
    expect(outcome).toMatchObject({ status: 'already_accepted' });
    expect(p.plan).not.toHaveBeenCalled();
  });

  it('regenerates after the stored plan was invalidated', async () => {
    // Invalidation releases the identity: regeneration is legitimate, and is
    // separately reserved and reconciled like any other attempt.
    upsert.mockReturnValue({
      lean: async () => ({ _id: 'row-1', requestId: 'req-1', state: 'validated', planDigest: 'd' }),
    });
    peek.mockResolvedValue(false);
    const p = provider();
    const outcome = await run(p);
    expect(outcome.status).toBe('validated');
    expect(p.plan).toHaveBeenCalled();
    expect(reserve).toHaveBeenCalled();
  });

  it('reconciles usage against the reservation', async () => {
    await run();
    expect(reconcile).toHaveBeenCalledWith(
      expect.objectContaining({ approvalId: 'approval-1', reservedTokens: 32768 }),
    );
  });

  it('marks stale dispatched attempts uncertain and pre-dispatch ones failed', async () => {
    // M4.5: recovery only handled `dispatched`/`validating`, so a crash during
    // `authorized` or `reserved` blocked the identity forever. M4.6 additionally
    // releases the reservation for the provably pre-dispatch case.
    updateMany.mockResolvedValue({ modifiedCount: 2 });
    find.mockReturnValue({
      select: () => ({ limit: () => ({ lean: async () => [] }) }),
    });
    expect(await recoverStalePlanningRequests()).toBe(2);
    const [, update] = updateMany.mock.calls[0];
    expect(update.$set.state).toBe('uncertain');
    // A possibly-billed attempt is only ever marked uncertain.
    expect(updateMany.mock.calls.some((call) => call[1].$set.state === 'failed')).toBe(false);
  });

  it('releases the reservation for a stale pre-dispatch attempt', async () => {
    updateMany.mockResolvedValue({ modifiedCount: 0 });
    find.mockReturnValue({
      select: () => ({
        limit: () => ({
          lean: async () => [
            { _id: 'row-a', requestId: 'req-a', approvalId: 'approval-1', reservedTokens: 32768 },
          ],
        }),
      }),
    });
    upsert.mockReturnValue({ lean: async () => ({ _id: 'row-a', state: 'failed' }) });
    const released = jest.fn(async () => ({ released: true, refunded: 32768 }));
    expect(await recoverStalePlanningRequests(0, released as never)).toBe(1);
    expect(released).toHaveBeenCalledWith(
      expect.objectContaining({ approvalId: 'approval-1', reservedTokens: 32768 }),
    );
  });

  it('derives a stable identity from the authorized operation', () => {
    const a = planningIdentity({
      courseId,
      revisionId,
      lessonId: 'lesson-1',
      mode: 'read',
      contextFingerprint: 'fnv1a64:1',
      provider: 'gemini',
      model: 'm',
    });
    const b = planningIdentity({
      courseId,
      revisionId,
      lessonId: 'lesson-1',
      mode: 'read',
      contextFingerprint: 'fnv1a64:1',
      provider: 'gemini',
      model: 'm',
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});

describe('review provenance (C3 close)', () => {
  const asset = {
    assetId: 'asset_1',
    courseId,
    revisionId,
    lessonId: 'lesson-1',
    blockId: 'code1',
    component: 'CodeWalkthrough',
    payload: { component: 'CodeWalkthrough', language: 'python', code: 'a=1', annotations: [] },
    provenance: 'instructor_authored',
    disclosure: 'x',
  } as unknown as StructuredAssetV1;

  const binding = { courseId, revisionId, lessonId: 'lesson-1' };

  function mockReview(rows: unknown[]) {
    findReviews.mockReturnValue({ limit: () => ({ lean: async () => rows }) });
  }

  const approved = () => ({
    reviewId: 'rev_1',
    assetId: 'asset_1',
    contentHash: assetContentHash(asset),
    lessonId: 'lesson-1',
    decision: 'approved' as const,
    reviewerUserId: actor,
    decidedAt: new Date(),
    revokedAt: undefined,
  });

  it('verifies only when a persisted approval matches the exact version', async () => {
    mockReview([approved()]);
    const result = await verifyReviewProvenance([asset], binding);
    expect(result.get('asset_1')?.verified).toBe(true);
    expect(result.get('asset_1')?.reason).toBe('verified');
  });

  it('refuses when no decision exists', async () => {
    mockReview([]);
    const result = await verifyReviewProvenance([asset], binding);
    expect(result.get('asset_1')?.reason).toBe('no_decision');
  });

  it('refuses a decision that covers a different asset version', async () => {
    mockReview([{ ...approved(), contentHash: 'sha256:' + 'f'.repeat(64) }]);
    const result = await verifyReviewProvenance([asset], binding);
    expect(result.get('asset_1')?.reason).toBe('version_mismatch');
  });

  it('refuses a revoked decision', async () => {
    mockReview([{ ...approved(), revokedAt: new Date() }]);
    const result = await verifyReviewProvenance([asset], binding);
    expect(result.get('asset_1')?.reason).toBe('revoked');
  });

  it('refuses a rejected decision', async () => {
    mockReview([{ ...approved(), decision: 'rejected' as const }]);
    const result = await verifyReviewProvenance([asset], binding);
    expect(result.get('asset_1')?.reason).toBe('rejected');
  });

  it('refuses a decision recorded for a different lesson', async () => {
    mockReview([{ ...approved(), lessonId: 'lesson-2' }]);
    const result = await verifyReviewProvenance([asset], binding);
    expect(result.get('asset_1')?.reason).toBe('binding_mismatch');
  });

  it('refuses when the reviewer no longer holds author rights', async () => {
    canAuthor.mockResolvedValue(false);
    mockReview([approved()]);
    const result = await verifyReviewProvenance([asset], binding);
    expect(result.get('asset_1')?.reason).toBe('reviewer_not_authorized');
  });

  it('never verifies a generated proposal', async () => {
    const generated = { ...asset, provenance: 'generated_proposal' } as unknown as StructuredAssetV1;
    mockReview([{ ...approved(), contentHash: assetContentHash(generated) }]);
    const result = await verifyReviewProvenance([generated], binding);
    expect(result.get('asset_1')?.reason).toBe('provenance_not_reviewable');
  });

  it('changes the content hash when the payload changes, invalidating approval', () => {
    const edited = {
      ...asset,
      payload: { component: 'CodeWalkthrough', language: 'python', code: 'b=2', annotations: [] },
    } as unknown as StructuredAssetV1;
    expect(assetContentHash(asset)).not.toBe(assetContentHash(edited));
  });
});
