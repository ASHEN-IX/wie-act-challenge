import React from "react";
import ChatMessage from "./ChatMessage";

export default function ChatHistory({ messages, currentUserId, loading }: any) {
  if (loading) {
    return <div className="text-sm text-gray-400">Loading chat history...</div>;
  }

  if (!messages.length) {
    return (
      <div className="text-sm text-gray-500">
        No messages yet. Ask your first question.
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
      {messages.map((message: any) => (
        <ChatMessage
          key={message._id || `${message.userId}-${message.createdAt}`}
          message={message}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  );
}
