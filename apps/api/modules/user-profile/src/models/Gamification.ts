import type {
  Gamification as GamificationRow,
  Prisma
} from '../../../../src/generated/prisma/client';
import { prisma, toDocument } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';
import { json } from './_helpers';

export interface IGamificationStats {
  coursesUploaded: number;
  tasksCompleted: number;
  perfectSessions: number;
  currentStreak: number;
  longestStreak: number;
  friendsAdded: number;
  teamSessions: number;
  groupSessions: number;
  challengesCompleted: number;
  subjectsCreated?: number;
}

export interface IGamificationAchievement {
  id: string;
  name: string;
  description: string;
  unlockedAt: Date;
  icon: string;
}

export type IGamification = Omit<
  GamificationRow,
  'stats' | 'xpHistory' | 'achievements' | 'evidenceAwards'
> & {
  id: string;
  stats: IGamificationStats;
  xpHistory: Array<{ action: string; xp: number; timestamp: Date; metadata?: unknown }>;
  achievements: IGamificationAchievement[];
  evidenceAwards: GamificationEvidenceAward[];
};

export interface GamificationEvidenceAward {
  awardId: string;
  completionKey: string;
  evidenceId: string;
  policyVersion: string;
  xp: number;
  reason: string;
  day: string;
  topicKey: string;
  group: boolean;
  timestamp: Date;
}

export const ACHIEVEMENT_CATALOG = [
  {
    id: 'first_course',
    name: 'Knowledge Seeker',
    description: 'Upload your first course',
    icon: '📚',
    condition: (s: IGamificationStats) => s.coursesUploaded >= 1
  },
  {
    id: 'five_courses',
    name: 'Librarian',
    description: 'Upload 5 courses',
    icon: '🏛️',
    condition: (s: IGamificationStats) => s.coursesUploaded >= 5
  },
  {
    id: 'first_task',
    name: 'Task Tackler',
    description: 'Complete your first task',
    icon: '✅',
    condition: (s: IGamificationStats) => s.tasksCompleted >= 1
  },
  {
    id: 'ten_tasks',
    name: 'Productivity Machine',
    description: 'Complete 10 tasks',
    icon: '⚡',
    condition: (s: IGamificationStats) => s.tasksCompleted >= 10
  },
  {
    id: 'fifty_tasks',
    name: 'Task Master',
    description: 'Complete 50 tasks',
    icon: '🏆',
    condition: (s: IGamificationStats) => s.tasksCompleted >= 50
  },
  {
    id: 'first_focus',
    name: 'Laser Focus',
    description: 'Achieve your first perfect focus session',
    icon: '🎯',
    condition: (s: IGamificationStats) => s.perfectSessions >= 1
  },
  {
    id: 'ten_focus',
    name: 'Focus Guru',
    description: 'Achieve 10 perfect focus sessions',
    icon: '🧘',
    condition: (s: IGamificationStats) => s.perfectSessions >= 10
  },
  {
    id: 'level_5',
    name: 'Rising Star',
    description: 'Reach level 5',
    icon: '⭐',
    condition: (_s: IGamificationStats, level: number) => level >= 5
  },
  {
    id: 'level_10',
    name: 'Veteran Scholar',
    description: 'Reach level 10',
    icon: '🌟',
    condition: (_s: IGamificationStats, level: number) => level >= 10
  },
  {
    id: 'level_25',
    name: 'Grand Master',
    description: 'Reach level 25',
    icon: '👑',
    condition: (_s: IGamificationStats, level: number) => level >= 25
  },
  {
    id: 'streak_7',
    name: 'Week Warrior',
    description: 'Maintain a 7-day streak',
    icon: '🔥',
    condition: (s: IGamificationStats) => s.currentStreak >= 7
  },
  {
    id: 'streak_30',
    name: 'Unstoppable',
    description: 'Maintain a 30-day streak',
    icon: '💎',
    condition: (s: IGamificationStats) => s.currentStreak >= 30
  },
  {
    id: 'first_friend',
    name: 'Social Butterfly',
    description: 'Add your first friend',
    icon: '🤝',
    condition: (s: IGamificationStats) => (s.friendsAdded || 0) >= 1
  },
  {
    id: 'five_friends',
    name: 'Study Circle',
    description: 'Have 5 friends',
    icon: '👥',
    condition: (s: IGamificationStats) => (s.friendsAdded || 0) >= 5
  },
  {
    id: 'first_team_session',
    name: 'Team Player',
    description: 'Complete your first team study session',
    icon: '🎮',
    condition: (s: IGamificationStats) => (s.teamSessions || 0) >= 1
  },
  {
    id: 'ten_team_sessions',
    name: 'Squad Leader',
    description: 'Complete 10 team study sessions',
    icon: '🏅',
    condition: (s: IGamificationStats) => (s.teamSessions || 0) >= 10
  }
];

function hydrate(row: GamificationRow): IGamification {
  return toDocument(row) as unknown as IGamification;
}

export function calculateLevel(totalXp: number): number {
  return Math.floor(totalXp / 100) + 1;
}

