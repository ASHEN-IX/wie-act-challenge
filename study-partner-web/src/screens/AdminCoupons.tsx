'use client';
import React from "react";
import { adminAPI } from "@/services/api";

const initialForm = {
  code: "",
  targetTier: "vip",
  durationDays: 30,
  maxUses: 1,
  expiresAt: "",
};

export default function AdminCoupons() {
  const [coupons, setCoupons] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [form, setForm] = React.useState(initialForm);

  const loadCoupons = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getCoupons();
      setCoupons(response.data?.coupons || []);
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load coupons");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadCoupons();
  }, [loadCoupons]);

  const handleCreate = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await adminAPI.createCoupon({
        code: form.code || undefined,
        targetTier: form.targetTier,
        durationDays: Number(form.durationDays || 30),
        maxUses: Number(form.maxUses || 1),
        expiresAt: form.expiresAt
          ? new Date(form.expiresAt).toISOString()
          : null,
      });
      setSuccess("Coupon created successfully.");
      setForm(initialForm);
      await loadCoupons();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create coupon");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (couponId: any) => {
    try {
      await adminAPI.deactivateCoupon(couponId);
      await loadCoupons();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to deactivate coupon");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Admin Coupon Management</h1>
        <p className="text-muted-foreground mb-6">
          Create single-use coupons, control duration, and monitor usage.
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-[var(--accent-color-dynamic)]/40 bg-[var(--accent-color-dynamic)]/10 px-4 py-2 text-[var(--accent-color-dynamic)] text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-md border border-[var(--accent-color-dynamic)]/40 bg-[var(--accent-color-dynamic)]/10 px-4 py-2 text-[var(--accent-color-dynamic)] text-sm">
            {success}
          </div>
        )}

        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-border bg-card/40 p-4 mb-8 grid grid-cols-1 md:grid-cols-5 gap-3"
        >
          <input
            value={form.code}
            onChange={(e: any) =>
              setForm((prev: any) => ({ ...prev, code: e.target.value }))
            }
            placeholder="Custom code (optional)"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <select
            value={form.targetTier}
            onChange={(e: any) =>
              setForm((prev: any) => ({ ...prev, targetTier: e.target.value }))
            }
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="trial">Trial</option>
            <option value="normal">Normal</option>
            <option value="vip">VIP</option>
            <option value="vip_plus">VIP+</option>
          </select>
          <input
            type="number"
            min="1"
            max="365"
            value={form.durationDays}
            onChange={(e: any) =>
              setForm((prev: any) => ({ ...prev, durationDays: e.target.value }))
            }
            placeholder="Duration days"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="number"
            min="1"
            value={form.maxUses}
            onChange={(e: any) =>
              setForm((prev: any) => ({ ...prev, maxUses: e.target.value }))
            }
            placeholder="Max uses"
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="datetime-local"
            value={form.expiresAt}
            onChange={(e: any) =>
              setForm((prev: any) => ({ ...prev, expiresAt: e.target.value }))
            }
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="md:col-span-5 rounded-md bg-primary text-primary-foreground px-4 py-2 font-semibold hover:opacity-90"
          >
            {saving ? "Creating..." : "Create Coupon"}
          </button>
        </form>

        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">Code</th>
                <th className="text-left p-3">Tier</th>
                <th className="text-left p-3">Duration</th>
                <th className="text-left p-3">Usage</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-4 text-center text-muted-foreground"
                  >
                    Loading coupons...
                  </td>
                </tr>
              ) : coupons.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-4 text-center text-muted-foreground"
                  >
                    No coupons found.
                  </td>
                </tr>
              ) : (
                coupons.map((coupon) => (
                  <tr key={coupon._id} className="border-t border-border">
                    <td className="p-3 font-mono">{coupon.code}</td>
                    <td className="p-3 uppercase">{coupon.targetTier}</td>
                    <td className="p-3">{coupon.durationDays} days</td>
                    <td className="p-3">
                      {coupon.usageCount}/
                      {coupon.maxUses === -1 ? "∞" : coupon.maxUses}
                    </td>
                    <td className="p-3">
                      {coupon.isActive ? "Active" : "Inactive"}
                    </td>
                    <td className="p-3">
                      {coupon.isActive && (
                        <button
                          onClick={() => handleDeactivate(coupon._id)}
                          className="rounded-md border border-[var(--accent-color-dynamic)]/40 text-[var(--accent-color-dynamic)] px-2 py-1 hover:bg-[var(--accent-color-dynamic)]/10"
                        >
                          Deactivate
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
