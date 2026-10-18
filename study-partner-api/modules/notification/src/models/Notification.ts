import mongoose, { Document, Model, Schema } from 'mongoose';

export type NotificationType =
  | 'study_reminder'
  | 'break_suggestion'
  | 'plan_generated'
  | 'task_due'
  | 'session_suspended'
  | 'fatigue_alert'
  | 'focus_drop'
  | 'achievement'
  | 'level_up'
  | 'quest_complete'
  | 'schedule_change'
  | 'system'
  | 'friend_request'
  | 'friend_accepted'
  | 'team_invite'
  | 'team_join'
  | 'friend_studying'
  | 'session_start';

export type NotificationStatus = 'unread' | 'read' | 'dismissed';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface INotification extends Document {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  status: NotificationStatus;
  priority: NotificationPriority;
  metadata: Record<string, any>;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    type: {
      type: String,
      required: true,
      enum: [
        'study_reminder',
        'break_suggestion',
        'plan_generated',
        'task_due',
        'session_suspended',
        'fatigue_alert',
        'focus_drop',
        'achievement',
        'level_up',
        'quest_complete',
        'schedule_change',
        'system',
        'friend_request',
        'friend_accepted',
        'team_invite',
        'team_join',
        'friend_studying',
        'session_start'
      ]
    },
    title: {
      type: String,
      required: true,
      maxlength: 200
    },
    message: {
      type: String,
      required: true,
      maxlength: 2000
    },
    status: {
      type: String,
      enum: ['unread', 'read', 'dismissed'],
      default: 'unread',
      index: true
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal'
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    readAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

notificationSchema.index({ userId: 1, status: 1, createdAt: -1 });

notificationSchema.index(
  { updatedAt: 1 },
  {
    expireAfterSeconds: 30 * 24 * 60 * 60,
    partialFilterExpression: { status: 'dismissed' }
  }
);

const Notification: Model<INotification> = mongoose.model<INotification>(
  'Notification',
  notificationSchema
);
export default Notification;
