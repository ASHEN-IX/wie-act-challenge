/**
 * Rank Badge Seed Data
 * Populates rank badge metadata for all rank ladder entries.
 * Run with: npx tsx seeds/rank-badges.seed.ts
 */

/* eslint-disable no-console */

import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({
  path: path.resolve(__dirname, '../.env')
});

import { RANK_LADDER } from '../modules/user-profile/src/models/rankingConfig';
import RankBadge from '../modules/user-profile/src/models/RankBadge';

const SINGLE_BADGE_TIERS = new Set(['grandmaster', 'legend']);
const DIVISION_TO_BADGE_KEY: Record<string, string> = {
  III: 'first',
  II: 'second',
  I: 'third'
};

function toBadgeKey(rank: any): string {
  const tier = String(rank?.tier || '').toLowerCase();
  if (SINGLE_BADGE_TIERS.has(tier)) return 'use';
  return DIVISION_TO_BADGE_KEY[String(rank?.division || '').toUpperCase()] || 'use';
}

function buildBadgeDoc(rank: any) {
  const tier = String(rank.tier || 'novice').toLowerCase();
  const badgeKey = toBadgeKey(rank);

  return {
    rankIndex: rank.index,
    rankName: rank.name,
    tier,
    division: rank.division || null,
    badgeKey,
    // The rebrand removed the per-tier badge PNGs; point at a shipped asset.
    imagePath: '/brand/noveris-symbol.svg',
    isActive: true
  };
}

function buildMongoCandidates(): string[] {
  const primary =
    process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/ednova';

  const candidates = [primary];
  if (primary.includes('host.docker.internal')) {
    candidates.push(primary.replace(/host\.docker\.internal/g, 'localhost'));
  }

  const localhostDefault = 'mongodb://localhost:27017/ednova';
  if (!candidates.includes(localhostDefault)) {
    candidates.push(localhostDefault);
  }

  return candidates;
}

async function connectToMongoWithFallback(): Promise<string> {
  const candidates = buildMongoCandidates();
  let lastError: any = null;

  for (const uri of candidates) {
    try {
      console.log(`Connecting to MongoDB: ${uri}`);
      await mongoose.connect(uri);
      console.log('Connected to MongoDB');
      return uri;
    } catch (error: any) {
      lastError = error;
      console.warn(`MongoDB connection failed for ${uri}: ${error.message}`);

      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
    }
  }

  throw lastError || new Error('Failed to connect to MongoDB');
}

async function seedRankBadges(): Promise<void> {
  try {
    await connectToMongoWithFallback();

    const badgeDocs = RANK_LADDER.map(buildBadgeDoc);

    await (RankBadge as any).deleteMany({});
    await (RankBadge as any).insertMany(badgeDocs, { ordered: true });

    console.log(`Seeded ${badgeDocs.length} rank badges`);
    console.log('Rank badge seed complete');

    await mongoose.connection.close();
  } catch (error: any) {
    console.error('Rank badge seed failed:', error.message);
    process.exit(1);
  }
}

seedRankBadges();
