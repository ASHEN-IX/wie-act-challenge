"use client";
import { unwrapAction } from "./action-result";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Check, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  NardouchCitation,
  NardouchMessage,
} from "@ednova/shared/ednova/nardouch";
import { sendNardouchFeedback } from "./actions";

export function SourceReferences({
  citations,
  courseId,
  revisionId,
}: {
  citations: NardouchCitation[];
  courseId: string;
  revisionId: string;
}) {
  if (!citations.length)
    return (
      <p className="text-xs text-muted-foreground">
        Course evidence is missing for this answer. Check it with your course
        materials.
      </p>
    );
  return (
    <nav aria-label="Answer sources" className="flex flex-wrap gap-2">
      {citations.map((c, i) => (
        <a
          key={c.chunkId}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
          href={`/api/v1/study/courses/${encodeURIComponent(courseId)}/revisions/${encodeURIComponent(revisionId)}/sources/${encodeURIComponent(c.documentId)}${c.pageNumber ? `#page=${c.pageNumber}` : ""}`}
        >
          <BookOpen className="size-3" aria-hidden="true" />
          Source {i + 1}
          {c.pageNumber ? ` · p. ${c.pageNumber}` : " · text"}
        </a>
      ))}
    </nav>
  );
}
export function SuggestedFollowups({
  questions,
  onSelect,
  disabled,
}: {
  questions: string[];
  onSelect: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {questions.map((q) => (
        <Button
          key={q}
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => onSelect(q)}
          className="h-auto whitespace-normal text-start"
        >
          {q}
        </Button>
      ))}
    </div>
  );
}
export function MessageBubble({
  message,
  courseId,
  revisionId,
  conversationId,
  renderAudio,
}: {
  message: NardouchMessage;
  courseId: string;
  revisionId: string;
  conversationId: string;
  renderAudio?: (message: NardouchMessage) => React.ReactNode;
}) {
  const [feedback, setFeedback] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function rate(helpful: boolean) {
    setPending(true);
    setError("");
    try {
      unwrapAction(
        await sendNardouchFeedback(conversationId, message.id, helpful),
      );
      setFeedback(true);
    } catch {
      setError("Feedback could not be saved. Please retry.");
    } finally {
      setPending(false);
    }
  }
  return (
    <article
      className={`rounded-xl p-4 ${message.role === "user" ? "ms-6 bg-muted" : "me-2 border bg-background"}`}
      aria-label={
        message.role === "user" ? "Your message" : "Nardouch response"
      }
    >
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        {message.role === "user" ? "You" : "Nardouch"}
      </p>
      <p
        dir="auto"
        className="whitespace-pre-wrap break-words text-sm leading-7"
      >
        {message.content}
      </p>
      {message.answer && (
        <div className="mt-3 space-y-3">
          <SourceReferences
            citations={message.answer.citations}
            courseId={courseId}
            revisionId={revisionId}
          />
          <p className="text-xs text-muted-foreground">
            Learning guidance · source links identify evidence; check the
            reasoning. Practice here is ungraded.
          </p>
          {renderAudio?.(message)}
          {feedback ? (
            <p className="flex items-center gap-1 text-xs">
              <Check className="size-3" />
              Feedback saved
            </p>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                aria-label="Helpful answer"
                onClick={() => rate(true)}
              >
                <ThumbsUp />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                aria-label="Answer needs improvement"
                onClick={() => rate(false)}
              >
                <ThumbsDown />
              </Button>
            </div>
          )}
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
export function ConversationPanel({
  messages,
  ...props
}: {
  messages: NardouchMessage[];
  courseId: string;
  revisionId: string;
  conversationId: string;
  renderAudio?: (message: NardouchMessage) => React.ReactNode;
}) {
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages.length]);
  return (
    <div
      ref={log}
      tabIndex={0}
      role="log"
      aria-label="Nardouch conversation"
      aria-live="polite"
      className="max-h-[32rem] space-y-3 overflow-y-auto overscroll-contain"
    >
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} {...props} />
      ))}
    </div>
  );
}
