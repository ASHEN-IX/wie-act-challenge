import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IDataPoint {
  timestamp: Date;
  focusLevel: number;
  isDistracted: boolean;
  gazeData?: {
    x?: number;
    y?: number;
  };
}

export interface IFocusSummary {
  totalFocusTime?: number;
  totalDistractedTime?: number;
  avgFocusLevel?: number;
  breakCount?: number;
}

export interface IFocusSession extends Document {
  userId: string;
  studySessionId?: string;
  startTime: Date;
  endTime?: Date;
  focusScore?: number;
  dataPoints: IDataPoint[];
  summary?: IFocusSummary;
  createdAt: Date;
  updatedAt: Date;
}

const focusSessionSchema = new Schema<IFocusSession>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    studySessionId: {
      type: String
    },
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date
    },
    focusScore: {
      type: Number,
      min: 0,
      max: 100
    },
    dataPoints: [
      {
        timestamp: Date,
        focusLevel: Number,
        isDistracted: Boolean,
        gazeData: {
          x: Number,
          y: Number
        }
      }
    ],
    summary: {
      totalFocusTime: Number,
      totalDistractedTime: Number,
      avgFocusLevel: Number,
      breakCount: Number
    }
  },
  {
    timestamps: true
  }
);

focusSessionSchema.index({ userId: 1, startTime: -1 });

const FocusSession: Model<IFocusSession> =
  mongoose.models.FocusSession || mongoose.model<IFocusSession>('FocusSession', focusSessionSchema);

module.exports = FocusSession;
export default FocusSession;
