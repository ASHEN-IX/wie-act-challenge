import { ActionForm } from "@/components/shared/action-form";
import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { EmptyState } from "@/components/shared/states";
import { updateTask } from "./actions";
export interface Task {
  _id: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  estimatedTime?: number;
}
export function TaskList({ tasks }: { tasks: Task[] }) {
  if (!tasks.length)
    return (
      <EmptyState
        title="A clear plan starts small"
        description="Add one task you can make progress on today."
      />
    );
  return (
    <div className="divide-y rounded-lg border">
      {tasks.map((task) => (
        <article
          key={task._id}
          className="flex flex-wrap items-start justify-between gap-6 p-5"
        >
          <div className="flex min-w-0 flex-col gap-2">
            <h2 className="font-medium">{task.title}</h2>
            {task.description && (
              <p className="max-w-xl text-sm text-muted-foreground">
                {task.description}
              </p>
            )}
            <div className="flex items-center gap-3">
              <Badge variant="secondary">{task.priority}</Badge>
              <span className="text-xs text-muted-foreground">
                {task.estimatedTime || 0} minutes
              </span>
            </div>
          </div>
          <ActionForm
            action={updateTask}
            submit="Update"
            variant="outline"
            className="flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="id" value={task._id} />
            <Field>
              <FieldLabel htmlFor={`status-${task._id}`} className="sr-only">
                Status of {task.title}
              </FieldLabel>
              <NativeSelect
                id={`status-${task._id}`}
                name="status"
                defaultValue={task.status}
              >
                {["todo", "in-progress", "completed", "cancelled"].map(
                  (status) => (
                    <NativeSelectOption value={status} key={status}>
                      {status}
                    </NativeSelectOption>
                  ),
                )}
              </NativeSelect>
            </Field>
          </ActionForm>
        </article>
      ))}
    </div>
  );
}
