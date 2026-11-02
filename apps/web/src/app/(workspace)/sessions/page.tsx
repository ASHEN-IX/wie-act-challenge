import Link from "next/link";
import { load } from "@/lib/api";
import { getCourses } from "@/features/courses/queries";
import { startSession } from "@/features/learning/session-actions";
import { PageHeader } from "@/components/shared/page-header";
import { DataError, EmptyState } from "@/components/shared/states";
import { ActionForm } from "@/components/shared/action-form";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { isCourseReady } from "@/features/courses/lifecycle";
export default async function Sessions() {
  const [result, courses] = await Promise.all([
    load<{
      sessions: {
        _id: string;
        status: string;
        type?: string;
        startTime?: string;
        duration?: number;
      }[];
    }>("/api/v1/study/sessions"),
    getCourses(),
  ]);
  const ready =
    courses.data?.courses.filter(isCourseReady) || [];
  return (
    <>
      <PageHeader
        title="Focused study"
        description="Work through your course topics at your own pace."
      />
      <DataError message={result.error || courses.error} />
      {ready.length > 0 && (
        <div className="mb-9 max-w-md">
          <ActionForm action={startSession} submit="Start studying">
            <Field>
              <FieldLabel htmlFor="courseId">Choose a course</FieldLabel>
              <NativeSelect id="courseId" name="courseId">
                {ready.map((c) => (
                  <NativeSelectOption value={c.id} key={c.id}>
                    {c.title}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          </ActionForm>
        </div>
      )}
      {result.data?.sessions.length ? (
        <div className="divide-y rounded-lg border">
          {result.data.sessions.map((session) => (
            <Link
              key={session._id}
              href={
                session.type === "team"
                  ? `/study-together/${session._id}`
                  : `/sessions/${session._id}`
              }
              className="flex justify-between gap-4 p-5 hover:bg-muted"
            >
              <span>
                {session.type === "team" ? "Group session" : "Study session"}
              </span>
              <span className="text-sm text-muted-foreground">
                {session.status} · {session.duration || 0} min
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Start a focused session"
          description="Upload and process a course first, then choose it here to study its topics."
        />
      )}
    </>
  );
}
