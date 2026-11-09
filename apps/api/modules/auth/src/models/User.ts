import type { Prisma, User as UserRow } from '../../../../src/generated/prisma/client';
import { prisma, toDocument, toDocumentOrNull } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';

/**
 * Domain user. The Mongo collection `users` is now the `users` table; helpers
 * here keep the field names, the defaults and the `toJSON` redaction the rest
 * of the auth module already relies on.
 */
export type IUser = UserRow & {
  id: string;
  /** Prisma surfaces this as a relation; the API used to read it inline. */
  refreshTokens?: RefreshTokenRow[];
};

export interface RefreshTokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  jti: string;
  createdAt: Date;
  expiresAt: Date;
}

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
  notificationPreferences: { email: boolean; push: boolean };
}

/** Fields a caller may never receive. Applied everywhere a user is serialized. */
const REDACTED = [
  'password',
  'refreshTokens',
  'verificationToken',
  'verificationExpires',
  'verificationOtp',
  'verificationOtpExpires',
  'resetPasswordToken',
  'resetPasswordExpires'
] as const;

export function redactUser<T extends Record<string, unknown>>(user: T): Omit<T, 'password'> {
  const copy: Record<string, unknown> = { ...user };
  for (const field of REDACTED) delete copy[field];
  return copy as Omit<T, 'password'>;
}

type UserWithTokens = UserRow & { refreshTokens?: RefreshTokenRow[] };

function hydrate(row: UserWithTokens): IUser {
  return { ...toDocument(row), refreshTokens: row.refreshTokens } as IUser;
}

/** Columns that are JSON documents at rest. Prisma types them as `JsonValue`. */
function jsonColumn<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

export const User = {
  async findById(id: string): Promise<IUser | null> {
    const row = await prisma.user.findUnique({ where: { id }, include: { refreshTokens: true } });
    return row ? hydrate(row) : null;
  },

  async findOne(where: Partial<Record<keyof UserRow, unknown>>): Promise<IUser | null> {
    const row = await prisma.user.findFirst({
      where: where as Prisma.UserWhereInput,
      include: { refreshTokens: true }
    });
    return row ? hydrate(row) : null;
  },

  async countDocuments(where: Prisma.UserWhereInput = {}): Promise<number> {
    return prisma.user.count({ where });
  },

  async create(data: Prisma.UserUncheckedCreateInput): Promise<IUser> {
    const row = await prisma.user.create({
      data: { ...data, id: data.id ?? newId() },
      include: { refreshTokens: true }
    });
    return hydrate(row);
  },

  async updateOne(
    where: Prisma.UserWhereInput,
    data: Prisma.UserUpdateInput
  ): Promise<{ matchedCount: number }> {
    const result = await prisma.user.updateMany({ where, data });
    return { matchedCount: result.count };
  },

  async findByIdAndUpdate(
    id: string,
    data: Prisma.UserUpdateInput,
    { new: returnNew = false }: { new?: boolean } = {}
  ): Promise<IUser | null> {
    if (returnNew) {
      const row = await prisma.user
        .update({ where: { id }, data, include: { refreshTokens: true } })
        .catch(() => null);
      return row ? hydrate(row) : null;
    }
    const result = await prisma.user.updateMany({ where: { id }, data });
    if (result.count === 0) return null;
    return User.findById(id);
  },

  async findOneAndUpdate(
    where: Prisma.UserWhereInput,
    data: Prisma.UserUpdateInput,
    { new: returnNew = false }: { new?: boolean } = {}
  ): Promise<IUser | null> {
    const existing = await prisma.user.findFirst({ where, select: { id: true } });
    if (!existing) return null;
    return User.findByIdAndUpdate(existing.id, data, { new: returnNew });
  },

  /** Persist the mutable fields of an in-memory document, like `doc.save()`. */
  async save(user: IUser): Promise<IUser> {
    const {
      id,
      email,
      password,
      name,
      role,
      isAdmin,
      isActive,
      isVerified,
      lastLogin,
      tier,
      trialStartedAt,
      trialExpiresAt,
      tierChangedAt,
      subscriptionId,
      subscriptionStartAt,
      subscriptionEndAt,
      subscriptionDurationMonths,
      autoRenew,
      renewalDate,
      canChangeAfter,
      subscriptionExpiryNoticeSentAt,
      entitlementPurchasedAt,
      stripeCustomerId,
      verificationToken,
      verificationExpires,
      verificationOtp,
      verificationOtpExpires,
      verificationOtpAttempts,
      resetPasswordToken,
      resetPasswordExpires,
      onboardingCompletedAt,
      appliedCheckoutSessionIds,
      appliedCouponIds,
      notificationPreferences,
      onboardingDraft
    } = user;
    const row = await prisma.user.update({
      where: { id },
      data: {
        email,
        password,
        name,
        role,
        isAdmin,
        isActive,
        isVerified,
        lastLogin,
        tier,
        trialStartedAt,
        trialExpiresAt,
        tierChangedAt,
        subscriptionId,
        subscriptionStartAt,
        subscriptionEndAt,
        subscriptionDurationMonths,
        autoRenew,
        renewalDate,
        canChangeAfter,
        subscriptionExpiryNoticeSentAt,
        entitlementPurchasedAt,
        stripeCustomerId,
        verificationToken,
        verificationExpires,
        verificationOtp,
        verificationOtpExpires,
        verificationOtpAttempts,
        resetPasswordToken,
        resetPasswordExpires,
        onboardingCompletedAt,
        appliedCheckoutSessionIds,
        appliedCouponIds,
        notificationPreferences: jsonColumn(notificationPreferences),
        onboardingDraft: jsonColumn(onboardingDraft)
      },
      include: { refreshTokens: true }
    });
    return hydrate(row);
  },

  /** Mirrors the removed schema `toJSON` method: never serialize secrets. */
  toJSON(user: IUser) {
    return redactUser(user as unknown as Record<string, unknown>);
  }
};

export { toDocumentOrNull };
export default User;
