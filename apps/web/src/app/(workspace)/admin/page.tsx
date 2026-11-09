import { requireIdentity } from "@/server/identity";
import { load } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { DataError, EmptyState } from "@/components/shared/states";
export default async function Admin() {
  await requireIdentity("admin");
  const result = await load<{
    users: {
      id: string;
      email: string;
      name?: string;
      role: string;
      isActive?: boolean;
    }[];
  }>("/api/v1/auth/admin/users");
  return (
    <>
      <PageHeader
        title="Administration"
        description="Account access remains controlled by the API’s role checks."
      />
      <DataError message={result.error} />
      {result.data?.users.length ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {result.data.users.map((user) => (
                <tr key={user.id}>
                  <td className="p-4">{user.name || "—"}</td>
                  <td className="p-4">{user.email}</td>
                  <td className="p-4">{user.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No accounts to display"
          description="Accounts appear here when available."
        />
      )}
    </>
  );
}
