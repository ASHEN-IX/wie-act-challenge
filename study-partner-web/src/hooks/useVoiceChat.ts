import { useCallback, useEffect, useMemo, useState } from "react";
import useAudioStream from "@/hooks/useAudioStream";
import useWebRTC from "@/hooks/useWebRTC";
import useSpeakingDetection from "@/hooks/useSpeakingDetection";
import {
  startVoiceSession,
  endVoiceSession,
  joinVoiceSession,
  leaveVoiceSession,
  setVoiceMute,
  getVoiceStatus,
} from "@/services/voiceChatService";

export default function useVoiceChat({ sessionId, userId }: any) {
  const [active, setActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [speakingStatus, setSpeakingStatus] = useState("silent");
  const [error, setError] = useState("");
  const [serverParticipants, setServerParticipants] = useState<any[]>([]);

  const { stream, startAudio, stopAudio } = useAudioStream();

  const { connected, participants, sendMute, sendSpeaking } = useWebRTC({
    sessionId,
    userId,
    localStream: stream,
    enabled: active,
  });

  const refreshStatus = useCallback(async () => {
    if (!sessionId) return;
    try {
      const response = await getVoiceStatus(sessionId);
      setServerParticipants(response.data?.participants || []);
    } catch {
      // Ignore when voice session does not exist yet.
    }
  }, [sessionId]);

  useEffect(() => {
    if (!active) return undefined;
    refreshStatus();
    const timer = setInterval(refreshStatus, 5000);
    return () => clearInterval(timer);
  }, [active, refreshStatus]);

  useSpeakingDetection({
    stream,
    onSpeakingChange: (status: any) => {
      setSpeakingStatus(status);
      sendSpeaking(status);
    },
  });

  const start = useCallback(async () => {
    if (!sessionId || !userId) return;

    try {
      // Pre-check microphone permission status where supported
      try {
        if (typeof navigator !== "undefined" && navigator.permissions) {
          const micPerm = await navigator.permissions.query({
            name: "microphone",
          });
          if (micPerm.state === "denied") {
            setError(
              "Microphone permission is denied. Ask participants to enable microphone in their browser site settings (click the padlock icon → Site settings → Microphone → Allow).",
            );
            return;
          }
        }
      } catch (permErr) {
        // Permissions API may not be available or may throw on some browsers — ignore
      }

      const localStream = await startAudio();
      if (!localStream) {
        setError("Microphone access is required for voice chat.");
        return;
      }

      await startVoiceSession(sessionId);
      await joinVoiceSession(sessionId, userId);
      setActive(true);
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to start voice chat.");
      stopAudio();
    }
  }, [sessionId, userId, startAudio, stopAudio]);

  const stop = useCallback(async () => {
    if (!sessionId) return;
    try {
      await leaveVoiceSession(sessionId);
      await endVoiceSession(sessionId);
    } catch {
      // Do not block local cleanup.
    }

    stopAudio();
    setActive(false);
    setIsMuted(false);
    setSpeakingStatus("silent");
  }, [sessionId, stopAudio]);

  const toggleMute = useCallback(async () => {
    if (!stream) return;
    const next = !isMuted;
    stream.getAudioTracks().forEach((track: any) => {
      track.enabled = !next;
    });

    setIsMuted(next);
    sendMute(next);

    try {
      await setVoiceMute(sessionId, next);
    } catch {
      // Local mute state remains authoritative for current client.
    }
  }, [stream, isMuted, sendMute, sessionId]);

  const participantCount = useMemo(() => {
    const unique = new Set();
    (serverParticipants || []).forEach((p) => unique.add(p.userId));
    (participants || []).forEach((id) => unique.add(id));
    unique.add(userId);
    return unique.size;
  }, [serverParticipants, participants, userId]);

  return {
    active,
    connected,
    isMuted,
    speakingStatus,
    participantCount,
    participants: serverParticipants,
    error,
    start,
    stop,
    toggleMute,
  };
}
