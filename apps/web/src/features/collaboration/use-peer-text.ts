"use client";
import { useCallback, useRef, useState } from "react";
import { getPeerHistory, sendPeerMessage } from "./actions";
import {
  failPeerSubmission,
  mergePeerMessages,
  type PeerTextState,
} from "./peer-text-state";

export function usePeerText(roomId: string, currentUserId: string) {
  const [state, setState] = useState<PeerTextState>({
    roomId,
    currentUserId,
    draft: "",
    messages: [],
  });
  const recoveryGeneration = useRef(0);
  const sending = useRef(false);
  const [isSending, setIsSending] = useState(false);
  const invalidateRecovery = useCallback(() => {
    recoveryGeneration.current++;
  }, []);
  const [historyStatus, setHistoryStatus] = useState("Recovering messages…");
  const receive = useCallback((input: unknown) => {
    setState((previous) => mergePeerMessages(previous, [input]));
  }, []);
  const recover = useCallback(
    async (isCurrent: () => boolean = () => true) => {
      const generation = ++recoveryGeneration.current;
      const active = () =>
        isCurrent() && recoveryGeneration.current === generation;
      setHistoryStatus("Recovering messages…");
      let afterSeq = 0;
      // All retained accepted messages fit in ten bounded pages; no background polling.
      for (let page = 0; page < 10; page++) {
        let result: Awaited<ReturnType<typeof getPeerHistory>>;
        try {
          result = await getPeerHistory(roomId, afterSeq);
        } catch {
          if (active())
            setHistoryStatus("History unavailable. Try recovery again.");
          return;
        }
        if (!active()) return;
        if (!result.data) {
          setHistoryStatus(result.error || "Message history unavailable.");
          return;
        }
        setState((previous) => mergePeerMessages(previous, result.data.items));
        if (!result.data.hasMore) {
          setHistoryStatus("History recovered");
          return;
        }
        if (result.data.nextAfterSeq <= afterSeq) break;
        afterSeq = result.data.nextAfterSeq;
      }
      setHistoryStatus("History recovery incomplete. Try recovery again.");
    },
    [roomId],
  );
  const send = async (retry = false) => {
    const pending = retry
      ? state.outbox
      : {
          submissionId: crypto.randomUUID(),
          text: state.draft.trim(),
          status: "pending" as const,
        };
    if (
      !pending ||
      !pending.text ||
      sending.current ||
      state.outbox?.status === "pending"
    )
      return;
    sending.current = true;
    setIsSending(true);
    setState((previous) => ({
      ...previous,
      outbox: { ...pending, status: "pending", error: undefined },
    }));
    try {
      const result = await sendPeerMessage(
        roomId,
        pending.submissionId,
        pending.text,
      );
      if (result.data) receive(result.data.message);
      else
        setState((previous) =>
          failPeerSubmission(
            previous,
            pending.submissionId,
            result.error || "Send failed.",
            result.status === 503 || result.status === 429,
          ),
        );
    } catch {
      setState((previous) =>
        failPeerSubmission(
          previous,
          pending.submissionId,
          "Acknowledgement unavailable. Retry the same message.",
          true,
        ),
      );
    } finally {
      sending.current = false;
      setIsSending(false);
    }
  };
  return {
    isSending,
    invalidateRecovery,
    state,
    historyStatus:
      historyStatus === "History recovered" &&
      state.messages.some((message, index) => message.seq !== index + 1)
        ? "History incomplete. Recover messages."
        : historyStatus,
    receive,
    recover,
    send,
    setDraft: (draft: string) =>
      setState((previous) => ({ ...previous, draft })),
    editFailed: () =>
      setState((previous) => ({ ...previous, outbox: undefined })),
  };
}
