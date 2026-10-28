import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IStudentAttempt extends Document {
  userId: string;
  attemptId: string;
  courseId: string;
  revisionId: string;
  contentHash: string;
  activityId: string;
  activityRevision: string;
  activityType: 'InteractiveQuiz' | 'GuidedProblem';
  roomId?: string | null;
  timeSpentSeconds: number;
  answers: Record<string, unknown>;
  payloadHash: string;
  status: 'in_progress' | 'submitted' | 'graded';
  submittedAt: Date;
  assessmentResult?: Record<string, unknown> | null;
  evidenceId?: string | null;
  protocolVersion?: number;
  processingState?: 'claimed' | 'prepared' | 'completed';
  submission?: Record<string, unknown>;
  preparedEvidence?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const StudentAttemptSchema = new Schema<IStudentAttempt>(
  {
    userId: { type: String, required: true, index: true },
    attemptId: { type: String, required: true, index: true },
    courseId: { type: String, required: true, index: true },
    revisionId: { type: String, required: true },
    contentHash: { type: String, required: true },
    activityId: { type: String, required: true, index: true },
    activityRevision: { type: String, required: true },
    activityType: {
      type: String,
      required: true,
      enum: ['InteractiveQuiz', 'GuidedProblem']
    },
    roomId: { type: String, default: null },
    timeSpentSeconds: { type: Number, required: true, min: 0, max: 86400 },
    answers: { type: Schema.Types.Mixed, required: true },
    payloadHash: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ['in_progress', 'submitted', 'graded'],
      default: 'submitted'
    },
    submittedAt: { type: Date, required: true, default: Date.now },
    assessmentResult: { type: Schema.Types.Mixed, default: null },
    evidenceId: { type: String, default: null },
    protocolVersion: { type: Number },
    processingState: { type: String, enum: ['claimed', 'prepared', 'completed'] },
    submission: { type: Schema.Types.Mixed },
    preparedEvidence: { type: Schema.Types.Mixed, default: null }
  },
  {
    timestamps: true,
    collection: 'student_attempts'
  }
);

// Target unique index: (userId, attemptId) composite identity (ED-29 / Contract 05)
StudentAttemptSchema.index({ userId: 1, attemptId: 1 }, { unique: true });

// Retrieval by course and activity
StudentAttemptSchema.index({ courseId: 1, revisionId: 1, activityId: 1, userId: 1 });

export const StudentAttempt: Model<IStudentAttempt> =
  mongoose.models.StudentAttempt ||
  mongoose.model<IStudentAttempt>('StudentAttempt', StudentAttemptSchema);
