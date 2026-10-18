'use client';
import React from "react";
import { useNavigate } from "@/navigation";
import { motion } from "framer-motion";
import { useAuthStore } from "../store/authStore";
import { authAPI } from "../services/api";
import { Check, X, Sparkles, Crown, Star, Zap } from "lucide-react";

const tiers = [
  {
    id: "normal",
    name: "Free",
    price: "$0",
    period: "forever",
    icon: <Star size={28} />,
    color: "from-gray-600 to-gray-700",
    borderColor: "border-gray-600/30",
    features: {
      "Manual course creation": true,
      "Task management": true,
      "Study sessions": true,
      "Calendar view": true,
      "Subjects & topics": true,
      Leaderboard: true,
      "AI course ingestion": false,
      "AI study planner": false,
      "AI scheduler": false,
      "AI coach": false,
      "Signal processing (webcam)": false,
      "AI search": false,
      "Spaced repetition reviews": false,
    },
  },
  {
    id: "vip",
    name: "VIP",
    price: "$9.99",
    period: "/month",
    icon: <Zap size={28} />,
    color:
      "from-[var(--accent-color-dynamic)] to-[var(--accent-color-dynamic)]",
    borderColor: "border-[var(--accent-color-dynamic)]/30",
    popular: false,
    features: {
      "Manual course creation": true,
      "Task management": true,
      "Study sessions": true,
      "Calendar view": true,
      "Subjects & topics": true,
      Leaderboard: true,
      "AI course ingestion": true,
      "AI study planner": true,
      "AI scheduler": true,
      "AI coach": false,
      "Signal processing (webcam)": false,
      "AI search": true,
      "Spaced repetition reviews": true,
    },
  },
  {
    id: "vip_plus",
    name: "VIP+",
    price: "$19.99",
    period: "/month",
    icon: <Crown size={28} />,
    color:
      "from-[var(--accent-color-dynamic)] to-[var(--accent-color-dynamic)]",
    borderColor: "border-[var(--accent-color-dynamic)]/30",
    popular: true,
    features: {
      "Manual course creation": true,
      "Task management": true,
      "Study sessions": true,
      "Calendar view": true,
      "Subjects & topics": true,
      Leaderboard: true,
      "AI course ingestion": true,
      "AI study planner": true,
      "AI scheduler": true,
      "AI coach": true,
      "Signal processing (webcam)": true,
      "AI search": true,
      "Spaced repetition reviews": true,
    },
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const currentTier = useAuthStore((s) => s.getTier());
  const updateUser = useAuthStore((s) => s.updateUser);
  const [checkoutTier, setCheckoutTier] = React.useState<any>(null);
  const [couponTier, setCouponTier] = React.useState<any>(null);
  const [couponCode, setCouponCode] = React.useState("");
  const [redeemingTier, setRedeemingTier] = React.useState<any>(null);
  const [selectedMonths, setSelectedMonths] = React.useState({
    vip: 1,
    vip_plus: 1,
  });
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [couponInfo, setCouponInfo] = React.useState<any>(null);
  const [stripeUnavailable, setStripeUnavailable] = React.useState(false);

  const monthOptions = [1, 3, 6, 12];

  const getDiscountPct = (months: any) => {
    if (months >= 12) return 20;
    if (months >= 6) return 10;
    return 0;
  };

  const getMonthlyPrice = (tierId: any) => {
    if (tierId === "vip") return 9.99;
    if (tierId === "vip_plus") return 19.99;
    return 0;
  };

  const getPricingSummary = (tierId: any) => {
    const months = (selectedMonths as any)[tierId] || 1;
    const monthly = getMonthlyPrice(tierId);
    const base = monthly * months;
    const discountPct = getDiscountPct(months);
    const total = base * (1 - discountPct / 100);
    return { months, monthly, base, discountPct, total };
  };

  const hasActivePaidPlan =
    ["vip", "vip_plus"].includes(currentTier) &&
    Number(user?.daysRemaining || 0) > 0;
  const canChangePlan = user?.canChangePlan !== false;
  const isPlanChangeLocked = hasActivePaidPlan && !canChangePlan;

  React.useEffect(() => {
    let mounted = true;

    const loadStripeConfig = async () => {
      try {
        const response = await authAPI.getStripeConfig();
        if (!mounted) return;
        setStripeUnavailable(response.data?.stripeConfigured === false);
      } catch {
        // If this check fails, defer to checkout attempt handling.
      }
    };

    loadStripeConfig();
    return () => {
      mounted = false;
    };
  }, []);

  const handlePay = async (tierId: any) => {
    if (tierId === currentTier) return;

    if (isPlanChangeLocked) {
      setError(
        `Plan change is locked. You can change in ${user?.daysUntilCanChange ?? "a few"} day(s).`,
      );
      return;
    }

    if (tierId === "normal") {
      setError("Downgrade/cancel is managed in account settings.");
      return;
    }

    if (stripeUnavailable) {
      setError(
        "Payments are temporarily unavailable. Please try again later or contact support.",
      );
      return;
    }

    const durationMonths = (selectedMonths as any)[tierId] || 1;
    setCheckoutTier(tierId);
    setError("");
    setSuccess("");
    try {
      const response = await authAPI.subscribe(tierId, durationMonths);
      const checkoutUrl = response.data?.checkoutUrl;

      if (!checkoutUrl) {
        throw new Error("Checkout URL not returned");
      }

      window.location.href = checkoutUrl;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 503) {
        setStripeUnavailable(true);
        setError(
          "Payments are temporarily unavailable. Please try again later or contact support.",
        );
      } else {
        setError(err.response?.data?.error || "Failed to start checkout flow.");
      }
      setCheckoutTier(null);
    }
  };

  const handleRedeemCoupon = async (tierId: any) => {
    if (isPlanChangeLocked) {
      setError(
        `Plan change is locked. You can change in ${user?.daysUntilCanChange ?? "a few"} day(s).`,
      );
      return;
    }

    if (!couponCode.trim()) {
      setError("Please enter a coupon code.");
      return;
    }

    setRedeemingTier(tierId);
    setError("");
    setSuccess("");
    setCouponInfo(null);
    try {
      const response = await authAPI.redeemCoupon(couponCode.trim(), tierId);
      const updatedUser = response.data?.user;
      if (updatedUser) {
        updateUser(updatedUser);
      }
      setSuccess(
        `Coupon applied. Plan changed to ${response.data?.tier || tierId}.`,
      );
      const expiresAt = response.data?.couponExpiresAt;
      if (expiresAt) {
        const daysLeft = Math.max(
          0,
          Math.ceil(((new Date(expiresAt) as any) - (new Date() as any)) / (1000 * 60 * 60 * 24)),
        );
        setCouponInfo({ expiresAt, daysLeft });
      }
      setCouponCode("");
      setCouponTier(null);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to redeem coupon.");
    } finally {
      setRedeemingTier(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 px-4 py-16">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 mb-4"
          >
            <Sparkles
              className="text-[var(--accent-color-dynamic)]"
              size={24}
            />
            <span className="text-[var(--accent-color-dynamic)] font-semibold uppercase tracking-wider text-sm">
              Choose Your Plan
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold text-white mb-4"
          >
            Unlock Your Full{" "}
            <span className="bg-gradient-to-r from-[var(--accent-color-dynamic)] to-[var(--accent-color-dynamic)] bg-clip-text text-transparent">
              Study Potential
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-gray-400 text-lg max-w-xl mx-auto"
          >
            Start free and upgrade when you need AI-powered study tools.
          </motion.p>
        </div>

        {/* Tier Cards */}
        {error && (
          <div className="mb-8 rounded-lg border border-[var(--accent-color-dynamic)]/40 bg-[var(--accent-color-dynamic)]/10 px-4 py-3 text-sm text-[var(--accent-color-dynamic)]">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-8 rounded-lg border border-[var(--accent-color-dynamic)]/40 bg-[var(--accent-color-dynamic)]/10 px-4 py-3 text-sm text-[var(--accent-color-dynamic)]">
            {success}
          </div>
        )}
        {couponInfo && (
          <div className="mb-8 rounded-lg border border-[var(--accent-color-dynamic)]/40 bg-[var(--accent-color-dynamic)]/10 px-4 py-3 text-sm text-[var(--accent-color-dynamic)]">
            Coupon access expires on{" "}
            {new Date(couponInfo.expiresAt).toLocaleDateString()}.
            {couponInfo.daysLeft < 5 && (
              <span className="ml-2 font-semibold text-[var(--accent-color-dynamic)]">
                Warning: less than 5 days left.
              </span>
            )}
          </div>
        )}
        {stripeUnavailable && (
          <div className="mb-8 rounded-lg border border-[var(--accent-color-dynamic)]/40 bg-[var(--accent-color-dynamic)]/10 px-4 py-3 text-sm text-[var(--accent-color-dynamic)]">
            Card payments are currently unavailable. Coupon upgrades still work.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {tiers.map((tier: any, i: any) => {
            const isCurrent = tier.id === currentTier;
            const pricing = getPricingSummary(tier.id);
            return (
              <motion.div
                key={tier.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 * i }}
                className={`relative rounded-2xl border ${tier.borderColor} bg-gray-900/80 backdrop-blur-sm p-8 flex flex-col ${
                  tier.popular
                    ? "ring-2 ring-[var(--accent-color-dynamic)]/50 scale-[1.02]"
                    : ""
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[var(--accent-color-dynamic)] to-[var(--accent-color-dynamic)] px-4 py-1 text-xs font-bold text-white uppercase tracking-wider">
                    Most Popular
                  </div>
                )}

                <div
                  className={`inline-flex items-center gap-2 rounded-xl bg-gradient-to-r ${tier.color} p-3 w-fit text-white mb-4`}
                >
                  {tier.icon}
                </div>

                <h3 className="text-2xl font-bold text-white">{tier.name}</h3>
                <div className="mt-2 mb-6">
                  <span className="text-4xl font-extrabold text-white">
                    {tier.price}
                  </span>
                  <span className="text-gray-400 text-sm ml-1">
                    {tier.period}
                  </span>
                </div>

                {tier.id !== "normal" && (
                  <div className="mb-5 rounded-xl border border-gray-700/60 bg-gray-950/50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                      Select Months
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {monthOptions.map((m) => (
                        <button
                          key={m}
                          onClick={() =>
                            setSelectedMonths((prev: any) => ({
                              ...prev,
                              [tier.id]: m,
                            }))
                          }
                          className={`rounded-lg py-1.5 text-xs font-semibold border transition ${
                            pricing.months === m
                              ? "border-[var(--accent-color-dynamic)] bg-[var(--accent-color-dynamic)]/20 text-white"
                              : "border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800"
                          }`}
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-gray-300">
                      Total: ${pricing.total.toFixed(2)}
                      {pricing.discountPct > 0 && (
                        <span className="ml-2 text-[var(--accent-color-dynamic)]">
                          ({pricing.discountPct}% OFF)
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <ul className="flex-1 space-y-3 mb-8">
                  {Object.entries(tier.features).map(([feature, enabled]) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm"
                    >
                      {enabled ? (
                        <Check
                          className="text-[var(--accent-color-dynamic)] mt-0.5 shrink-0"
                          size={16}
                        />
                      ) : (
                        <X
                          className="text-gray-600 mt-0.5 shrink-0"
                          size={16}
                        />
                      )}
                      <span
                        className={enabled ? "text-gray-200" : "text-gray-600"}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button
                    disabled
                    className="w-full rounded-xl py-3 font-semibold bg-gray-700 text-gray-400 cursor-default"
                  >
                    Current Plan
                  </button>
                ) : isPlanChangeLocked && tier.id !== currentTier ? (
                  <div className="rounded-xl border border-[var(--accent-color-dynamic)]/30 bg-[var(--accent-color-dynamic)]/10 p-3 text-xs text-[var(--accent-color-dynamic)]">
                    Plan locked until last 5 days. Remaining:{" "}
                    {user?.daysRemaining ?? 0} day(s).
                  </div>
                ) : tier.id === "normal" ? (
                  <button
                    onClick={() => handlePay(tier.id)}
                    className="w-full rounded-xl py-3 font-semibold bg-gray-800 hover:bg-gray-700 text-white"
                  >
                    Switch to Free
                  </button>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={() => handlePay(tier.id)}
                      disabled={
                        checkoutTier === tier.id ||
                        redeemingTier === tier.id ||
                        stripeUnavailable
                      }
                      className={`w-full rounded-xl py-3 font-semibold transition-all ${
                        tier.popular
                          ? "bg-gradient-to-r from-[var(--accent-color-dynamic)] to-[var(--accent-color-dynamic)] hover:from-[var(--accent-color-dynamic)] hover:to-[var(--accent-color-dynamic)] text-white shadow-lg hover:shadow-purple-500/25"
                          : "bg-gray-800 hover:bg-gray-700 text-white"
                      }`}
                    >
                      {stripeUnavailable
                        ? "Payments Unavailable"
                        : checkoutTier === tier.id
                          ? "Redirecting..."
                          : "Pay & Subscribe"}
                    </button>

                    <button
                      onClick={() => {
                        setCouponTier((prev: any) =>
                          prev === tier.id ? null : tier.id,
                        );
                        setError("");
                        setSuccess("");
                      }}
                      disabled={
                        checkoutTier === tier.id || redeemingTier === tier.id
                      }
                      className="w-full rounded-xl py-3 font-semibold bg-gray-700/60 hover:bg-gray-700 text-white"
                    >
                      Use Coupon
                    </button>

                    {couponTier === tier.id && (
                      <div className="rounded-xl border border-gray-700 bg-gray-950/60 p-3">
                        <input
                          value={couponCode}
                          onChange={(e: any) => setCouponCode(e.target.value)}
                          placeholder={`Enter ${tier.name} coupon`}
                          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-[var(--accent-color-dynamic)]"
                        />
                        <button
                          onClick={() => handleRedeemCoupon(tier.id)}
                          disabled={redeemingTier === tier.id}
                          className="mt-2 w-full rounded-lg bg-[var(--accent-color-dynamic)] hover:bg-[var(--accent-color-dynamic)] px-3 py-2 text-sm font-semibold text-white"
                        >
                          {redeemingTier === tier.id
                            ? "Applying..."
                            : "Apply Coupon"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Back */}
        <div className="text-center mt-12">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-500 hover:text-gray-300 transition text-sm"
          >
            &larr; Go back
          </button>
        </div>
      </div>
    </div>
  );
}
