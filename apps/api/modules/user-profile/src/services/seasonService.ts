import type { ISeasonResultSnapshot } from '../models/SeasonResultSnapshot';
import RankSeason, { IRankSeason } from '../models/RankSeason';
import UserRankProfile, { IUserRankProfile } from '../models/UserRankProfile';
import { Prisma } from '../../../../src/generated/prisma/client';
import { prisma } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';
import { DEFAULT_SEASON_FLOOR_INDEX, getRankByIndex, isLowBracket } from '../models/rankingConfig';

export function toSeasonCode(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${year}-S${quarter}`;
}

export function deriveNextSeasonCode(currentCode: string): string {
  const match = String(currentCode || '').match(/^(\d{4})-S([1-4])$/);
  if (!match) {
    const now = new Date();
    now.setUTCMonth(now.getUTCMonth() + 3);
    return toSeasonCode(now);
  }

  const year = Number(match[1]);
  const quarter = Number(match[2]);
  if (quarter < 4) {
    return `${year}-S${quarter + 1}`;
  }

  return `${year + 1}-S1`;
}

export async function getOrCreateActiveSeason(): Promise<IRankSeason> {
  const now = new Date();
  let season = await RankSeason.getActiveSeason(now);
  if (season) return season;

  const seasonCode = toSeasonCode(now);
  season = await RankSeason.findOne({
    seasonCode,
    status: { in: ['upcoming', 'active'] }
  });

  if (season) {
    await RankSeason.updateOne(
      { id: season.id },
      {
        status: 'active',
        startAt: season.startAt || now,
        endAt: season.endAt && season.endAt <= now ? null : season.endAt
      }
    );
    return (await RankSeason.findOne({ id: season.id })) as IRankSeason;
  }

  season = await RankSeason.create({
    id: newId(),
    seasonCode,
    name: `Season ${seasonCode}`,
    theme: null,
    status: 'active',
    startAt: now,
    resetPolicy: {
      lowBracketDrop: 3,
      highBracketDrop: 5,
      seasonFloorIndex: DEFAULT_SEASON_FLOOR_INDEX
    } as unknown as Prisma.InputJsonValue
  });

  return season;
}

export async function ensureUserRankProfile(
  userId: string,
  seasonId: string
): Promise<IUserRankProfile> {
  let profile = await UserRankProfile.findOne({ userId });

  if (!profile) {
    profile = (await UserRankProfile.findOneAndUpdate(
      { userId },
      { currentSeasonId: seasonId },
      { upsert: true }
    )) as IUserRankProfile;
    return profile;
  }

  if (!profile.currentSeasonId || String(profile.currentSeasonId) !== String(seasonId)) {
    profile.currentSeasonId = seasonId;
    profile.seasonPeakRankIndex = profile.rankIndex;
    const points = Math.max(0, Number(profile.knowledgePoints || 0));
    profile.seasonPeakKp = points;
    profile.competitiveEventsCountSeason = 0;
    profile.currentStreak = 0;
    await UserRankProfile.save(profile);
  }

  return profile;
}

export function computeResetPreviewForProfile(
  profile: Pick<IUserRankProfile, 'rankIndex' | 'knowledgePoints' | 'userId' | 'rankName'>,
  resetPolicy: Partial<IRankSeason['resetPolicy']> = {}
) {
  const lowBracketDrop =
    typeof resetPolicy.lowBracketDrop === 'number' && Number.isFinite(resetPolicy.lowBracketDrop)
      ? resetPolicy.lowBracketDrop
      : 3;
  const highBracketDrop =
    typeof resetPolicy.highBracketDrop === 'number' && Number.isFinite(resetPolicy.highBracketDrop)
      ? resetPolicy.highBracketDrop
      : 5;
  const seasonFloorIndex =
    typeof resetPolicy.seasonFloorIndex === 'number' &&
    Number.isFinite(resetPolicy.seasonFloorIndex)
      ? resetPolicy.seasonFloorIndex
      : DEFAULT_SEASON_FLOOR_INDEX;

  const oldRankIndex = profile.rankIndex;
  const demotedBy = isLowBracket(oldRankIndex) ? lowBracketDrop : highBracketDrop;
  const newRankIndex = Math.max(seasonFloorIndex, oldRankIndex - demotedBy);
  const newRank = getRankByIndex(newRankIndex);
  const oldPoints = Math.max(0, Number(profile.knowledgePoints || 0));

  return {
    userId: profile.userId,
    oldRankIndex,
    oldRankName: profile.rankName,
    oldKnowledgePoints: oldPoints,
    demotedBy,
    newRankIndex,
    newRankName: newRank.name,
    seasonFloorIndex
  };
}

export async function previewSeasonReset(seasonId: string | null = null) {
  const season = seasonId
    ? await RankSeason.findOne({ id: seasonId })
    : await getOrCreateActiveSeason();
  if (!season) {
    throw new Error('Season not found');
  }

  const profiles = await UserRankProfile.findMany(
    { currentSeasonId: season.id },
    { orderBy: { knowledgePoints: 'desc' } }
  );

  const preview = profiles.map((profile) =>
    computeResetPreviewForProfile(profile, season.resetPolicy)
  );
  return { season, preview };
}

export async function startSeason({
  seasonCode,
  name,
  theme = null,
  startedBy
}: {
  seasonCode?: string;
  name?: string;
  theme?: string | null;
  startedBy?: string | null;
}) {
  const activeSeason = await RankSeason.getActiveSeason(new Date());
  if (activeSeason) {
    throw new Error('An active season already exists. Close it before starting a new one.');
  }

  const now = new Date();
  const code = seasonCode || toSeasonCode(now);
  const seasonName = name || `Season ${code}`;

  let season = await RankSeason.findOne({ seasonCode: code });
  if (season) {
    await RankSeason.updateOne(
      { id: season.id },
      {
        status: 'active',
        startAt: now,
        endAt: null,
        theme: theme || season.theme || null,
        startedBy: startedBy || null
      }
    );
    return (await RankSeason.findOne({ id: season.id })) as IRankSeason;
  }

  season = await RankSeason.create({
    id: newId(),
    seasonCode: code,
    name: seasonName,
    theme,
    status: 'active',
    startAt: now,
    startedBy: startedBy || null,
    resetPolicy: {
      lowBracketDrop: 3,
      highBracketDrop: 5,
      seasonFloorIndex: DEFAULT_SEASON_FLOOR_INDEX
    } as unknown as Prisma.InputJsonValue
  });

  return season;
}

export async function closeSeasonAndStartNext({
  seasonId = null,
  startedBy = null
}: {
  seasonId?: string | null;
  startedBy?: string | null;
} = {}) {
  const season = seasonId
    ? await RankSeason.findOne({ id: seasonId })
    : await getOrCreateActiveSeason();
  if (!season) {
    throw new Error('Season not found');
  }
  if (season.status !== 'active') {
    throw new Error('Only active seasons can be closed');
  }

  const now = new Date();
  const nextSeasonCode = deriveNextSeasonCode(season.seasonCode);

  let nextSeason = await RankSeason.findOne({ seasonCode: nextSeasonCode });
  if (!nextSeason) {
    nextSeason = await RankSeason.create({
      id: newId(),
      seasonCode: nextSeasonCode,
      name: `Season ${nextSeasonCode}`,
      theme: season.theme || null,
      status: 'active',
      startAt: now,
      startedBy: startedBy || null,
      resetPolicy: {
        lowBracketDrop: 3,
        highBracketDrop: 5,
        seasonFloorIndex: DEFAULT_SEASON_FLOOR_INDEX
      } as unknown as Prisma.InputJsonValue
    });
  } else {
    await RankSeason.updateOne(
      { id: nextSeason.id },
      {
        status: 'active',
        startAt: now,
        endAt: null,
        theme: nextSeason.theme || season.theme || null,
        startedBy: startedBy || nextSeason.startedBy || null
      }
    );
    nextSeason = (await RankSeason.findOne({ id: nextSeason.id })) as IRankSeason;
  }

  const currentProfiles = await UserRankProfile.findMany(
    { currentSeasonId: season.id },
    { orderBy: { knowledgePoints: 'desc' } }
  );

  const snapshots: Array<
    Pick<
      ISeasonResultSnapshot,
      | 'seasonId'
      | 'userId'
      | 'position'
      | 'finalRankIndex'
      | 'finalRankName'
      | 'finalKnowledgePoints'
      | 'seasonPeakRankIndex'
      | 'seasonPeakKp'
      | 'eventsCount'
      | 'resetApplied'
    >
  > = [];
  for (let idx = 0; idx < currentProfiles.length; idx += 1) {
    const profile = currentProfiles[idx];
    const finalRankIndex = profile.rankIndex;
    const finalRankName = profile.rankName;
    const finalKnowledgePoints = Math.max(0, Number(profile.knowledgePoints || 0));
    const seasonPeakRankIndex = profile.seasonPeakRankIndex;
    const seasonPeakKp = Math.max(0, Number(profile.seasonPeakKp || 0));
    const eventsCount = profile.competitiveEventsCountSeason;

    const resetInfo = UserRankProfile.applySeasonReset(profile, season.resetPolicy || {});
    const newRank = getRankByIndex(resetInfo.newRankIndex);

    profile.currentSeasonId = nextSeason._id;
    await UserRankProfile.save(profile);

    snapshots.push({
      seasonId: season.id,
      userId: profile.userId,
      position: idx + 1,
      finalRankIndex,
      finalRankName,
      finalKnowledgePoints,
      seasonPeakRankIndex,
      seasonPeakKp,
      eventsCount,
      resetApplied: {
        demotedBy: resetInfo.demotedBy,
        newRankIndex: resetInfo.newRankIndex,
        newRankName: newRank.name,
        seasonFloorIndex: resetInfo.seasonFloorIndex
      }
    });
  }

  if (snapshots.length > 0) {
    await prisma.seasonResultSnapshot.createMany({
      data: snapshots.map((snapshot) => ({
        id: newId(),
        seasonId: snapshot.seasonId,
        userId: snapshot.userId,
        position: snapshot.position,
        finalRankIndex: snapshot.finalRankIndex,
        finalRankName: snapshot.finalRankName,
        finalKnowledgePoints: snapshot.finalKnowledgePoints,
        seasonPeakRankIndex: snapshot.seasonPeakRankIndex,
        seasonPeakKp: snapshot.seasonPeakKp,
        eventsCount: snapshot.eventsCount,
        resetApplied: snapshot.resetApplied as unknown as Prisma.InputJsonValue
      })),
      skipDuplicates: true
    });
  }

  await RankSeason.updateOne({ id: season.id }, { status: 'closed', endAt: now, closedAt: now });
  const closedSeason = (await RankSeason.findOne({ id: season.id })) as IRankSeason;

  return {
    closedSeason,
    startedSeason: nextSeason,
    affectedUsers: currentProfiles.length
  };
}

export default {
  getOrCreateActiveSeason,
  ensureUserRankProfile,
  previewSeasonReset,
  startSeason,
  closeSeasonAndStartNext
};
module.exports = {
  getOrCreateActiveSeason,
  ensureUserRankProfile,
  previewSeasonReset,
  startSeason,
  closeSeasonAndStartNext
};
