import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface ICouponUsageHistory {
  userId: Types.ObjectId;
  redeemedAt: Date;
}

export interface ICoupon extends Document {
  code: string;
  targetTier: 'trial' | 'normal' | 'vip' | 'vip_plus';
  durationDays: number;
  createdBy: Types.ObjectId | null;
  expiresAt: Date | null;
  isActive: boolean;
  maxUses: number;
  usageCount: number;
  usedBy: Types.ObjectId[];
  usageHistory: ICouponUsageHistory[];
  createdAt: Date;
  updatedAt: Date;
  isRedeemableBy(userId: Types.ObjectId | string): { redeemable: boolean; reason?: string };
}

const couponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    targetTier: {
      type: String,
      enum: ['trial', 'normal', 'vip', 'vip_plus'],
      required: true,
      index: true
    },
    durationDays: {
      type: Number,
      min: 1,
      max: Number(process.env.COUPON_MAX_DURATION || 365),
      default: 30
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    maxUses: {
      type: Number,
      default: 1
    },
    usageCount: {
      type: Number,
      default: 0
    },
    usedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    usageHistory: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        redeemedAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

couponSchema.methods.isRedeemableBy = function isRedeemableBy(
  this: ICoupon,
  userId: Types.ObjectId | string
) {
  if (!this.isActive) {
    return { redeemable: false, reason: 'Coupon is inactive' };
  }

  if (this.expiresAt && new Date(this.expiresAt) <= new Date()) {
    return { redeemable: false, reason: 'Coupon has expired' };
  }

  if (this.maxUses !== -1 && this.usageCount >= this.maxUses) {
    return { redeemable: false, reason: 'Coupon usage limit reached' };
  }

  if (this.usedBy.some((id) => String(id) === String(userId))) {
    return { redeemable: false, reason: 'Coupon already used by this user' };
  }

  return { redeemable: true };
};

const Coupon: Model<ICoupon> = mongoose.model<ICoupon>('Coupon', couponSchema);
export default Coupon;
