import { requireIdentity } from "@/server/identity";
import { getInstitutionContexts } from "@/features/institutions/queries";
import { InstitutionAdmin } from "@/features/institutions/institution-admin";
import { DataError } from "@/components/shared/states";
export default async function Institutions() {
  const identity = await requireIdentity();
  const result = await getInstitutionContexts();
  return (
    <>
      <DataError message={result.error} />
      <InstitutionAdmin
        contexts={result.data?.institutions || []}
        platformAdmin={identity.role === "admin"}
      />
    </>
  );
}
