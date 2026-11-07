import { Document, Model, Schema, model, models } from 'mongoose';

/**
 * One learner's adaptation preferences (Batch 4, Milestone 4.4).
 *
 * User-scoped, editable, resettable, and deliberately small. It stores only
 * what the application needs to honour a stated preference — never an ability
 * estimate, never a learning-style classification, never an evidence history.
 * Assessment evidence is read live from the trusted records at recommendation
 * time and is not copied here.
 *
 * `version` makes concurrent writes deterministic: a stale tab writing an old
 * version is rejected rather than silently winning.
 */
export interface ILearnerAdaptationPreference extends Document {
  userId: string;
  /** Optimistic-concurrency counter, incremented on every accepted write. */
  version: number;
  recommendationsEnabled: boolean;
  allowAssessmentEvidence: boolean;
  preferredMode: string | null;
  preferWorkedExamples: boolean;
  preferVisualExploration: boolean;
  preferDetailedProofs: boolean;
  /** When set, the learner dismissed a suggestion for this lesson+mode and it
   * is not re-surfaced until the inputs change. */
  dismissed: Array<{ courseId: string; revisionId: string; lessonId: string; mode: string; at: Date }>;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ILearnerAdaptationPreference>(
  {
    userId: { type: String, required: true, unique: true },
    version: { type: Number, required: true, default: 0 },
    recommendationsEnabled: { type: Boolean, required: true, default: true },
    allowAssessmentEvidence: { type: Boolean, required: true, default: true },
    preferredMode: { type: String, default: null },
    preferWorkedExamples: { type: Boolean, required: true, default: false },
    preferVisualExploration: { type: Boolean, required: true, default: false },
    preferDetailedProofs: { type: Boolean, required: true, default: false },
    dismissed: {
      type: [
        new Schema(
          {
            courseId: { type: String, required: true },
            revisionId: { type: String, required: true },
            lessonId: { type: String, required: true },
            mode: { type: String, required: true },
            at: { type: Date, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { collection: 'learner_adaptation_preferences', timestamps: true },
);

schema.index({ userId: 1 }, { unique: true });

export const LearnerAdaptationPreference: Model<ILearnerAdaptationPreference> =
  models.LearnerAdaptationPreference ||
  model<ILearnerAdaptationPreference>('LearnerAdaptationPreference', schema);
