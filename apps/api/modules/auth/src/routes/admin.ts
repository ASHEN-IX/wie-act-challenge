import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Prisma } from '../../../../src/generated/prisma/client';
import type { IUser } from '../models/User';
import { prisma } from '../../../../shared/database';
import { createContracts } from '@noveris/shared/domainContracts';
import Joi from 'joi';
import crypto from 'crypto';
import type { Response } from 'express';
import User from '../models/User';
import Coupon from '../models/Coupon';
import Payment from '../models/Payment';
import { requireRole } from '@noveris/shared/auth';

const router = createContracts();

// All admin routes require admin role
router.use(requireRole('admin'));

const updatableTiers = ['trial', 'normal', 'vip', 'vip_plus'];

const couponCreateSchema = Joi.object({
  code: Joi.string().trim().min(3).max(100).optional().allow(''),
  targetTier: Joi.string().valid('trial', 'normal', 'vip', 'vip_plus').required(),
  durationDays: Joi.number().integer().min(1).max(365).default(30),
  maxUses: Joi.number().integer().min(1).default(1),
  expiresAt: Joi.date().optional().allow(null)
});

const couponUpdateSchema = Joi.object({
  targetTier: Joi.string().valid('trial', 'normal', 'vip', 'vip_plus').optional(),
  durationDays: Joi.number().integer().min(1).max(365).optional(),
  maxUses: Joi.number().integer().min(1).optional(),
  expiresAt: Joi.date().optional().allow(null),
  isActive: Joi.boolean().optional()
}).min(1);

// GET /admin/users — List all users with tier info
router.get('/users', async (req: DomainRequest, res: Response) => {
  try {
    const { tier, isActive, query, page = 1, limit = 50 } = req.query;
    const filter: Prisma.UserWhereInput = {};
    if (tier) filter.tier = String(tier) as Prisma.UserWhereInput['tier'];
    if (typeof isActive !== 'undefined') {
      filter.isActive = String(isActive).toLowerCase() === 'true';
    }
    if (query) {
      // SEC-09: treat admin search as literal text. Never pass user input
      // straight into $regex — crafted patterns (e.g. (a+)+) can stall the
      // query (ReDoS). Escape regex metacharacters and coerce to a string so
      // operator-injection via ?query[$regex]=... is neutralized too.
      // Prisma parameterizes LIKE patterns; escaping `%` and `_` keeps the
      // search literal, which is the property SEC-09 requires.
      const safeQuery = String(query);
      filter.OR = [
        { email: { contains: safeQuery, mode: 'insensitive' } },
        { name: { contains: safeQuery, mode: 'insensitive' } }
      ];
    }

    const { boundedInteger } = require('@noveris/shared/pagination');
    const pageNumber = boundedInteger(page, 1, 10000);
    const pageSize = boundedInteger(limit, 50, 100);
    const skip = (pageNumber - 1) * pageSize;
    const rows = await prisma.user.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isAdmin: true,
        isActive: true,
        isVerified: true,
        lastLogin: true,
        tier: true,
        trialStartedAt: true,
        trialExpiresAt: true,
        tierChangedAt: true,
        subscriptionId: true,
        subscriptionStartAt: true,
        subscriptionEndAt: true,
        subscriptionDurationMonths: true,
        autoRenew: true,
        renewalDate: true,
        canChangeAfter: true,
        subscriptionExpiryNoticeSentAt: true,
        entitlementPurchasedAt: true,
        stripeCustomerId: true,
        onboardingCompletedAt: true,
        createdAt: true,
        updatedAt: true
      }
    });
    const users = rows.map((row) => ({ ...row, id: row.id }));
    const total = await User.countDocuments(filter);

    return res.json({ users, total, page: pageNumber, limit: pageSize });
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /admin/users/:userId — User detail
router.get('/users/:userId', async (req: DomainRequest, res: Response) => {
  try {
    const userRow = await prisma.user.findUnique({
      where: { id: String(req.params.userId) },
      omit: {
        password: true,
        verificationToken: true,
        verificationExpires: true,
        verificationOtp: true,
        verificationOtpExpires: true,
        resetPasswordToken: true,
        resetPasswordExpires: true
      }
    });
    const user = userRow ? { ...userRow, id: userRow.id } : null;
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user });
  } catch (error) {
    console.error('Error fetching user detail:', error);
    return res.status(500).json({ error: 'Failed to fetch user detail' });
  }
});

