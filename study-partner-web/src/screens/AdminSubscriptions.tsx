'use client';
import React from "react";
import { adminAPI } from "@/services/api";

export default function AdminSubscriptions() {
  const [subscriptions, setSubscriptions] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const loadSubscriptions = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getSubscriptions({ status: "succeeded" });
      setSubscriptions(response.data?.subscriptions || []);
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load subscriptions");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  const handleCancel = async (paymentId: any) => {
    try {
      await adminAPI.cancelSubscription(paymentId);
      await loadSubscriptions();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to cancel subscription");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Admin Subscriptions</h1>
        <p className="text-muted-foreground mb-6">
          Monitor active paid subscriptions and cancel if needed.
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-[var(--accent-color-dynamic)]/40 bg-[var(--accent-color-dynamic)]/10 px-4 py-2 text-[var(--accent-color-dynamic)] text-sm">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">User</th>
                <th className="text-left p-3">Tier</th>
                <th className="text-left p-3">Duration</th>
                <th className="text-left p-3">Amount</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Purchased</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-4 text-center text-muted-foreground"
                  >
                    Loading subscriptions...
                  </td>
                </tr>
              ) : subscriptions.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-4 text-center text-muted-foreground"
                  >
                    No subscriptions found.
                  </td>
                </tr>
              ) : (
                subscriptions.map((s) => (
                  <tr key={s._id} className="border-t border-border">
                    <td className="p-3">{s.userId?.email || "Unknown user"}</td>
                    <td className="p-3 uppercase">{s.tier}</td>
                    <td className="p-3">{s.durationMonths || 1} month(s)</td>
                    <td className="p-3">
                      ${((s.amount || 0) / 100).toFixed(2)}
                    </td>
                    <td className="p-3 capitalize">{s.status}</td>
                    <td className="p-3">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      {s.status !== "canceled" && (
                        <button
                          onClick={() => handleCancel(s._id)}
                          className="rounded-md border border-[var(--accent-color-dynamic)]/40 text-[var(--accent-color-dynamic)] px-2 py-1 hover:bg-[var(--accent-color-dynamic)]/10"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
