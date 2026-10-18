/**
 * BLOOM-08 Competency Updater
 *
 * Polls the eval_results collection (written by the orchestrator) for steps
 * that demonstrated a skill level, claims each via a unique correlationId
 * (idempotent ACK-skip), resolves the competency key, and calls
 * upsertProfile to atomically update the CompetencyProfile.
 */

import { EvalResultRecord, LearningObjective } from '../models/index';
import crypto from 'node:crypto';
import { upsertProfile } from './competency';

const POLL_INTERVAL_MS = Number(process.env.COMPETENCY_POLL_INTERVAL_MS) || 5000;
const POLL_LIMIT = Number(process.env.COMPETENCY_POLL_LIMIT) || 50;

/**
 * Claim an eval result idempotently via unique correlationId.
 * Returns true if newly claimed, false if already processed.
 */
async function claimResult(correlationId: string): Promise<string | null> {
  const token = crypto.randomUUID();
  const now = new Date();
  const claimed = await EvalResultRecord.findOneAndUpdate(
    {
      correlationId,
      competencyProcessedAt: null,
      $or: [{ competencyLeaseUntil: null }, { competencyLeaseUntil: { $lte: now } }]
    },
    {
      $set: { competencyLeaseToken: token, competencyLeaseUntil: new Date(now.getTime() + 60000) }
    },
    { new: true }
  );
  return claimed ? token : null;
}

/**
 * Resolve objectiveId → { topicId, knowledgeType } via LearningObjective.
 */
async function resolveCompetencyKey(
  objectiveId: string | null | undefined
): Promise<{ topicId: string; knowledgeType: string } | null> {
  if (!objectiveId) return null;
  const objective = await LearningObjective.findOne({ objectiveId }).lean();
  if (!objective || !objective.topicId) return null;
  return { topicId: objective.topicId, knowledgeType: objective.knowledgeType || 'declarative' };
}

interface ProcessResult {
  skipped?: string;
  correlationId?: string;
  processed?: boolean;
  userId?: string;
  topicId?: string;
  knowledgeType?: string;
  bloomLevel?: string;
}

/**
 * Process a single EvalResult record.
 */
async function processEvalResult(result: any): Promise<ProcessResult> {
  if (!result.demonstratedBloomLevel) return { skipped: 'no_skill_level' };
  const token = await claimResult(result.correlationId);
  if (!token) return { skipped: 'already_processing' };
  const filter = { correlationId: result.correlationId, competencyLeaseToken: token };
  try {
    const key = await resolveCompetencyKey(result.objectiveId);
    if (!key) {
      // Retry missing objectives later, allowing all other records to progress.
      await EvalResultRecord.updateOne(filter, {
        $set: { competencyLeaseUntil: new Date(Date.now() + 60000) }
      });
      return { skipped: 'no_objective', correlationId: result.correlationId };
    }
    await upsertProfile({
      userId: result.userId,
      topicId: key.topicId,
      knowledgeType: key.knowledgeType,
      bloomLevel: result.demonstratedBloomLevel,
      evidenceItem: {
        objectiveId: result.objectiveId,
        demonstratedBloomLevel: result.demonstratedBloomLevel,
        masteryScore: result.masteryScore,
        evaluatedAt: result.createdAt,
        correlationId: result.correlationId
      }
    });
    await EvalResultRecord.updateOne(filter, {
      $set: { competencyProcessedAt: new Date() },
      $unset: { competencyLeaseUntil: '', competencyLeaseToken: '' }
    });
    return {
      processed: true,
      userId: result.userId,
      topicId: key.topicId,
      knowledgeType: key.knowledgeType,
      bloomLevel: result.demonstratedBloomLevel
    };
  } catch (error) {
    // The lease expires after errors/crashes. Profile evidence is replay-safe.
    throw error;
  }
}

interface RunOnceResults {
  total: number;
  processed: number;
  skipped: number;
  errors: number;
}

/**
 * One poll cycle.
 */
async function runOnce(): Promise<RunOnceResults> {
  const candidates = await EvalResultRecord.find({
    demonstratedBloomLevel: { $ne: null },
    competencyProcessedAt: null,
    $or: [{ competencyLeaseUntil: null }, { competencyLeaseUntil: { $lte: new Date() } }]
  })
    .sort({ createdAt: 1 })
    .limit(POLL_LIMIT)
    .lean();

  const results: RunOnceResults = { total: candidates.length, processed: 0, skipped: 0, errors: 0 };

  for (const candidate of candidates) {
    try {
      const outcome = await processEvalResult(candidate);
      if (outcome.processed) results.processed++;
      else results.skipped++;
    } catch (_err) {
      results.errors++;
    }
  }

  return results;
}

/**
 * Start the recurring poller.
 */
function startCompetencyUpdater(): () => Promise<void> {
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;
  let inFlight: Promise<void> = Promise.resolve();

  async function poll() {
    if (running) return;
    running = true;
    try {
      await runOnce();
    } catch (_) {
      // poll-level errors swallowed; individual results logged above
    } finally {
      running = false;
    }
  }

  timer = setInterval(() => {
    if (!running) inFlight = poll();
  }, POLL_INTERVAL_MS);
  // Run immediately on start
  inFlight = poll();

  return async function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    await inFlight;
  };
}

export {
  claimResult,
  resolveCompetencyKey,
  processEvalResult,
  runOnce,
  startCompetencyUpdater,
  POLL_INTERVAL_MS,
  POLL_LIMIT
};

module.exports = {
  claimResult,
  resolveCompetencyKey,
  processEvalResult,
  runOnce,
  startCompetencyUpdater,
  POLL_INTERVAL_MS,
  POLL_LIMIT
};
