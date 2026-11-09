/** Batch 4 M4.2: durable planning budget accounting.
 *
 * The property under test is conservatism. A provider that reports nothing must
 * cost the full reservation; a refund must never exceed the reservation; and an
 * unavailable ledger must refuse rather than permit.
 */
jest.mock('mongodb', () => {
  const findOneAndUpdate = jest.fn();
  const updateOne = jest.fn();
  const findOne = jest.fn();
  const close = jest.fn(async () => undefined);
  const collection = jest.fn(() => ({ findOneAndUpdate, updateOne, findOne }));
  const db = jest.fn(() => ({ collection }));
  return {
    __mocks: { findOneAndUpdate, updateOne, findOne, close, collection, db },
    MongoClient: jest.fn(() => ({ db, close, connect: jest.fn(async () => undefined) })),
  };
});

import {
  reconcilePlanningBudget,
  reservePlanningBudget,
  planningBudgetStatus,
  PLANNING_RESERVED_TOKENS,
  PlanningBudgetError,
} from '../services/planningBudget';

const mocks = (jest.requireMock('mongodb') as { __mocks: Record<string, jest.Mock> }).__mocks;

const originalUri = process.env.LLM_BUDGET_MONGODB_URI;
const originalDb = process.env.LLM_BUDGET_DB_NAME;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.LLM_BUDGET_MONGODB_URI = 'mongodb://budget.test/';
  process.env.LLM_BUDGET_DB_NAME = 'budget';
});

afterAll(() => {
  if (originalUri === undefined) delete process.env.LLM_BUDGET_MONGODB_URI;
  else process.env.LLM_BUDGET_MONGODB_URI = originalUri;
  if (originalDb === undefined) delete process.env.LLM_BUDGET_DB_NAME;
  else process.env.LLM_BUDGET_DB_NAME = originalDb;
});

const reservation = {
  approvalId: 'approval-1',
  task: 'experience_planning',
  model: 'gemini/gemini-3.6-flash',
  maxTokens: 100_000,
  maxRequests: 1,
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
};

describe('budget reservation', () => {
  it('reserves the conservative planning allowance', async () => {
    expect(PLANNING_RESERVED_TOKENS).toBe(32768);
  });

  it('reserves atomically and returns the reservation', async () => {
    mocks.findOneAndUpdate.mockResolvedValue({ id: 'approval-1' });
    const result = await reservePlanningBudget(reservation);
    expect(result).toEqual({ approvalId: 'approval-1', reservedTokens: 32768 });
    // The update is conditional on remaining budget, which is the whole safety
    // property: two concurrent callers cannot both win.
    const [filter] = mocks.findOneAndUpdate.mock.calls[0];
    expect(filter.usedTokens).toEqual({ $lte: 100_000 - 32768 });
    expect(filter.revokedAt).toEqual({ $exists: false });
  });

  it('refuses when the conditional update does not match', async () => {
    mocks.findOneAndUpdate.mockResolvedValue(null);
    await expect(reservePlanningBudget(reservation)).rejects.toBeInstanceOf(PlanningBudgetError);
  });

  it('refuses when the budget ledger is not configured', async () => {
    delete process.env.LLM_BUDGET_MONGODB_URI;
    await expect(reservePlanningBudget(reservation)).rejects.toBeInstanceOf(PlanningBudgetError);
  });

  it('refuses when the ledger is unreachable', async () => {
    mocks.findOneAndUpdate.mockRejectedValue(new Error('unreachable'));
    await expect(reservePlanningBudget(reservation)).rejects.toBeInstanceOf(PlanningBudgetError);
  });

  it('refuses a nonsensical reservation size', async () => {
    await expect(
      reservePlanningBudget({ ...reservation, reservedTokens: 0 }),
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
    costUsd: null,
  });

  it('charges the full reservation when no usage was reported', async () => {
    const result = await reconcilePlanningBudget({
      approvalId: 'approval-1',
      reservedTokens: 32768,
      usage: usage(null, false),
    });
    expect(result).toEqual({ chargedTokens: 32768, refunded: 0, usageReported: false });
    // No refund was written: the reservation stays spent.
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('charges the full reservation when usage is null', async () => {
    const result = await reconcilePlanningBudget({
      approvalId: 'approval-1',
      reservedTokens: 32768,
      usage: null,
    });
    expect(result.chargedTokens).toBe(32768);
    expect(result.refunded).toBe(0);
  });

  it('refunds the unused part when usage is reported below the reservation', async () => {
    mocks.updateOne.mockResolvedValue({});
    const result = await reconcilePlanningBudget({
      approvalId: 'approval-1',
      reservedTokens: 32768,
      usage: usage(150),
    });
    expect(result).toEqual({ chargedTokens: 150, refunded: 32618, usageReported: true });
    expect(mocks.updateOne).toHaveBeenCalled();
  });

  it('never refunds when reported usage meets or exceeds the reservation', async () => {
    const atReservation = await reconcilePlanningBudget({
      approvalId: 'approval-1',
      reservedTokens: 32768,
      usage: usage(32768),
    });
    expect(atReservation.refunded).toBe(0);
    const over = await reconcilePlanningBudget({
      approvalId: 'approval-1',
      reservedTokens: 32768,
      usage: usage(40000),
    });
    expect(over.chargedTokens).toBe(40000);
    expect(mocks.updateOne).not.toHaveBeenCalled();
  });

  it('bounds the refund so the ledger cannot go negative', async () => {
    mocks.updateOne.mockResolvedValue({});
    await reconcilePlanningBudget({
      approvalId: 'approval-1',
      reservedTokens: 32768,
      usage: usage(0),
    });
    const [, pipeline] = mocks.updateOne.mock.calls[0];
    // The $max with 0 is what prevents a negative balance.
    expect(JSON.stringify(pipeline)).toContain('"$max":[0');
  });

  it('treats a negative or non-integer report as unreported', async () => {
    const negative = await reconcilePlanningBudget({
      approvalId: 'approval-1',
      reservedTokens: 32768,
      usage: usage(-5),
    });
    expect(negative.usageReported).toBe(false);
    expect(negative.chargedTokens).toBe(32768);
  });
});

describe('budget status', () => {
  it('reports usage without exposing credentials', async () => {
    mocks.findOne.mockResolvedValue({ usedTokens: 500, maxTokens: 1000 });
    const status = await planningBudgetStatus('approval-1');
    expect(status).toEqual({ usedTokens: 500, maxTokens: 1000 });
    expect(JSON.stringify(status)).not.toMatch(/key|secret|password/i);
  });

  it('returns null for an unknown approval', async () => {
    mocks.findOne.mockResolvedValue(null);
    expect(await planningBudgetStatus('missing')).toBeNull();
  });
});
