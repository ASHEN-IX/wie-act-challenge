import Link from "next/link";
import { load } from "@/lib/api";
import { hasTeachingAccess } from "@/server/teaching";
import { requireIdentity } from "@/server/identity";
import { PageHeader } from "@/components/shared/page-header";
import { DataError, EmptyState } from "@/components/shared/states";
import { ActionForm } from "@/components/shared/action-form";
import { TextField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FieldGroup } from "@/components/ui/field";
import { RowAction } from "@/features/community/row-action";
import { joinRoom } from "@/features/collaboration/actions";
import {
  answerGroupInvite,
  blockUser,
  cancelRequest,
  createGroup,
  deleteGroup,
  dismissNotification,
  inviteToGroup,
  joinGroupSession,
  leaveOrRemove,
  removeConnection,
  requestByCode,
  requestConnection,
  respondToRequest,
  startGroupSession,
  unblockUser,
} from "@/features/community/actions";

export const metadata = { title: "Connections" };

interface Person {
  userId: string;
  name: string;
  friendshipId?: string;
  friendshipStatus?: string | null;
}
interface GroupSummary {
  groupId: string;
  name: string;
  subject: string;
  memberCount: number;
  role: "owner" | "member" | "invited";
  activeSession: { roomId: string; title: string } | null;
}
interface GroupDetail {
  groupId: string;
  members: { userId: string; name: string; isOwner: boolean }[];
  invites: { userId: string; name: string }[];
}
interface Notice {
  _id: string;
  type: string;
  message: string;
  metadata?: { kind?: string; inviteCode?: string; roomTitle?: string };
}

