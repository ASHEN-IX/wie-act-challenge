// eslint-disable-next-line @typescript-eslint/no-require-imports
const moduleClient = require('@study-partner/shared/moduleClient');
import { StudySession } from '../models';
import { toSafeInteger, getAxiosErrorDetails, buildInternalHeaders } from './sessionHelpers';

const USER_PROFILE_URL = 'module://users';
const ANALYTICS_SERVICE_URL = 'module://analytics';
const BASE_SESSION_COMPLETE_XP = Number(process.env.BASE_SESSION_COMPLETE_XP || 10);
const BASE_CHALLENGE_COMPLETE_XP = Number(process.env.BASE_CHALLENGE_COMPLETE_XP || 30);
const BASE_TEAM_SESSION_XP = Number(process.env.BASE_TEAM_SESSION_XP || 20);
const BASE_TEAM_HOST_XP = Number(process.env.BASE_TEAM_HOST_XP || 30);
const CHALLENGE_DIFFICULTY_MULTIPLIER: Record<string, number> = {
  easy: 1,
  medium: 1.5,
  hard: 2,
  expert: 2.5
};

interface TrackAnalyticsParams {
  authorization?: string;
  eventType: string;
  metadata?: Record<string, unknown>;
}

const trackAnalyticsEvent = async ({
  authorization,
  eventType,
  metadata = {}
}: TrackAnalyticsParams) => {
  if (!authorization) return null;

  try {
    const response = await moduleClient.post(
      `${ANALYTICS_SERVICE_URL}/api/v1/analytics/track`,
      { eventType, metadata },
      {
        headers: { Cookie: authorization }
      }
    );

    return response?.data || null;
  } catch (error) {
    console.warn('[Analytics] Event tracking failed:', getAxiosErrorDetails(error));
    return null;
  }
};

interface FetchGamificationProfileParams {
  authorization?: string;
  userId?: string | null;
}

const fetchGamificationProfile = async ({
  authorization,
  userId = null
}: FetchGamificationProfileParams = {}) => {
  if (!authorization) return null;

  try {
    const response = await moduleClient.get(`${USER_PROFILE_URL}/api/v1/users/gamification`, {
      params: userId ? { userId } : {},
      headers: buildInternalHeaders(authorization)
    });

    return response?.data || null;
  } catch (error) {
    console.warn('[Gamification] Profile lookup failed:', getAxiosErrorDetails(error));
    return null;
  }
};

interface CalculateChallengeXPParams {
  difficulty?: string | null;
  baseXP: number;
}

const calculateChallengeXP = ({ difficulty, baseXP }: CalculateChallengeXPParams) => {
  const normalizedDifficulty = String(difficulty || 'medium').toLowerCase();
  const difficultyMultiplier = CHALLENGE_DIFFICULTY_MULTIPLIER[normalizedDifficulty] || 1;
  return toSafeInteger(baseXP * difficultyMultiplier, baseXP);
};

interface CompletionSession {
  _id: { toString(): string } | string;
  mode?: string;
  duration?: number;
  taskId?: string;
  challengeDifficulty?: string;
}

const getSessionCompletionContext = (session: CompletionSession) => {
  const isChallenge = session.mode === 'exam';
  const duration = Number(session.duration || 0);

  if (isChallenge) {
    return {
      isChallenge: true,
      action: 'challenge_complete',
      baseXP: BASE_CHALLENGE_COMPLETE_XP,
      challengeId: session.taskId,
      difficulty: session.challengeDifficulty || 'medium',
      sessionType: 'challenge'
    };
  }

  return {
    isChallenge: false,
    action: 'study_session',
    baseXP: BASE_SESSION_COMPLETE_XP,
    challengeId: null,
    difficulty: null,
    sessionType: duration >= 60 ? 'long' : 'short'
  };
};

interface AwardSessionCompletionParams {
  userId?: string;
  session: CompletionSession;
  authorization?: string;
}

