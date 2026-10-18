import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IRankBadge extends Document {
  rankIndex: number;
  rankName: string;
  tier: string;
  division: string | null;
  badgeKey: 'first' | 'second' | 'third' | 'use';
  imagePath: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const rankBadgeSchema = new Schema<IRankBadge>(
  {
    rankIndex: {
      type: Number,
      required: true,
      unique: true,
      index: true,
      min: 0
    },
    rankName: {
      type: String,
      required: true,
      trim: true
    },
    tier: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    division: {
      type: String,
      default: null
    },
    badgeKey: {
      type: String,
      required: true,
      enum: ['first', 'second', 'third', 'use']
    },
    imagePath: {
      type: String,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

const RankBadge =
  (mongoose.models.RankBadge as Model<IRankBadge>) ||
  mongoose.model<IRankBadge>('RankBadge', rankBadgeSchema);

export default RankBadge;
module.exports = RankBadge;
