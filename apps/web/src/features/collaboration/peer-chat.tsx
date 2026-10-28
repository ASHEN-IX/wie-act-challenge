"use client";
import type { usePeerText } from "./use-peer-text";
import { Button } from "@/components/ui/button";

export function PeerChat({
  chat,
  connected,
}: {
  chat: ReturnType<typeof usePeerText>;
  connected: boolean;
}) {
  const { state } = chat;
  return (
    <section
      className="min-w-0 rounded-lg border p-5"
      aria-label="Public peer discussion"
    >
      <h2 className="text-lg font-semibold">Peer discussion</h2>
      <p className="text-sm text-muted-foreground">
        Shared with room members. AI is not required.
      </p>
      <p role="status" className="mt-2 text-xs">
        {chat.historyStatus}
      </p>
      {connected && (
        <Button
          variant="outline"
          disabled={chat.historyStatus === "Recovering messages…"}
          onClick={() => void chat.recover()}
        >
          Recover messages
        </Button>
      )}
      {state.messages.length === 0 && (
        <p className="my-4 text-sm">No accepted peer messages loaded.</p>
      )}
      <ol
        className="my-4 max-h-96 space-y-3 overflow-y-auto"
        aria-label="Accepted peer messages"
        aria-live="polite"
        aria-relevant="additions"
      >
        {state.messages.map((m) => (
          <li
            key={m.messageId}
            data-testid={`peer-message-${m.messageId}`}
            data-message-seq={m.seq}
            className="rounded border p-3"
          >
            <p className="text-xs font-semibold">
              {m.senderName}
              {m.senderUserId === state.currentUserId ? " (You)" : ""} ·
              Accepted
            </p>
            <p className="whitespace-pre-wrap break-words text-sm">{m.text}</p>
          </li>
        ))}
      </ol>
      {state.outbox && (
        <div
          role="status"
          data-testid="peer-outbox"
          className="my-3 rounded border p-3 text-sm"
        >
          <p className="whitespace-pre-wrap break-words">{state.outbox.text}</p>
          <p>
            {state.outbox.status === "pending"
              ? "Pending acceptance…"
              : state.outbox.status === "retryable"
                ? "Retryable — acceptance uncertain"
                : "Failed"}
          </p>
          {state.outbox.error && <p>{state.outbox.error}</p>}
          {state.outbox.status === "retryable" && (
            <Button disabled={!connected} onClick={() => void chat.send(true)}>
              Retry same message
            </Button>
          )}
          {state.outbox.status === "failed" && (
            <Button onClick={chat.editFailed}>Edit draft</Button>
          )}
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void chat.send();
        }}
        className="space-y-3"
      >
        <label
          className="block text-sm font-medium"
          htmlFor={`peer-draft-${state.roomId}`}
        >
          Message to room
        </label>
        <textarea
          id={`peer-draft-${state.roomId}`}
          value={state.draft}
          onChange={(event) => chat.setDraft(event.target.value)}
          maxLength={2000}
          required
          rows={3}
          className="w-full rounded border bg-background p-3 text-sm"
          disabled={!!state.outbox}
        />
        <Button
          type="submit"
          disabled={
            !connected ||
            chat.isSending ||
            !!state.outbox ||
            !state.draft.trim()
          }
        >
          Send message
        </Button>
        {!connected && (
          <p className="text-xs text-muted-foreground">
            Connect to the room to send. Your draft is kept.
          </p>
        )}
      </form>
    </section>
  );
}
