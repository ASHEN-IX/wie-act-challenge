import { requireIdentity } from "@/server/identity";
import { getInstitutionContexts } from "@/features/institutions/queries";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await requireIdentity();
  const admin = identity.role === "admin";
  // Instructor tools show only for users who hold an active instructor or
  // institution-admin role. If roles cannot be loaded, keep the tools visible
  // rather than hide them from an instructor.
  const contexts = await getInstitutionContexts();
  const instructor = contexts.data
    ? contexts.data.institutions.some(
        (c) =>
          c.membership.status === "active" &&
          (c.membership.role === "instructor" ||
            c.membership.role === "university_admin"),
      )
    : true;
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
