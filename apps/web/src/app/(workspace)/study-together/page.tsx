import Link from "next/link";
import { load } from "@/lib/api";
import { getCourses } from "@/features/courses/queries";
import { createRoom, joinRoom } from "@/features/collaboration/actions";
import { PageHeader } from "@/components/shared/page-header";
import { DataError, EmptyState } from "@/components/shared/states";
import { ActionForm } from "@/components/shared/action-form";
import { TextField } from "@/components/shared/form-field";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
export const metadata = { title: "Study together" };
export default async function Rooms() {
  const [courses, sessions] = await Promise.all([
    getCourses(),
    load<{
      sessions: {
        _id: string;
        type: string;
        status: string;
        inviteCode?: string;
      }[];
    }>("/api/v1/study/sessions"),
  ]);
  const rooms = (sessions.data?.sessions || []).filter(
    (s) => s.type === "team" && s.status === "active",
  );
  return (
    <>
      <PageHeader
        title="Better questions, together"
        description="Invite a few peers and work through your material in a shared room."
      />
      <DataError message={courses.error || sessions.error} />
      <div className="mb-10 grid max-w-4xl gap-8 md:grid-cols-2">
        <section className="rounded-lg border p-6">
          <h2 className="mb-5 text-lg font-semibold">Create a room</h2>
          <ActionForm action={createRoom} submit="Create room">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="courseId">Course (optional)</FieldLabel>
                <NativeSelect name="courseId" id="courseId">
                  <NativeSelectOption value="">
                    Start without a course
                  </NativeSelectOption>
                  {courses.data?.courses
                    .filter((c) => c.status === "completed")
                    .map((c) => (
                      <NativeSelectOption key={c.id} value={c.id}>
                        {c.title}
                      </NativeSelectOption>
                    ))}
                </NativeSelect>
              </Field>
            </FieldGroup>
            <p className="text-sm text-muted-foreground">
              Up to four participants. Share the invite code with your peers.
            </p>
          </ActionForm>
        </section>
        <section className="rounded-lg border p-6">
          <h2 className="mb-5 text-lg font-semibold">Have an invite?</h2>
          <ActionForm action={joinRoom} submit="Join room" variant="outline">
            <FieldGroup>
              <TextField
                name="code"
                label="Invite code"
                required
                minLength={6}
                maxLength={6}
                autoComplete="off"
              />
            </FieldGroup>
          </ActionForm>
        </section>
      </div>
      <h2 className="mb-5 text-xl font-semibold">Rooms you host</h2>
      {rooms.length ? (
        <div className="flex flex-col gap-3">
          {rooms.map((room) => (
            <div
              key={room._id}
              className="flex items-center justify-between rounded-lg border p-5"
            >
              <p className="text-sm">
                Invite code: <strong>{room.inviteCode}</strong>
              </p>
              <Button asChild variant="outline">
                <Link href={`/study-together/${room._id}`}>Open room</Link>
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Room for another perspective"
          description="Create a room, or join a peer using their invite code."
        />
      )}
    </>
  );
}
