import { PageHeader } from "@/components/shared/page-header";
import { DataError } from "@/components/shared/states";
import { UploadForm, SubjectForm } from "@/features/courses/upload-form";
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
        description="Keep your original sources and organize them by subject."
      />
      <DataError message={subjects.error} />
      <div className="max-w-xl">
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
        {Boolean(subjects.data?.subjects.length) && (
          <details className="mt-10 border-t pt-6">
            <summary className="cursor-pointer text-sm font-medium">
              Create another subject
            </summary>
            <div className="mt-5">
              <SubjectForm />
            </div>
          </details>
        )}
      </div>
    </>
  );
}
