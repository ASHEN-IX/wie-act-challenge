import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ISeasonResultSnapshot extends Document {
  seasonId: mongoose.Types.ObjectId;
  userId: string;
  position: number | null;
  finalRankIndex: number;
  finalKnowledgePoints: number;
  finalRankName: string;
  seasonPeakKp: number | null;
  seasonPeakRankIndex: number | null;
  eventsCount: number;
  rewardsGranted: string[];
  resetApplied: {
    demotedBy: number;
    newRankIndex: number;
    newRankName: string | null;
    seasonFloorIndex: number;
  };
  snapshotAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const seasonResultSnapshotSchema = new Schema<ISeasonResultSnapshot>(
  {
    seasonId: {
      type: Schema.Types.ObjectId,
      ref: 'RankSeason',
      required: true,
      index: true
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    position: {
      type: Number,
      min: 1,
      default: null
    },
    finalRankIndex: {
      type: Number,
      required: true
    },
    finalKnowledgePoints: {
      type: Number,
      required: true,
      default: 0
    },
    // Compatibility alias (legacy RP naming).
    finalRankName: {
      type: String,
      required: true
    },
    seasonPeakKp: {
      type: Number,
      default: null
    },
    seasonPeakRankIndex: {
      type: Number,
      default: null
    },
    eventsCount: {
      type: Number,
      default: 0
    },
    rewardsGranted: {
      type: [String],
      default: []
    },
    resetApplied: {
      demotedBy: { type: Number, default: 0 },
      newRankIndex: { type: Number, default: 0 },
      newRankName: { type: String, default: null },
      seasonFloorIndex: { type: Number, default: 0 }
    },
    snapshotAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

seasonResultSnapshotSchema.pre('save', function normalizePoints(next) {
  if (!Number.isFinite(this.finalKnowledgePoints)) {
    this.finalKnowledgePoints = 0;
  }
  if (!Number.isFinite(this.seasonPeakKp)) {
    this.seasonPeakKp = null;
  }
  next();
});

seasonResultSnapshotSchema.index({ seasonId: 1, userId: 1 }, { unique: true });

const SeasonResultSnapshot =
  (mongoose.models.SeasonResultSnapshot as Model<ISeasonResultSnapshot>) ||
  mongoose.model<ISeasonResultSnapshot>('SeasonResultSnapshot', seasonResultSnapshotSchema);

export default SeasonResultSnapshot;
module.exports = SeasonResultSnapshot;
