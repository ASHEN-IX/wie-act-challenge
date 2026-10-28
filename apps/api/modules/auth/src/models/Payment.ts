import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IPayment extends Document {
  userId: Types.ObjectId;
  stripeEventId?: string;
  stripeCheckoutSessionId?: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  tier: 'normal' | 'vip' | 'vip_plus';
  durationMonths: number;
  monthlyPriceCents?: number | null;
  discountPercentage: number;
  status: 'pending' | 'succeeded' | 'failed' | 'canceled';
  amount?: number;
  currency: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    stripeEventId: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    stripeCheckoutSessionId: {
      type: String,
      index: true,
      unique: true,
      sparse: true
    },
    stripeSubscriptionId: {
      type: String,
      index: true
    },
    stripeCustomerId: {
      type: String,
      index: true
    },
    tier: {
      type: String,
      enum: ['normal', 'vip', 'vip_plus'],
      required: true
    },
    durationMonths: {
      type: Number,
      default: 1
    },
    monthlyPriceCents: {
      type: Number,
      default: null
    },
    discountPercentage: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'canceled'],
      default: 'pending',
      index: true
    },
    amount: {
      type: Number
    },
    currency: {
      type: String,
      default: 'usd'
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

paymentSchema.index({ status: 1, createdAt: -1 });

const Payment: Model<IPayment> = mongoose.model<IPayment>('Payment', paymentSchema);
export default Payment;
