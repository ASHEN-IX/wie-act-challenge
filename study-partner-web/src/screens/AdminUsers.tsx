'use client';
import React from "react";
import { adminAPI } from "@/services/api";

export default function AdminUsers() {
  const [users, setUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [query, setQuery] = React.useState("");

  const loadUsers = React.useCallback(async (search = "") => {
    setLoading(true);
    try {
      const response = await adminAPI.getUsers(search ? { query: search } : {});
      setUsers(response.data?.users || []);
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleTierChange = async (userId: any, tier: any) => {
    try {
      await adminAPI.updateUser(userId, { tier });
      await loadUsers(query);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update tier");
    }
  };

  const handleDeactivate = async (userId: any) => {
    try {
      await adminAPI.deactivateUser(userId);
      await loadUsers(query);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to deactivate user");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Admin Users</h1>
        <p className="text-muted-foreground mb-6">
          Manage user tiers and account status.
        </p>

        <div className="mb-4 flex gap-2">
          <input
            value={query}
            onChange={(e: any) => setQuery(e.target.value)}
            placeholder="Search by name or email"
            className="w-full max-w-sm rounded-md border border-border bg-card px-3 py-2 text-sm"
          />
          <button
            onClick={() => loadUsers(query)}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground font-semibold"
          >
            Search
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-[var(--accent-color-dynamic)]/40 bg-[var(--accent-color-dynamic)]/10 px-4 py-2 text-[var(--accent-color-dynamic)] text-sm">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Role</th>
                <th className="text-left p-3">Tier</th>
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
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-4 text-center text-muted-foreground"
                  >
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u._id} className="border-t border-border">
                    <td className="p-3">{u.name}</td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3 uppercase">{u.role}</td>
                    <td className="p-3">
                      <select
                        value={u.tier}
                        onChange={(e: any) =>
                          handleTierChange(u._id, e.target.value)
                        }
                        className="rounded border border-border bg-background px-2 py-1"
                      >
                        <option value="trial">trial</option>
                        <option value="normal">normal</option>
                        <option value="vip">vip</option>
                        <option value="vip_plus">vip_plus</option>
                      </select>
                    </td>
                    <td className="p-3">
                      {u.isActive === false ? "Inactive" : "Active"}
                    </td>
                    <td className="p-3">
                      {u.isActive !== false && (
                        <button
                          onClick={() => handleDeactivate(u._id)}
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