function unlockedAchievements(
  stats: IGamificationStats,
  level: number,
  existing: IGamificationAchievement[]
): IGamificationAchievement[] {
  const unlocked = new Set(existing.map((a) => a.id));
  const newly: IGamificationAchievement[] = [];
  for (const achievement of ACHIEVEMENT_CATALOG) {
    if (unlocked.has(achievement.id)) continue;
    if (achievement.condition(stats, level)) {
      newly.push({
        id: achievement.id,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        unlockedAt: new Date()
      });
    }
  }
  return newly;
}

/**
 * Award XP, recompute the level and unlock any achievement the new stats earn.
 *
 * The previous version mutated a Mongoose document and relied on a `__v`
 * optimistic-concurrency guard. The guard is preserved with a conditional
 * update on `updatedAt`: a concurrent writer that moved the row is detected and
 * the call throws rather than silently overwriting.
 */
export async function awardXp(
  doc: IGamification,
  xp: number,
  action: string,
  metadata: unknown = {}
): Promise<{
  xpAwarded: number;
  totalXp: number;
  oldLevel: number;
  newLevel: number;
  leveledUp: boolean;
  newAchievements: IGamificationAchievement[];
  document: IGamification;
}> {
  const oldLevel = doc.level;
  const totalXp = doc.totalXp + xp;
  const level = calculateLevel(totalXp);
  const newAchievements = unlockedAchievements(doc.stats, level, doc.achievements);
  const xpHistory = [...doc.xpHistory, { action, xp, metadata, timestamp: new Date() }];
  const achievements = [...doc.achievements, ...newAchievements];
  const row = await prisma.gamification.update({
    where: { id: doc.id, updatedAt: doc.updatedAt },
    data: {
      totalXp,
      level,
      xpHistory: json(xpHistory) as Prisma.InputJsonValue,
      achievements: json(achievements) as Prisma.InputJsonValue
    }
  });
  return {
    xpAwarded: xp,
    totalXp,
    oldLevel,
    newLevel: level,
    leveledUp: level > oldLevel,
    newAchievements,
    document: hydrate(row)
  };
}

export const Gamification = {
  async findOne(where: Prisma.GamificationWhereInput): Promise<IGamification | null> {
    const row = await prisma.gamification.findFirst({ where });
    return row ? hydrate(row) : null;
  },

  async findMany(
    where: Prisma.GamificationWhereInput = {},
    options: {
      take?: number;
      skip?: number;
      orderBy?: Prisma.GamificationOrderByWithRelationInput;
    } = {}
  ): Promise<IGamification[]> {
    const rows = await prisma.gamification.findMany({
      where,
      take: options.take,
      skip: options.skip,
      orderBy: options.orderBy
    });
    return rows.map(hydrate);
  },

  async create(userId: string): Promise<IGamification> {
    const row = await prisma.gamification.create({
      data: {
        id: newId(),
        userId,
        stats: json({
          coursesUploaded: 0,
          tasksCompleted: 0,
          perfectSessions: 0,
          currentStreak: 0,
          longestStreak: 0,
          friendsAdded: 0,
          teamSessions: 0,
          groupSessions: 0,
          challengesCompleted: 0
        }) as Prisma.InputJsonValue
      }
    });
    return hydrate(row);
  },

  async findOneAndUpdate(
    where: Prisma.GamificationWhereInput,
    data: Prisma.GamificationUpdateInput,
    { upsert = false }: { upsert?: boolean } = {}
  ): Promise<IGamification | null> {
    const existing = await prisma.gamification.findFirst({ where, select: { id: true } });
    if (existing) {
      return hydrate(await prisma.gamification.update({ where: { id: existing.id }, data }));
    }
    if (!upsert) return null;
    const userId = (where as { userId?: string }).userId;
    return userId ? Gamification.create(userId) : null;
  },

  async updateOne(where: Prisma.GamificationWhereInput, data: Prisma.GamificationUpdateInput) {
    const result = await prisma.gamification.updateMany({ where, data });
    return { matchedCount: result.count };
  },

  async save(doc: IGamification): Promise<IGamification> {
    const row = await prisma.gamification.update({
      where: { id: doc.id },
      data: {
        totalXp: doc.totalXp,
        level: doc.level,
        evidenceAwards: json(doc.evidenceAwards) as Prisma.InputJsonValue,
        xpHistory: json(doc.xpHistory) as Prisma.InputJsonValue,
        achievements: json(doc.achievements) as Prisma.InputJsonValue,
        stats: json(doc.stats) as Prisma.InputJsonValue
      }
    });
    return hydrate(row);
  },

  awardXp,
  calculateLevel,

  /** Unlock any achievement the current stats already satisfy. */
  async checkAndUnlockAchievements(doc: IGamification): Promise<IGamificationAchievement[]> {
    const newly = unlockedAchievements(doc.stats, doc.level, doc.achievements);
    if (newly.length === 0) return [];
    await prisma.gamification.update({
      where: { id: doc.id },
      data: { achievements: json([...doc.achievements, ...newly]) as Prisma.InputJsonValue }
    });
    return newly;
  }
};

export default Gamification;
