"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AiModeNote } from "@/features/ai-status/ai-status-view";
import {
  loadPrivateHelp,
  sendPrivateHelp,
  type PrivateHelpItem,
} from "./private-help-actions";
export function PrivateHelpPanel({ roomId }: { roomId: string }) {
  const [question, setQuestion] = useState(""),
    [history, setHistory] = useState<PrivateHelpItem[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const request = useRef<{ id: string; question: string } | null>(null);
  useEffect(() => {
    let active = true;
    loadPrivateHelp(roomId)
      .then((r) => {
        if (active) setHistory(r.history);
      })
      .catch(() => {
        if (active) setError("Private history unavailable.");
      });
    return () => {
      active = false;
    };
  }, [roomId]);
  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (!request.current)
        request.current = { id: crypto.randomUUID(), question };
      const fixed = request.current;
      const result = await sendPrivateHelp(roomId, fixed.id, fixed.question);
      setHistory((old) => [
        result,
        ...old.filter((r) => r.requestId !== result.requestId),
      ]);
      if (result.status === "completed") {
        request.current = null;
        setQuestion("");
      }
    } catch {
      setError(
        "Private help unavailable. Retry the same request or refresh history.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="rounded-xl border p-4 space-y-3"
      aria-label="Requester-only room help"
      data-testid="private-room-help"
    >
      <h2 className="font-semibold">Private source help</h2>
      <p>
        Only you can retrieve this question and response. They are excluded from
        the room recap.
      </p>
      <label>
        Your private question
        <textarea
          aria-label="Private room question"
          value={question}
          maxLength={2000}
          disabled={busy || !!request.current}
          onChange={(e) => setQuestion(e.target.value)}
          className="block w-full rounded border p-2"
        />
      </label>
      <Button disabled={busy || !question.trim()} onClick={submit}>
        {request.current ? "Retry private request" : "Ask privately"}
      </Button>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => {
          request.current = null;
          setQuestion("");
        }}
      >
        Start another question
      </Button>
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          try {
            setHistory((await loadPrivateHelp(roomId)).history);
            setError("");
          } catch {
            setHistory([]);
            setError("Private history unavailable.");
          }
        }}
      >
        Refresh private help
      </Button>
      {error && <p role="alert">{error}</p>}
      {history.map((item) => (
        <article key={item.requestId} className="border-t pt-2">
          <p>{item.question}</p>
          {item.response?.executionMode ? (
            <AiModeNote mode={item.response.executionMode} />
          ) : (
            <p>{item.status}</p>
          )}
          <p className="whitespace-pre-wrap">
            {item.response?.answer ||
              (item.status === "pending"
                ? "Request pending; retry with its original identity."
                : "Source help unavailable; no verified answer is asserted.")}
          </p>
        </article>
      ))}
    </section>
  );
}
