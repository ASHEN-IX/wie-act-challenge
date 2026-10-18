import React, { useEffect } from "react";
import { MessageSquare, Wifi, WifiOff } from "lucide-react";
import ChatInput from "./ChatInput";
import ChatHistory from "./ChatHistory";
import useSessionChat from "@/hooks/useSessionChat";
import styles from "./ChatStyles.module.css";

export default function ChatWindow({ sessionId, userId }: any) {
  const {
    connected,
    messages,
    loadingHistory,
    submitting,
    error,
    loadHistory,
    submitQuery,
  } = useSessionChat({ sessionId, userId });

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <aside className={`${styles.panel} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-white">
          <MessageSquare size={16} />
          <h3 className="text-sm font-bold tracking-wide uppercase">
            Session Search Chat
          </h3>
        </div>
        <div className="text-xs text-gray-300 flex items-center gap-1">
          {connected ? (
            <Wifi size={14} className="text-[var(--accent-color-dynamic)]" />
          ) : (
            <WifiOff size={14} className="text-[var(--accent-color-dynamic)]" />
          )}
          {connected ? "Live" : "Fallback"}
        </div>
      </div>

      <ChatHistory
        messages={messages}
        currentUserId={userId}
        loading={loadingHistory}
      />

      {error && (
        <div className="mt-2 text-xs text-[var(--accent-color-dynamic)]">
          {error}
        </div>
      )}

      <div className="mt-3">
        <ChatInput onSubmit={submitQuery} disabled={submitting} />
      </div>
    </aside>
  );
}
