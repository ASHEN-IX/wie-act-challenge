import React from "react";

export default function VoiceNotification({ message }: any) {
  if (!message) return null;
  return (
    <div
      className="rounded-md bg-[#0f2c33] px-2 py-1 text-xs"
      style={{
        borderColor:
          "color-mix(in srgb, var(--accent-color-dynamic) 40%, transparent)",
        borderWidth: "1px",
        color:
          "color-mix(in srgb, var(--accent-color-dynamic) 90%, transparent)",
      }}
    >
      {message}
    </div>
  );
}
