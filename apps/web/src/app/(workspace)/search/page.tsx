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
        title="Explore sources"
        description="Search the web for sources on a question."
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
            <p className="text-sm text-muted-foreground">
              Your question is sent to a public web search engine to find
              links. Do not include names or other personal information.
            </p>
          </FieldGroup>
        </JobForm>
      </div>
    </>
  );
}
