/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();
import { Prisma } from '../../../../src/generated/prisma/client';
import { connectDatabase, disconnectDatabase } from '../../../../shared/database';
import UserRankProfile from '../models/UserRankProfile';
import Gamification from '../models/Gamification';
import RankSeason from '../models/RankSeason';
import { newId } from '../../../../shared/ids';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toSeasonCode(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${year}-S${quarter}`;
}

function toInitialKp(totalXp: number): number {
  return clamp(300 + Math.floor(Math.max(0, Number(totalXp) || 0) * 0.15), 300, 1600);
}

async function ensureActiveSeason() {
  const now = new Date();
  const seasonCode = toSeasonCode(now);

  let activeSeason = await RankSeason.getActiveSeason(now);

  if (activeSeason) return activeSeason;

  activeSeason = await RankSeason.findOne({
    seasonCode,
    status: { in: ['upcoming', 'active'] }
  });
  if (activeSeason) {
    await RankSeason.updateOne(
      { id: activeSeason.id },
      {
        status: 'active',
        startAt: activeSeason.startAt || now,
        endAt: activeSeason.endAt && activeSeason.endAt <= now ? null : activeSeason.endAt
      }
    );
    return (await RankSeason.findOne({ id: activeSeason.id })) as typeof activeSeason;
  }

  return RankSeason.create({
    id: newId(),
    seasonCode,
    name: `Season ${seasonCode}`,
    status: 'active',
    startAt: now,
    resetPolicy: {
      lowBracketDrop: 3,
      highBracketDrop: 5,
      seasonFloorIndex: 3
    } as unknown as Prisma.InputJsonValue
  });
}

async function upsertProfile(
  userId: string,
  totalXp: number,
  activeSeasonId: string,
  dryRun: boolean
) {
  const initialKP = toInitialKp(totalXp);
  let profile = await UserRankProfile.findOne({ userId });
  const isNew = !profile;

  if (!profile) {
    profile = await UserRankProfile.create(userId);
  }

  profile.currentSeasonId = profile.currentSeasonId || activeSeasonId;
  profile.knowledgePoints = initialKP;
  profile.seasonPeakKp = Math.max(initialKP, Number(profile.seasonPeakKp || 0));
  profile.allTimePeakKp = Math.max(initialKP, Number(profile.allTimePeakKp || 0));
  profile.learningSkillRating = Number.isFinite(profile.learningSkillRating)
    ? profile.learningSkillRating
    : 1000;
  profile.currentStreak = Number.isFinite(profile.currentStreak) ? profile.currentStreak : 0;
  profile.comebackBonusRemaining = Number.isFinite(profile.comebackBonusRemaining)
    ? profile.comebackBonusRemaining
    : 0;

  UserRankProfile.syncRankFromPoints(profile);

  if (!dryRun) {
    await UserRankProfile.save(profile);
  }

  return { isNew, initialKP };
}

async function run() {
  const dryRun = process.argv.includes('--dry-run');

  await connectDatabase();
  console.log(`[KP Migration] Connected to PostgreSQL (${dryRun ? 'dry-run' : 'write'})`);

  const activeSeason = await ensureActiveSeason();
  const activeSeasonId = activeSeason.id;

  const gamificationRows = await Gamification.findMany({});
  const processedUserIds = new Set();

  let created = 0;
  let updated = 0;

  for (const row of gamificationRows) {
    processedUserIds.add(row.userId);
    const result = await upsertProfile(row.userId, row.totalXp, activeSeasonId, dryRun);
    if (result.isNew) created += 1;
    else updated += 1;
  }

  // Profiles without gamification rows still get minimum KP baseline.
  const orphanProfiles = await UserRankProfile.findMany({
    userId: { notIn: Array.from(processedUserIds) as string[] }
  });

  for (const profile of orphanProfiles) {
    const result = await upsertProfile(profile.userId, 0, activeSeasonId, dryRun);
    if (result.isNew) created += 1;
    else updated += 1;
  }

  console.log('[KP Migration] Completed');
  console.log(`[KP Migration] Created profiles: ${created}`);
  console.log(`[KP Migration] Updated profiles: ${updated}`);
  console.log(`[KP Migration] Season used: ${activeSeason.seasonCode}`);

  await disconnectDatabase();
}

if (require.main === module) {
  run().catch(async (error) => {
    console.error('[KP Migration] Failed:', error);
    try {
      await disconnectDatabase();
    } catch (disconnectError) {
      console.error(
        '[KP Migration] Disconnect failed:',
        disconnectError instanceof Error ? disconnectError.message : String(disconnectError)
      );
    }
    process.exit(1);
  });
}

export default { run };
module.exports = { run };
