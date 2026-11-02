import { plural } from "@/lib/utils";
import Link from "next/link";
import { randomUUID } from 'node:crypto';
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
import { Badge } from "@/components/ui/badge";
import { isCourseReady } from "@/features/courses/lifecycle";

export const metadata = { title: "Study together" };

interface StudyRoomItem {
  roomId: string;
  inviteCode: string;
  title: string;
  currentPhase: string;
  participantsCount: number;
}

export default async function Rooms() {
  const [courses, sessions, studyRooms] = await Promise.all([
    getCourses(),
    load<{
      sessions: {
        _id: string;
        type: string;
        status: string;
        inviteCode?: string;
      }[];
    }>("/api/v1/study/sessions"),
    load<{
      rooms: StudyRoomItem[];
    }>("/api/v1/study/rooms"),
  ]);

  const dedicatedRooms = studyRooms.data?.rooms || [];
  const legacyRooms = (sessions.data?.sessions || []).filter(
    (s) => s.type === "team" && s.status === "active",
  );

  return (
    <>
      <PageHeader
        title="Study Together"
        description="Study with up to six peers in a shared room. Create one or join with a code."
      />
      <DataError message={courses.error || sessions.error} />
      <div className="mb-10 grid max-w-4xl gap-8 md:grid-cols-2">
        <section className="rounded-lg border p-6">
          <h2 className="mb-5 text-lg font-semibold">Create a room</h2>
          <ActionForm action={createRoom} submit="Create room">
            <input type="hidden" name="commandId" value={randomUUID()} />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="courseId">Course (optional)</FieldLabel>
                <NativeSelect name="courseId" id="courseId">
                  <NativeSelectOption value="">
                    Start without a course
                  </NativeSelectOption>
                  {courses.data?.courses
                    .filter(isCourseReady)
                    .map((c) => (
                      <NativeSelectOption key={c.id} value={c.id}>
                        {c.title}
                      </NativeSelectOption>
                    ))}
                </NativeSelect>
              </Field>
            </FieldGroup>
            <p className="text-sm text-muted-foreground">
              You get an invite code to share.
            </p>
          </ActionForm>
        </section>
        <section className="rounded-lg border p-6">
          <h2 className="mb-5 text-lg font-semibold">Have an invite?</h2>
          <ActionForm action={joinRoom} submit="Join room" variant="outline">
            <input type="hidden" name="commandId" value={randomUUID()} />
            <FieldGroup>
              <TextField
                name="code"
                label="Invite code"
                required
                minLength={6}
                maxLength={6}
                autoComplete="off"
                placeholder="e.g. DB1NF2"
              />
            </FieldGroup>
          </ActionForm>
        </section>
      </div>

      <h2 className="mb-5 text-xl font-semibold">Your rooms</h2>
      {dedicatedRooms.length > 0 || legacyRooms.length > 0 ? (
        <div className="flex flex-col gap-3">
          {dedicatedRooms.map((room) => (
            <div
              key={room.roomId}
              className="flex items-center justify-between rounded-lg border p-5"
            >
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-foreground">
                  {room.title}
                </span>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    Invite code:{" "}
                    <code className="font-mono font-bold text-foreground">
                      {room.inviteCode}
                    </code>
                  </span>
                  <span>•</span>
                  <span>{plural(room.participantsCount, "participant")}</span>
                  <Badge variant="outline" className="text-xs capitalize">
                    {room.currentPhase.replaceAll("_", " ")}
                  </Badge>
                </div>
              </div>
              <Button asChild variant="outline">
                <Link href={`/study-together/${room.roomId}`}>Open room</Link>
              </Button>
            </div>
          ))}

          {legacyRooms.map((room) => (
            <div
              key={room._id}
              className="flex items-center justify-between rounded-lg border p-5"
            >
              <p className="text-sm">
                Invite code:{" "}
                <code className="font-mono font-bold text-foreground">
                  {room.inviteCode}
                </code>
              </p>
              <Button asChild variant="outline">
                <Link href={`/study-together/${room._id}`}>Open room</Link>
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No rooms yet"
          description="Create a room, or enter a peer’s invite code above."
        />
      )}
    </>
  );
}
