import type {
  Coupon as CouponRow,
  CouponUsage as CouponUsageRow,
  Prisma
} from '../../../../src/generated/prisma/client';
import { prisma, toDocument } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';

export interface ICouponUsageHistory {
  userId: string;
  redeemedAt: Date;
}

export type ICoupon = CouponRow & {
  id: string;
  /** `usedBy` and `usageHistory` were embedded arrays; they are now rows. */
  usedBy: string[];
  usageHistory: ICouponUsageHistory[];
  isRedeemableBy(userId: string | { toString(): string }): { redeemable: boolean; reason?: string };
};

type CouponWithUsages = CouponRow & { usages: CouponUsageRow[] };

function hydrate(row: CouponWithUsages): ICoupon {
  const usageHistory = row.usages.map((usage) => ({
    userId: usage.userId,
    redeemedAt: usage.redeemedAt
  }));
  const coupon = {
    ...toDocument(row),
    usedBy: usageHistory.map((usage) => usage.userId),
    usageHistory
  } as unknown as ICoupon;
  coupon.isRedeemableBy = (userId) => isRedeemableBy(coupon, String(userId));
  return coupon;
}

function isRedeemableBy(coupon: ICoupon, userId: string) {
  if (!coupon.isActive) return { redeemable: false, reason: 'Coupon is inactive' };
  if (coupon.expiresAt && new Date(coupon.expiresAt) <= new Date())
    return { redeemable: false, reason: 'Coupon has expired' };
  if (coupon.maxUses !== -1 && coupon.usageCount >= coupon.maxUses)
    return { redeemable: false, reason: 'Coupon usage limit reached' };
  if (coupon.usedBy.some((id) => String(id) === String(userId)))
    return { redeemable: false, reason: 'Coupon already used by this user' };
  return { redeemable: true };
}

const withUsages = { usages: { orderBy: { redeemedAt: 'asc' as const } } };

export const Coupon = {
  isRedeemableBy,

  async findById(id: string): Promise<ICoupon | null> {
    const row = await prisma.coupon.findUnique({ where: { id }, include: withUsages });
    return row ? hydrate(row) : null;
  },

  async findOne(where: Prisma.CouponWhereInput): Promise<ICoupon | null> {
    const row = await prisma.coupon.findFirst({ where, include: withUsages });
    return row ? hydrate(row) : null;
  },

  async findMany(where: Prisma.CouponWhereInput = {}): Promise<ICoupon[]> {
    const rows = await prisma.coupon.findMany({
      where,
      include: withUsages,
      orderBy: { createdAt: 'desc' }
    });
    return rows.map(hydrate);
  },

  async countDocuments(where: Prisma.CouponWhereInput = {}): Promise<number> {
    return prisma.coupon.count({ where });
  },

  async create(data: Prisma.CouponUncheckedCreateInput): Promise<ICoupon> {
    const row = await prisma.coupon.create({
      data: { ...data, id: data.id ?? newId() },
      include: withUsages
    });
    return hydrate(row);
  },

  async findByIdAndUpdate(
    id: string,
    data: Prisma.CouponUpdateInput,
    { new: returnNew = false }: { new?: boolean } = {}
  ): Promise<ICoupon | null> {
    const result = await prisma.coupon.updateMany({ where: { id }, data });
    if (result.count === 0) return null;
    return returnNew ? Coupon.findById(id) : Coupon.findById(id);
  }
};

export default Coupon;
