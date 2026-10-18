import { useCallback, useEffect, useRef, useState } from "react";

const WS_BASE =
  process.env.NEXT_PUBLIC_WS_URL ||
  (typeof window === "undefined" ? "" : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`);

export default function useChatWebSocket({ sessionId, userId, onMessage }: any) {
  const socketRef = useRef<any>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!sessionId || !userId) return undefined;

    // Cookies are sent automatically on same-origin WS connections
    const ws = new WebSocket(
      `${WS_BASE}/ws/realtime?sessionId=${sessionId}&userId=${userId}`,
    );
    socketRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onclose = () => {
      setConnected(false);
      socketRef.current = null;
    };

    ws.onerror = () => {
      setConnected(false);
    };

    ws.onmessage = (event: any) => {
      try {
        const payload = JSON.parse(event.data);
        if (onMessage) onMessage(payload);
      } catch {
        // Ignore malformed payloads.
      }
    };

    return () => {
      ws.close();
    };
  }, [sessionId, userId, onMessage]);

  const send = useCallback((payload: any) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return false;
    }
    socketRef.current.send(JSON.stringify(payload));
    return true;
  }, []);

  const sendChatQuery = useCallback(
    (query: any) => {
      return send({ type: "chat_query", query });
    },
    [send],
  );

  return {
    connected,
    send,
    sendChatQuery,
  };
}
