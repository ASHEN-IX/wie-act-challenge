import mongoose, { Schema } from 'mongoose';

const schema = new Schema(
  {
    awardId: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    completionKey: { type: String, required: true },
    evidenceId: { type: String, required: true },
    policyVersion: { type: String, required: true },
    status: { type: String, enum: ['pending', 'applied'], required: true },
    xp: { type: Number, min: 0 },
    reason: String,
    appliedAt: Date
  },
  { timestamps: true, collection: 'learning_reward_ledger' }
);
schema.index({ userId: 1, completionKey: 1 }, { unique: true });
export const LearningRewardLedger =
  mongoose.models.LearningRewardLedger || mongoose.model('LearningRewardLedger', schema);
