/**
 * BLOOM-07 — CompetencyProfile estimator service.
 *
 * Evidence-weighted EWMA seeded by EVAL's smoothing guard.
 * Each competency key (userId × topicId × knowledgeType × bloomLevel)
 * is updated independently — no cross-level inference.
 *
 * Recency decay: EWMA inherently weights recent evidence more heavily.
 * Each update is score_new = score_prev + α × (observation − score_prev),
 * which is equivalent to exponential decay of older observations with
 * half-life ≈ ln(2) / ln(1/(1−α)) ≈ 1.3 updates for α = 0.4.
 *
 * Per-step delta is capped at MAX_STEP (0.12), matching EVAL's guard.
 */

import { CompetencyProfile, IEvidenceEntry } from '../models/index';

const ALPHA = 0.4;
const MAX_STEP = 0.12;
const MAX_EVIDENCE = 20;

/**
 * Apply a single EWMA update step.
 */
function ewmaStep(prevScore: number, observation: number): number {
  const raw = prevScore + ALPHA * (observation - prevScore);
  let delta = raw - prevScore;
  delta = Math.max(Math.min(delta, MAX_STEP), -MAX_STEP);
  let score = prevScore + delta;
  score = Math.max(0, Math.min(1, score));
  return Math.round(score * 1000) / 1000;
}

/**
 * Compute confidence from evidence count.
 * Confidence grows logarithmically with evidence, asymptoting to 1.
 */
function computeConfidence(evidenceCount: number): number {
  if (evidenceCount <= 0) return 0;
  const conf = 1 - Math.pow(1 - ALPHA, evidenceCount);
  return Math.round(Math.min(1, conf) * 1000) / 1000;
}

/**
 * Sort evidence by evaluatedAt (oldest first) and replay EWMA to get the
 * canonical score for a given profile key.
 */
function replayEvidence(evidence: IEvidenceEntry[]): { score: number; confidence: number } {
  const sorted = [...evidence]
    .filter((e) => e.masteryScore != null)
    .sort(
      (a, b) =>
        new Date(a.evaluatedAt as Date).getTime() - new Date(b.evaluatedAt as Date).getTime()
    );

  if (sorted.length === 0) return { score: 0, confidence: 0 };

  // Seed at 0.5 (neutral), matching EVAL's smoothing guard default
  let score = 0.5;
  for (const item of sorted) {
    score = ewmaStep(score, item.masteryScore!);
  }
  return { score, confidence: computeConfidence(sorted.length) };
}

interface UpsertProfileParams {
  userId: string;
  topicId: string;
  knowledgeType: string;
  bloomLevel: string;
  evidenceItem: IEvidenceEntry;
}

/**
 * Update or insert a CompetencyProfile row for one competency key.
 * Evidence is appended (capped at MAX_EVIDENCE), EWMA replayed.
 */
async function upsertProfile({
  userId,
  topicId,
  knowledgeType,
  bloomLevel,
  evidenceItem
}: UpsertProfileParams) {
  const filter = { userId, topicId, knowledgeType, bloomLevel };

  // Optimistic compare-and-set prevents concurrent evidence updates from
  // overwriting each other. Retrying a completed correlation is a no-op.
  for (let attempt = 0; attempt < 8; attempt++) {
    const existing = await CompetencyProfile.findOne(filter).lean();
    const prevEvidence = existing?.evidence || [];
    if (prevEvidence.some((item) => item.correlationId === evidenceItem.correlationId))
      return existing;
    const newEvidence = [...prevEvidence, evidenceItem]
      .sort(
        (a, b) =>
          new Date(a.evaluatedAt as Date).getTime() - new Date(b.evaluatedAt as Date).getTime()
      )
      .slice(-MAX_EVIDENCE);
    const { score, confidence } = replayEvidence(newEvidence);
    try {
      const updated = await CompetencyProfile.findOneAndUpdate(
        { ...filter, __v: existing?.__v ?? { $exists: false } },
        {
          $set: { score, confidence, evidence: newEvidence, updatedAt: new Date() },
          $inc: { __v: 1 }
        },
        { upsert: !existing, new: true, setDefaultsOnInsert: true }
      );
      if (updated) return updated;
    } catch (error: any) {
      if (error.code !== 11000) throw error;
    }
  }
  throw new Error('Concurrent competency update; retry after lease expiry');
}

interface RollupResult {
  bloomLevel: string;
  avgScore: number;
  avgConfidence: number;
  count: number;
}

/**
 * Subject-level rollup from topic-level rows.
 */
async function rollupByTopics(userId: string, topicIds: string[]): Promise<RollupResult[]> {
  if (!topicIds || topicIds.length === 0) return [];

  const rows = await CompetencyProfile.find({
    userId,
    topicId: { $in: topicIds }
  })
    .select('bloomLevel score confidence')
    .lean();

  if (rows.length === 0) return [];

  // Group by bloomLevel
  const groups: Record<string, { total: number; conf: number; count: number }> = {};
  for (const row of rows) {
    if (!groups[row.bloomLevel]) {
      groups[row.bloomLevel] = { total: 0, conf: 0, count: 0 };
    }
    groups[row.bloomLevel].total += row.score;
    groups[row.bloomLevel].conf += row.confidence;
    groups[row.bloomLevel].count += 1;
  }

  return Object.entries(groups)
    .map(([bloomLevel, g]) => ({
      bloomLevel,
      avgScore: Math.round((g.total / g.count) * 1000) / 1000,
      avgConfidence: Math.round((g.conf / g.count) * 1000) / 1000,
      count: g.count
    }))
    .sort((a, b) => a.bloomLevel.localeCompare(b.bloomLevel));
}

export {
  ALPHA,
  MAX_STEP,
  MAX_EVIDENCE,
  ewmaStep,
  computeConfidence,
  replayEvidence,
  upsertProfile,
  rollupByTopics
};

module.exports = {
  ALPHA,
  MAX_STEP,
  MAX_EVIDENCE,
  ewmaStep,
  computeConfidence,
  replayEvidence,
  upsertProfile,
  rollupByTopics
};
