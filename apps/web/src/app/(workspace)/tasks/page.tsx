import { load } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { DataError } from "@/components/shared/states";
import { ActionForm } from "@/components/shared/action-form";
import { TextField, LongField } from "@/components/shared/form-field";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { TaskList, type Task } from "@/features/tasks/task-list";
import { createTask } from "@/features/tasks/actions";
export const metadata = { title: "Tasks" };
export default async function Tasks() {
  const result = await load<{ tasks: Task[] }>("/api/v1/study/tasks");
  return (
    <>
      <PageHeader
        title="Tasks"
        description="What you plan to work on. Add one on the right."
      />
      <DataError message={result.error} />
      <div className="grid items-start gap-9 xl:grid-cols-[minmax(0,1fr)_320px]">
        <TaskList tasks={result.data?.tasks || []} />
        <section className="rounded-lg border p-6">
          <h2 className="mb-6 text-lg font-semibold">Add a task</h2>
          <ActionForm action={createTask} submit="Add task">
            <FieldGroup>
              <TextField
                name="title"
                label="What will you work on?"
                required
                maxLength={200}
              />
              <LongField
                name="description"
                label="Notes (optional)"
                maxLength={2000}
              />
              <TextField
                name="minutes"
                type="number"
                label="Estimated minutes"
                min={1}
                max={600}
                defaultValue={30}
                required
              />
              <Field>
                <FieldLabel htmlFor="priority">Priority</FieldLabel>
                <NativeSelect
                  name="priority"
                  id="priority"
                  defaultValue="medium"
                >
                  {["low", "medium", "high"].map((value) => (
                    <NativeSelectOption key={value} value={value}>
                      {value}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </FieldGroup>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