async function awardSessionCompletion({ session, authorization }: AwardSessionCompletionParams) {
  const sessionId = String(session?._id || '');
  const durationMinutes = Number(session?.duration || 0);
  const completionContext = getSessionCompletionContext(session);
  const computedTotalXP = completionContext.isChallenge
    ? calculateChallengeXP({
        difficulty: completionContext.difficulty,
        baseXP: completionContext.baseXP
      })
    : toSafeInteger(completionContext.baseXP, 0);
  const awardPayload = {
    action: completionContext.action,
    xp_amount: computedTotalXP,
    metadata: {
      sessionId,
      duration: durationMinutes,
      sessionType: completionContext.sessionType,
      challengeId: completionContext.challengeId,
      challengeDifficulty: completionContext.difficulty
    }
  };

  const awardResponse = await moduleClient.post(
    `${USER_PROFILE_URL}/api/v1/users/gamification/award-xp`,
    awardPayload,
    {
      headers: buildInternalHeaders(authorization)
    }
  );

  const awardData = awardResponse?.data || {};
  return {
    action: completionContext.action,
    baseXP: completionContext.baseXP,
    awardedXP: computedTotalXP,
    rank: {
      name: awardData.rank_name || null,
      index: Number.isFinite(Number(awardData.rank_index)) ? Number(awardData.rank_index) : null,
      totalKnowledgePoints: Number.isFinite(Number(awardData.total_knowledge_points))
        ? Number(awardData.total_knowledge_points)
        : null,
      knowledgePointsAwarded: Number.isFinite(Number(awardData.knowledge_points_awarded))
        ? Number(awardData.knowledge_points_awarded)
        : null,
      kpToNextRank: Number.isFinite(Number(awardData.kp_to_next_rank))
        ? Number(awardData.kp_to_next_rank)
        : null
    }
  };
}

async function processSessionCompletionRewards({
  userId,
  session,
  authorization
}: AwardSessionCompletionParams) {
  let completionRewards = null;

  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const yesterdaySession = await StudySession.findOne({
      userId,
      status: 'completed',
      createdAt: { $gte: yesterday, $lt: todayStart }
    });

    if (yesterdaySession) {
      await moduleClient.post(
        `${USER_PROFILE_URL}/api/v1/users/gamification/award-xp`,
        {
          action: 'daily_streak',
          metadata: { sessionId: session._id.toString() }
        },
        {
          headers: buildInternalHeaders(authorization)
        }
      );
    }

    completionRewards = await awardSessionCompletion({
      userId,
      session,
      authorization
    });

    const completionAction = String(completionRewards?.action || 'session_complete').toLowerCase();
    const questAction = completionAction.includes('challenge')
      ? 'challenge_complete'
      : 'study_session';

    await moduleClient.post(
      `${USER_PROFILE_URL}/api/v1/users/quests/progress`,
      {
        action: questAction
      },
      {
        headers: buildInternalHeaders(authorization)
      }
    );
  } catch (xpErr) {
    console.warn('XP/streak award failed:', getAxiosErrorDetails(xpErr));
  }

  return completionRewards;
}

export {
  BASE_SESSION_COMPLETE_XP,
  BASE_CHALLENGE_COMPLETE_XP,
  BASE_TEAM_SESSION_XP,
  BASE_TEAM_HOST_XP,
  CHALLENGE_DIFFICULTY_MULTIPLIER,
  trackAnalyticsEvent,
  fetchGamificationProfile,
  calculateChallengeXP,
  getSessionCompletionContext,
  awardSessionCompletion,
  processSessionCompletionRewards
};

module.exports = {
  BASE_SESSION_COMPLETE_XP,
  BASE_CHALLENGE_COMPLETE_XP,
  BASE_TEAM_SESSION_XP,
  BASE_TEAM_HOST_XP,
  CHALLENGE_DIFFICULTY_MULTIPLIER,
  trackAnalyticsEvent,
  fetchGamificationProfile,
  calculateChallengeXP,
  getSessionCompletionContext,
  awardSessionCompletion,
  processSessionCompletionRewards
};
