import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IAnalyticsEvent extends Document {
  userId: string;
  eventType:
    | 'study_session_started'
    | 'study_session_completed'
    | 'task_created'
    | 'task_completed'
    | 'course_ingested'
    | 'plan_generated'
    | 'focus_tracked'
    | 'login'
    | 'profile_updated';
  metadata?: Record<string, unknown> & { duration?: number };
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const analyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        'study_session_started',
        'study_session_completed',
        'task_created',
        'task_completed',
        'course_ingested',
        'plan_generated',
        'focus_tracked',
        'login',
        'profile_updated'
      ]
    },
    metadata: {
      type: Schema.Types.Mixed
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'analytics_events'
  }
);

// Index for efficient time-based queries
analyticsEventSchema.index({ userId: 1, timestamp: -1 });
analyticsEventSchema.index({ eventType: 1, timestamp: -1 });
analyticsEventSchema.index({ userId: 1, eventType: 1, timestamp: -1 });

const AnalyticsEvent: Model<IAnalyticsEvent> =
  mongoose.models.AnalyticsEvent ||
  mongoose.model<IAnalyticsEvent>('AnalyticsEvent', analyticsEventSchema);

module.exports = AnalyticsEvent;
export default AnalyticsEvent;
