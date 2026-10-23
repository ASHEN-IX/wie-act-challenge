/**
 * BLOOM-08 — Competency Updater tests.
 */

jest.mock('../models/index', () => ({
  EvalResultRecord: { find: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn() },
  LearningObjective: { findOne: jest.fn() },
  CompetencyProfile: {}
}));

jest.mock('../services/competency', () => ({
  upsertProfile: jest.fn()
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { EvalResultRecord, LearningObjective } = require('../models/index');
import { upsertProfile } from '../services/competency';

import {
  claimResult,
  resolveCompetencyKey,
  processEvalResult,
  runOnce
} from '../services/competencyUpdater';

// ── claimResult ─────────────────────────────────────────────────────────────

describe('claimResult', () => {
  beforeEach(() => jest.resetAllMocks());

  test('returns a lease token when an unprocessed result is claimed', async () => {
    EvalResultRecord.findOneAndUpdate.mockResolvedValue({ correlationId: 'c1' });
    expect(await claimResult('c1')).toEqual(expect.any(String));
    expect(EvalResultRecord.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: 'c1',
        competencyProcessedAt: null,
        $or: expect.any(Array)
      }),
      {
        $set: { competencyLeaseToken: expect.any(String), competencyLeaseUntil: expect.any(Date) }
      },
      { new: true }
    );
  });

  test('returns null when processed or currently leased', async () => {
    EvalResultRecord.findOneAndUpdate.mockResolvedValue(null);
    expect(await claimResult('c1')).toBeNull();
  });

  test('re-throws non-duplicate errors', async () => {
    const dbErr = new Error('connection lost');
    EvalResultRecord.findOneAndUpdate.mockRejectedValue(dbErr);
    await expect(claimResult('c1')).rejects.toThrow('connection lost');
  });
});

// ── resolveCompetencyKey ─────────────────────────────────────────────────────

describe('resolveCompetencyKey', () => {
  beforeEach(() => jest.resetAllMocks());

  test('returns topicId + knowledgeType from the objective', async () => {
    LearningObjective.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ topicId: 't1', knowledgeType: 'procedural' })
    });
    const key = await resolveCompetencyKey('obj-1', 'user-1');
    expect(key).toEqual({ topicId: 't1', knowledgeType: 'procedural' });
    expect(LearningObjective.findOne).toHaveBeenCalledWith({
      objectiveId: 'obj-1',
      userId: 'user-1',
      isActive: true
    });
  });

  test('defaults knowledgeType to declarative when missing on objective', async () => {
    LearningObjective.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ topicId: 't1' })
    });
    const key = await resolveCompetencyKey('obj-1', 'user-1');
    expect(key!.knowledgeType).toBe('declarative');
  });

  test('returns null when objectiveId is falsy', async () => {
    expect(await resolveCompetencyKey(null, 'user-1')).toBeNull();
    expect(await resolveCompetencyKey(undefined, 'user-1')).toBeNull();
    expect(await resolveCompetencyKey('', 'user-1')).toBeNull();
  });

  test('returns null when objective is not found', async () => {
    LearningObjective.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null)
    });
    expect(await resolveCompetencyKey('obj-missing', 'user-1')).toBeNull();
  });

  test('returns null when objective has no topicId', async () => {
    LearningObjective.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ knowledgeType: 'declarative' })
    });
    expect(await resolveCompetencyKey('obj-notopic', 'user-1')).toBeNull();
  });
});

// ── processEvalResult ────────────────────────────────────────────────────────

describe('processEvalResult', () => {
  const baseResult = {
    correlationId: 'corr-1',
    userId: 'u1',
    sessionId: 's1',
    step: 1,
    demonstratedBloomLevel: 'UNDERSTAND',
    masteryScore: 0.7,
    objectiveId: 'obj-1',
    createdAt: new Date('2026-01-01')
  };

  beforeEach(() => jest.resetAllMocks());

  test('claims, resolves, and calls upsertProfile with the evidence item', async () => {
    EvalResultRecord.findOneAndUpdate.mockResolvedValue({ correlationId: 'corr-1' });
    LearningObjective.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ topicId: 'topic-1', knowledgeType: 'conceptual' })
    });
    (upsertProfile as jest.Mock).mockResolvedValue(undefined);

    const result = await processEvalResult(baseResult);
    expect(result.processed).toBe(true);
    expect(result.bloomLevel).toBe('UNDERSTAND');
    expect(upsertProfile).toHaveBeenCalledTimes(1);
    expect(upsertProfile).toHaveBeenCalledWith({
      userId: 'u1',
      topicId: 'topic-1',
      knowledgeType: 'conceptual',
      bloomLevel: 'UNDERSTAND',
      evidenceItem: {
        objectiveId: 'obj-1',
        demonstratedBloomLevel: 'UNDERSTAND',
        masteryScore: 0.7,
        evaluatedAt: new Date('2026-01-01'),
        correlationId: 'corr-1'
      }
    });
  });

  test('skips when demonstratedBloomLevel is absent', async () => {
    const result = await processEvalResult({ ...baseResult, demonstratedBloomLevel: null });
    expect(result.skipped).toBe('no_skill_level');
    expect(EvalResultRecord.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('skips when demonstratedBloomLevel is undefined', async () => {
    const result = await processEvalResult({ ...baseResult, demonstratedBloomLevel: undefined });
    expect(result.skipped).toBe('no_skill_level');
  });

  test('skips when the result cannot be claimed', async () => {
    EvalResultRecord.findOneAndUpdate.mockResolvedValue(null);

    const result = await processEvalResult(baseResult);
    expect(result.skipped).toBe('already_processing');
    expect(upsertProfile).not.toHaveBeenCalled();
  });

  test('skips with no_objective when objective is missing', async () => {
    EvalResultRecord.findOneAndUpdate.mockResolvedValue({ correlationId: 'corr-1' });
    LearningObjective.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null)
    });

    const result = await processEvalResult(baseResult);
    expect(result.skipped).toBe('no_objective');
    expect(result.correlationId).toBe('corr-1');
    expect(upsertProfile).not.toHaveBeenCalled();
  });
});

