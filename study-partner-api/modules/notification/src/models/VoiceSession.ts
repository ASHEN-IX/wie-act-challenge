import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IParticipant {
  userId: string;
  peerId?: string;
  joinedAt: Date;
  leftAt?: Date | null;
  isMuted: boolean;
  speakingStatus: 'silent' | 'speaking' | 'loud';
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'failed';
  speakingTime: number;
  mutedDuration: number;
  lastHeartbeat: Date;
}

export interface IVoiceSession extends Document {
  sessionId: string;
  startedAt: Date;
  endedAt?: Date | null;
  isActive: boolean;
  recordingUrl?: string | null;
  participants: IParticipant[];
  createdAt: Date;
  updatedAt: Date;
}

const participantSchema = new Schema<IParticipant>(
  {
    userId: { type: String, required: true },
    peerId: { type: String, default: '' },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date, default: null },
    isMuted: { type: Boolean, default: false },
    speakingStatus: {
      type: String,
      enum: ['silent', 'speaking', 'loud'],
      default: 'silent'
    },
    connectionState: {
      type: String,
      enum: ['connecting', 'connected', 'disconnected', 'failed'],
      default: 'connecting'
    },
    speakingTime: { type: Number, default: 0 },
    mutedDuration: { type: Number, default: 0 },
    lastHeartbeat: { type: Date, default: Date.now }
  },
  { _id: false }
);

const voiceSessionSchema = new Schema<IVoiceSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    recordingUrl: { type: String, default: null },
    participants: {
      type: [participantSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

const VoiceSession: Model<IVoiceSession> = mongoose.model<IVoiceSession>(
  'VoiceSession',
  voiceSessionSchema
);
export default VoiceSession;
