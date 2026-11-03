import { requireIdentity } from "@/server/identity";
import { hasTeachingAccess } from "@/server/teaching";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await requireIdentity();
  const admin = identity.role === "admin";
  const instructor = await hasTeachingAccess();
  return (
    <WorkspaceShell
      email={identity.email}
      admin={admin}
      instructor={instructor}
    >
      {children}
    </WorkspaceShell>
  );
}
