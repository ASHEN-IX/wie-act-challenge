import { useCallback, useMemo, useState } from "react";
import useChatWebSocket from "@/hooks/useChatWebSocket";
import { sessionChatAPI } from "@/services/api";

export default function useSessionChat({ sessionId, userId }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onSocketMessage = useCallback((payload: any) => {
    if (payload.type === "chat_query") {
      setMessages((prev: any) => [
        {
          _id: `query-${payload.userId}-${payload.createdAt}`,
          messageType: "query",
          userId: payload.userId,
          content: payload.query,
          searchQuery: payload.query,
          createdAt: payload.createdAt,
        },
        ...prev,
      ]);
      return;
    }

    if (payload.type === "chat_result") {
      setMessages((prev: any) => [
        {
          _id:
            payload.messageId ||
            `result-${payload.userId}-${payload.createdAt}`,
          messageType: "result",
          userId: payload.userId,
          content: payload.answer,
          searchQuery: payload.question,
          searchResults: payload.results || [],
          createdAt: payload.createdAt,
        },
        ...prev,
      ]);
      setSubmitting(false);
      return;
    }

    if (payload.type === "chat_error") {
      setError(payload.error || "Search failed");
      setSubmitting(false);
    }
  }, []);

  const { connected, sendChatQuery } = useChatWebSocket({
    sessionId,
    userId,
    onMessage: onSocketMessage,
  });

  const loadHistory = useCallback(async () => {
    if (!sessionId) return;
    setLoadingHistory(true);
    setError("");

    try {
      const response = await sessionChatAPI.getHistory(sessionId, {
        limit: 100,
      });
      setMessages(response.data?.items || []);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load chat history");
    } finally {
      setLoadingHistory(false);
    }
  }, [sessionId]);

  const submitQuery = useCallback(
    async (query: any) => {
      const normalized = (query || "").trim();
      if (!normalized) return;

      setSubmitting(true);
      setError("");

      const sentViaWs = sendChatQuery(normalized);
      if (sentViaWs) {
        return;
      }

      try {
        const response = await sessionChatAPI.query(sessionId, normalized);
        const result = response.data;
        setMessages((prev: any) => [
          {
            _id: result.messageId,
            messageType: "result",
            userId,
            content: result.answer,
            searchQuery: result.question,
            searchResults: result.results || [],
            createdAt: result.createdAt,
          },
          ...prev,
        ]);
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to process search query");
      } finally {
        setSubmitting(false);
      }
    },
    [sendChatQuery, sessionId, userId],
  );

  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (a: any, b: any) => (new Date(b.createdAt) as any) - (new Date(a.createdAt) as any),
      ),
    [messages],
  );

  return {
    connected,
    messages: sortedMessages,
    loadingHistory,
    submitting,
    error,
    loadHistory,
    submitQuery,
  };
}
