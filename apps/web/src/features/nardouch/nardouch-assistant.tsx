"use client";
import { unwrapAction, NardouchActionError } from "./action-result";
import { useEffect, useId, useRef, useState } from "react";
import { Orbit, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  LanguagePreference,
  LearningMode,
  NardouchConversation,
} from "@ednova/shared/ednova/nardouch";
import { sendNardouchTurn, loadNardouchConversation } from "./actions";
import { ConversationPanel, SuggestedFollowups } from "./conversation-panel";
import { VoiceRecorder } from "./voice-recorder";
import { AudioPlayer } from "./audio-player";
import { LanguageSelector, LearningModeSelector } from "./selectors";

export function NardouchAssistant({
  courseId,
  revisionId,
  userId,
  objectiveId,
  onPractice,
}: {
  courseId: string;
  revisionId: string;
  userId: string;
  objectiveId?: string;
  onPractice?: () => void;
}) {
  const [conversation, setConversation] = useState<NardouchConversation | null>(
    null,
  );
  const [mode, setMode] = useState<LearningMode>("explain");
  const [language, setLanguage] = useState<LanguagePreference>({
    language: "auto",
    script: "auto",
  });
  const [needsReload, setNeedsReload] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [restoring, setRestoring] = useState(true),
    [error, setError] = useState("");
  const inputId = useId(),
    inputRef = useRef<HTMLTextAreaElement>(null);
  const storageKey = `nardouch:${userId}:${courseId}:${revisionId}`;
  useEffect(() => {
    let active = true;
    setRestoring(true);
    setConversation(null);
    setError("");
    async function restore() {
      try {
        const id = localStorage.getItem(storageKey);
        if (active) {
          setRestoreId(id);
          setVoiceEnabled(
            localStorage.getItem(storageKey + ":voice") === "true",
          );
        }
        if (id) {
          const data = unwrapAction(await loadNardouchConversation(id));
          if (
            active &&
            data.conversation.courseId === courseId &&
            data.conversation.revisionId === revisionId
          ) {
            setConversation(data.conversation);
            setMode(data.conversation.mode);
            setLanguage(data.conversation.language);
          }
        }
      } catch {
        if (active)
          setError(
            "Previous conversation could not be restored. Retry loading it or start a new conversation.",
          );
      } finally {
        if (active) setRestoring(false);
      }
    }
    void restore();
    return () => {
      active = false;
    };
  }, [storageKey, courseId, revisionId]);
  async function reload() {
    const id = conversation?.id || restoreId;
    if (!id) return send();
    setBusy(true);
    try {
      const data = unwrapAction(await loadNardouchConversation(id));
      setConversation(data.conversation);
      setMode(data.conversation.mode);
      setLanguage(data.conversation.language);
      setError("");
    } catch {
      setError(
        "Unable to reload. Please retry loading or start a new conversation.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (!draft.trim() || busy || restoring) return;
    setBusy(true);
    setError("");
    try {
      const data = unwrapAction(
        await sendNardouchTurn({
          courseId,
          revisionId,
          objectiveId,
          conversationId: conversation?.id,
          expectedVersion: conversation?.version || 0,
          message: draft,
          mode,
          language,
        }),
      );
      setConversation(data.conversation);
      setRestoreId(data.conversation.id);
      setDraft("");
      setNeedsReload(false);
      try {
        localStorage.setItem(storageKey, data.conversation.id);
      } catch {
        /* History is still durable server-side. */
      }
    } catch (e) {
      setNeedsReload(e instanceof NardouchActionError && e.status === 409);
      setError(
        e instanceof Error
          ? e.message
          : "Nardouch is unavailable. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  const disabled = busy || restoring;
  const last = conversation?.messages.at(-1)?.answer;
  return (
    <section aria-label="Nardouch learning assistant" className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
            <Orbit className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold">Nardouch</h2>
            <p className="text-xs text-muted-foreground">
              Your course companion · نفهموها مع بعضنا
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => {
            setConversation(null);
            setRestoreId(null);
            setError("");
            try {
              localStorage.removeItem(storageKey);
            } catch {
              /* Storage may be disabled. */
            }
          }}
        >
          New conversation
        </Button>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <LearningModeSelector
          value={mode}
          onChange={setMode}
          disabled={disabled}
        />
        <LanguageSelector
          value={language}
          onChange={setLanguage}
          disabled={disabled}
        />
      </div>
      {conversation ? (
        <ConversationPanel
          messages={conversation.messages}
          courseId={courseId}
          revisionId={revisionId}
          conversationId={conversation.id}
          renderAudio={
            voiceEnabled
              ? (message) => (
                  <AudioPlayer
                    conversationId={conversation.id}
                    messageId={message.id}
                  />
                )
              : undefined
          }
        />
      ) : (
        <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
          Ask about this course in Darija, français or English. We can unpack a
          concept, reason through a problem, or practise step by step.
        </p>
      )}
      {last && (
        <SuggestedFollowups
          questions={last.followups}
          disabled={disabled}
          onSelect={(text) => {
            setDraft(text);
            inputRef.current?.focus();
          }}
        />
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="space-y-3"
      >
        <label htmlFor={inputId} className="block text-sm font-medium">
          Your question or answer
        </label>
        <textarea
          id={inputId}
          ref={inputRef}
          dir="auto"
          className="min-h-24 w-full resize-y rounded-xl border bg-background p-3 text-sm leading-6 focus-visible:outline-primary"
          maxLength={4000}
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ya Nardouch, mafhemtech el récursivité…"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Private conversation · you can correct any misunderstood word.
          </p>
          <Button type="submit" disabled={disabled || !draft.trim()}>
            <Send className="size-4" />
            {busy ? "Thinking…" : "Ask Nardouch"}
          </Button>
        </div>
      </form>
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={voiceEnabled}
          disabled={disabled}
          onChange={(e) => {
            setVoiceEnabled(e.target.checked);
            try {
              localStorage.setItem(
                storageKey + ":voice",
                String(e.target.checked),
              );
            } catch {
              /* Preference is optional. */
            }
          }}
        />
        Enable voice tools. Listening may send the selected answer to
        ElevenLabs, an external metered voice service. Provider retention terms
        apply. Recording stays with local Whisper and requires consent below.
      </label>
      {voiceEnabled && (
        <VoiceRecorder
          courseId={courseId}
          revisionId={revisionId}
          disabled={disabled}
          onTranscript={(text) => {
            setDraft(text);
            inputRef.current?.focus();
          }}
        />
      )}
      {(busy || restoring) && (
        <p role="status" className="text-sm text-muted-foreground">
          {restoring
            ? "Loading your conversation…"
            : "Working through your question with the course material…"}
        </p>
      )}
      {error && (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>{error}</p>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() =>
              needsReload || (!draft.trim() && (conversation || restoreId))
                ? reload()
                : send()
            }
          >
            Retry
          </Button>
        </div>
      )}
      {mode === "practice" && onPractice && (
        <Button variant="outline" size="sm" onClick={onPractice}>
          Open reviewed practice and mastery checks
        </Button>
      )}
      {mode === "peer" && (
        <p className="text-xs text-muted-foreground">
          Prepare your own explanation here. Your private conversation is not
          shared with your Study Circle.
        </p>
      )}
    </section>
  );
}
