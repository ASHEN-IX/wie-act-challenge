import { Schema, model, models, type Model, type Types } from 'mongoose';
import type { PublishIngestionParams } from '../services/ingestionJob';
import type { AiResultEnvelope } from '@ednova/shared/ai-messaging/envelope';

export interface IngestionOperation {
  _id: string;
  correlationId: string;
  courseId: Types.ObjectId;
  revisionId: string;
  userId: string;
  requestId?: string;
  fileRef: string;
  /** Display-only title captured with this operation for an exact retry/reconcile. */
  courseTitle?: string;
  files: NonNullable<PublishIngestionParams['files']>;
  state: 'prepared' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'superseded';
  result?: Pick<AiResultEnvelope, 'type' | 'correlationId' | 'status' | 'payload' | 'error'>;
  resultApplied?: boolean;
  dispatchCount: number;
  lastDispatchedAt?: Date;
}

/** Server-owned dispatch/recovery record. Never a learner/browser source grant. */
const schema = new Schema<IngestionOperation>(
  {
    _id: { type: String, required: true },
    correlationId: { type: String, required: true, unique: true },
    courseId: { type: Schema.Types.ObjectId, required: true, index: true },
    revisionId: { type: String, required: true },
    userId: { type: String, required: true },
    requestId: String,
    fileRef: { type: String, required: true },
    courseTitle: { type: String, trim: true, maxlength: 150 },
    files: {
      type: [
        new Schema<NonNullable<PublishIngestionParams['files']>[number]>(
          {
            filename: String,
            originalName: String,
            mimetype: String,
            size: Number,
            path: String,
            fileHash: String
          },
          { _id: false }
        )
      ],
      required: true
    },
    state: {
      type: String,
      enum: ['prepared', 'queued', 'processing', 'completed', 'failed', 'cancelled', 'superseded'],
      required: true
    },
    result: { type: Schema.Types.Mixed },
    resultApplied: { type: Boolean, default: false },
    dispatchCount: { type: Number, default: 0 },
    lastDispatchedAt: Date
  },
  { collection: 'course_ingestion_operations', timestamps: true }
);

export const CourseIngestionOperation =
  (models.CourseIngestionOperation as Model<IngestionOperation>) ||
  model<IngestionOperation>('CourseIngestionOperation', schema);
