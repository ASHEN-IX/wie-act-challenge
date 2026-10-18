import Coupon from '../models/Coupon';

/** Reservation and user membership change in one document operation. */
export async function reserveCoupon(couponId: unknown, userId: unknown) {
  const now = new Date();
  const reserved = await Coupon.findOneAndUpdate(
    {
      _id: couponId,
      isActive: true,
      usedBy: { $ne: userId },
      $and: [
        { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
        { $or: [{ maxUses: -1 }, { $expr: { $lt: ['$usageCount', '$maxUses'] } }] }
      ]
    },
    {
      $inc: { usageCount: 1 },
      $addToSet: { usedBy: userId },
      $push: { usageHistory: { userId, redeemedAt: now } }
    },
    { new: true }
  );
  const coupon = reserved || (await Coupon.findById(couponId));
  const redemption = coupon?.usageHistory.find((entry) => String(entry.userId) === String(userId));
  if (!coupon || !redemption)
    throw Object.assign(new Error('Coupon is not redeemable'), { statusCode: 409 });
  return { coupon, redeemedAt: redemption.redeemedAt };
}