// ── runOnce ──────────────────────────────────────────────────────────────────

describe('runOnce', () => {
  beforeEach(() => jest.resetAllMocks());

  test('processes multiple candidates in order and returns totals', async () => {
    const candidates = [
      {
        correlationId: 'c1',
        userId: 'u1',
        demonstratedBloomLevel: 'UNDERSTAND',
        objectiveId: 'o1',
        masteryScore: 0.6,
        sessionId: 's1',
        step: 1,
        createdAt: new Date()
      },
      {
        correlationId: 'c2',
        userId: 'u1',
        demonstratedBloomLevel: 'APPLY',
        objectiveId: 'o2',
        masteryScore: 0.8,
        sessionId: 's1',
        step: 2,
        createdAt: new Date()
      }
    ];

    EvalResultRecord.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(candidates)
    });

    EvalResultRecord.findOneAndUpdate
      .mockResolvedValueOnce({ correlationId: 'c1' })
      .mockResolvedValueOnce({ correlationId: 'c2' });

    LearningObjective.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ topicId: 't1', knowledgeType: 'declarative' })
    });

    (upsertProfile as jest.Mock).mockResolvedValue(undefined);

    const stats = await runOnce();
    expect(stats.total).toBe(2);
    expect(stats.processed).toBe(2);
    expect(stats.skipped).toBe(0);
    expect(stats.errors).toBe(0);
    expect(upsertProfile).toHaveBeenCalledTimes(2);
  });

  test('skips already-processed results and counts correctly', async () => {
    const candidates = [
      {
        correlationId: 'c1',
        userId: 'u1',
        demonstratedBloomLevel: 'REMEMBER',
        objectiveId: 'o1',
        masteryScore: 0.5,
        sessionId: 's1',
        step: 1,
        createdAt: new Date()
      },
      {
        correlationId: 'c2',
        userId: 'u1',
        demonstratedBloomLevel: 'ANALYSE',
        objectiveId: 'o2',
        masteryScore: 0.9,
        sessionId: 's1',
        step: 2,
        createdAt: new Date()
      }
    ];

    EvalResultRecord.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(candidates)
    });

    // c1 already claimed, c2 is new
    EvalResultRecord.findOneAndUpdate
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ correlationId: 'c2' });

    LearningObjective.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ topicId: 't1', knowledgeType: 'declarative' })
    });

    (upsertProfile as jest.Mock).mockResolvedValue(undefined);

    const stats = await runOnce();
    expect(stats.total).toBe(2);
    expect(stats.processed).toBe(1);
    expect(stats.skipped).toBe(1);
    expect(upsertProfile).toHaveBeenCalledTimes(1);
    expect(upsertProfile).toHaveBeenCalledWith(expect.objectContaining({ bloomLevel: 'ANALYSE' }));
  });

  test('returns zero totals when no candidates exist', async () => {
    EvalResultRecord.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([])
    });

    const stats = await runOnce();
    expect(stats).toEqual({ total: 0, processed: 0, skipped: 0, errors: 0 });
    expect(EvalResultRecord.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('continues processing remaining candidates when one errors', async () => {
    const candidates = [
      {
        correlationId: 'c1',
        userId: 'u1',
        demonstratedBloomLevel: 'UNDERSTAND',
        objectiveId: 'o1',
        masteryScore: 0.7,
        sessionId: 's1',
        step: 1,
        createdAt: new Date()
      },
      {
        correlationId: 'c2',
        userId: 'u1',
        demonstratedBloomLevel: 'APPLY',
        objectiveId: 'o2',
        masteryScore: 0.8,
        sessionId: 's1',
        step: 2,
        createdAt: new Date()
      }
    ];

    EvalResultRecord.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(candidates)
    });

    const dbErr = new Error('connection lost');
    EvalResultRecord.findOneAndUpdate
      .mockRejectedValueOnce(dbErr)
      .mockResolvedValueOnce({ correlationId: 'c2' });

    LearningObjective.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ topicId: 't1', knowledgeType: 'declarative' })
    });

    (upsertProfile as jest.Mock).mockResolvedValue(undefined);

    const stats = await runOnce();
    expect(stats.total).toBe(2);
    expect(stats.processed).toBe(1);
    expect(stats.errors).toBe(1);
  });

  test('respects POLL_LIMIT in query', async () => {
    EvalResultRecord.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([])
      })
    });

    await runOnce();
    expect(EvalResultRecord.find).toHaveBeenCalledWith(
      expect.objectContaining({ demonstratedBloomLevel: { $ne: null } })
    );
  });
});
