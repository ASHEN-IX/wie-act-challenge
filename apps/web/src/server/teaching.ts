import "server-only";
import { requireIdentity } from "./identity";
import { getInstitutionContexts } from "@/features/institutions/queries";

export async function hasTeachingAccess() {
  const identity = await requireIdentity();
  if (identity.role === "admin") return true;
  const contexts = await getInstitutionContexts();
  return (
    contexts.data?.institutions.some(
      (c) =>
        c.membership.status === "active" &&
        (c.membership.role === "instructor" ||
          c.membership.role === "university_admin"),
    ) ?? false
  );
}