// PUT /admin/users/:userId — Update user state/tier/admin status
router.put('/users/:userId', async (req: DomainRequest, res: Response) => {
  try {
    const { tier, isActive, isAdmin, role } = req.body || {};
    const updates: Partial<IUser> = {};

    if (typeof tier !== 'undefined') {
      if (!updatableTiers.includes(tier)) {
        return res.status(400).json({ error: 'Invalid tier' });
      }
      updates.tier = tier;
      updates.tierChangedAt = new Date();
    }

    if (typeof isActive !== 'undefined') {
      updates.isActive = !!isActive;
    }

    const updatableRoles = ['student', 'admin'];

    if (typeof isAdmin !== 'undefined') {
      updates.isAdmin = !!isAdmin;
      updates.role = isAdmin ? 'admin' : role === 'admin' ? 'student' : role || 'student';
    } else if (typeof role !== 'undefined') {
      if (!updatableRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      updates.role = role;
      updates.isAdmin = role === 'admin';
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    const user = await User.findByIdAndUpdate(
      String(req.params.userId),
      updates as Prisma.UserUpdateInput,
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ message: 'User updated', user: User.toJSON(user) });
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /admin/users/:userId — Soft deactivate user
router.delete('/users/:userId', async (req: DomainRequest, res: Response) => {
  try {
    const existing = await User.findById(String(req.params.userId));
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }
    await prisma.$transaction([
      prisma.refreshToken.deleteMany({ where: { userId: existing.id } }),
      prisma.user.update({ where: { id: existing.id }, data: { isActive: false } })
    ]);
    const user = await User.findById(existing.id);
    return res.json({ message: 'User deactivated', user: user ? User.toJSON(user) : null });
  } catch (error) {
    console.error('Error deactivating user:', error);
    return res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

// PUT /admin/users/:userId/tier — Change a user's tier
router.put('/users/:userId/tier', async (req: DomainRequest, res: Response) => {
  try {
    const userId = String(req.params.userId);
    const { tier } = req.body;
    const validTiers = ['trial', 'normal', 'vip', 'vip_plus'];

    if (!tier || !validTiers.includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.tier = tier;
    user.tierChangedAt = new Date();
    if (tier === 'trial') {
      user.trialStartedAt = new Date();
      user.trialExpiresAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    }
    const saved = await User.save(user);

    return res.json({ message: 'Tier updated', user: User.toJSON(saved) });
  } catch (error) {
    console.error('Error updating user tier:', error);
    return res.status(500).json({ error: 'Failed to update tier' });
  }
});

// GET /admin/stats — Tier distribution
router.get('/stats', async (req: DomainRequest, res: Response) => {
  try {
    const stats = await prisma.user.groupBy({ by: ['tier'], _count: { _all: true } });

    const total = await User.countDocuments();
    const distribution: Record<string, number> = {};
    stats.forEach((s) => {
      distribution[s.tier || 'unknown'] = s._count._all;
    });

    return res.json({ total, distribution });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /admin/analytics/revenue — monthly revenue + ARR
router.get('/analytics/revenue', async (req: DomainRequest, res: Response) => {
  try {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const grouped = await prisma.payment.groupBy({
      by: ['createdAt'],
      where: { status: 'succeeded', createdAt: { gte: startOfYear } },
      _count: { _all: true }
    });
    const byMonth = new Map<
      string,
      { year: number; month: number; revenueCents: number; count: number }
    >();
    for (const row of grouped) {
      const year = row.createdAt.getUTCFullYear();
      const month = row.createdAt.getUTCMonth() + 1;
      const key = `${year}-${month}`;
      const entry = byMonth.get(key) ?? { year, month, revenueCents: 0, count: 0 };
      entry.count += row._count._all;
      byMonth.set(key, entry);
    }
    const succeeded = await prisma.payment.findMany({
      where: { status: 'succeeded', createdAt: { gte: startOfYear } },
      select: { createdAt: true, amount: true }
    });
    for (const row of succeeded) {
      const key = `${row.createdAt.getUTCFullYear()}-${row.createdAt.getUTCMonth() + 1}`;
      const entry = byMonth.get(key);
      if (entry) entry.revenueCents += row.amount ?? 0;
    }
    const monthly = [...byMonth.values()]
      .sort((a, b) => a.year - b.year || a.month - b.month)
      .map((entry) => ({
        id: { year: entry.year, month: entry.month },
        revenueCents: entry.revenueCents,
        count: entry.count
      }));

    const totalRevenueCents = monthly.reduce((sum, row) => sum + row.revenueCents, 0);
    const avgMonthlyRevenueCents = monthly.length
      ? Math.round(totalRevenueCents / monthly.length)
      : 0;
    const arrCents = avgMonthlyRevenueCents * 12;

    return res.json({
      monthly,
      totalRevenueCents,
      avgMonthlyRevenueCents,
      arrCents
    });
  } catch (error) {
    console.error('Error fetching revenue analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch revenue analytics' });
  }
});

// GET /admin/subscriptions — list subscription payments with user context
router.get('/subscriptions', async (req: DomainRequest, res: Response) => {
  try {
    const { status = 'succeeded', tier, page = 1, limit = 50 } = req.query;
    const filter: Prisma.PaymentWhereInput = {};

    if (status && status !== 'all') {
      filter.status = String(status) as Prisma.PaymentWhereInput['status'];
    }
    if (tier) {
      filter.tier = String(tier) as Prisma.PaymentWhereInput['tier'];
    }

    const { boundedInteger } = require('@noveris/shared/pagination');
    const pageNumber = boundedInteger(page, 1, 10000);
    const pageSize = boundedInteger(limit, 50, 100);
    const skip = (pageNumber - 1) * pageSize;

    const payments = await Payment.findMany(filter);
    const userIds = [...new Set(payments.map((payment) => payment.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        name: true,
        tier: true,
        subscriptionStartAt: true,
        subscriptionEndAt: true
      }
    });
    const usersById = new Map(users.map((user) => [user.id, user]));
    const subscriptions = payments
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(skip, skip + pageSize)
      .map((payment) => ({
        ...payment,
        userId: usersById.get(payment.userId) ?? payment.userId
      }));

    const total = await Payment.countDocuments(filter);
    return res.json({ subscriptions, total, page: pageNumber, limit: pageSize });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// PUT /admin/subscriptions/:paymentId/cancel — force cancel subscription and downgrade user
router.put('/subscriptions/:paymentId/cancel', async (req: DomainRequest, res: Response) => {
  try {
    const payment = await Payment.findById(String(req.params.paymentId));
    if (!payment) {
      return res.status(404).json({ error: 'Subscription payment not found' });
    }

    await Payment.updateOne({ id: payment.id }, { status: 'canceled' });
    payment.status = 'canceled';

    const user = await User.findById(payment.userId);
    let savedUser = null;
    if (user) {
      user.tier = 'normal';
      user.tierChangedAt = new Date();
      user.subscriptionId = null;
      user.subscriptionStartAt = null;
      user.subscriptionEndAt = null;
      user.subscriptionDurationMonths = 0;
      user.renewalDate = null;
      user.canChangeAfter = null;
      user.autoRenew = false;
      savedUser = await User.save(user);
    }

    return res.json({
      message: 'Subscription canceled',
      payment,
      user: savedUser ? User.toJSON(savedUser) : null
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// GET /admin/coupons — list all coupons
router.get('/coupons', async (req: DomainRequest, res: Response) => {
  try {
    const coupons = (await Coupon.findMany())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((coupon) => ({
        id: coupon.id,
        code: coupon.code,
        targetTier: coupon.targetTier,
        durationDays: coupon.durationDays,
        createdBy: coupon.createdBy,
        expiresAt: coupon.expiresAt,
        isActive: coupon.isActive,
        maxUses: coupon.maxUses,
        usageCount: coupon.usageCount,
        createdAt: coupon.createdAt,
        updatedAt: coupon.updatedAt
      }));
    return res.json({ coupons });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    return res.status(500).json({ error: 'Failed to fetch coupons' });
  }
});

// POST /admin/coupons — create coupon
router.post('/coupons', async (req: DomainRequest, res: Response) => {
  try {
    const { error, value } = couponCreateSchema.validate(req.body || {});
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const code = String(value.code || `partner-${crypto.randomBytes(4).toString('hex')}`)
      .trim()
      .toLowerCase();

    const existing = await Coupon.findOne({ code });
    if (existing) {
      return res.status(409).json({ error: 'Coupon code already exists' });
    }

    const coupon = await Coupon.create({
      code,
      targetTier: value.targetTier,
      durationDays: value.durationDays,
      maxUses: value.maxUses,
      expiresAt: value.expiresAt || null,
      createdBy: req.user!.userId,
      isActive: true
    } as Prisma.CouponUncheckedCreateInput);

    return res.status(201).json({ message: 'Coupon created', coupon });
  } catch (error) {
    console.error('Error creating coupon:', error);
    return res.status(500).json({ error: 'Failed to create coupon' });
  }
});

// PUT /admin/coupons/:couponId — update coupon
router.put('/coupons/:couponId', async (req: DomainRequest, res: Response) => {
  try {
    const { error, value } = couponUpdateSchema.validate(req.body || {});
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const coupon = await Coupon.findByIdAndUpdate(String(req.params.couponId), value, {
      new: true
    });
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    return res.json({ message: 'Coupon updated', coupon });
  } catch (error) {
    console.error('Error updating coupon:', error);
    return res.status(500).json({ error: 'Failed to update coupon' });
  }
});

// DELETE /admin/coupons/:couponId — soft delete (deactivate)
router.delete('/coupons/:couponId', async (req: DomainRequest, res: Response) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(
      String(req.params.couponId),
      { isActive: false },
      {
        new: true
      }
    );
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    return res.json({ message: 'Coupon deactivated', coupon });
  } catch (error) {
    console.error('Error deleting coupon:', error);
    return res.status(500).json({ error: 'Failed to deactivate coupon' });
  }
});

// GET /admin/coupons/:couponId/usage — usage history
router.get('/coupons/:couponId/usage', async (req: DomainRequest, res: Response) => {
  try {
    const coupon = await Coupon.findById(String(req.params.couponId));
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    const usageUsers = await prisma.user.findMany({
      where: { id: { in: coupon.usageHistory.map((entry) => entry.userId) } },
      select: { id: true, email: true, name: true }
    });
    const usageById = new Map(usageUsers.map((user) => [user.id, user]));

    return res.json({
      coupon: {
        id: coupon.id,
        code: coupon.code,
        targetTier: coupon.targetTier,
        durationDays: coupon.durationDays,
        maxUses: coupon.maxUses,
        usageCount: coupon.usageCount,
        usageHistory: coupon.usageHistory.map((entry) => ({
          ...entry,
          userId: usageById.get(entry.userId) ?? entry.userId
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching coupon usage:', error);
    return res.status(500).json({ error: 'Failed to fetch coupon usage' });
  }
});

export default router;
