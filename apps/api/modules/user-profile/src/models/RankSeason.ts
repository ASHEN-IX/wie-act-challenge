import mongoose, { Document, Model, Schema } from 'mongoose';
import { DEFAULT_SEASON_FLOOR_INDEX } from './rankingConfig';

export type RankSeasonStatus = 'upcoming' | 'active' | 'closed' | 'archived';

export interface IRankSeason extends Document {
  seasonCode: string;
  name: string;
  theme: string | null;
  startAt: Date;
  endAt: Date | null;
  status: RankSeasonStatus;
  resetPolicy: {
    lowBracketDrop: number;
    highBracketDrop: number;
    seasonFloorIndex: number;
  };
  startedBy: string | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRankSeasonModel extends Model<IRankSeason> {
  getActiveSeason(at?: Date): Promise<IRankSeason | null>;
}

const rankSeasonSchema = new Schema<IRankSeason, IRankSeasonModel>(
  {
    seasonCode: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    name: {
      type: String,
      required: true
    },
    theme: {
      type: String,
      default: null
    },
    startAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    endAt: {
      type: Date,
      default: null,
      index: true
    },
    status: {
      type: String,
      enum: ['upcoming', 'active', 'closed', 'archived'],
      default: 'active',
      index: true
    },
    resetPolicy: {
      lowBracketDrop: {
        type: Number,
        min: 0,
        max: 10,
        default: 3
      },
      highBracketDrop: {
        type: Number,
        min: 0,
        max: 10,
        default: 5
      },
      seasonFloorIndex: {
        type: Number,
        min: 0,
        default: DEFAULT_SEASON_FLOOR_INDEX
      }
    },
    startedBy: {
      type: String,
      default: null
    },
    closedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

rankSeasonSchema.statics.getActiveSeason = async function getActiveSeason(at: Date = new Date()) {
  return this.findOne({
    status: 'active',
    startAt: { $lte: at },
    $or: [{ endAt: null }, { endAt: { $gt: at } }]
  })
    .sort({ startAt: -1 })
    .lean(false);
};

const RankSeason =
  (mongoose.models.RankSeason as IRankSeasonModel) ||
  mongoose.model<IRankSeason, IRankSeasonModel>('RankSeason', rankSeasonSchema);

export default RankSeason;
module.exports = RankSeason;
