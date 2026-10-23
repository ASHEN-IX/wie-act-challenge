import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IRefreshToken {
  tokenHash: string;
  jti: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface INotificationPreferences {
  emailOnVerification: boolean;
  emailOnLevelUp: boolean;
  emailOnTaskDue: boolean;
  emailOnSessionReminder: boolean;
  emailOnWeeklySummary: boolean;
  emailOnAchievement: boolean;
  emailOnPasswordReset: boolean;
  emailOnSubscriptionUpdate: boolean;
}

export interface IOnboardingDraft {
  studyGoals: string[];
  preferredSubjects: string[];
  weeklyHours: number;
  studyLevel: 'beginner' | 'intermediate' | 'advanced';
  studyTime: 'morning' | 'afternoon' | 'evening' | 'night';
  timezone: string;
  language: string;
  notificationPreferences: {
    email: boolean;
    push: boolean;
  };
}

export interface IUser extends Document {
  appliedCheckoutSessionIds: string[];
  appliedCouponIds: string[];
  entitlementPurchasedAt?: Date;
  email: string;
  password?: string;
  name: string;
  role: 'student' | 'admin';
  isAdmin: boolean;
  isActive: boolean;
  isVerified: boolean;
  refreshTokens: IRefreshToken[];
  lastLogin?: Date;
  tier: 'trial' | 'normal' | 'vip' | 'vip_plus';
  trialStartedAt?: Date;
  trialExpiresAt?: Date;
  tierChangedAt?: Date;
  subscriptionId?: string | null;
  subscriptionStartAt?: Date | null;
  subscriptionEndAt?: Date | null;
  subscriptionDurationMonths: number;
  autoRenew: boolean;
  renewalDate?: Date | null;
  canChangeAfter?: Date | null;
  subscriptionExpiryNoticeSentAt?: Date | null;
  stripeCustomerId?: string;
  verificationToken?: string;
  verificationExpires?: Date;
  verificationOtp?: string;
  verificationOtpExpires?: Date;
  verificationOtpAttempts: number;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  notificationPreferences: INotificationPreferences;
  onboardingDraft: IOnboardingDraft;
  onboardingCompletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    appliedCheckoutSessionIds: { type: [String], default: [], select: false },
    appliedCouponIds: { type: [String], default: [], select: false },
    entitlementPurchasedAt: { type: Date },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: { type: String, select: false },
    name: {
      type: String,
      required: true,
      trim: true
    },
    role: {
      type: String,
      enum: ['student', 'admin'],
      default: 'student'
    },
    isAdmin: {
      type: Boolean,
      default: false,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    refreshTokens: [
      {
        tokenHash: {
          type: String,
          required: true
        },
        jti: {
          type: String,
          required: true
        },
        createdAt: {
          type: Date,
          default: Date.now
        },
        expiresAt: {
          type: Date,
          required: true
        }
      }
    ],
    lastLogin: {
      type: Date
    },
    tier: {
      type: String,
      enum: ['trial', 'normal', 'vip', 'vip_plus'],
      default: 'trial'
    },
    trialStartedAt: {
      type: Date,
      default: Date.now
    },
    trialExpiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
    },
    tierChangedAt: {
      type: Date
    },
    subscriptionId: {
      type: String
    },
    subscriptionStartAt: {
      type: Date,
      default: null
    },
    subscriptionEndAt: {
      type: Date,
      default: null,
      index: true
    },
    subscriptionDurationMonths: {
      type: Number,
      default: 0
    },
    autoRenew: {
      type: Boolean,
      default: false
    },
    renewalDate: {
      type: Date,
      default: null
    },
    canChangeAfter: {
      type: Date,
      default: null
    },
    subscriptionExpiryNoticeSentAt: {
      type: Date,
      default: null
    },
    stripeCustomerId: {
      type: String
    },
    verificationToken: { type: String, index: true },
    verificationExpires: { type: Date },
    verificationOtp: { type: String },
    verificationOtpExpires: { type: Date },
    verificationOtpAttempts: { type: Number, default: 0 },
    resetPasswordToken: { type: String, index: true },
    resetPasswordExpires: { type: Date },
    notificationPreferences: {
      type: {
        emailOnVerification: { type: Boolean, default: true },
        emailOnLevelUp: { type: Boolean, default: true },
        emailOnTaskDue: { type: Boolean, default: false },
        emailOnSessionReminder: { type: Boolean, default: false },
        emailOnWeeklySummary: { type: Boolean, default: true },
        emailOnAchievement: { type: Boolean, default: true },
        emailOnPasswordReset: { type: Boolean, default: true },
        emailOnSubscriptionUpdate: { type: Boolean, default: true }
      },
      default: () => ({
        emailOnVerification: true,
        emailOnLevelUp: true,
        emailOnTaskDue: false,
        emailOnSessionReminder: false,
        emailOnWeeklySummary: true,
        emailOnAchievement: true,
        emailOnPasswordReset: true,
        emailOnSubscriptionUpdate: true
      })
    },
    onboardingDraft: {
      studyGoals: {
        type: [String],
        default: []
      },
      preferredSubjects: {
        type: [String],
        default: []
      },
      weeklyHours: {
        type: Number,
        min: 0,
        default: 0
      },
      studyLevel: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'beginner'
      },
      studyTime: {
        type: String,
        enum: ['morning', 'afternoon', 'evening', 'night'],
        default: 'evening'
      },
      timezone: {
        type: String,
        default: 'UTC'
      },
      language: {
        type: String,
        default: 'en'
      },
      notificationPreferences: {
        email: {
          type: Boolean,
          default: true
        },
        push: {
          type: Boolean,
          default: true
        }
      }
    },
    onboardingCompletedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

userSchema.methods.toJSON = function (this: IUser) {
  const user: Partial<IUser> = this.toObject();
  delete user.password;
  delete user.refreshTokens;
  delete user.verificationToken;
  delete user.verificationExpires;
  delete user.verificationOtp;
  delete user.verificationOtpExpires;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpires;
  return user;
};

const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);
export default User;
