/** Private, provisional learning-style profile. Recipient-only: never shared with peers or instructors. */
import { Prisma } from '../../../../src/generated/prisma/client';
import { prisma } from '../../../../shared/database';
import { table } from '../models/_table';
import {
  LEARNING_STYLE_PROBE,
  STYLE_CUES,
  scoreLearningStyleProbe,
  validateProbeAnswers,
  type LearningStyle
} from './learningStyleProbe';

export interface LearningStyleState {
  id: string;
  _id: string;
  userId: string;
  primary: LearningStyle;
  ranking: Array<{ style: LearningStyle; count: number }>;
  provisional: boolean;
  completedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LearningStyleProfile = table<LearningStyleState>({
  delegate: () => prisma.learningStyleProfile,
  jsonColumns: ['ranking'],
  defaults: () => ({ provisional: true }),
  columns: (row) => ({
    userId: row.userId,
    primary: row.primary,
    ranking: row.ranking as unknown as Prisma.InputJsonValue,
    provisional: row.provisional,
    completedAt: row.completedAt
  })
});

export function learningStyleProbeQuestions() {
  return LEARNING_STYLE_PROBE.map(({ id, prompt, options }) => ({
    id,
    prompt,
    options: options.map(({ id: optionId, label }) => ({ id: optionId, label }))
  }));
}

export async function getLearningStyle(userId: string) {
  const profile = await LearningStyleProfile.findOne({ userId });
  if (!profile) return null;
  return {
    primary: profile.primary,
    ranking: profile.ranking,
    provisional: true as const,
    completedAt: profile.completedAt
  };
}

export async function saveLearningStyle(userId: string, input: unknown) {
  const result = scoreLearningStyleProbe(validateProbeAnswers(input));
  const saved = await LearningStyleProfile.findOneAndUpdate(
    { userId },
    { $set: { userId, ...result, completedAt: new Date() } },
    { upsert: true, new: true }
  );
  if (!saved) throw new Error('Learning style profile was not saved');
  return {
    primary: saved.primary,
    ranking: saved.ranking,
    provisional: true as const,
    completedAt: saved.completedAt
  };
}

/** Phrasing cue for private hints, or null when the learner has not taken the probe. */
export async function learningStyleCue(userId: string): Promise<string | null> {
  const profile = await LearningStyleProfile.findOne({ userId }).select({ primary: 1 });
  return profile ? STYLE_CUES[profile.primary] : null;
}
