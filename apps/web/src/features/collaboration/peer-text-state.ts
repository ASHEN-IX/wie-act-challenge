export interface PeerMessage {
  roomId: string;
  messageId: string;
  submissionId: string;
  senderUserId: string;
  senderName: string;
  text: string;
  seq: number;
  createdAt: string;
}
export interface PeerTextState {
  roomId: string;
  currentUserId: string;
  draft: string;
  messages: PeerMessage[];
  outbox?: {
    submissionId: string;
    text: string;
    status: "pending" | "failed" | "retryable";
    error?: string;
  };
}
function publicMessage(
  input: unknown,
  roomId: string,
): PeerMessage | undefined {
  if (!input || typeof input !== "object") return;
  const m = input as Record<string, unknown>;
  if (
    m.roomId !== roomId ||
    !Number.isSafeInteger(m.seq) ||
    (m.seq as number) < 1 ||
    (m.seq as number) > 1000 ||
    ![
      "messageId",
      "submissionId",
      "senderUserId",
      "senderName",
      "text",
      "createdAt",
    ].every((key) => typeof m[key] === "string") ||
    (m.text as string).length > 2000 ||
    !Number.isFinite(Date.parse(m.createdAt as string))
  )
    return;
  return {
    roomId,
    messageId: m.messageId as string,
    submissionId: m.submissionId as string,
    senderUserId: m.senderUserId as string,
    senderName: m.senderName as string,
    text: m.text as string,
    seq: m.seq as number,
    createdAt: m.createdAt as string,
  };
}
/** Merge history, event and acknowledgement without replacing newer accepted records. */
export function mergePeerMessages(
  previous: PeerTextState,
  input: unknown[],
): PeerTextState {
  const messages = [...previous.messages];
  for (const value of input.slice(0, 1000)) {
    const message = publicMessage(value, previous.roomId);
    if (
      !message ||
      messages.some(
        (m) =>
          m.messageId === message.messageId ||
          m.seq === message.seq ||
          (m.senderUserId === message.senderUserId &&
            m.submissionId === message.submissionId),
      )
    )
      continue;
    messages.push(message);
  }
  messages.sort((a, b) => a.seq - b.seq);
  const accepted =
    previous.outbox &&
    messages.some(
      (m) =>
        m.senderUserId === previous.currentUserId &&
        m.submissionId === previous.outbox!.submissionId,
    );
  return {
    ...previous,
    messages: messages.slice(0, 1000),
    ...(accepted
      ? {
          outbox: undefined,
          draft:
            previous.draft.trim() === previous.outbox!.text
              ? ""
              : previous.draft,
        }
      : {}),
  };
}
export function failPeerSubmission(
  previous: PeerTextState,
  submissionId: string,
  error: string,
  retryable: boolean,
): PeerTextState {
  if (previous.outbox?.submissionId !== submissionId) return previous;
  return {
    ...previous,
    outbox: {
      ...previous.outbox,
      status: retryable ? "retryable" : "failed",
      error,
    },
  };
}
