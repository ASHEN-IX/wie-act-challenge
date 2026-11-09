/**
 * Rank Badge Seed Data
 * Populates rank badge metadata for all rank ladder entries.
 * Run with: npx tsx seeds/rank-badges.seed.ts
 */

/* eslint-disable no-console */

import type { Prisma } from '../src/generated/prisma/client';
import path from 'path';
import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase, prisma } from '../shared/database';
import { newId } from '../shared/ids';
import { RANK_LADDER } from '../modules/user-profile/src/models/rankingConfig';

dotenv.config({
  path: path.resolve(__dirname, '../.env')
});

const SINGLE_BADGE_TIERS = new Set(['grandmaster', 'legend']);
const DIVISION_TO_BADGE_KEY: Record<string, string> = {
  III: 'first',
  II: 'second',
  I: 'third'
};

function toBadgeKey(rank: (typeof RANK_LADDER)[number]): string {
  const tier = String(rank?.tier || '').toLowerCase();
  if (SINGLE_BADGE_TIERS.has(tier)) return 'use';
  return DIVISION_TO_BADGE_KEY[String(rank?.division || '').toUpperCase()] || 'use';
}

function buildBadgeDoc(rank: (typeof RANK_LADDER)[number]): Prisma.RankBadgeUncheckedCreateInput {
  const tier = String(rank.tier || 'novice').toLowerCase();
  const badgeKey = toBadgeKey(rank);

  return {
    id: newId(),
    rankIndex: Number(rank.index),
    rankName: String(rank.name),
    tier,
    division: rank.division || null,
    badgeKey: badgeKey as Prisma.RankBadgeUncheckedCreateInput['badgeKey'],
    // The rebrand removed the per-tier badge PNGs; point at a shipped asset.
    imagePath: '/brand/noveris-symbol.svg',
    isActive: true
  };
}

export async function createMissingRankBadges(): Promise<number> {
  const { count } = await prisma.rankBadge.createMany({
    data: RANK_LADDER.map(buildBadgeDoc),
    skipDuplicates: true
  });
  return count;
}

/** Badge tiers are keyed by `rankIndex`, so a re-run updates the same rows. */
async function seedRankBadges(): Promise<void> {
  try {
    if (process.env.NODE_ENV === 'production') throw new Error('Demo seeding is development only');
    const url = process.env.DATABASE_URL;
    if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname))
      throw new Error('Rank badge seeding requires a loopback PostgreSQL database');

    await connectDatabase();
    const badgeDocs = RANK_LADDER.map(buildBadgeDoc);
    for (const badge of badgeDocs) {
      const { id: id, rankIndex, ...rest } = badge;
      await prisma.rankBadge.upsert({
        where: { rankIndex },
        update: rest,
        create: badge
      });
    }

    console.log(`Seeded ${badgeDocs.length} rank badges`);
    console.log('Rank badge seed complete');
  } catch (error: any) {
    console.error('Rank badge seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

if (require.main === module) void seedRankBadges();
