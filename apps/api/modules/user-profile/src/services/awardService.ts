import type { IUserRankProfile } from '../models/UserRankProfile';
import type { IRankSeason } from '../models/RankSeason';

interface AwardResult {
  awarded: boolean;
  reason?: string;
  deltaKp: number;
  season?: IRankSeason;
  profile?: IUserRankProfile;
  progress?: ReturnType<typeof leaderboardService.buildRankProgress>;
  baseKP?: number;
  multipliers?: {
    difficulty: number;
    performance: number;
    consistency: number;
    comeback: number;
    antiGrind: number;
    total: number;
  };
  breakdown?: {
    formula: string;
    baseKP: number;
    difficulty: { label: string; multiplier: number };
    performance: { score: number | null; multiplier: number };
    consistency: { streak: number; multiplier: number };
    comeback: { applied: boolean; multiplier: number; remainingSessions: number };
    antiGrind: { lowDifficultyAction: boolean; applied: boolean; multiplier: number };
    totalMultiplier: number;
    rawFinalKp: number;
    cappedByDailyLimit: boolean;
    finalKP: number;
    learningSkillDelta: number;
    learningSkillRating: number;
  };
  beforeKp?: number;
  afterKp?: number;
  beforeRankIndex?: number;
  afterRankIndex?: number;
  rankUp?: boolean;
  rankDown?: boolean;
}
import { Prisma } from '../../../../src/generated/prisma/client';
import { newId } from '../../../../shared/ids';
import RankEventLedger from '../models/RankEventLedger';
import UserRankProfile from '../models/UserRankProfile';
import { prisma } from '../../../../shared/database';
import * as seasonService from './seasonService';
import * as leaderboardService from './leaderboardService';

export const BASE_KP_MAP: Record<string, number> = {
  task_complete_easy: 20,
  task_complete_medium: 40,
  task_complete_hard: 70,
  session_complete: 30,
  challenge_complete: 60,
  challenge_completed: 60,
  perfect_focus_session: 20,
  subject_create: 20,
  course_upload: 40,
  daily_streak: 20,
  team_session: 35,
  team_session_host: 45,
  quest_complete: 40,
  friend_added: 10
};

export const DIFFICULTY_MULTIPLIERS: Record<string, number> = {
  easy: 1,
  medium: 1.2,
  hard: 1.5,
  extreme: 2
};

export const DAILY_KP_CAP = Number(process.env.RANK_DAILY_KP_CAP || 600);
export const LOW_DIFFICULTY_REPEAT_THRESHOLD = Number(
  process.env.RANK_LOW_DIFFICULTY_REPEAT_THRESHOLD || 8
);
export const LOW_DIFFICULTY_WINDOW_MINUTES = Number(
  process.env.RANK_LOW_DIFFICULTY_WINDOW_MINUTES || 120
);
export const COMEBACK_INACTIVITY_HOURS = Number(process.env.RANK_COMEBACK_INACTIVITY_HOURS || 72);
export const COMEBACK_BONUS_SESSIONS = Number(process.env.RANK_COMEBACK_BONUS_SESSIONS || 5);

const SESSION_ACTIONS = new Set([
  'session_complete',
  'challenge_complete',
  'challenge_completed',
  'team_session',
  'team_session_host'
]);

