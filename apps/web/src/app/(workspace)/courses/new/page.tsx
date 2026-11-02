import { PageHeader } from "@/components/shared/page-header";
import { DataError } from "@/components/shared/states";
import { UploadForm } from "@/features/courses/upload-form";
import { getSubjects } from "@/features/courses/queries";
import { getInstitutionContexts } from "@/features/institutions/queries";
export const metadata = { title: "Upload course" };
export default async function NewCourse() {
  const [subjects, contexts] = await Promise.all([
    getSubjects(),
    getInstitutionContexts(),
  ]);
  return (
    <>
      <PageHeader
        title="Bring your course material"
        description="Add the sources you already have. EdNova organizes them by subject and prepares your course in the background."
      />
      <DataError message={subjects.error} />
      <div className="max-w-2xl">
        <UploadForm
          subjects={subjects.data?.subjects || []}
          institutions={
            contexts.data?.institutions
              .filter((c) =>
                ["instructor", "university_admin"].includes(c.membership.role),
              )
              .map((c) => c.institution) || []
          }
        />
      </div>
    </>
  );
}
