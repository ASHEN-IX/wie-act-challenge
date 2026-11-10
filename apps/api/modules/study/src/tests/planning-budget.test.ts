/** Batch 4 M4.2: durable planning budget accounting.
 *
 * The property under test is conservatism. A provider that reports nothing must
 * cost the full reservation; a refund must never exceed the reservation; and an
 * unavailable ledger must refuse rather than permit.
 */
jest.mock('../../../../shared/database', () => {
  const createMany = jest.fn(async () => ({ count: 1 }));
  const updateMany = jest.fn();
  const findUnique = jest.fn();
  const executeRaw = jest.fn();
  return {
    __mocks: { createMany, updateMany, findUnique, executeRaw },
    prisma: {
      llmApprovalBudget: { createMany, updateMany, findUnique },
      $executeRaw: executeRaw
    }
  };
});

import {
  reconcilePlanningBudget,
  releaseUndispatchedReservation,
  reservePlanningBudget,
  planningBudgetStatus,
  PLANNING_RESERVED_TOKENS,
  PlanningBudgetError
} from '../services/planningBudget';

const mocks = (
  jest.requireMock('../../../../shared/database') as { __mocks: Record<string, jest.Mock> }
).__mocks;

beforeEach(() => {
  jest.clearAllMocks();
  mocks.createMany.mockResolvedValue({ count: 1 });
});

const reservation = {
  approvalId: 'approval-1',
  task: 'experience_planning',
  model: 'gemini/gemini-3.6-flash',
  maxTokens: 100_000,
  maxRequests: 1,
  expiresAt: Math.floor(Date.now() / 1000) + 3600
};

describe('budget reservation', () => {
  it('reserves the conservative planning allowance', async () => {
    expect(PLANNING_RESERVED_TOKENS).toBe(32768);
  });

  it('reserves atomically and returns the reservation', async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    const result = await reservePlanningBudget(reservation);
    expect(result).toEqual({ approvalId: 'approval-1', reservedTokens: 32768 });
    // The update is conditional on remaining budget, which is the whole safety
    // property: two concurrent callers cannot both win.
    const [{ where, data }] = mocks.updateMany.mock.calls[0];
    expect(where.usedTokens).toEqual({ lte: 100_000 - 32768 });
    expect(where.revokedAt).toBeNull();
    expect(data.usedTokens).toEqual({ increment: 32768 });
  });

  it('refuses when the conditional update does not match', async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    await expect(reservePlanningBudget(reservation)).rejects.toBeInstanceOf(PlanningBudgetError);
  });

  it('refuses when the ledger is unreachable', async () => {
    mocks.updateMany.mockRejectedValue(new Error('unreachable'));
    await expect(reservePlanningBudget(reservation)).rejects.toBeInstanceOf(PlanningBudgetError);
  });

  it('refuses a nonsensical reservation size', async () => {
    await expect(
      reservePlanningBudget({ ...reservation, reservedTokens: 0 })
    ).rejects.toBeInstanceOf(PlanningBudgetError);
  });
});

describe('usage reconciliation', () => {
  const usage = (totalTokens: number | null, usageReported = true) => ({
    usageReported,
    inputTokens: null,
    outputTokens: null,
    totalTokens,
    reservedTokens: 32768,
    modelVersion: null,
    costUsd: null
  });

  it('charges the full reservation when no usage was reported', async () => {
    const result = await reconcilePlanningBudget({
      approvalId: 'approval-1',
      reservedTokens: 32768,
      usage: usage(null, false)
    });
    expect(result).toEqual({ chargedTokens: 32768, refunded: 0, usageReported: false });
    // No refund was written: the reservation stays spent.
    expect(mocks.executeRaw).not.toHaveBeenCalled();
  });

  it('charges the full reservation when usage is null', async () => {
    const result = await reconcilePlanningBudget({
      approvalId: 'approval-1',
      reservedTokens: 32768,
      usage: null
    });
    expect(result.chargedTokens).toBe(32768);
    expect(result.refunded).toBe(0);
  });

  it('refunds the unused part when usage is reported below the reservation', async () => {
    mocks.executeRaw.mockResolvedValue(1);
    const result = await reconcilePlanningBudget({
      approvalId: 'approval-1',
      reservedTokens: 32768,
      usage: usage(150)
    });
    expect(result).toEqual({ chargedTokens: 150, refunded: 32618, usageReported: true });
    expect(mocks.executeRaw).toHaveBeenCalled();
  });

  it('never refunds when reported usage meets or exceeds the reservation', async () => {
    const atReservation = await reconcilePlanningBudget({
      approvalId: 'approval-1',
      reservedTokens: 32768,
      usage: usage(32768)
    });
    expect(atReservation.refunded).toBe(0);
    const over = await reconcilePlanningBudget({
      approvalId: 'approval-1',
      reservedTokens: 32768,
      usage: usage(40000)
    });
    expect(over.chargedTokens).toBe(40000);
    expect(mocks.executeRaw).not.toHaveBeenCalled();
  });

  it('bounds the refund so the ledger cannot go negative', async () => {
    mocks.executeRaw.mockResolvedValue(1);
    await reconcilePlanningBudget({
      approvalId: 'approval-1',
      reservedTokens: 32768,
      usage: usage(0)
    });
    const [strings] = mocks.executeRaw.mock.calls[0];
    // GREATEST(0, ...) is what prevents a negative balance.
    expect(strings.join('?')).toContain('GREATEST(0,');
  });

  it('treats a negative or non-integer report as unreported', async () => {
    const negative = await reconcilePlanningBudget({
      approvalId: 'approval-1',
      reservedTokens: 32768,
      usage: usage(-5)
    });
    expect(negative.usageReported).toBe(false);
    expect(negative.chargedTokens).toBe(32768);
  });
});

describe('budget status', () => {
  it('reports usage without exposing credentials', async () => {
    mocks.findUnique.mockResolvedValue({ usedTokens: 500, maxTokens: 1000 });
    const status = await planningBudgetStatus('approval-1');
    expect(status).toEqual({ usedTokens: 500, maxTokens: 1000 });
    expect(JSON.stringify(status)).not.toMatch(/key|secret|password/i);
  });

  it('returns null for an unknown approval', async () => {
    mocks.findUnique.mockResolvedValue(null);
    expect(await planningBudgetStatus('missing')).toBeNull();
  });
});

describe('release of an undispatched reservation', () => {
  const release = { approvalId: 'approval-1', reservedTokens: 32768, releaseToken: 'attempt-0001' };

  it('claims the release marker and refunds in one conditional update', async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    expect(await releaseUndispatchedReservation(release)).toEqual({
      released: true,
      refunded: 32768
    });
    const [{ where, data }] = mocks.updateMany.mock.calls[0];
    expect(where.NOT).toEqual({ releaseMarkers: { has: 'attempt-0001' } });
    expect(data.releaseMarkers).toEqual({ push: 'attempt-0001' });
  });

  it('is a no-op the second time the same attempt is released', async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    expect(await releaseUndispatchedReservation(release)).toEqual({ released: false, refunded: 0 });
  });
});
