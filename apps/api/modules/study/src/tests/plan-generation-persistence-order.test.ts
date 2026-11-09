/** Batch 4 release-integrity: `validated` must mean a plan is retrievable.
 *
 * M4.3 wrote the request state before storing the plan. A crash in between left
 * a request claiming a usable plan with no plan record — reproduced against
 * real MongoDB as `state=validated, plan_records=0`. These tests pin the
 * corrected ordering.
 */
jest.mock('../models/ExperiencePlanRequest', () => ({
  ExperiencePlanRequest: {
    findOneAndUpdate: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(),
    updateMany: jest.fn()
  }
}));
jest.mock('../services/experiencePlanStore', () => ({
  loadAcceptedPlan: jest.fn(),
  peekStoredPlan: jest.fn(),
  storeAcceptedPlan: jest.fn()
}));
jest.mock('../models/ExperiencePlanRecord', () => ({
  ExperiencePlanRecord: { findOne: jest.fn() }
}));
jest.mock('../models/StructuredAssetReview', () => ({
  StructuredAssetReview: { find: jest.fn(), findOneAndUpdate: jest.fn() }
}));
jest.mock('../services/resourceAccess', () => ({
  canAuthorCourse: jest.fn(async () => true),
  canManageCourse: jest.fn(async () => true)
}));
jest.mock('../services/planningGovernance', () => {
  const actual = jest.requireActual('../services/planningGovernance');
  return { ...actual, assertPlanningAuthorized: jest.fn() };
});

import { ExperiencePlanRequest } from '../models/ExperiencePlanRequest';
import { ExperiencePlanRecord } from '../models/ExperiencePlanRecord';
import {
  loadAcceptedPlan,
  peekStoredPlan,
  storeAcceptedPlan
} from '../services/experiencePlanStore';
import { assertPlanningAuthorized } from '../services/planningGovernance';
import { generateExperiencePlan } from '../services/experiencePlanGeneration';
import {
  experienceContextFingerprint,
  type ExperiencePlanValidationContext
} from '../../../../shared/ednova/experiencePlan';
import type { ExperiencePlannerProvider } from '../../../../shared/ednova/experiencePlannerProvider';
import { COMPONENT_REGISTRY_VERSION } from '../../../../shared/ednova/componentRegistry';

const courseId = 'a57d9f30-21c4-58ff-b48c-1e9e140f4c6d';
const revisionId = 'rev_order';
const contentHash = 'sha256:' + 'b'.repeat(64);

const upsert = ExperiencePlanRequest.findOneAndUpdate as jest.Mock;
const findOne = ExperiencePlanRequest.findOne as jest.Mock;
const updateOne = ExperiencePlanRequest.updateOne as jest.Mock;
const peek = peekStoredPlan as jest.Mock;
const load = loadAcceptedPlan as jest.Mock;
const store = storeAcceptedPlan as jest.Mock;
const authorize = assertPlanningAuthorized as jest.Mock;

function context(): ExperiencePlanValidationContext {
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
      blockIds: ['h1']
    }),
    allowedPlanners: [{ implementation: 'gemini', version: '1.0.0' }],
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
    assets: []
  };
}

function contextInput() {
  return {
    courseTitle: 'Course',
    courseId,
    revisionId,
    lessonId: 'lesson-1',
    lessonTitle: 'Lesson',
    mode: 'guided',
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
}

function proposal() {
  return {
    schemaVersion: '1.0.0',
    planId: 'plan-1',
    claims: {
      courseId,
      revisionId,
      contentHash,
      lessonId: 'lesson-1',
      mode: 'guided',
      registryVersion: COMPONENT_REGISTRY_VERSION,
      presentationSchemaVersion: '1.0.0',
      contextFingerprint: context().contextFingerprint
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
        fallback: 'ConceptExplanation' as const
      }
    ],
    notes: []
  };
}

function provider(): ExperiencePlannerProvider {
  return {
    identity: { provider: 'gemini', model: 'gemini/gemini-3.6-flash' },
    isEnabled: () => true,
    plan: jest.fn(async () => ({
      ok: true as const,
      proposal: proposal() as never,
      usage: {
        usageReported: true,
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        reservedTokens: 32768,
        modelVersion: 'v1',
        costUsd: null
      },
      identity: { provider: 'gemini', model: 'gemini/gemini-3.6-flash' }
    }))
  };
}

const run = (p = provider()) =>
  generateExperiencePlan({
    actor: 'author-a',
    provider: p,
    courseId,
    revisionId,
    lessonId: 'lesson-1',
    mode: 'guided',
    keySha256: 'a'.repeat(64),
    contextInput: contextInput(),
    validationContext: context(),
    reserve: jest.fn(async () => ({ approvalId: 'approval-1', reservedTokens: 32768 })),
    reconcile: jest.fn(async () => ({
      chargedTokens: 15,
      refunded: 32653,
      usageReported: true
    }))
  });

function statesWritten(): string[] {
  return updateOne.mock.calls.map((call) => call[1]?.$set?.state).filter(Boolean) as string[];
}

