import { load, segment } from "@/lib/api";
import { requireIdentity } from "@/server/identity";
import { PageHeader } from "@/components/shared/page-header";
import { DataError, EmptyState } from "@/components/shared/states";
import { ActionForm } from "@/components/shared/action-form";
import { LongField } from "@/components/shared/form-field";
import { FieldGroup } from "@/components/ui/field";
import {
  askRoom,
  leaveRoom,
  startRoom,
  endRoom,
} from "@/features/collaboration/actions";
import { RealtimeStatus } from "@/features/collaboration/realtime-status";
export default async function Room({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const id = segment(sessionId);
  const participants = await load<{
    participants: {
      userId: string;
      name: string;
      role: string;
      leftAt?: string;
    }[];
  }>(`/api/v1/study/sessions/team/${id}/participants`);
  if (!participants.data)
    return <DataError message={participants.error || "Room is unavailable."} />;
  const [history, identity] = await Promise.all([
    load<{ items: { _id: string; content: string; messageType: string }[] }>(
      `/api/v1/session-chat/${id}/history`,
    ),
    requireIdentity(),
  ]);
  const host = participants.data.participants.some(
    (p) => p.userId === identity.userId && p.role === "host",
  );
  const ownerSession = host
    ? await load<{ session: { inviteCode?: string } }>(
        `/api/v1/study/sessions/${id}`,
      )
    : undefined;
  return (
    <>
      <PageHeader
        title="Your study room"
        description="Work through the material and make space for every perspective."
        action={<RealtimeStatus sessionId={sessionId} />}
      />
      <DataError message={history.error} />
      <div className="grid gap-9 lg:grid-cols-[minmax(0,1fr)_260px]">
        <section className="flex flex-col gap-6">
          <h2 className="text-xl font-semibold">Session questions</h2>
          {history.data?.items.length ? (
            history.data.items.map((item) => (
              <article key={item._id} className="rounded-lg border p-5">
                <p className="mb-2 text-xs capitalize text-muted-foreground">
                  {item.messageType.replaceAll("_", " ")}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-7">
                  {item.content}
                </p>
              </article>
            ))
          ) : (
            <EmptyState
              title="Start with a question"
              description="Use the shared search to explore your session topic."
            />
          )}
          <ActionForm action={askRoom} submit="Ask about this session">
            <input type="hidden" name="id" value={sessionId} />
            <FieldGroup>
              <LongField
                name="query"
                label="What are you exploring?"
                required
                minLength={2}
                maxLength={1000}
              />
            </FieldGroup>
          </ActionForm>
        </section>
        <aside className="flex flex-col gap-6">
          <h2 className="font-semibold">Participants</h2>
          {ownerSession?.data?.session.inviteCode && (
            <p className="text-sm text-muted-foreground">
              Invite code:{" "}
              <code
                data-testid="invite-code"
                className="font-semibold text-foreground"
              >
                {ownerSession.data.session.inviteCode}
              </code>
            </p>
          )}
          {participants.data.participants
            .filter((p) => !p.leftAt)
            .map((p) => (
              <div key={p.userId} className="flex justify-between text-sm">
                <span>{p.name || "Participant"}</span>
                <span className="text-muted-foreground">{p.role}</span>
              </div>
            ))}
          {host && (
            <>
              <ActionForm action={startRoom} submit="Start session">
                <input type="hidden" name="id" value={sessionId} />
              </ActionForm>
              <ActionForm
                action={endRoom}
                submit="End session"
                variant="outline"
              >
                <input type="hidden" name="id" value={sessionId} />
              </ActionForm>
            </>
          )}
          <ActionForm action={leaveRoom} submit="Leave room" variant="outline">
            <input type="hidden" name="id" value={sessionId} />
          </ActionForm>
        </aside>
      </div>
    </>
  );
}
