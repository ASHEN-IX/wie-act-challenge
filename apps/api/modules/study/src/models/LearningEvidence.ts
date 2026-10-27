import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ILearningEvidence extends Document {
  evidenceId: string;
  evidenceVersion: string;
  userId: string;
  attemptId: string;
  activity: {
    courseId: string;
    revisionId: string;
    contentHash: string;
    activityId: string;
    activityRevision: string;
    activityType: 'InteractiveQuiz' | 'GuidedProblem';
  };
  objectiveId: string;
  status: 'accepted';
  bloomLevel: string;
  score: number;
  masteryAchieved: boolean;
  evaluator: {
    type: 'deterministic_rubric' | 'llm_evaluation';
    model?: string | null;
    validationVersion: string;
    executionMode: 'REAL_APPROVED' | 'MOCK_TEST' | 'DETERMINISTIC_FALLBACK';
  };
  rewardReference?: {
    rewardCandidateId: string;
    policyVersion: string;
    eventKey: string;
    finalAwardId?: string | null;
  } | null;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LearningEvidenceSchema = new Schema<ILearningEvidence>(
  {
    evidenceId: { type: String, required: true, unique: true, index: true },
    evidenceVersion: { type: String, required: true, default: '1.0.0' },
    userId: { type: String, required: true, index: true },
    attemptId: { type: String, required: true, index: true },
    activity: {
      courseId: { type: String, required: true, index: true },
      revisionId: { type: String, required: true },
      contentHash: { type: String, required: true },
      activityId: { type: String, required: true, index: true },
      activityRevision: { type: String, required: true },
      activityType: {
        type: String,
        required: true,
        enum: ['InteractiveQuiz', 'GuidedProblem']
      }
    },
    objectiveId: { type: String, required: true, index: true },
    status: { type: String, required: true, default: 'accepted', enum: ['accepted'] },
    bloomLevel: { type: String, required: true },
    score: { type: Number, required: true, min: 0, max: 1 },
    masteryAchieved: { type: Boolean, required: true },
    evaluator: {
      type: {
        type: String,
        required: true,
        enum: ['deterministic_rubric', 'llm_evaluation']
      },
      model: { type: String, default: null },
      validationVersion: { type: String, required: true, default: '1.0.0' },
      executionMode: {
        type: String,
        required: true,
        enum: ['REAL_APPROVED', 'MOCK_TEST', 'DETERMINISTIC_FALLBACK']
      }
    },
    rewardReference: {
      rewardCandidateId: { type: String },
      policyVersion: { type: String },
      eventKey: { type: String },
      finalAwardId: { type: String, default: null }
    },
    timestamp: { type: Date, required: true, default: Date.now }
  },
  {
    timestamps: true,
    collection: 'learning_evidences'
  }
);

// Target unique index: (userId, attemptId) ensures exactly one accepted evidence per attempt
LearningEvidenceSchema.index({ userId: 1, attemptId: 1 }, { unique: true });

// Learner competency aggregation index
LearningEvidenceSchema.index({ userId: 1, objectiveId: 1, masteryAchieved: 1 });

export const LearningEvidence: Model<ILearningEvidence> =
  mongoose.models.LearningEvidence ||
  mongoose.model<ILearningEvidence>('LearningEvidence', LearningEvidenceSchema);
