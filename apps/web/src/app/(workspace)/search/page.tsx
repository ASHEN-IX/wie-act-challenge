import { PageHeader } from "@/components/shared/page-header";
import { TextField } from "@/components/shared/form-field";
import { FieldGroup } from "@/components/ui/field";
import { JobForm } from "@/features/learning/job-form";
import { searchSources } from "@/features/learning/actions";
export const metadata = { title: "Explore sources" };
export default function Search() {
  return (
    <>
      <PageHeader
        title="Follow your curiosity"
        description="Find supporting sources for a question you’re exploring."
      />
      <div className="max-w-2xl">
        <JobForm action={searchSources} kind="search" submit="Find sources">
          <FieldGroup>
            <TextField
              label="What would you like to understand?"
              name="query"
              required
              minLength={2}
              maxLength={500}
            />
          </FieldGroup>
        </JobForm>
      </div>
    </>
  );
}
