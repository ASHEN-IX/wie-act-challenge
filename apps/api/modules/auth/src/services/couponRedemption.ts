import { prisma } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';

/**
 * Reserve one use of a coupon for a user.
 *
 * The previous implementation relied on a single-document conditional update
 * (`$inc` + `$addToSet` guarded by `usageCount < maxUses`). The equivalent
 * guarantee is now a transaction: the usage row's unique (couponId, userId)
 * key makes double redemption impossible, and the counters move with it.
 */
export async function reserveCoupon(couponId: unknown, userId: unknown) {
  const now = new Date();
  const id = String(couponId);
  const actor = String(userId);

  return prisma.$transaction(async (tx) => {
    const coupon = await tx.coupon.findUnique({ where: { id } });
    if (!coupon) throw Object.assign(new Error('Coupon is not redeemable'), { statusCode: 409 });

    if (!coupon.isActive || (coupon.expiresAt && coupon.expiresAt <= now))
      throw Object.assign(new Error('Coupon is not redeemable'), { statusCode: 409 });

    const existing = await tx.couponUsage.findUnique({
      where: { couponId_userId: { couponId: id, userId: actor } }
    });
    // A retry after a crash reuses the original redemption date.
    if (existing) return { coupon, redeemedAt: existing.redeemedAt };

    if (coupon.maxUses !== -1 && coupon.usageCount >= coupon.maxUses)
      throw Object.assign(new Error('Coupon is not redeemable'), { statusCode: 409 });

    await tx.couponUsage.create({
      data: { id: newId(), couponId: id, userId: actor, redeemedAt: now }
    });
    const updated = await tx.coupon.update({
      where: { id },
      data: { usageCount: { increment: 1 } }
    });
    return { coupon: updated, redeemedAt: now };
  });
}
