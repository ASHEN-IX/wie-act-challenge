import type { BinarySearchState } from '../../../../shared/visualization';
import mongoose, { Document, Model, Schema } from 'mongoose';

export type RoomPhase = 'idle' | 'peer_discussion' | 'individual_attempt' | 'debrief';
export type ModeratorMode = 'guided' | 'on_demand' | 'muted';

export interface IStudyRoomParticipant {
  userId: string;
  name: string;
  avatar?: string;
  role: 'host' | 'participant';
  hasVoiceConsent: boolean;
  isOnline: boolean;
  isSpeaking?: boolean;
  hasSubmitted: boolean;
  joinedAt: Date;
  leftAt?: Date;
}

export interface IStudyRoom extends Document {
  createCommandId?: string;
  commandReceipts: IRoomCommandReceipt[];
  roomId: string;
  inviteCode: string; // 6-character alphanumeric, e.g. "DB1NF2"
  courseId?: string;
  revisionId?: string;
  hostUserId: string;
  presenterUserId: string;
  title: string;
  maxParticipants: number;
  moderatorMode: ModeratorMode;
  facilitatorActive?: boolean;
  activeActivityId?: string | null;
  activePin?: {
    courseId: string;
    revisionId: string;
    contentHash: string;
    activityId: string;
    activityRevision: string;
    activityType: string;
  } | null;
  activityRound?: string;
  visualizationState?: BinarySearchState;
  currentPhase: RoomPhase;
  status: 'active' | 'closed';
  seq: number;
  participants: IStudyRoomParticipant[];
  createdAt: Date;
  closedAt?: Date;
}

export interface IRoomCommandReceipt {
  actorId: string;
  commandId: string;
  payloadHash: string;
  status: number;
  response: Record<string, string | number | boolean | null>;
}

const commandReceiptSchema = new Schema<IRoomCommandReceipt>(
  {
    actorId: { type: String, required: true },
    commandId: { type: String, required: true },
    payloadHash: { type: String, required: true },
    status: { type: Number, required: true },
    response: { type: Schema.Types.Mixed, required: true }
  },
  { _id: false }
);

const studyRoomParticipantSchema = new Schema<IStudyRoomParticipant>(
  {
    userId: { type: String, required: true },
    name: { type: String, default: 'Student' },
    avatar: { type: String },
    role: { type: String, enum: ['host', 'participant'], default: 'participant' },
    hasVoiceConsent: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: true },
    isSpeaking: { type: Boolean, default: false },
    hasSubmitted: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date }
  },
  { _id: false }
);

const studyRoomSchema = new Schema<IStudyRoom>(
  {
    createCommandId: { type: String },
    commandReceipts: { type: [commandReceiptSchema], default: [], select: false },
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    inviteCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    courseId: {
      type: String,
      index: true
    },
    revisionId: { type: String },
    activePin: { type: Schema.Types.Mixed, default: null },
    activityRound: String,
    hostUserId: {
      type: String,
      required: true,
      index: true
    },
    presenterUserId: {
      type: String,
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    maxParticipants: {
      type: Number,
      default: 6,
      min: 2,
      max: 10
    },
    moderatorMode: {
      type: String,
      enum: ['guided', 'on_demand', 'muted'],
      default: 'guided'
    },
    facilitatorActive: {
      type: Boolean,
      default: false
    },
    activeActivityId: {
      type: String,
      default: null
    },
    visualizationState: { type: Schema.Types.Mixed },
    currentPhase: {
      type: String,
      enum: ['idle', 'peer_discussion', 'individual_attempt', 'debrief'],
      default: 'idle'
    },
    status: {
      type: String,
      enum: ['active', 'closed'],
      default: 'active',
      index: true
    },
    seq: {
      type: Number,
      default: 1
    },
    participants: [studyRoomParticipantSchema],
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    closedAt: {
      type: Date
    }
  },
  {
    timestamps: false
  }
);

studyRoomSchema.index({ 'participants.userId': 1, status: 1 });
studyRoomSchema.index({ inviteCode: 1, status: 1 });
studyRoomSchema.index({ hostUserId: 1, status: 1 });
studyRoomSchema.index({ courseId: 1, status: 1 });
studyRoomSchema.index(
  { hostUserId: 1, createCommandId: 1 },
  {
    unique: true,
    partialFilterExpression: { createCommandId: { $type: 'string' } },
    name: 'room_creation_command'
  }
);

export const StudyRoom =
  (mongoose.models.StudyRoom as Model<IStudyRoom>) ||
  mongoose.model<IStudyRoom>('StudyRoom', studyRoomSchema, 'study_rooms');

export default StudyRoom;
module.exports = { StudyRoom, default: StudyRoom };
