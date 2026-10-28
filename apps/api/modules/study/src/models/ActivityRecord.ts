import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IActivityRecord extends Document {
  courseId: string;
  revisionId: string;
  contentHash: string;
  activityId: string;
  activityRevision: string;
  activityType: 'InteractiveQuiz' | 'GuidedProblem';
  objectiveId: string;
  publicDefinition: Record<string, unknown>;
  serverEvaluation: {
    schemaVersion: string;
    visibility: 'server_only';
    activity: {
      courseId: string;
      revisionId: string;
      contentHash: string;
      activityId: string;
      activityRevision: string;
      activityType: 'InteractiveQuiz' | 'GuidedProblem';
    };
    evaluationRef: string;
    evaluatorType: 'deterministic_rubric' | 'llm_evaluation';
    rubricVersion: string;
    rubric: string;
    answerKey: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const ActivityRecordSchema = new Schema<IActivityRecord>(
  {
    courseId: { type: String, required: true, index: true },
    revisionId: { type: String, required: true, index: true },
    contentHash: { type: String, required: true },
    activityId: { type: String, required: true, index: true },
    activityRevision: { type: String, required: true },
    activityType: {
      type: String,
      required: true,
      enum: ['InteractiveQuiz', 'GuidedProblem']
    },
    objectiveId: { type: String, required: true, index: true },
    publicDefinition: { type: Schema.Types.Mixed, required: true },
    serverEvaluation: { type: Schema.Types.Mixed, required: true }
  },
  {
    timestamps: true,
    collection: 'activity_records'
  }
);

// Unique composite index: exactly one activity per (courseId, revisionId, activityId)
ActivityRecordSchema.index({ courseId: 1, revisionId: 1, activityId: 1 }, { unique: true });

export const ActivityRecord: Model<IActivityRecord> =
  mongoose.models.ActivityRecord ||
  mongoose.model<IActivityRecord>('ActivityRecord', ActivityRecordSchema);
