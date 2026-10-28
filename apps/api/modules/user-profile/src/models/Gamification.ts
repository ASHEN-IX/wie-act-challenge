import mongoose, { Document, Model, Schema } from 'mongoose';

// Achievement catalog
export const ACHIEVEMENT_CATALOG = [
  {
    id: 'first_course',
    name: 'Knowledge Seeker',
    description: 'Upload your first course',
    icon: '📚',
    condition: (stats: IGamification['stats']) => stats.coursesUploaded >= 1
  },
  {
    id: 'five_courses',
    name: 'Librarian',
    description: 'Upload 5 courses',
    icon: '🏛️',
    condition: (stats: IGamification['stats']) => stats.coursesUploaded >= 5
  },
  {
    id: 'first_task',
    name: 'Task Tackler',
    description: 'Complete your first task',
    icon: '✅',
    condition: (stats: IGamification['stats']) => stats.tasksCompleted >= 1
  },
  {
    id: 'ten_tasks',
    name: 'Productivity Machine',
    description: 'Complete 10 tasks',
    icon: '⚡',
    condition: (stats: IGamification['stats']) => stats.tasksCompleted >= 10
  },
  {
    id: 'fifty_tasks',
    name: 'Task Master',
    description: 'Complete 50 tasks',
    icon: '🏆',
    condition: (stats: IGamification['stats']) => stats.tasksCompleted >= 50
  },
  {
    id: 'first_focus',
    name: 'Laser Focus',
    description: 'Achieve your first perfect focus session',
    icon: '🎯',
    condition: (stats: IGamification['stats']) => stats.perfectSessions >= 1
  },
  {
    id: 'ten_focus',
    name: 'Focus Guru',
    description: 'Achieve 10 perfect focus sessions',
    icon: '🧘',
    condition: (stats: IGamification['stats']) => stats.perfectSessions >= 10
  },
  {
    id: 'level_5',
    name: 'Rising Star',
    description: 'Reach level 5',
    icon: '⭐',
    condition: (_: IGamification['stats'], profile: Pick<IGamification, 'level'>) =>
      profile.level >= 5
  },
  {
    id: 'level_10',
    name: 'Veteran Scholar',
    description: 'Reach level 10',
    icon: '🌟',
    condition: (_: IGamification['stats'], profile: Pick<IGamification, 'level'>) =>
      profile.level >= 10
  },
  {
    id: 'level_25',
    name: 'Grand Master',
    description: 'Reach level 25',
    icon: '👑',
    condition: (_: IGamification['stats'], profile: Pick<IGamification, 'level'>) =>
      profile.level >= 25
  },
  {
    id: 'streak_7',
    name: 'Week Warrior',
    description: 'Maintain a 7-day streak',
    icon: '🔥',
    condition: (stats: IGamification['stats']) => stats.currentStreak >= 7
  },
  {
    id: 'streak_30',
    name: 'Unstoppable',
    description: 'Maintain a 30-day streak',
    icon: '💎',
    condition: (stats: IGamification['stats']) => stats.currentStreak >= 30
  },
  // Social achievements
  {
    id: 'first_friend',
    name: 'Social Butterfly',
    description: 'Add your first friend',
    icon: '🤝',
    condition: (stats: IGamification['stats']) => (stats.friendsAdded || 0) >= 1
  },
  {
    id: 'five_friends',
    name: 'Study Circle',
    description: 'Have 5 friends',
    icon: '👥',
    condition: (stats: IGamification['stats']) => (stats.friendsAdded || 0) >= 5
  },
  {
    id: 'first_team_session',
    name: 'Team Player',
    description: 'Complete your first team study session',
    icon: '🎮',
    condition: (stats: IGamification['stats']) => (stats.teamSessions || 0) >= 1
  },
  {
    id: 'ten_team_sessions',
    name: 'Squad Leader',
    description: 'Complete 10 team study sessions',
    icon: '🏅',
    condition: (stats: IGamification['stats']) => (stats.teamSessions || 0) >= 10
  }
];

