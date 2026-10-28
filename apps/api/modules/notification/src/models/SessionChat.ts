import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ISearchResult {
  title?: string;
  snippet?: string;
  source?: string;
  url?: string;
  relevanceScore?: number;
}

export interface IPeerMessage {
  roomId: string;
  messageId: string;
  submissionId: string;
  senderUserId: string;
  senderName: string;
  text: string;
  seq: number;
  createdAt: string;
}

export interface ISessionChat extends Document {
  sessionId: string;
  userId: string;
  messageType: 'query' | 'result' | 'coach_suggestion' | 'peer_stream';
  peerSeq: number;
  peerMessages: IPeerMessage[];
  content: string;
  searchQuery: string;
  searchResults: ISearchResult[];
  createdAt: Date;
  updatedAt: Date;
}

const searchResultSchema = new Schema<ISearchResult>(
  {
    title: String,
    snippet: String,
    source: String,
    url: String,
    relevanceScore: Number
  },
  { _id: false }
);

const peerMessageSchema = new Schema<IPeerMessage>(
  {
    roomId: { type: String, required: true },
    messageId: { type: String, required: true },
    submissionId: { type: String, required: true },
    senderUserId: { type: String, required: true },
    senderName: { type: String, required: true },
    text: { type: String, required: true },
    seq: { type: Number, required: true },
    createdAt: { type: String, required: true }
  },
  { _id: false }
);

const sessionChatSchema = new Schema<ISessionChat>(
  {
    sessionId: {
      type: String,
      required: true,
      index: true
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    messageType: {
      type: String,
      enum: ['query', 'result', 'coach_suggestion', 'peer_stream'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    // Bounded peer journal: acceptance, deduplication and ordering share one atomic write.
    peerSeq: { type: Number, default: 0, select: false },
    peerMessages: { type: [peerMessageSchema], default: [], select: false },
    searchQuery: {
      type: String,
      default: ''
    },
    searchResults: {
      type: [searchResultSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

sessionChatSchema.index({ sessionId: 1, createdAt: -1 });
sessionChatSchema.index(
  { sessionId: 1, messageType: 1 },
  {
    unique: true,
    name: 'peer_room_journal',
    partialFilterExpression: { messageType: 'peer_stream' }
  }
);

const SessionChat: Model<ISessionChat> = mongoose.model<ISessionChat>(
  'SessionChat',
  sessionChatSchema
);
export default SessionChat;
