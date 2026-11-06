"use client";
import { unwrapAction } from "./action-result";
import { useEffect, useRef, useState } from "react";
import { cachedSpeech, sessionSpeech } from "./speech-cache";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { speakNardouchAnswer } from "./actions";
export function AudioPlayer({
  conversationId,
  messageId,
}: {
  conversationId: string;
  messageId: string;
}) {
  const [url, setUrl] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const generating = useRef(false);
  const playRequested = useRef(false);
  const cacheKey = `${conversationId}:${messageId}`;
  const audio = useRef<HTMLAudioElement>(null),
    current = useRef(""),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const cached = cachedSpeech(cacheKey);
    if (cached) {
      const next = URL.createObjectURL(cached);
      current.current = next;
      setUrl(next);
    }
    return () => {
      alive.current = false;
      if (current.current) URL.revokeObjectURL(current.current);
    };
  }, [cacheKey]);
  useEffect(() => {
    const element = audio.current;
    if (element && playRequested.current) {
      playRequested.current = false;
      void element
        .play()
        .catch(() => setError("Press Play in the audio controls to listen."));
    }
    return () => element?.pause();
  }, [url]);
  async function generate() {
    if (generating.current) return;
    generating.current = true;
    setPending(true);
    setError("");
    try {
      const blob = await sessionSpeech(cacheKey, async () => {
        const result = unwrapAction(
          await speakNardouchAnswer(conversationId, messageId),
        );
        const data = Uint8Array.from(atob(result.audioBase64), (c) =>
          c.charCodeAt(0),
        );
        return new Blob([data], { type: result.mimeType });
      });
      if (!alive.current) return;
      if (current.current) URL.revokeObjectURL(current.current);
      const next = URL.createObjectURL(blob);
      current.current = next;
      playRequested.current = true;
      setUrl(next);
    } catch {
      if (alive.current)
        setError(
          "Audio is unavailable. The full answer is above; you can retry.",
        );
    } finally {
      generating.current = false;
      if (alive.current) setPending(false);
    }
  }
  return (
    <div className="space-y-2">
      {url ? (
        <>
          <audio
            ref={audio}
            controls
            src={url}
            preload="none"
            aria-label="Spoken Nardouch answer"
            className="max-w-full"
          >
            Read the text response above.
          </audio>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (audio.current) {
                audio.current.pause();
                audio.current.currentTime = 0;
              }
            }}
          >
            Stop playback
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (audio.current) {
                audio.current.currentTime = 0;
                void audio.current
                  .play()
                  .catch(() =>
                    setError(
                      "Playback failed. Try the audio controls or read the answer.",
                    ),
                  );
              }
            }}
          >
            Replay answer
          </Button>
        </>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={generate}
        >
          <Volume2 />
          {pending ? "Preparing audio…" : "Listen to this answer"}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