export interface IGamification extends Document {
  userId: string;
  totalXp: number;
  evidenceAwards?: Array<{
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
  }>;

  level: number;
  xpHistory: Array<{
    action: string;
    xp: number;
    timestamp: Date;
    metadata?: unknown;
  }>;
  achievements: Array<{
    id: string;
    name: string;
    description: string;
    unlockedAt: Date;
    icon: string;
  }>;
  stats: {
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
  };
  createdAt: Date;
  updatedAt: Date;
  calculateLevel(): number;
  awardXp(
    xp: number,
    action: string,
    metadata?: unknown
  ): {
    xpAwarded: number;
    totalXp: number;
    oldLevel: number;
    newLevel: number;
    leveledUp: boolean;
    newAchievements: IGamification['achievements'];
  };
  checkAndUnlockAchievements(): IGamification['achievements'];
}

const gamificationSchema = new Schema<IGamification>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    totalXp: {
      type: Number,
      default: 0,
      min: 0
    },
    level: {
      type: Number,
      default: 1,
      min: 1
    },
    // Compact atomic application markers are retained, never pruned silently.
    // The evidence service fails closed at its documented document bound.
    evidenceAwards: { type: [Schema.Types.Mixed], default: [] },
    xpHistory: [
      {
        action: {
          type: String,
          required: true
        },
        xp: {
          type: Number,
          required: true
        },
        timestamp: {
          type: Date,
          default: Date.now
        },
        metadata: {
          type: Schema.Types.Mixed
        }
      }
    ],
    achievements: [
      {
        id: String,
        name: String,
        description: String,
        unlockedAt: Date,
        icon: String
      }
    ],
    stats: {
      coursesUploaded: {
        type: Number,
        default: 0
      },
      tasksCompleted: {
        type: Number,
        default: 0
      },
      perfectSessions: {
        type: Number,
        default: 0
      },
      currentStreak: {
        type: Number,
        default: 0
      },
      longestStreak: {
        type: Number,
        default: 0
      },
      friendsAdded: {
        type: Number,
        default: 0
      },
      teamSessions: {
        type: Number,
        default: 0
      },
      groupSessions: {
        type: Number,
        default: 0
      },
      challengesCompleted: {
        type: Number,
        default: 0
      }
    }
  },
  {
    timestamps: true,
    optimisticConcurrency: true
  }
);

// Calculate level based on XP (100 XP per level)
gamificationSchema.methods.calculateLevel = function (this: IGamification) {
  return Math.floor(this.totalXp / 100) + 1;
};

// Award XP and check for level up
gamificationSchema.methods.awardXp = function (
  this: IGamification,
  xp: number,
  action: string,
  metadata: unknown = {}
) {
  const oldLevel = this.level;
  this.totalXp += xp;
  this.level = this.calculateLevel();

  this.xpHistory.push({
    action,
    xp,
    metadata,
    timestamp: new Date()
  });

  // Check for new achievements
  const newAchievements = this.checkAndUnlockAchievements();

  return {
    xpAwarded: xp,
    totalXp: this.totalXp,
    oldLevel,
    newLevel: this.level,
    leveledUp: this.level > oldLevel,
    newAchievements
  };
};

// Check all achievement conditions and unlock any newly earned ones
gamificationSchema.methods.checkAndUnlockAchievements = function (this: IGamification) {
  const unlockedIds = new Set(this.achievements.map((a) => a.id));
  const newlyUnlocked: IGamification['achievements'] = [];

  for (const achievement of ACHIEVEMENT_CATALOG) {
    if (unlockedIds.has(achievement.id)) continue;
    if (achievement.condition(this.stats, this)) {
      const unlocked = {
        id: achievement.id,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        unlockedAt: new Date()
      };
      this.achievements.push(unlocked);
      newlyUnlocked.push(unlocked);
    }
  }

  return newlyUnlocked;
};

gamificationSchema.index({ totalXp: -1, userId: 1 });

const Gamification =
  (mongoose.models.Gamification as Model<IGamification>) ||
  mongoose.model<IGamification>('Gamification', gamificationSchema);

export default Gamification;
module.exports = Gamification;
