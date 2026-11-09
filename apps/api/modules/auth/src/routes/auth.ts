import type { DomainRequest } from '../../../../src/framework/contracts';
import type { IUser } from '../models/User';
import { reserveCoupon } from '../services/couponRedemption';
import { createContracts } from '@ednova/shared/domainContracts';
import Joi from 'joi';
import type { Response } from 'express';
import User from '../models/User';
import Coupon from '../models/Coupon';
import { prisma } from '../../../../shared/database';
import { sendSubscriptionExpiryNotice } from '../services/emailService';
import { authenticate } from '@ednova/shared/auth';
import { asyncHandler } from '@ednova/shared/middleware';

const router = createContracts();

const redeemCouponSchema = Joi.object({
  coupon: Joi.string().trim().min(3).max(100).required(),
  expectedTier: Joi.string().valid('vip', 'vip_plus', 'normal', 'trial').optional()
});

// Test coupons (env-var COUPON_CODES) are a DEVELOPMENT-only convenience.
function testCouponsEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.ALLOW_TEST_COUPONS !== 'false';
}

function resolveTestTierFromCoupon(rawCoupon: string): IUser['tier'] | null {
  if (!testCouponsEnabled()) return null;

  const normalized = String(rawCoupon || '')
    .trim()
    .toLowerCase();

  if (!normalized) return null;

  const envCoupons = (process.env.COUPON_CODES || '').split(',');
  for (const entry of envCoupons) {
    const [code, tier] = entry.split(':').map((v) =>
      String(v || '')
        .trim()
        .toLowerCase()
    );
    if (!code || !tier) continue;
    if (
      normalized === code &&
      (tier === 'trial' || tier === 'normal' || tier === 'vip' || tier === 'vip_plus')
    ) {
      return tier;
    }
  }

  return null;
}

function getSubscriptionSnapshot(user: Pick<IUser, 'subscriptionEndAt' | 'tier'>) {
  const now = new Date();
  const endDate = user.subscriptionEndAt ? new Date(user.subscriptionEndAt) : null;
  const hasActiveSubscription =
    !!endDate && endDate > now && ['vip', 'vip_plus'].includes(user.tier);

  const daysRemaining = hasActiveSubscription
    ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const canChangePlan = hasActiveSubscription ? daysRemaining <= 5 : true;
  const daysUntilCanChange = hasActiveSubscription ? Math.max(0, daysRemaining - 5) : 0;

  return {
    hasActiveSubscription,
    daysRemaining,
    canChangePlan,
    daysUntilCanChange
  };
}

function withSubscriptionMeta(user: IUser) {
  const safeUser = User.toJSON(user) as IUser;
  return {
    ...safeUser,
    ...getSubscriptionSnapshot(safeUser)
  };
}

// Get current user (protected route)
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: DomainRequest, res: Response) => {
    const user = await User.findById(req.user!.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Auto-downgrade expired trials
    if (
      user.tier === 'trial' &&
      user.trialExpiresAt &&
      new Date(user.trialExpiresAt) < new Date()
    ) {
      user.tier = 'normal';
      user.tierChangedAt = new Date();
      await User.save(user);
    }

    if (
      ['vip', 'vip_plus'].includes(user.tier) &&
      user.subscriptionEndAt &&
      new Date(user.subscriptionEndAt) <= new Date()
    ) {
      user.tier = 'normal';
      user.tierChangedAt = new Date();
      user.subscriptionId = null;
      user.subscriptionStartAt = null;
      user.subscriptionEndAt = null;
      user.subscriptionDurationMonths = 0;
      user.renewalDate = null;
      user.canChangeAfter = null;
      user.autoRenew = false;
      await User.save(user);
    }

    const snapshot = getSubscriptionSnapshot(user);
    if (
      snapshot.hasActiveSubscription &&
      snapshot.daysRemaining <= 5 &&
      ['vip', 'vip_plus'].includes(user.tier)
    ) {
      const lastNoticeAt = user.subscriptionExpiryNoticeSentAt
        ? new Date(user.subscriptionExpiryNoticeSentAt)
        : null;
      const shouldSendNotice =
        !lastNoticeAt || Date.now() - lastNoticeAt.getTime() > 24 * 60 * 60 * 1000;

      if (shouldSendNotice) {
        sendSubscriptionExpiryNotice(user.email, {
          tier: user.tier,
          endDate: user.subscriptionEndAt,
          daysRemaining: snapshot.daysRemaining
        }).catch((err: Error) => {
          console.warn('Failed to send subscription expiry reminder:', err.message);
        });
        user.subscriptionExpiryNoticeSentAt = new Date();
        await User.save(user);
      }
    }

    return res.json({ user: withSubscriptionMeta(user) });
  })
);

