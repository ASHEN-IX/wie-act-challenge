import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ISearchResult {
  title?: string;
  snippet?: string;
  source?: string;
  url?: string;
  relevanceScore?: number;
}

export interface ISessionChat extends Document {
  sessionId: string;
  userId: string;
  messageType: 'query' | 'result' | 'coach_suggestion';
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
      enum: ['query', 'result', 'coach_suggestion'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
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

const SessionChat: Model<ISessionChat> = mongoose.model<ISessionChat>(
  'SessionChat',
  sessionChatSchema
);
export default SessionChat;
