import React from "react";
import { Link } from "@/navigation";

const TIER_STYLES = {
  trial: {
    label: "TRIAL",
    classes:
      "bg-[var(--accent-color-dynamic)]/20 text-[var(--accent-color-dynamic)] border-[var(--accent-color-dynamic)]/40",
  },
  normal: {
    label: "FREE",
    classes: "bg-slate-500/20 text-slate-300 border-slate-500/40",
  },
  vip: {
    label: "VIP",
    classes:
      "bg-[var(--accent-color-dynamic)]/20 text-[var(--accent-color-dynamic)] border-[var(--accent-color-dynamic)]/40",
  },
  vip_plus: {
    label: "VIP+",
    classes:
      "bg-[var(--accent-color-dynamic)]/20 text-[var(--accent-color-dynamic)] border-[var(--accent-color-dynamic)]/40",
  },
};

export default function SubscriptionBadge({ user, tier = "normal" }: any) {
  const badge = (TIER_STYLES as any)[tier] || TIER_STYLES.normal;
  const daysRemaining = Number(user?.daysRemaining || 0);
  const hasActiveSubscription = Boolean(user?.hasActiveSubscription);
  const canChangePlan = user?.canChangePlan === true;

  return (
    <Link
      to="/pricing"
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold tracking-wide hover:opacity-90 transition"
      title={
        hasActiveSubscription
          ? `${daysRemaining} day(s) remaining${canChangePlan ? " - plan change available" : ""}`
          : "Manage your plan"
      }
    >
      <span className={`rounded-full border px-2 py-0.5 ${badge.classes}`}>
        {badge.label}
      </span>
      {hasActiveSubscription && (
        <span
          className={
            daysRemaining <= 5
              ? "text-[var(--accent-color-dynamic)]"
              : "text-slate-300"
          }
        >
          {daysRemaining}d left
        </span>
      )}
      {canChangePlan && hasActiveSubscription && (
        <span className="text-[var(--accent-color-dynamic)]">Change now</span>
      )}
    </Link>
  );
}
