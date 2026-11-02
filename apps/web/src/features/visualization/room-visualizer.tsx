"use client";
import { useEffect, useRef, useState } from "react";
import type { BinarySearchState } from "@study-partner/shared/visualization";
import { BinarySearchVisualizer } from "./binary-search";
import { loadRoomVisualization, updateRoomVisualization } from "./room-actions";
import { Button } from "@/components/ui/button";

type Cursor = Awaited<ReturnType<typeof loadRoomVisualization>>;
export function RoomVisualizer({
  roomId,
  seq,
  presenter,
}: {
  roomId: string;
  seq: number;
  presenter: boolean;
}) {
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef<{
    commandId: string;
    expectedSeq: number;
    state: BinarySearchState;
  } | null>(null);
  useEffect(() => {
    let current = true;
    setError("");
    loadRoomVisualization(roomId)
      .then((value) => {
        if (current) setCursor(value);
      })
      .catch((e) => {
        if (current) {
          setCursor(null);
          setError(e.message);
        }
      });
    return () => {
      current = false;
    };
  }, [roomId, seq]);
  useEffect(() => {
    pending.current = null;
  }, [roomId, presenter]);
  async function submit(state: BinarySearchState) {
    if (!cursor || !presenter || busy) return;
    setBusy(true);
    setError("");
    // Retain an uncertain request payload until its outcome is recovered. A
    // different click cannot silently reuse an old command for new parameters.
    if (!pending.current)
      pending.current = {
        commandId: crypto.randomUUID(),
        expectedSeq: cursor.seq,
        state,
      };
    const command = pending.current;
    try {
      const next = await updateRoomVisualization(
        roomId,
        command.state,
        command.commandId,
        command.expectedSeq,
      );
      pending.current = null;
      setCursor(next);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Shared illustration unavailable",
      );
      try {
        const recovered = await loadRoomVisualization(roomId);
        setCursor(recovered);
        // If the room advanced, refresh authority and let the user explicitly
        // issue a new command. A committed command remains replayable server-side.
        if (recovered.seq !== command.expectedSeq) pending.current = null;
      } catch {
        setCursor(null);
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <section data-testid="room-visualization" className="space-y-3">
      <h2 className="font-semibold">Shared example</h2>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {cursor ? (
        <BinarySearchVisualizer
          state={cursor.state}
          readOnly={!presenter}
          busy={busy}
          onChange={submit}
        />
      ) : (
        <p role="status">No shared example yet.</p>
      )}
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          try {
            setCursor(await loadRoomVisualization(roomId));
            setError("");
          } catch (e) {
            setCursor(null);
            setError(
              e instanceof Error ? e.message : "Illustration unavailable",
            );
          }
        }}
      >
        Reload example
      </Button>
    </section>
  );
}
