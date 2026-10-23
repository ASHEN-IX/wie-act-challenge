export interface PricingPlan {
  monthlyPriceUsd: number;
  monthlyPriceCents: number;
}

export const PRICING_PLANS: Record<string, PricingPlan> = {
  vip: {
    monthlyPriceUsd: 9.99,
    monthlyPriceCents: 999
  },
  vip_plus: {
    monthlyPriceUsd: 19.99,
    monthlyPriceCents: 1999
  }
};

export const MONTH_OPTIONS = [1, 3, 6, 12] as const;

export function getDiscountPercentage(durationMonths: number): number {
  if (durationMonths >= 12) return 20;
  if (durationMonths >= 6) return 10;
  return 0;
}

export interface CalculatedPlanPrice {
  monthlyPriceCents: number;
  monthlyPriceUsd: number;
  durationMonths: number;
  discountPercentage: number;
  baseAmountCents: number;
  discountAmountCents: number;
  finalAmountCents: number;
}

export function calculatePlanPrice(tier: string, durationMonths: number = 1): CalculatedPlanPrice {
  const normalizedMonths = Number(durationMonths || 1);
  const plan = PRICING_PLANS[tier];

  if (!plan) {
    throw new Error(`Unsupported plan tier: ${tier}`);
  }

  if (!MONTH_OPTIONS.some((months) => months === normalizedMonths)) {
    throw new Error(`Unsupported durationMonths: ${normalizedMonths}`);
  }

  const discountPercentage = getDiscountPercentage(normalizedMonths);
  const baseAmountCents = plan.monthlyPriceCents * normalizedMonths;
  const discountAmountCents = Math.round((baseAmountCents * discountPercentage) / 100);
  const finalAmountCents = baseAmountCents - discountAmountCents;

  return {
    monthlyPriceCents: plan.monthlyPriceCents,
    monthlyPriceUsd: plan.monthlyPriceUsd,
    durationMonths: normalizedMonths,
    discountPercentage,
    baseAmountCents,
    discountAmountCents,
    finalAmountCents
  };
}
