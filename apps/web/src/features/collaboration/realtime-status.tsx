"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
export function RealtimeStatus({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState("Connecting");
  useEffect(() => {
    let stopped = false;
    let socket: WebSocket;
    let reconnect: ReturnType<typeof setTimeout>;
    let refresh: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const connect = () => {
      const url = new URL(
        "/ws/realtime",
        process.env.NEXT_PUBLIC_WS_URL ||
          `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}`,
      );
      url.searchParams.set("sessionId", sessionId);
      socket = new WebSocket(url);
      socket.onopen = () => {
        attempts = 0;
        setStatus("Connected");
        router.refresh();
      };
      socket.onmessage = () => {
        clearTimeout(refresh);
        refresh = setTimeout(() => router.refresh(), 300);
      };
      socket.onerror = () => setStatus("Connection interrupted");
      socket.onclose = (event) => {
        if (stopped) return;
        if ([4401, 4403, 4001, 4003].includes(event.code)) {
          setStatus("Access ended");
          router.refresh();
          return;
        }
        setStatus("Reconnecting");
        reconnect = setTimeout(
          connect,
          Math.min(30000, 1000 * 2 ** attempts++),
        );
      };
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(reconnect);
      clearTimeout(refresh);
      socket?.close();
    };
  }, [sessionId, router]);
  return (
    <Badge variant="secondary" aria-live="polite">
      {status}
    </Badge>
  );
}