export default async function Connections({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const teaching = await hasTeachingAccess();
  const { userId: me } = await requireIdentity();
  const { q = "" } = await searchParams;
  const query = q.trim().slice(0, 50);
  const [friends, incoming, outgoing, blocked, groups, notices, results] = await Promise.all([
    load<{ friends: Person[] }>("/api/v1/users/friends"),
    load<{ requests: Person[] }>("/api/v1/users/friends/requests/incoming"),
    load<{ requests: Person[] }>("/api/v1/users/friends/requests/outgoing"),
    load<{ blocked: Person[] }>("/api/v1/users/friends/blocked"),
    load<{ groups: GroupSummary[] }>("/api/v1/users/groups"),
    load<{ notifications: Notice[] }>("/api/v1/notifications?status=unread&limit=50"),
    query.length >= 3
      ? load<{ results: Person[] }>(`/api/v1/users/friends/search?q=${encodeURIComponent(query)}`)
      : Promise.resolve({ data: { results: [] as Person[] }, error: undefined }),
  ]);

  const myFriends = friends.data?.friends ?? [];
  const roomInvites = (notices.data?.notifications ?? []).filter(
    (n) => n.type === "team_invite" && n.metadata?.kind === "study_room" && n.metadata.inviteCode,
  );
  const groupInvites = (groups.data?.groups ?? []).filter((g) => g.role === "invited");
  const myGroups = (groups.data?.groups ?? []).filter((g) => g.role !== "invited");
  const details = new Map<string, GroupDetail>();
  await Promise.all(
    myGroups.map(async (g) => {
      const result = await load<{ group: GroupDetail }>(`/api/v1/users/groups/${g.groupId}`);
      if (result.data) details.set(g.groupId, result.data.group);
    }),
  );
  const hasInvitations = roomInvites.length > 0 || groupInvites.length > 0;

  return (
    <div className="flex max-w-4xl flex-col gap-12">
      <PageHeader
        title="Connections"
        description="People you study with. Connecting never shares your courses, progress or institution."
        action={
          <Button asChild variant="outline">
            <Link href="/study-together">Back to Study Together</Link>
          </Button>
        }
      />
      <DataError message={friends.error || groups.error} />

      {hasInvitations && (
        <section aria-labelledby="invitations" className="flex flex-col gap-3">
          <h2 id="invitations" className="text-xl font-semibold">
            Invitations
          </h2>
          <ul className="divide-y rounded-lg border">
            {roomInvites.map((n) => (
              <li key={n._id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="min-w-0 text-sm">{n.message}</p>
                <div className="flex gap-2">
                  {!teaching && (
                    <ActionForm action={joinRoom} submit="Join room" className="flex items-center gap-2">
                      <input type="hidden" name="code" value={n.metadata!.inviteCode} />
                      <input type="hidden" name="commandId" value={n._id} />
                    </ActionForm>
                  )}
                  <RowAction action={dismissNotification} fields={{ id: n._id }} label="Dismiss" variant="ghost" />
                </div>
              </li>
            ))}
            {groupInvites.map((g) => (
              <li key={g.groupId} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="text-sm">
                  Join the study group <strong>{g.name}</strong>
                  {g.subject ? ` (${g.subject})` : ""}?
                </p>
                <div className="flex gap-2">
                  <RowAction action={answerGroupInvite} fields={{ groupId: g.groupId, decision: "accept" }} label="Join group" variant="default" />
                  <RowAction action={answerGroupInvite} fields={{ groupId: g.groupId, decision: "decline" }} label="Decline" variant="ghost" />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(incoming.data?.requests.length ?? 0) > 0 && (
        <section aria-labelledby="requests" className="flex flex-col gap-3">
          <h2 id="requests" className="text-xl font-semibold">
            Requests to connect
          </h2>
          <ul className="divide-y rounded-lg border">
            {incoming.data!.requests.map((p) => (
              <li key={p.friendshipId} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span className="font-medium">{p.name}</span>
                <div className="flex gap-2">
                  <RowAction action={respondToRequest} fields={{ friendshipId: p.friendshipId!, decision: "accept" }} label="Accept" variant="default" />
                  <RowAction action={respondToRequest} fields={{ friendshipId: p.friendshipId!, decision: "reject" }} label="Decline" variant="ghost" />
                  <RowAction action={blockUser} fields={{ userId: p.userId }} label="Block" variant="ghost" confirm={`Block ${p.name}? They won't be able to contact you.`} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="find" className="flex flex-col gap-4">
        <h2 id="find" className="text-xl font-semibold">
          Find someone to study with
        </h2>
        <form role="search" className="flex max-w-xl items-end gap-2">
          <div className="flex-1">
            <TextField label="Name (3+ letters)" name="q" defaultValue={query} maxLength={50} autoComplete="off" />
          </div>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        <p className="text-sm text-muted-foreground">
          You can only find people who accept requests. For a private connection, ask them for their friend code.
        </p>
        {query.length >= 3 && (
          <ul className="divide-y rounded-lg border">
            {(results.data?.results ?? []).map((p) => (
              <li key={p.userId} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span className="font-medium">{p.name}</span>
                {p.friendshipStatus === "accepted" ? (
                  <Badge variant="outline">Connected</Badge>
                ) : p.friendshipStatus === "pending" ? (
                  <Badge variant="outline">Request pending</Badge>
                ) : (
                  <RowAction action={requestConnection} fields={{ userId: p.userId }} label="Connect" />
                )}
              </li>
            ))}
            {!results.data?.results.length && (
              <li className="p-4 text-sm text-muted-foreground">No one found for “{query}”.</li>
            )}
          </ul>
        )}
        <details>
          <summary className="cursor-pointer text-sm font-medium">Have a friend code?</summary>
          <div className="mt-3 max-w-sm">
            <ActionForm action={requestByCode} submit="Send request" variant="outline">
              <FieldGroup>
                <TextField label="Friend code" name="friendCode" maxLength={12} autoComplete="off" required />
              </FieldGroup>
            </ActionForm>
          </div>
        </details>
        {(outgoing.data?.requests.length ?? 0) > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">Waiting for a reply</h3>
            <ul className="divide-y rounded-lg border">
              {outgoing.data!.requests.map((p) => (
                <li key={p.friendshipId} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <span className="text-sm">{p.name}</span>
                  <RowAction action={cancelRequest} fields={{ friendshipId: p.friendshipId! }} label="Cancel" variant="ghost" />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section aria-labelledby="mine" className="flex flex-col gap-3">
        <h2 id="mine" className="text-xl font-semibold">
          Your connections
        </h2>
        {myFriends.length ? (
          <ul className="divide-y rounded-lg border">
            {myFriends.map((p) => (
              <li key={p.userId} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span className="font-medium">{p.name}</span>
                <div className="flex gap-2">
                  <RowAction action={removeConnection} fields={{ userId: p.userId }} label="Remove" variant="ghost" confirm={`Remove ${p.name} from your connections?`} />
                  <RowAction action={blockUser} fields={{ userId: p.userId }} label="Block" variant="ghost" confirm={`Block ${p.name}?`} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          !friends.error && (
            <EmptyState
              title="No connections yet"
              description="Search for a classmate above, then invite them to a study room from inside the room."
            />
          )
        )}
      </section>

      <section aria-labelledby="groups" className="flex flex-col gap-4">
        <h2 id="groups" className="text-xl font-semibold">
          Study groups
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          A group is a reusable set of people. It starts shared study rooms and does not give anyone access to
          your courses or documents.
        </p>
        {myGroups.map((g) => {
          const detail = details.get(g.groupId);
          const owner = g.role === "owner";
          const candidates = myFriends.filter(
            (f) => !detail?.members.some((m) => m.userId === f.userId) && !detail?.invites.some((i) => i.userId === f.userId),
          );
          return (
            <article key={g.groupId} className="flex flex-col gap-4 rounded-lg border p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{g.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {g.subject ? `${g.subject} · ` : ""}
                    {g.memberCount} {g.memberCount === 1 ? "member" : "members"}
                  </p>
                </div>
                {!teaching && (
                  <div className="flex gap-2">
                    {g.activeSession && (
                      <RowAction action={joinGroupSession} fields={{ groupId: g.groupId }} label="Join current session" variant="default" />
                    )}
                    <RowAction
                      action={startGroupSession}
                      fields={{ groupId: g.groupId }}
                      label={g.activeSession ? "Start a new session" : "Start a session"}
                      variant={g.activeSession ? "outline" : "default"}
                    />
                  </div>
                )}
              </div>
              {detail && (
                <p className="text-sm">
                  {detail.members.map((m) => m.name + (m.isOwner ? " (owner)" : "")).join(", ")}
                  {detail.invites.length > 0 && (
                    <span className="text-muted-foreground"> · invited: {detail.invites.map((i) => i.name).join(", ")}</span>
                  )}
                </p>
              )}
              {owner && candidates.length > 0 && (
                <ActionForm action={inviteToGroup} submit="Invite" variant="outline" className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="groupId" value={g.groupId} />
                  <label className="sr-only" htmlFor={`invite-${g.groupId}`}>
                    Invite a connection
                  </label>
                  <select id={`invite-${g.groupId}`} name="friendId" required className="h-10 rounded-lg border bg-background px-3 text-sm">
                    <option value="">Invite a connection…</option>
                    {candidates.map((f) => (
                      <option key={f.userId} value={f.userId}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </ActionForm>
              )}
              {owner && candidates.length === 0 && myFriends.length === 0 && (
                <p className="text-sm text-muted-foreground">Connect with people first, then invite them here.</p>
              )}
              <div className="flex gap-2">
                {owner ? (
                  <RowAction action={deleteGroup} fields={{ groupId: g.groupId }} label="Delete group" variant="ghost" confirm={`Delete “${g.name}” for everyone?`} />
                ) : (
                  <RowAction action={leaveOrRemove} fields={{ groupId: g.groupId, userId: me }} label="Leave group" variant="ghost" confirm={`Leave “${g.name}”?`} />
                )}
              </div>
            </article>
          );
        })}
        <div className="max-w-md rounded-lg border p-5">
          <h3 className="mb-3 font-semibold">Create a group</h3>
          <ActionForm action={createGroup} submit="Create group">
            <FieldGroup>
              <TextField label="Group name" name="name" required minLength={2} maxLength={60} />
              <TextField label="Subject (optional)" name="subject" maxLength={60} />
            </FieldGroup>
          </ActionForm>
        </div>
      </section>

      {(blocked.data?.blocked.length ?? 0) > 0 && (
        <section aria-labelledby="blocked" className="flex flex-col gap-3">
          <h2 id="blocked" className="text-xl font-semibold">
            Blocked
          </h2>
          <ul className="divide-y rounded-lg border">
            {blocked.data!.blocked.map((p) => (
              <li key={p.userId} className="flex items-center justify-between gap-3 p-3">
                <span className="text-sm">{p.name}</span>
                <RowAction action={unblockUser} fields={{ userId: p.userId }} label="Unblock" variant="ghost" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
