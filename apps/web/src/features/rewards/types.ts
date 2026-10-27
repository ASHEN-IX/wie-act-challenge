export interface LearningRewards {
  totalXp: number;
  level: number;
  levelProgress: number;
  nextLevelXp: number;
  learningXp: number;
  legacyXp: number;
  pending: number;
  pendingAwards: { awardId: string; evidenceId: string }[];
  meaning: string;
  policyVersion: string;
  policy: {
    xpPerCompletion: number;
    maxDailyTopicXp: number;
    repeatRule: string;
  };
  achievements: {
    id: string;
    name: string;
    description: string;
    unlockedAt: string;
  }[];
  awards: {
    awardId: string;
    xp: number;
    reason: string;
    policyVersion: string;
    timestamp: string;
    group: boolean;
  }[];
}
