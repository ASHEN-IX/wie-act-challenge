import React from "react";

export default function ParticipantList({ participants = [] }: any) {
  if (!participants.length) {
    return (
      <p className="text-xs text-gray-500">
        No other participants connected yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {participants.map((participant: any) => (
        <div
          key={`${participant.userId}-${participant.joinedAt || ""}`}
          className="flex items-center justify-between rounded-md border border-[#ffffff12] bg-[#0f1923] px-2 py-1.5 text-xs"
        >
          <span className="text-gray-200">{participant.userId}</span>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">
              {participant.connectionState || "connected"}
            </span>
            <span
              className={
                participant.isMuted
                  ? "text-[var(--accent-color-dynamic)]"
                  : "text-[var(--accent-color-dynamic)]"
              }
            >
              {participant.isMuted ? "Muted" : "Live"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
