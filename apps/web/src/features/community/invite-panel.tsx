"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  inviteConnectionToRoom,
  listConnectionsForInvite,
  type ConnectionSummary,
} from "./actions";

/** Lists the caller's connections and sends a room invitation to one of them. */
export function InvitePanel({ roomId }: { roomId: string }) {
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<ConnectionSummary[] | null>(null);
  const [status, setStatus] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && friends === null) {
      startTransition(async () => {
        const result = await listConnectionsForInvite();
        setFriends(result.friends);
        setError(result.error ?? null);
      });
    }
  };

  const invite = (friend: ConnectionSummary) =>
    startTransition(async () => {
      const result = await inviteConnectionToRoom(roomId, friend.userId);
      setStatus((s) => ({ ...s, [friend.userId]: "error" in result ? result.error : "Invited" }));
    });

  return (
    <div className="flex flex-col gap-2">
      <Button size="sm" variant="outline" aria-expanded={open} onClick={toggle}>
        Invite a connection
      </Button>
      {open && (
        <div className="rounded-lg border p-3 text-sm">
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          {friends === null && !error && <p className="text-muted-foreground">Loading…</p>}
          {friends?.length === 0 && !error && (
            <p className="text-muted-foreground">
              You have no connections yet. Add some from Connections, or share this room’s invite code.
            </p>
          )}
          <ul className="flex flex-col divide-y">
            {friends?.map((friend) => (
              <li key={friend.userId} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0 truncate">{friend.name}</span>
                {status[friend.userId] === "Invited" ? (
                  <span role="status" className="text-xs text-muted-foreground">
                    Invited
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {status[friend.userId] && (
                      <span role="alert" className="text-xs text-destructive">
                        {status[friend.userId]}
                      </span>
                    )}
                    <Button size="xs" variant="outline" disabled={pending} onClick={() => invite(friend)}>
                      Invite
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
