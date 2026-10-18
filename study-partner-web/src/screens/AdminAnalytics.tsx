'use client';
import React from "react";
import { adminAPI } from "@/services/api";

const centsToUsd = (cents = 0) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

export default function AdminAnalytics() {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await adminAPI.getRevenueAnalytics();
        setData(response.data || null);
        setError("");
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const maxRevenue = React.useMemo(() => {
    const rows = data?.monthly || [];
    return rows.reduce(
      (max: any, row: any) => Math.max(max, Number(row.revenueCents || 0)),
      0,
    );
  }, [data]);

  const exportCsv = React.useCallback(() => {
    const rows = data?.monthly || [];
    const lines = ["year,month,revenue_cents,revenue_usd,transactions"];
    rows.forEach((row: any) => {
      const year = row?._id?.year || "";
      const month = row?._id?.month || "";
      const revenueCents = Number(row?.revenueCents || 0);
      const revenueUsd = (revenueCents / 100).toFixed(2);
      const transactions = Number(row?.count || 0);
      lines.push(
        [year, month, revenueCents, revenueUsd, transactions].join(","),
      );
    });

    const blob = new Blob([`${lines.join("\n")}\n`], {
      type: "text/csv;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `revenue-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }, [data]);

  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Admin Analytics</h1>
        <p className="text-muted-foreground mb-6">
          Revenue analytics and recurring revenue indicators.
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-[var(--accent-color-dynamic)]/40 bg-[var(--accent-color-dynamic)]/10 px-4 py-2 text-[var(--accent-color-dynamic)] text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-muted-foreground">Loading analytics...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground uppercase">
                  Total Revenue
                </div>
                <div className="text-2xl font-bold">
                  {centsToUsd(data?.totalRevenueCents)}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground uppercase">
                  Monthly Average
                </div>
                <div className="text-2xl font-bold">
                  {centsToUsd(data?.avgMonthlyRevenueCents)}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground uppercase">
                  ARR
                </div>
                <div className="text-2xl font-bold">
                  {centsToUsd(data?.arrCents)}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 overflow-x-auto">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="font-semibold">Monthly Revenue</h2>
                <button
                  type="button"
                  onClick={exportCsv}
                  className="text-xs rounded-md border border-border px-3 py-1.5 hover:bg-muted"
                >
                  Export CSV
                </button>
              </div>

              <div className="space-y-2 mb-4">
                {(data?.monthly || []).map((row: any) => {
                  const revenue = Number(row.revenueCents || 0);
                  const width =
                    maxRevenue > 0
                      ? Math.max(4, Math.round((revenue / maxRevenue) * 100))
                      : 4;
                  return (
                    <div key={`bar-${row._id.year}-${row._id.month}`}>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>
                          {row._id.year}-
                          {String(row._id.month).padStart(2, "0")}
                        </span>
                        <span>{centsToUsd(revenue)}</span>
                      </div>
                      <div className="w-full h-2 rounded bg-muted">
                        <div
                          className="h-2 rounded bg-primary"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2">Month</th>
                    <th className="py-2">Revenue</th>
                    <th className="py-2">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.monthly || []).map((row: any) => (
                    <tr
                      key={`${row._id.year}-${row._id.month}`}
                      className="border-t border-border"
                    >
                      <td className="py-2">
                        {row._id.year}-{String(row._id.month).padStart(2, "0")}
                      </td>
                      <td className="py-2">{centsToUsd(row.revenueCents)}</td>
                      <td className="py-2">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
