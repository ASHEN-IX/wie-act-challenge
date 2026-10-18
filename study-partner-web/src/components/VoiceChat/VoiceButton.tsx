import React, { useState } from "react";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import useVoiceChat from "@/hooks/useVoiceChat";
import VoiceIndicator from "./VoiceIndicator";
import ParticipantList from "./ParticipantList";
import VolumeControl from "./VolumeControl";
import VoiceSettings from "./VoiceSettings";
import VoiceNotification from "./VoiceNotification";
import styles from "./VoiceStyles.module.css";

export default function VoiceButton({ sessionId, userId }: any) {
  const [volume, setVolume] = useState(80);
  const [notice, setNotice] = useState("");

  const {
    active,
    connected,
    isMuted,
    speakingStatus,
    participantCount,
    participants,
    error,
    start,
    stop,
    toggleMute,
  } = useVoiceChat({ sessionId, userId });

  const handleStart = async () => {
    await start();
    setNotice("Voice chat started");
    setTimeout(() => setNotice(""), 3000);
  };

  const handleStop = async () => {
    await stop();
    setNotice("Voice chat stopped");
    setTimeout(() => setNotice(""), 3000);
  };

  return (
    <div className={`${styles.panel} p-3 text-white`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-xs font-bold tracking-wide uppercase">
          Team Voice Chat
        </h3>
        <span className="text-xs text-gray-300">
          {connected ? "Connected" : "Offline"}
        </span>
      </div>

      <VoiceNotification message={notice || error} />

      <div className="mt-2 flex items-center gap-2">
        {!active ? (
          <button
            onClick={handleStart}
            className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold"
            style={{
              backgroundColor: "var(--accent-color-dynamic)",
              color: "#0f1923",
            }}
          >
            <Mic size={14} /> Join Voice
          </button>
        ) : (
          <>
            <button
              onClick={toggleMute}
              className="inline-flex items-center gap-2 rounded-md border border-[#ffffff20] px-3 py-1.5 text-xs"
            >
              {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
              {isMuted ? "Unmute" : "Mute"}
            </button>
            <button
              onClick={handleStop}
              className="inline-flex items-center gap-2 rounded-md border border-[var(--accent-color-dynamic)]/30 bg-[var(--accent-color-dynamic)]/10 px-3 py-1.5 text-xs text-[var(--accent-color-dynamic)]"
            >
              <PhoneOff size={14} /> Leave
            </button>
          </>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-gray-300">
        <span>Participants: {participantCount}</span>
        <VoiceIndicator speakingStatus={speakingStatus} />
      </div>

      <div className="mt-2">
        <VolumeControl value={volume} onChange={setVolume} />
      </div>

      <div className="mt-2">
        <ParticipantList participants={participants} />
      </div>

      <div className="mt-2">
        <VoiceSettings />
      </div>
    </div>
  );
}
