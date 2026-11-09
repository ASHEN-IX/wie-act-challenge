import type {
  Prisma,
  UserProfile as UserProfileRow
} from '../../../../src/generated/prisma/client';
import { prisma, toDocument } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';
import type { LearningProfile } from '../../../../shared/ednova/learningProfile';
import { json, jsonOrNull } from './_helpers';

export type IUserProfile = Omit<
  UserProfileRow,
  | 'level'
  | 'privacy'
  | 'preferences'
  | 'stats'
  | 'goals'
  | 'learningProfile'
  | 'backgroundSettings'
  | 'animatedBackgroundSettings'
  | 'teamStats'
> & {
  id: string;
  learningProfile?: LearningProfile | null;
  privacy: {
    showOnlineStatus: boolean;
    showStudyActivity: boolean;
    showStats: boolean;
    allowRequests: 'everyone' | 'nobody';
  };
  level: { current: number; xp: number; title: string };
  preferences: {
    studyTime: 'morning' | 'afternoon' | 'evening' | 'night';
    notifications: { email: boolean; push: boolean };
    theme: 'light' | 'dark';
    language: string;
  };
  stats: {
    totalStudyTime: number;
    completedTasks: number;
    currentStreak: number;
    longestStreak: number;
  };
  goals: Array<{
    title: string;
    target: number;
    current: number;
    deadline?: Date;
    completed: boolean;
  }>;
  backgroundSettings?: {
    enabled: boolean;
    type: 'preset' | 'uploaded' | 'url';
    imageUrl?: string | null;
    opacity: number;
    blur: number;
    position: 'cover' | 'contain' | 'repeat';
    uploadedAt?: Date;
  };
  animatedBackgroundSettings?: {
    enabled: boolean;
    type: 'preset' | 'uploaded' | 'url';
    videoUrl?: string | null;
    fileName?: string;
    opacity: number;
    brightness: number;
    saturation: number;
    loop: boolean;
    speed: number;
    uploadedAt?: Date;
  };
  teamStats?: {
    teamSessionsCompleted: number;
    currentTeam?: string;
    friendsInTeams: number;
    preferredTeammates: string[];
  };
};

function hydrate(row: UserProfileRow): IUserProfile {
  return toDocument(row) as unknown as IUserProfile;
}

const DEFAULT_PROFILE = {
  privacy: {
    showOnlineStatus: true,
    showStudyActivity: true,
    showStats: true,
    allowRequests: 'everyone' as const
  },
  level: { current: 1, xp: 0, title: 'Novice Explorer' },
  preferences: {
    studyTime: 'evening' as const,
    notifications: { email: true, push: true },
    theme: 'dark' as const,
    language: 'en'
  },
  stats: { totalStudyTime: 0, completedTasks: 0, currentStreak: 0, longestStreak: 0 },
  goals: [] as IUserProfile['goals']
};

export const UserProfile = {
  async findById(id: string): Promise<IUserProfile | null> {
    const row = await prisma.userProfile.findUnique({ where: { id } });
    return row ? hydrate(row) : null;
  },

  async findOne(where: Prisma.UserProfileWhereInput): Promise<IUserProfile | null> {
    const row = await prisma.userProfile.findFirst({ where });
    return row ? hydrate(row) : null;
  },

  async findMany(
    where: Prisma.UserProfileWhereInput = {},
    options: { take?: number; orderBy?: Prisma.UserProfileOrderByWithRelationInput } = {}
  ): Promise<IUserProfile[]> {
    const rows = await prisma.userProfile.findMany({
      where,
      take: options.take,
      orderBy: options.orderBy
    });
    return rows.map(hydrate);
  },

  async countDocuments(where: Prisma.UserProfileWhereInput = {}): Promise<number> {
    return prisma.userProfile.count({ where });
  },

  async exists(where: Prisma.UserProfileWhereInput): Promise<boolean> {
    const row = await prisma.userProfile.findFirst({ where, select: { id: true } });
    return row !== null;
  },

  async create(data: { userId: string } & Partial<Prisma.UserProfileUncheckedCreateInput>) {
    const row = await prisma.userProfile.create({
      data: {
        ...data,
        id: newId(),
        userId: data.userId,
        avatar: data.avatar ?? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
        friendCode: data.friendCode ?? randomFriendCode(),
        privacy: json(data.privacy ?? DEFAULT_PROFILE.privacy) as Prisma.InputJsonValue,
        level: json(data.level ?? DEFAULT_PROFILE.level) as Prisma.InputJsonValue,
        preferences: json(data.preferences ?? DEFAULT_PROFILE.preferences) as Prisma.InputJsonValue,
        stats: json(data.stats ?? DEFAULT_PROFILE.stats) as Prisma.InputJsonValue,
        goals: json(data.goals ?? DEFAULT_PROFILE.goals) as Prisma.InputJsonValue
      }
    });
    return hydrate(row);
  },

  async findOneAndUpdate(
    where: Prisma.UserProfileWhereInput,
    data: Prisma.UserProfileUpdateInput,
    { upsert = false }: { upsert?: boolean } = {}
  ): Promise<IUserProfile | null> {
    const existing = await prisma.userProfile.findFirst({ where, select: { id: true } });
    if (existing) {
      const row = await prisma.userProfile.update({ where: { id: existing.id }, data });
      return hydrate(row);
    }
    if (!upsert) return null;
    const userId = (where as { userId?: string }).userId;
    if (!userId) return null;
    return UserProfile.create({ userId });
  },

  async updateOne(where: Prisma.UserProfileWhereInput, data: Prisma.UserProfileUpdateInput) {
    const result = await prisma.userProfile.updateMany({ where, data });
    return { matchedCount: result.count };
  },

  /** Persist mutable fields of an in-memory document, like `doc.save()`. */
  async save(profile: IUserProfile): Promise<IUserProfile> {
    const row = await prisma.userProfile.update({
      where: { id: profile.id },
      data: {
        bio: profile.bio,
        avatar: profile.avatar,
        nickname: profile.nickname,
        friendCode: profile.friendCode,
        learningProfile: jsonOrNull(profile.learningProfile ?? null),
        onlineStatus: profile.onlineStatus,
        lastSeenAt: profile.lastSeenAt,
        privacy: json(profile.privacy) as Prisma.InputJsonValue,
        level: json(profile.level) as Prisma.InputJsonValue,
        preferences: json(profile.preferences) as Prisma.InputJsonValue,
        stats: json(profile.stats) as Prisma.InputJsonValue,
        goals: json(profile.goals) as Prisma.InputJsonValue,
        backgroundSettings: jsonOrNull(profile.backgroundSettings ?? null),
        animatedBackgroundSettings: jsonOrNull(profile.animatedBackgroundSettings ?? null),
        teamStats: jsonOrNull(profile.teamStats ?? null)
      }
    });
    return hydrate(row);
  }
};

function randomFriendCode(): string {
  return newId().slice(0, 8).toUpperCase();
}

export default UserProfile;
