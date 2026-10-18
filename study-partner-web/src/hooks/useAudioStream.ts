import { useCallback, useState } from "react";

export default function useAudioStream() {
  const [stream, setStream] = useState<any>(null);
  const [error, setError] = useState("");

  const startAudio = useCallback(async () => {
    try {
      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
        video: false,
      });
      setStream(localStream);
      setError("");
      return localStream;
    } catch (err: any) {
      setError(err.message || "Microphone access denied");
      return null;
    }
  }, []);

  const stopAudio = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track: any) => track.stop());
    }
    setStream(null);
  }, [stream]);

  return {
    stream,
    error,
    startAudio,
    stopAudio,
  };
}