// Redeem plan coupon for controlled plan assignment.
router.post(
  '/coupon/redeem',
  authenticate,
  asyncHandler(async (req: DomainRequest, res: Response) => {
    const { error, value } = redeemCouponSchema.validate(req.body || {});
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const normalizedCoupon = String(value.coupon || '')
      .trim()
      .toLowerCase();
    const storedCoupon = await Coupon.findOne({ code: normalizedCoupon });

    const resolvedTier = storedCoupon
      ? storedCoupon.targetTier
      : resolveTestTierFromCoupon(value.coupon);
    if (!resolvedTier) {
      return res.status(400).json({ error: 'Invalid coupon code' });
    }

    if (value.expectedTier && value.expectedTier !== resolvedTier) {
      return res.status(400).json({
        error: `Coupon is for ${resolvedTier}, but selected plan is ${value.expectedTier}`
      });
    }

    const user = await User.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const snapshot = getSubscriptionSnapshot(user);
    if (snapshot.hasActiveSubscription && !snapshot.canChangePlan && user.tier !== resolvedTier) {
      return res.status(403).json({
        error: `Plan change is locked until last 5 days. ${snapshot.daysUntilCanChange} day(s) remaining.`
      });
    }

    const reservation = storedCoupon ? await reserveCoupon(storedCoupon._id, user._id) : null;
    const redeemedAt = reservation?.redeemedAt || new Date();

    user.tier = resolvedTier;
    user.tierChangedAt = new Date();
    user.subscriptionId = null;
    user.autoRenew = false;

    if (resolvedTier === 'trial') {
      user.trialStartedAt = redeemedAt;
      user.trialExpiresAt = new Date(redeemedAt.getTime() + 15 * 86400000);
      user.subscriptionStartAt = null;
      user.subscriptionEndAt = null;
      user.subscriptionDurationMonths = 0;
      user.renewalDate = null;
      user.canChangeAfter = null;
    } else if (resolvedTier === 'normal') {
      user.subscriptionStartAt = null;
      user.subscriptionEndAt = null;
      user.subscriptionDurationMonths = 0;
      user.renewalDate = null;
      user.canChangeAfter = null;
    } else {
      const durationDays = storedCoupon?.durationDays || 30;
      const startAt = redeemedAt;
      const endAt = new Date(startAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
      user.subscriptionStartAt = startAt;
      user.subscriptionEndAt = endAt;
      user.subscriptionDurationMonths = Math.max(1, Math.round(durationDays / 30));
      user.renewalDate = endAt;
      user.canChangeAfter = new Date(endAt.getTime() - 5 * 24 * 60 * 60 * 1000);
    }

    if (storedCoupon) {
      // A crash after reservation is safe: retries reuse the original date.
      // The once-only marker and entitlement update commit together.
      const fields = [
        'tier',
        'tierChangedAt',
        'subscriptionId',
        'autoRenew',
        'trialStartedAt',
        'trialExpiresAt',
        'subscriptionStartAt',
        'subscriptionEndAt',
        'subscriptionDurationMonths',
        'renewalDate',
        'canChangeAfter'
      ] as const;
      const updates = Object.fromEntries(fields.map((field) => [field, user[field]]));
      const couponId = String(storedCoupon._id);
      await prisma.$transaction(async (tx) => {
        const current = await tx.user.findUnique({
          where: { id: user._id },
          select: { appliedCouponIds: true }
        });
        const alreadyApplied = current?.appliedCouponIds.includes(couponId) ?? false;
        await tx.user.update({
          where: { id: user._id },
          data: {
            ...updates,
            appliedCouponIds: alreadyApplied
              ? current!.appliedCouponIds
              : [...(current?.appliedCouponIds ?? []), couponId]
          }
        });
      });
      const refreshed = await User.findById(user._id);
      if (refreshed) Object.assign(user, refreshed);
    } else {
      await User.save(user);
    }

    return res.json({
      message: 'Coupon redeemed successfully',
      tier: user.tier,
      couponExpiresAt: storedCoupon?.expiresAt || user.subscriptionEndAt || null,
      couponDurationDays: storedCoupon?.durationDays || 30,
      user: withSubscriptionMeta(user)
    });
  })
);

router.get(
  '/coupon/list',
  authenticate,
  asyncHandler(async (req: DomainRequest, res: Response) => {
    if (!testCouponsEnabled()) {
      return res.status(403).json({ error: 'Coupon listing disabled' });
    }

    const envCoupons = (process.env.COUPON_CODES || '')
      .split(',')
      .map((entry) => {
        const [code, tier] = entry.split(':').map((v) => String(v || '').trim());
        if (!code || !tier) return null;
        return { code, tier };
      })
      .filter(Boolean);

    const dbCoupons = await Coupon.findMany({ isActive: true });

    return res.json({
      coupons: [
        ...envCoupons,
        ...dbCoupons.map((c) => ({
          code: c.code,
          tier: c.targetTier,
          durationDays: c.durationDays,
          expiresAt: c.expiresAt,
          usageCount: c.usageCount,
          maxUses: c.maxUses
        }))
      ]
    });
  })
);

export default router;
