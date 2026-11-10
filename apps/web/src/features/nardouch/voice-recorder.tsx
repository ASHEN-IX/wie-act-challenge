"use client";
import { unwrapAction } from "./action-result";
import { useEffect, useId, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { transcribeNardouchAudio } from "./actions";
import { startRecording, type Recording } from "./recording";

export function TranscriptReview({
  value,
  onChange,
  onUse,
  onDiscard,
}: {
  value: string;
  onChange: (text: string) => void;
  onUse: () => void;
  onDiscard: () => void;
}) {
  const id = useId();
  return (
    <div className="space-y-2 rounded-xl border p-3">
      <label htmlFor={id} className="text-sm font-medium">
        Review and correct your transcript
      </label>
      <textarea
        id={id}
        dir="auto"
        maxLength={4000}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-24 w-full rounded-lg border bg-background p-3 text-sm"
      />
      <p className="text-xs text-muted-foreground">
        Check technical terms and code-switching before using this text.
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!value.trim()}
          onClick={onUse}
        >
          Use edited transcript
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDiscard}>
          Discard
        </Button>
      </div>
    </div>
  );
}
export function VoiceRecorder({
  courseId,
  revisionId,
  onTranscript,
  disabled,
}: {
  courseId: string;
  revisionId: string;
  onTranscript: (text: string) => void;
  disabled: boolean;
}) {
  const [consent, setConsent] = useState(false),
    [recording, setRecording] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [transcript, setTranscript] = useState<string | null>(null),
    [audio, setAudio] = useState<string | null>(null);
  const [locale, setLocale] = useState<"ar-TN" | "fr-FR" | "en-US">("ar-TN");
  const handle = useRef<Recording | null>(null),
    alive = useRef(true),
    stopRef = useRef<() => void>(() => {});
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      handle.current?.cancel();
    };
  }, []);
  async function transcribe(encoded: string) {
    setPending(true);
    setError("");
    try {
      const result = unwrapAction(
        await transcribeNardouchAudio({
          courseId,
          revisionId,
          audioBase64: encoded,
          locale,
          consent: true,
        }),
      );
      if (alive.current) {
        setTranscript(result.transcript);
        setAudio(null);
      }
    } catch {
      if (alive.current)
        setError(
          "Transcription failed. Retry the recording or type your question.",
        );
    } finally {
      if (alive.current) setPending(false);
    }
  }
  function stop() {
    if (!handle.current) return;
    const current = handle.current;
    handle.current = null;
    setRecording(false);
    try {
      const encoded = current.stop();
      setAudio(encoded);
      void transcribe(encoded);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Recording could not be read. Type your question.",
      );
    }
  }
  stopRef.current = stop;
  async function start() {
    if (!consent || disabled || pending || recording) return;
    setPending(true);
    setError("");
    setTranscript(null);
    setAudio(null);
    try {
      const current = await startRecording(() => stopRef.current());
      if (!alive.current) {
        current.cancel();
        return;
      }
      handle.current = current;
      setRecording(true);
    } catch {
      if (alive.current)
        setError(
          "Microphone access failed. Allow it in browser settings or type your question.",
        );
    } finally {
      if (alive.current) setPending(false);
    }
  }
  return (
    <div className="space-y-3 border-t pt-3">
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={consent}
          disabled={pending || recording}
          onChange={(e) => {
            setConsent(e.target.checked);
            if (!e.target.checked) {
              setAudio(null);
              setTranscript(null);
            }
          }}
        />
        I agree to process my own recording with the local speech service for
        transcription. Noveris does not save raw audio. Record only yourself.
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs">
          Speech language
          <select
            value={locale}
            disabled={pending || recording}
            onChange={(e) => setLocale(e.target.value as typeof locale)}
            className="ms-2 rounded-lg border bg-background p-2"
          >
            <option value="ar-TN">Tunisian Arabic</option>
            <option value="fr-FR">French</option>
            <option value="en-US">English</option>
          </select>
        </label>
        {recording ? (
          <Button type="button" size="sm" variant="destructive" onClick={stop}>
            <Square />
            Stop recording
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || pending || !consent}
            onClick={start}
          >
            <Mic />
            {pending ? "Processing…" : "Record a question"}
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          30 seconds maximum
        </span>
      </div>
      {recording && (
        <p role="status" className="text-sm">
          Recording your microphone. Stop when ready.
        </p>
      )}
      {pending && !recording && (
        <p role="status" className="text-sm">
          Preparing your recording or transcript…
        </p>
      )}
      {error && (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>{error}</p>
          {audio && consent && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => transcribe(audio)}
            >
              Retry transcription
            </Button>
          )}
        </div>
      )}
      {transcript !== null && (
        <TranscriptReview
          value={transcript}
          onChange={setTranscript}
          onUse={() => {
            onTranscript(transcript);
            setTranscript(null);
          }}
          onDiscard={() => setTranscript(null)}
        />
      )}
    </div>
  );
}
