import type {
  Prisma,
  UserRankProfile as UserRankProfileRow
} from '../../../../src/generated/prisma/client';
import { prisma, toDocument } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';
import {
  DEFAULT_KP,
  DEFAULT_SEASON_FLOOR_INDEX,
  getRankByIndex,
  getRankByKp,
  isLowBracket,
  type RankLadderItem
} from './rankingConfig';

export type IUserRankProfile = UserRankProfileRow & { _id: string };

function hydrate(row: UserRankProfileRow): IUserRankProfile {
  return toDocument(row) as unknown as IUserRankProfile;
}

/** Rank fields derived from a knowledge-point total. */
function rankStateFor(kp: number) {
  const safe = Math.max(0, Math.trunc(kp) || 0);
  const rank = getRankByKp(safe);
  return { knowledgePoints: safe, rankIndex: rank.index, rankName: rank.name };
}

export const UserRankProfile = {
  async findOne(where: Prisma.UserRankProfileWhereInput): Promise<IUserRankProfile | null> {
    const row = await prisma.userRankProfile.findFirst({ where });
    return row ? hydrate(row) : null;
  },

  async findMany(
    where: Prisma.UserRankProfileWhereInput = {},
    options: {
      take?: number;
      skip?: number;
      orderBy?: Prisma.UserRankProfileOrderByWithRelationInput;
    } = {}
  ): Promise<IUserRankProfile[]> {
    const rows = await prisma.userRankProfile.findMany({ where, ...options });
    return rows.map(hydrate);
  },

  async countDocuments(where: Prisma.UserRankProfileWhereInput = {}): Promise<number> {
    return prisma.userRankProfile.count({ where });
  },

  async create(userId: string): Promise<IUserRankProfile> {
    const row = await prisma.userRankProfile.create({
      data: {
        id: newId(),
        userId,
        knowledgePoints: DEFAULT_KP,
        rankIndex: DEFAULT_SEASON_FLOOR_INDEX,
        rankName: getRankByIndex(DEFAULT_SEASON_FLOOR_INDEX).name
      }
    });
    return hydrate(row);
  },

  async findOneAndUpdate(
    where: Prisma.UserRankProfileWhereInput,
    data: Prisma.UserRankProfileUpdateInput,
    { upsert = false }: { upsert?: boolean } = {}
  ): Promise<IUserRankProfile | null> {
    const existing = await prisma.userRankProfile.findFirst({ where, select: { id: true } });
    if (existing) {
      const payload = { ...data };
      // The schema's pre-save hook kept rankName consistent with knowledgePoints.
      if (
        typeof data.knowledgePoints === 'number' &&
        data.rankIndex === undefined &&
        data.rankName === undefined
      ) {
        const rank = getRankByKp(Math.max(0, data.knowledgePoints));
        payload.rankIndex = rank.index;
        payload.rankName = rank.name;
      }
      return hydrate(
        await prisma.userRankProfile.update({ where: { id: existing.id }, data: payload })
      );
    }
    if (!upsert) return null;
    const userId = (where as { userId?: string }).userId;
    return userId ? UserRankProfile.create(userId) : null;
  },

  async updateOne(
    where: Prisma.UserRankProfileWhereInput,
    data: Prisma.UserRankProfileUpdateInput
  ) {
    const result = await prisma.userRankProfile.updateMany({ where, data });
    return { matchedCount: result.count };
  },

  async save(profile: IUserRankProfile): Promise<IUserRankProfile> {
    const row = await prisma.userRankProfile.update({
      where: { id: profile.id },
      data: {
        currentSeasonId: profile.currentSeasonId,
        knowledgePoints: profile.knowledgePoints,
        rankIndex: profile.rankIndex,
        rankName: profile.rankName,
        seasonPeakRankIndex: profile.seasonPeakRankIndex,
        allTimePeakRankIndex: profile.allTimePeakRankIndex,
        seasonPeakKp: profile.seasonPeakKp,
        allTimePeakKp: profile.allTimePeakKp,
        competitiveEventsCountSeason: profile.competitiveEventsCountSeason,
        learningSkillRating: profile.learningSkillRating,
        currentStreak: profile.currentStreak,
        comebackBonusRemaining: profile.comebackBonusRemaining,
        lastActivityAt: profile.lastActivityAt,
        lastEventAt: profile.lastEventAt,
        lastResetAt: profile.lastResetAt
      }
    });
    return hydrate(row);
  },

  syncRankFromPoints(profile: IUserRankProfile): RankLadderItem {
    const state = rankStateFor(profile.knowledgePoints);
    profile.knowledgePoints = state.knowledgePoints;
    profile.rankIndex = state.rankIndex;
    profile.rankName = state.rankName;
    return getRankByIndex(state.rankIndex);
  },

  /** Apply a knowledge delta and update the peak/event counters. */
  applyKnowledgeDelta(profile: IUserRankProfile, deltaKp: number) {
    const delta = Number.isFinite(deltaKp) ? Math.trunc(deltaKp) : 0;
    const beforeKp = Math.max(0, Number(profile.knowledgePoints) || 0);
    const beforeRank = getRankByKp(beforeKp);

    const state = rankStateFor(beforeKp + delta);
    profile.knowledgePoints = state.knowledgePoints;
    const afterRank = UserRankProfile.syncRankFromPoints(profile);

    if (profile.rankIndex > (profile.seasonPeakRankIndex || 0))
      profile.seasonPeakRankIndex = profile.rankIndex;
    if (profile.rankIndex > (profile.allTimePeakRankIndex || 0))
      profile.allTimePeakRankIndex = profile.rankIndex;
    if (profile.knowledgePoints > (profile.seasonPeakKp || 0))
      profile.seasonPeakKp = profile.knowledgePoints;
    if (profile.knowledgePoints > (profile.allTimePeakKp || 0))
      profile.allTimePeakKp = profile.knowledgePoints;

    profile.competitiveEventsCountSeason = (profile.competitiveEventsCountSeason || 0) + 1;
    profile.lastEventAt = new Date();
    profile.lastActivityAt = profile.lastEventAt;

    return {
      deltaKp: delta,
      beforeKp,
      afterKp: profile.knowledgePoints,
      beforeRankIndex: beforeRank.index,
      afterRankIndex: afterRank.index,
      rankUp: afterRank.index > beforeRank.index,
      rankDown: afterRank.index < beforeRank.index
    };
  },

  /** Demote the profile at a season boundary and reset the season counters. */
  applySeasonReset(
    profile: IUserRankProfile,
    resetPolicy: {
      lowBracketDrop?: number;
      highBracketDrop?: number;
      seasonFloorIndex?: number;
    } = {}
  ) {
    const lowBracketDrop = Number.isFinite(resetPolicy.lowBracketDrop)
      ? (resetPolicy.lowBracketDrop as number)
      : 3;
    const highBracketDrop = Number.isFinite(resetPolicy.highBracketDrop)
      ? (resetPolicy.highBracketDrop as number)
      : 5;
    const seasonFloorIndex = Number.isFinite(resetPolicy.seasonFloorIndex)
      ? (resetPolicy.seasonFloorIndex as number)
      : DEFAULT_SEASON_FLOOR_INDEX;

    const oldRankIndex = profile.rankIndex;
    const demotedBy = isLowBracket(oldRankIndex) ? lowBracketDrop : highBracketDrop;
    const newRankIndex = Math.max(seasonFloorIndex, oldRankIndex - demotedBy);
    const newRank = getRankByIndex(newRankIndex);

    profile.rankIndex = newRank.index;
    profile.rankName = newRank.name;
    profile.knowledgePoints = Number.isFinite(newRank.minKp) ? newRank.minKp : DEFAULT_KP;

    profile.seasonPeakRankIndex = profile.rankIndex;
    profile.seasonPeakKp = profile.knowledgePoints;
    profile.competitiveEventsCountSeason = 0;
    profile.currentStreak = 0;
    profile.comebackBonusRemaining = 5;
    profile.lastResetAt = new Date();

    return { oldRankIndex, newRankIndex, demotedBy, seasonFloorIndex };
  }
};

export default UserRankProfile;
