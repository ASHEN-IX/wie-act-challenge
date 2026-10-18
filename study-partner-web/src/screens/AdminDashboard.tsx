'use client';
import React from "react";
import { Link } from "@/navigation";
import { adminAPI } from "@/services/api";

const centsToUsd = (cents = 0) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

export default function AdminDashboard() {
  const [stats, setStats] = React.useState<any>(null);
  const [revenue, setRevenue] = React.useState<any>(null);
  const [subscriptions, setSubscriptions] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [statsRes, revenueRes, subRes] = await Promise.all([
          adminAPI.getStats(),
          adminAPI.getRevenueAnalytics(),
          adminAPI.getSubscriptions({ limit: 5 }),
        ]);

        setStats(statsRes.data || null);
        setRevenue(revenueRes.data || null);
        setSubscriptions(subRes.data?.subscriptions || []);
        setError("");
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to load admin dashboard");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground mb-6">
          Overview of users, subscriptions, and revenue.
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-[var(--accent-color-dynamic)]/40 bg-[var(--accent-color-dynamic)]/10 px-4 py-2 text-[var(--accent-color-dynamic)] text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-muted-foreground">Loading dashboard...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground uppercase">
                  Total Users
                </div>
                <div className="text-2xl font-bold">{stats?.total ?? 0}</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground uppercase">
                  ARR
                </div>
                <div className="text-2xl font-bold">
                  {centsToUsd(revenue?.arrCents)}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground uppercase">
                  Year Revenue
                </div>
                <div className="text-2xl font-bold">
                  {centsToUsd(revenue?.totalRevenueCents)}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground uppercase">
                  Monthly Avg
                </div>
                <div className="text-2xl font-bold">
                  {centsToUsd(revenue?.avgMonthlyRevenueCents)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="font-semibold mb-3">Plan Distribution</h2>
                <div className="space-y-2 text-sm">
                  {Object.entries(stats?.distribution || {}).map(
                    ([tier, count]) => (
                      <div key={tier} className="flex justify-between">
                        <span className="uppercase">{tier}</span>
                        <span>{String(count)}</span>
                      </div>
                    ),
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="font-semibold mb-3">Recent Subscriptions</h2>
                <div className="space-y-2 text-sm">
                  {subscriptions.length === 0 ? (
                    <div className="text-muted-foreground">
                      No recent subscriptions.
                    </div>
                  ) : (
                    subscriptions.map((s) => (
                      <div key={s._id} className="flex justify-between">
                        <span>{s.userId?.email || "Unknown"}</span>
                        <span>{centsToUsd(s.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                to="/admin/users"
                className="rounded-md bg-primary px-4 py-2 text-primary-foreground font-semibold"
              >
                View Users
              </Link>
              <Link
                to="/admin/subscriptions"
                className="rounded-md bg-primary px-4 py-2 text-primary-foreground font-semibold"
              >
                View Subscriptions
              </Link>
              <Link
                to="/admin/coupons"
                className="rounded-md bg-primary px-4 py-2 text-primary-foreground font-semibold"
              >
                Manage Coupons
              </Link>
              <Link
                to="/admin/analytics"
                className="rounded-md bg-primary px-4 py-2 text-primary-foreground font-semibold"
              >
                Analytics
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
