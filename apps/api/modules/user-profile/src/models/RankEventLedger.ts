import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IRankEventLedger extends Document {
  userId: string;
  seasonId: mongoose.Types.ObjectId;
  action: string;
  baseKP: number;
  multipliers: {
    difficulty: number;
    performance: number;
    consistency: number;
    comeback: number;
    antiGrind: number;
    total: number;
  };
  finalKP: number;
  deltaKp: number;
  beforeKp: number;
  afterKp: number;
  beforeRankIndex: number;
  afterRankIndex: number;
  rankName: string | null;
  metadata: Record<string, unknown> & {
    sessionId?: string;
    focusSessionId?: string;
    eventId?: string;
  };
  reasonBreakdown: Record<string, unknown>;
  contextSessionId: string | null;
  eventKey: string | null;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const rankEventLedgerSchema = new Schema<IRankEventLedger>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    seasonId: {
      type: Schema.Types.ObjectId,
      ref: 'RankSeason',
      required: true,
      index: true
    },
    action: {
      type: String,
      required: true,
      index: true
    },
    baseKP: {
      type: Number,
      required: true,
      default: 0
    },
    multipliers: {
      difficulty: { type: Number, default: 1 },
      performance: { type: Number, default: 1 },
      consistency: { type: Number, default: 1 },
      comeback: { type: Number, default: 1 },
      antiGrind: { type: Number, default: 1 },
      total: { type: Number, default: 1 }
    },
    finalKP: {
      type: Number,
      required: true,
      default: 0,
      index: true
    },
    deltaKp: {
      type: Number,
      required: true,
      default: 0
    },
    beforeKp: {
      type: Number,
      required: true,
      default: 0
    },
    afterKp: {
      type: Number,
      required: true,
      default: 0
    },
    beforeRankIndex: {
      type: Number,
      required: true,
      default: 0
    },
    afterRankIndex: {
      type: Number,
      required: true,
      default: 0
    },
    rankName: {
      type: String,
      default: null
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    reasonBreakdown: {
      type: Schema.Types.Mixed,
      default: {}
    },
    contextSessionId: {
      type: String,
      default: null,
      index: true
    },
    eventKey: {
      type: String,
      default: null,
      index: true,
      unique: true,
      sparse: true
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

rankEventLedgerSchema.pre('save', function syncCompatibility(next) {
  if (!Number.isFinite(this.deltaKp)) {
    this.deltaKp = Number(this.finalKP || 0);
  }
  if (!Number.isFinite(this.finalKP)) {
    this.finalKP = this.deltaKp;
  }

  if (!Number.isFinite(this.beforeKp)) {
    this.beforeKp = 0;
  }
  if (!Number.isFinite(this.afterKp)) {
    this.afterKp = this.beforeKp + this.deltaKp;
  }

  if (!this.contextSessionId) {
    this.contextSessionId =
      this.metadata?.sessionId || this.metadata?.focusSessionId || this.metadata?.eventId || null;
  }

  next();
});

rankEventLedgerSchema.index({ userId: 1, seasonId: 1, occurredAt: -1 });
rankEventLedgerSchema.index({ userId: 1, seasonId: 1, contextSessionId: 1, occurredAt: -1 });

const RankEventLedger =
  (mongoose.models.RankEventLedger as Model<IRankEventLedger>) ||
  mongoose.model<IRankEventLedger>('RankEventLedger', rankEventLedgerSchema);

export default RankEventLedger;
module.exports = RankEventLedger;
