import { PageHeader } from "@/components/shared/page-header";
import { TextField, LongField } from "@/components/shared/form-field";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { JobForm } from "@/features/learning/job-form";
import { generatePlan, finalizePlan } from "@/features/planning/actions";
import { getCourses } from "@/features/courses/queries";
import { DataError } from "@/components/shared/states";
export const metadata = { title: "Study planner" };
export default async function Planner() {
  const courses = await getCourses();
  return (
    <>
      <PageHeader
        title="A plan you can work with"
        description="Start with your goal and the time you have available."
      />
      <DataError message={courses.error} />
      <div className="max-w-2xl">
        <JobForm
          action={generatePlan}
          finalize={finalizePlan}
          kind="ai"
          submit="Generate a plan"
        >
          <FieldGroup>
            <LongField
              label="Learning goal"
              name="goal"
              required
              maxLength={500}
            />
            <TextField
              label="Available minutes"
              name="minutes"
              type="number"
              defaultValue={60}
              min={30}
              max={1440}
              required
            />
            <Field>
              <FieldLabel htmlFor="courseId">Course (optional)</FieldLabel>
              <NativeSelect id="courseId" name="courseId">
                <NativeSelectOption value="">
                  No course selected
                </NativeSelectOption>
                {courses.data?.courses
                  .filter((c) => c.status === "completed")
                  .map((course) => (
                    <NativeSelectOption key={course.id} value={course.id}>
                      {course.title}
                    </NativeSelectOption>
                  ))}
              </NativeSelect>
            </Field>
          </FieldGroup>
        </JobForm>
      </div>
    </>
  );
}