function toNumber<T extends number | null = number>(
  value: unknown,
  fallback: T = 0 as T
): number | T {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getUtcDayBounds(date: Date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function getUtcDayDiff(a: Date, b: Date): number {
  const aDay = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const bDay = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.floor((aDay - bDay) / (24 * 60 * 60 * 1000));
}

function buildEventKey({
  userId,
  action,
  metadata = {}
}: {
  userId: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  const stableId =
    metadata.eventId ||
    metadata.taskId ||
    metadata.sessionId ||
    metadata.courseId ||
    metadata.subjectId ||
    metadata.questId ||
    metadata.focusSessionId ||
    null;

  if (!stableId) return null;
  return `${userId}:${action}:${stableId}`;
}

function resolveDifficultyLabel(action: string, metadata: Record<string, unknown> = {}) {
  const fromMeta = String(metadata.difficulty || metadata.taskDifficulty || '').toLowerCase();
  if (DIFFICULTY_MULTIPLIERS[fromMeta]) return fromMeta;

  if (action.endsWith('_easy')) return 'easy';
  if (action.endsWith('_medium')) return 'medium';
  if (action.endsWith('_hard')) return 'hard';
  if (action.endsWith('_extreme')) return 'extreme';

  return 'medium';
}

function resolvePerformanceMultiplier(metadata: Record<string, unknown> = {}) {
  const score = toNumber(
    metadata.quizScore ?? metadata.score ?? metadata.performanceScore ?? metadata.focusScore,
    NaN
  );
  if (typeof score !== 'number' || !Number.isFinite(score)) return 1;
  if (score >= 90) return 1.5;
  if (score >= 75) return 1.2;
  if (score < 50) return 0.5;
  return 1;
}

function resolveConsistencyMultiplier(streak: number) {
  if (streak >= 30) return 1.5;
  if (streak >= 7) return 1.2;
  return 1;
}

function isSessionAction(action: string) {
  return SESSION_ACTIONS.has(action);
}

function updateStreak(profile: IUserRankProfile, now: Date) {
  if (!profile.lastActivityAt) {
    profile.currentStreak = 1;
    profile.lastActivityAt = now;
    return profile.currentStreak;
  }

  const previous = new Date(profile.lastActivityAt);
  const dayDiff = getUtcDayDiff(now, previous);

  if (dayDiff <= 0) {
    profile.lastActivityAt = now;
    return profile.currentStreak || 1;
  }

  if (dayDiff === 1) {
    profile.currentStreak = (profile.currentStreak || 0) + 1;
  } else {
    profile.currentStreak = 1;
  }

  profile.lastActivityAt = now;
  return profile.currentStreak;
}

function refreshComebackWindow(profile: IUserRankProfile, now: Date) {
  if (!profile.lastActivityAt) return;

  const inactivityHours =
    (now.getTime() - new Date(profile.lastActivityAt).getTime()) / (60 * 60 * 1000);
  if (inactivityHours >= COMEBACK_INACTIVITY_HOURS && (profile.comebackBonusRemaining || 0) <= 0) {
    profile.comebackBonusRemaining = COMEBACK_BONUS_SESSIONS;
  }
}

function computeLearningSkillDelta({
  difficultyMultiplier,
  performanceMultiplier,
  consistencyMultiplier,
  antiGrindMultiplier
}: {
  difficultyMultiplier: number;
  performanceMultiplier: number;
  consistencyMultiplier: number;
  antiGrindMultiplier: number;
}) {
  const score =
    (difficultyMultiplier - 1) * 16 +
    (performanceMultiplier - 1) * 24 +
    (consistencyMultiplier - 1) * 10 +
    (antiGrindMultiplier < 1 ? -8 : 0);
  return Math.round(score);
}

async function getTodayAwardedKp(userId: string, seasonId: string) {
  const { start, end } = getUtcDayBounds();
  // `$group: { $sum: '$finalKP' }` has no Prisma aggregate equivalent for a
  // single integer sum, so the sum runs in the database with parameterized SQL.
  const rows = await prisma.$queryRaw<Array<{ total: bigint | number | null }>>`
    SELECT COALESCE(SUM("finalKP"), 0) AS total
    FROM "rankeventledgers"
    WHERE "userId" = ${userId}
      AND "seasonId" = ${seasonId}
      AND "occurredAt" >= ${start}
      AND "occurredAt" < ${end}
      AND "finalKP" > 0
  `;
  const total = rows[0]?.total ?? 0;
  return typeof total === 'bigint' ? Number(total) : total;
}

async function countRecentLowDifficultyActions(userId: string, seasonId: string, now: Date) {
  const since = new Date(now.getTime() - LOW_DIFFICULTY_WINDOW_MINUTES * 60 * 1000);
  // The flag lives inside the `reasonBreakdown` JSON document, so the filter is
  // applied in the database with a JSON predicate rather than a column.
  const rows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
    SELECT COUNT(*) AS count
    FROM "rankeventledgers"
    WHERE "userId" = ${userId}
      AND "seasonId" = ${seasonId}
      AND "occurredAt" >= ${since}
      AND ("reasonBreakdown" ->> 'lowDifficultyAction') = 'true'
  `;
  const count = rows[0]?.count ?? 0;
  return typeof count === 'bigint' ? Number(count) : count;
}

export async function awardKnowledgePoints({
  userId,
  action,
  metadata = {}
}: {
  userId: string;
  action: string;
  metadata?: Record<string, unknown>;
}): Promise<AwardResult> {
  const baseKP = BASE_KP_MAP[action] || 0;
  if (baseKP <= 0) {
    return {
      awarded: false,
      reason: 'action_not_ranked',
      deltaKp: 0
    };
  }

  const season = await seasonService.getOrCreateActiveSeason();
  const profile = await seasonService.ensureUserRankProfile(userId, String(season.id));
  const now = new Date();

  const eventKey = buildEventKey({ userId, action, metadata });
  if (eventKey) {
    const existingEvent = await RankEventLedger.findOne({ eventKey });
    if (existingEvent) {
      return {
        awarded: false,
        reason: 'duplicate_event',
        deltaKp: 0,
        season,
        profile,
        progress: leaderboardService.buildRankProgress(profile)
      };
    }
  }

  refreshComebackWindow(profile, now);
  const currentStreak = updateStreak(profile, now);

  const difficultyLabel = resolveDifficultyLabel(action, metadata);
  const difficultyMultiplier = DIFFICULTY_MULTIPLIERS[difficultyLabel] || 1;
  const performanceMultiplier = resolvePerformanceMultiplier(metadata);
  const consistencyMultiplier = resolveConsistencyMultiplier(currentStreak);

  const lowDifficultyAction = difficultyLabel === 'easy';
  let antiGrindMultiplier = 1;
  if (lowDifficultyAction) {
    const recentLowCount = await countRecentLowDifficultyActions(userId, season.id, now);
    if (recentLowCount >= LOW_DIFFICULTY_REPEAT_THRESHOLD) {
      antiGrindMultiplier = 0.6;
    }
  }

  let comebackMultiplier = 1;
  const comebackEligible = isSessionAction(action) && (profile.comebackBonusRemaining || 0) > 0;
  if (comebackEligible) {
    comebackMultiplier = 1.5;
    profile.comebackBonusRemaining = Math.max(0, (profile.comebackBonusRemaining || 0) - 1);
  }

  const totalMultiplier =
    difficultyMultiplier *
    performanceMultiplier *
    consistencyMultiplier *
    antiGrindMultiplier *
    comebackMultiplier;

  const rawFinalKp = baseKP * totalMultiplier;
  let finalKP = Math.max(0, Math.floor(rawFinalKp));

  const todayAwarded = await getTodayAwardedKp(userId, season.id);
  const remaining = Math.max(0, DAILY_KP_CAP - todayAwarded);
  let cappedByDailyLimit = false;

  if (remaining <= 0) {
    await UserRankProfile.save(profile);
    return {
      awarded: false,
      reason: 'daily_cap_reached',
      deltaKp: 0,
      season,
      profile,
      progress: leaderboardService.buildRankProgress(profile)
    };
  }

  if (finalKP > remaining) {
    finalKP = remaining;
    cappedByDailyLimit = true;
  }

  if (finalKP <= 0) {
    await UserRankProfile.save(profile);
    return {
      awarded: false,
      reason: 'zero_kp_after_balancing',
      deltaKp: 0,
      season,
      profile,
      progress: leaderboardService.buildRankProgress(profile)
    };
  }

  const applyResult = UserRankProfile.applyKnowledgeDelta(profile, finalKP);

  const skillDelta = computeLearningSkillDelta({
    difficultyMultiplier,
    performanceMultiplier,
    consistencyMultiplier,
    antiGrindMultiplier
  });
  profile.learningSkillRating = Math.max(
    0,
    Math.round((profile.learningSkillRating || 1000) + skillDelta)
  );

  await UserRankProfile.save(profile);

  const reasonBreakdown = {
    formula:
      'baseKP × difficultyMultiplier × performanceMultiplier × consistencyMultiplier × comebackMultiplier × antiGrindMultiplier',
    baseKP,
    difficulty: {
      label: difficultyLabel,
      multiplier: difficultyMultiplier
    },
    performance: {
      score: toNumber(metadata.quizScore ?? metadata.score ?? metadata.performanceScore, null),
      multiplier: performanceMultiplier
    },
    consistency: {
      streak: currentStreak,
      multiplier: consistencyMultiplier
    },
    comeback: {
      applied: comebackEligible,
      multiplier: comebackMultiplier,
      remainingSessions: profile.comebackBonusRemaining || 0
    },
    antiGrind: {
      lowDifficultyAction,
      applied: antiGrindMultiplier < 1,
      multiplier: antiGrindMultiplier
    },
    totalMultiplier,
    rawFinalKp,
    cappedByDailyLimit,
    finalKP,
    learningSkillDelta: skillDelta,
    learningSkillRating: profile.learningSkillRating
  };

  await RankEventLedger.create({
    id: newId(),
    userId,
    seasonId: season.id,
    action,
    baseKP,
    multipliers: {
      difficulty: difficultyMultiplier,
      performance: performanceMultiplier,
      consistency: consistencyMultiplier,
      comeback: comebackMultiplier,
      antiGrind: antiGrindMultiplier,
      total: totalMultiplier
    },
    finalKP,
    deltaKp: finalKP,
    beforeKp: applyResult.beforeKp,
    afterKp: applyResult.afterKp,
    beforeRankIndex: applyResult.beforeRankIndex,
    afterRankIndex: applyResult.afterRankIndex,
    rankName: profile.rankName,
    metadata: metadata as unknown as Prisma.InputJsonValue,
    reasonBreakdown,
    contextSessionId:
      (metadata.sessionId as string) ||
      (metadata.focusSessionId as string) ||
      (metadata.eventId as string) ||
      null,
    eventKey
  });

  const progress = leaderboardService.buildRankProgress(profile);

  return {
    awarded: true,
    season,
    profile,
    progress,
    baseKP,
    multipliers: {
      difficulty: difficultyMultiplier,
      performance: performanceMultiplier,
      consistency: consistencyMultiplier,
      comeback: comebackMultiplier,
      antiGrind: antiGrindMultiplier,
      total: totalMultiplier
    },
    breakdown: reasonBreakdown,
    ...applyResult
  };
}

export default {
  BASE_KP_MAP,
  DAILY_KP_CAP,
  awardKnowledgePoints
};
module.exports = {
  BASE_KP_MAP,
  DAILY_KP_CAP,
  awardKnowledgePoints
};
