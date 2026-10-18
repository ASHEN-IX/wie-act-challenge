import React from "react";
import { useNavigate } from "@/navigation";
import { useAuthStore } from "@/store/authStore";
import { Clock, Sparkles } from "lucide-react";

/**
 * A persistent banner shown at the top of the page for trial users.
 * Shows the number of days remaining and a CTA to upgrade.
 */
export default function TrialBanner() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const tier = useAuthStore((s) => s.getTier());
  const daysRemaining = useAuthStore((s) => s.getTrialDaysRemaining());
  const isExpired = useAuthStore((s) => s.isTrialExpired());

  const isSubscriptionTier = ["vip", "vip_plus"].includes(tier);
  const subscriptionDaysRemaining = Number(user?.daysRemaining || 0);
  const subscriptionNearExpiry =
    subscriptionDaysRemaining > 0 && subscriptionDaysRemaining <= 5;
  const canChangePlan = Boolean(user?.canChangePlan);

  if (tier !== "trial" && !isSubscriptionTier) return null;
  if (isSubscriptionTier && subscriptionDaysRemaining <= 0) return null;
  if (isSubscriptionTier && !subscriptionNearExpiry) return null;

  const urgent = daysRemaining <= 3;
  const subscriptionUrgent = subscriptionDaysRemaining <= 5;

  const trialClass = isExpired
    ? "bg-[var(--accent-color-dynamic)]/90 text-white"
    : urgent
      ? "bg-[var(--accent-color-dynamic)]/90 text-black"
      : "bg-gradient-to-r from-[var(--accent-color-dynamic)]/90 to-[var(--accent-color-dynamic)]/90 text-white";

  const subscriptionClass = canChangePlan
    ? "bg-[var(--accent-color-dynamic)]/90 text-black"
    : subscriptionUrgent
      ? "bg-[var(--accent-color-dynamic)]/90 text-white"
      : "bg-gradient-to-r from-[var(--accent-color-dynamic)]/90 to-[var(--accent-color-dynamic)]/90 text-white";

  const barClass = tier === "trial" ? trialClass : subscriptionClass;

  const ctaClass =
    tier === "trial"
      ? isExpired || urgent
        ? "bg-white text-black hover:bg-gray-100"
        : "bg-white/20 hover:bg-white/30 text-white"
      : canChangePlan || subscriptionUrgent
        ? "bg-white text-black hover:bg-gray-100"
        : "bg-white/20 hover:bg-white/30 text-white";

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-3 px-4 py-2 text-sm font-medium h-10 ${barClass} backdrop-blur-sm`}
    >
      <Clock size={16} />
      {tier === "trial" && isExpired ? (
        <span>
          Your trial has expired. Upgrade now to keep using AI features.
        </span>
      ) : tier === "trial" ? (
        <span>
          {daysRemaining} day{daysRemaining !== 1 ? "s" : ""} left in your free
          trial
        </span>
      ) : (
        <span>
          {canChangePlan
            ? `Your ${tier.toUpperCase()} plan expires in ${subscriptionDaysRemaining} day(s). You can now change your plan.`
            : `Your ${tier.toUpperCase()} plan expires in ${subscriptionDaysRemaining} day(s). Plan change unlocks in ${Number(user?.daysUntilCanChange || 0)} day(s).`}
        </span>
      )}
      <button
        onClick={() => navigate("/pricing")}
        className={`ml-2 flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition ${ctaClass}`}
      >
        <Sparkles size={12} />
        {tier === "trial" ? "Upgrade" : "Manage Plan"}
      </button>
    </div>
  );
}
