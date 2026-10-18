import { requireIdentity } from "@/server/identity";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await requireIdentity();
  return (
    <WorkspaceShell email={identity.email} admin={identity.role === "admin"}>
      {children}
    </WorkspaceShell>
  );
}
