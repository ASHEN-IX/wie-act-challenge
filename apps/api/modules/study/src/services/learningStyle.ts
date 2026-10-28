/** Private, provisional learning-style profile. Recipient-only: never shared with peers or instructors. */
import mongoose, { Schema, type Model } from 'mongoose';
import {
  LEARNING_STYLE_PROBE,
  LEARNING_STYLES,
  STYLE_CUES,
  scoreLearningStyleProbe,
  validateProbeAnswers,
  type LearningStyle
} from './learningStyleProbe';

interface LearningStyleState {
  userId: string;
  primary: LearningStyle;
  ranking: Array<{ style: LearningStyle; count: number }>;
  provisional: true;
  completedAt: Date;
}

const schema = new Schema<LearningStyleState>(
  {
    userId: { type: String, required: true, unique: true },
    primary: { type: String, required: true, enum: LEARNING_STYLES },
    ranking: [
      {
        _id: false,
        style: { type: String, required: true, enum: LEARNING_STYLES },
        count: { type: Number, required: true, min: 0, max: LEARNING_STYLE_PROBE.length }
      }
    ],
    provisional: { type: Boolean, required: true, default: true },
    completedAt: { type: Date, required: true }
  },
  { timestamps: true }
);

const LearningStyleProfile: Model<LearningStyleState> =
  mongoose.models.LearningStyleProfile ||
  mongoose.model<LearningStyleState>('LearningStyleProfile', schema);

export function learningStyleProbeQuestions() {
  return LEARNING_STYLE_PROBE.map(({ id, prompt, options }) => ({
    id,
    prompt,
    options: options.map(({ id: optionId, label }) => ({ id: optionId, label }))
  }));
}

export async function getLearningStyle(userId: string) {
  const profile = await LearningStyleProfile.findOne({ userId }).lean();
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
    { upsert: true, new: true, lean: true }
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
  const profile = await LearningStyleProfile.findOne({ userId }, { primary: 1 }).lean();
  return profile ? STYLE_CUES[profile.primary] : null;
}
