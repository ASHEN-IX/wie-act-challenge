"use client";
import dynamic from "next/dynamic";
import type { BoardSignal } from "./whiteboard-canvas";

// The editor is large and browser-only: load it when the board is first opened.
const WhiteboardCanvas = dynamic(() => import("./whiteboard-canvas"), {
  ssr: false,
  loading: () => <p className="rounded-lg border p-4 text-sm text-muted-foreground">Loading whiteboard…</p>,
});

export function Whiteboard(props: { roomId: string; connected: boolean; signal: BoardSignal | null }) {
  return <WhiteboardCanvas {...props} />;
}
