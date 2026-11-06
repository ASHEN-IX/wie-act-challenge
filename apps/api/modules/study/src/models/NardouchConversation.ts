import mongoose, { Schema } from 'mongoose';
import type {
  LearningMode,
  LanguagePreference,
  NardouchMessage
} from '../../../../shared/ednova/nardouch';
export interface ConversationRecord {
  userId: string;
  courseId: string;
  revisionId: string;
  contentHash: string;
  mode: LearningMode;
  language: LanguagePreference;
  version: number;
  messages: NardouchMessage[];
  lockToken?: string;
  lockedUntil?: Date;
  feedback: Array<{ messageId: string; helpful: boolean; comment: string }>;
  expiresAt: Date;
}
const schema = new Schema<ConversationRecord>(
  {
    userId: { type: String, required: true, index: true },
    courseId: { type: String, required: true },
    revisionId: { type: String, required: true },
    contentHash: { type: String, required: true },
    mode: { type: String, required: true },
    language: { type: Schema.Types.Mixed, required: true },
    version: { type: Number, default: 0 },
    messages: {
      type: [
        new Schema<NardouchMessage>(
          { id: String, role: String, content: String, answer: Schema.Types.Mixed },
          { _id: false }
        )
      ],
      default: []
    },
    lockToken: String,
    lockedUntil: Date,
    feedback: {
      type: [new Schema({ messageId: String, helpful: Boolean, comment: String }, { _id: false })],
      default: []
    },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const NardouchConversationModel = mongoose.model<ConversationRecord>(
  'NardouchConversation',
  schema
);
