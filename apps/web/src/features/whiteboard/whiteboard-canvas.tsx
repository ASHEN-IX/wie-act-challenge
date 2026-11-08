"use client";
import "@excalidraw/excalidraw/index.css";
import {
  CaptureUpdateAction,
  Excalidraw,
  reconcileElements,
  restoreElements,
} from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  fetchWhiteboard,
  lockWhiteboard,
  saveWhiteboard,
  type BoardElementPayload,
  type BoardState,
} from "./actions";
import { changedSince, inBatches, remember, tombstoneAll, type KnownElements } from "./sync";

// Self-hosted fonts: the app's CSP does not allow third-party font hosts.
if (typeof window !== "undefined") {
  (window as unknown as { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH =
    "/excalidraw-assets/";
}

export interface BoardSignal {
  version: number;
  locked: boolean;
}

type SaveState = "saved" | "saving" | "offline";
type Meta = Pick<BoardState, "locked" | "canEdit" | "isHost">;

const SAVE_DEBOUNCE_MS = 350;
const POLL_WHEN_OFFLINE_MS = 8000;

const SAVE_LABEL: Record<SaveState, string> = {
  saved: "All changes saved",
  saving: "Saving…",
  offline: "Offline. Changes will sync when the connection returns.",
};

export default function WhiteboardCanvas({
  roomId,
  connected,
  signal,
}: {
  roomId: string;
  connected: boolean;
  signal: BoardSignal | null;
}) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const known = useRef<KnownElements>(new Map());
  const serverVersion = useRef(0);
  const inflight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const metaRef = useRef<Meta>({ locked: false, canEdit: true, isHost: false });

  const [initial, setInitial] = useState<OrderedExcalidrawElement[] | null>(null);
  const [meta, setMeta] = useState<Meta>(metaRef.current);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [confirmClear, setConfirmClear] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setDark(root.classList.contains("dark"));
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const applyMeta = useCallback((board: BoardState) => {
    const next = { locked: board.locked, canEdit: board.canEdit, isHost: board.isHost };
    metaRef.current = next;
    setMeta(next);
  }, []);

  /** Merge the server's board into the live scene without re-sending what it already has. */
  const applyRemote = useCallback((board: BoardState) => {
    const api = apiRef.current;
    serverVersion.current = Math.max(serverVersion.current, board.version);
    applyMeta(board);
    if (!api) return;
    const remote = restoreElements(board.elements as never, null) as never as OrderedExcalidrawElement[];
    const merged = reconcileElements(
      api.getSceneElementsIncludingDeleted() as OrderedExcalidrawElement[],
      remote as never,
      api.getAppState(),
    );
    remember(known.current, remote);
    api.updateScene({ elements: merged, captureUpdate: CaptureUpdateAction.NEVER });
  }, [applyMeta]);

  const refresh = useCallback(async () => {
    const result = await fetchWhiteboard(roomId);
    if ("error" in result) {
      setSaveState("offline");
      return;
    }
    applyRemote(result.board);
  }, [applyRemote, roomId]);

  const flush = useCallback(async () => {
    const api = apiRef.current;
    if (!api || inflight.current || !metaRef.current.canEdit) return;
    const changed = changedSince(
      known.current,
      api.getSceneElementsIncludingDeleted() as OrderedExcalidrawElement[],
    );
    if (!changed.length) {
      setSaveState("saved");
      return;
    }
    inflight.current = true;
    setSaveState("saving");
    let failed = false;
    for (const batch of inBatches(changed)) {
      const result = await saveWhiteboard(roomId, batch as unknown as BoardElementPayload[]);
      if ("error" in result) {
        failed = true;
        if (result.status === 403) setError(result.error);
        break;
      }
      remember(known.current, batch);
      applyRemote(result.board);
    }
    inflight.current = false;
    if (failed) {
      setSaveState("offline");
      timer.current = setTimeout(() => void flush(), POLL_WHEN_OFFLINE_MS);
    } else {
      void flush(); // anything edited while saving
    }
  }, [applyRemote, roomId]);

  const scheduleFlush = useCallback(() => {
    if (!metaRef.current.canEdit) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
  }, [flush]);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    void fetchWhiteboard(roomId).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setError(result.error);
        return;
      }
      serverVersion.current = result.board.version;
      applyMeta(result.board);
      const restored = restoreElements(result.board.elements as never, null) as never as OrderedExcalidrawElement[];
      remember(known.current, restored);
      setInitial(restored);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer.current);
    };
  }, [roomId, applyMeta]);

  // A newer version announced by the room: fetch it.
  useEffect(() => {
    if (!signal || initial === null) return;
    if (signal.version > serverVersion.current || signal.locked !== metaRef.current.locked) {
      void refresh();
    }
  }, [signal, initial, refresh]);

  // Recover after a reconnect, and keep polling while the socket is down.
  useEffect(() => {
    if (initial === null) return;
    if (connected) {
      void refresh();
      return;
    }
    const id = setInterval(() => void refresh(), POLL_WHEN_OFFLINE_MS);
    return () => clearInterval(id);
  }, [connected, initial, refresh]);

  const clearBoard = () => {
    const api = apiRef.current;
    if (!api) return;
    const all = api.getSceneElementsIncludingDeleted() as OrderedExcalidrawElement[];
    const cleared = tombstoneAll(all, () => Math.floor(Math.random() * 2 ** 31));
    const byId = new Map(cleared.map((e) => [e.id, e]));
    api.updateScene({
      elements: all.map((e) => byId.get(e.id) ?? e),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY, // so Undo can bring it back
    });
    setConfirmClear(false);
    scheduleFlush();
  };

  const toggleLock = async () => {
    const result = await lockWhiteboard(roomId, !meta.locked);
    if ("error" in result) setError(result.error);
    else applyMeta(result.board);
  };

  if (error && initial === null) {
    return (
      <p role="alert" className="rounded-lg border p-4 text-sm text-destructive">
        {error}
      </p>
    );
  }
  if (initial === null) {
    return <p className="rounded-lg border p-4 text-sm text-muted-foreground">Loading whiteboard…</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span role="status" className="text-muted-foreground">
          {meta.locked && !meta.isHost ? "The host has locked this board. You can view it." : SAVE_LABEL[saveState]}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {meta.isHost && (
            <Button size="sm" variant="outline" onClick={toggleLock}>
              {meta.locked ? "Unlock board" : "Lock board"}
            </Button>
          )}
          {meta.canEdit &&
            (confirmClear ? (
              <>
                <span className="text-muted-foreground">Clear the board for everyone?</span>
                <Button size="sm" variant="destructive" onClick={clearBoard}>
                  Yes, clear
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setConfirmClear(true)}>
                Clear board
              </Button>
            ))}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div
        className="h-[min(70vh,640px)] min-h-[420px] overflow-hidden rounded-lg border"
        aria-label="Shared whiteboard"
      >
        <Excalidraw
          excalidrawAPI={(api) => {
            apiRef.current = api;
          }}
          initialData={{ elements: initial, scrollToContent: true }}
          onChange={scheduleFlush}
          viewModeEnabled={!meta.canEdit}
          theme={dark ? "dark" : "light"}
          UIOptions={{
            canvasActions: { loadScene: false, saveToActiveFile: false, clearCanvas: false },
          }}
        />
      </div>
    </div>
  );
}