beforeEach(() => {
  jest.clearAllMocks();
  authorize.mockResolvedValue({ approvalId: 'approval-1', maxTokens: 100_000 });
  peek.mockResolvedValue(false);
  load.mockResolvedValue({ status: 'absent' });
  store.mockResolvedValue({ stored: true, planId: 'plan-x' });
  upsert.mockReturnValue({
    lean: async () => ({ id: 'row-1', requestId: 'req-1', state: 'requested' })
  });
  findOne.mockReturnValue({ lean: async () => ({ id: 'row-1', state: 'authorized' }) });
  updateOne.mockResolvedValue({});
});

describe('validated means retrievable', () => {
  it('stores the plan before declaring the attempt validated', async () => {
    await run();
    const order: string[] = [];
    for (const call of updateOne.mock.calls) {
      if (call[1]?.$set?.state) order.push(call[1].$set.state);
    }
    // `validated` is written, and the store was called before it.
    expect(order).toContain('validated');
    expect(store).toHaveBeenCalled();
    const storeOrder = store.mock.invocationCallOrder[0];
    const validatedOrder =
      updateOne.mock.invocationCallOrder[
        updateOne.mock.calls.findIndex((c) => c[1]?.$set?.state === 'validated')
      ];
    expect(storeOrder).toBeLessThan(validatedOrder);
  });

  it('never reports validated when persistence fails', async () => {
    store.mockResolvedValue({ stored: false, reason: 'not_validated' });
    const outcome = await run();
    expect(outcome).toMatchObject({ status: 'failed', code: 'PLAN_NOT_STORED' });
    // The request is marked failed, not validated.
    expect(statesWritten()).not.toContain('validated');
    expect(statesWritten()).toContain('failed');
  });

  it('does not treat a failed store as a usable plan', async () => {
    store.mockResolvedValue({ stored: false, reason: 'identity_mismatch' });
    const outcome = await run();
    expect(outcome.status).toBe('failed');
  });
});

describe('no duplicate work after interruption', () => {
  it('a request left in validating is recovered as uncertain, never replayed', async () => {
    const { recoverStalePlanningRequests } = jest.requireActual(
      '../services/experiencePlanGeneration'
    );
    const updateMany = ExperiencePlanRequest.updateMany as jest.Mock;
    updateMany.mockResolvedValue({ modifiedCount: 1 });
    const find = ExperiencePlanRequest.find as jest.Mock;
    find.mockReturnValue({ select: () => ({ limit: () => ({ lean: async () => [] }) }) });
    await recoverStalePlanningRequests(0);
    const [, update] = updateMany.mock.calls[0];
    // The provider was called, so the reservation is retained and the state is
    // uncertain — never `failed`, which would imply no charge.
    expect(update.$set.state).toBe('uncertain');
  });
});

describe('post-store crash window', () => {
  /** The plan was committed, then the process died before `validated`.
   * Recovery marks the row `uncertain`. The next authorised attempt must adopt
   * the durable plan rather than blocking the author forever or re-dispatching.
   */
  it('adopts a durable plan instead of reporting a permanent failure', async () => {
    // The upsert finds the existing uncertain row (not a fresh `requested` one).
    upsert.mockReturnValue({ lean: async () => ({ id: 'row-1', state: 'uncertain' }) });
    findOne.mockReturnValue({ lean: async () => ({ id: 'row-1', state: 'uncertain' }) });
    peek.mockResolvedValue(true);
    load.mockResolvedValue({ status: 'available', plan: { digest: 'fnv1a64:deadbeef' } });
    (ExperiencePlanRecord.findOne as jest.Mock).mockReturnValue({
      select: () => ({ lean: async () => ({ planDigest: 'fnv1a64:deadbeef' }) })
    });
    // The promotion is a conditional findOneAndUpdate; simulate winning it.
    // (The first findOneAndUpdate call is the upsert, which already returned
    // the uncertain row, so this only affects the promotion.)
    const promote = { lean: async () => ({ id: 'row-1', state: 'validated' }) };
    let call = 0;
    upsert.mockImplementation(() =>
      call++ === 0 ? { lean: async () => ({ id: 'row-1', state: 'uncertain' }) } : promote
    );

    const outcome = await run();
    expect(outcome).toMatchObject({ status: 'already_accepted', planDigest: 'fnv1a64:deadbeef' });
    expect(load).toHaveBeenCalledWith(
      expect.objectContaining({
        courseId,
        revisionId,
        contentHash,
        contextFingerprint: context().contextFingerprint,
        validationContext: context()
      })
    );
    expect(peek).not.toHaveBeenCalled();
  });

  it('keeps the uncertain failure when no durable plan exists', async () => {
    upsert.mockReturnValue({ lean: async () => ({ id: 'row-1', state: 'uncertain' }) });
    findOne.mockReturnValue({ lean: async () => ({ id: 'row-1', state: 'uncertain' }) });
    peek.mockResolvedValue(false);

    const outcome = await run();
    expect(outcome).toMatchObject({
      status: 'failed',
      code: 'PROVIDER_UNCERTAIN_PREVIOUS',
      uncertain: true
    });
  });
});
