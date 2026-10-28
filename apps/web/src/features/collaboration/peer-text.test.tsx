import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  mergePeerMessages,
  failPeerSubmission,
  type PeerMessage,
  type PeerTextState,
} from "./peer-text-state";
import { PeerChat } from "./peer-chat";

const initial: PeerTextState = {
  roomId: "room_one",
  currentUserId: "actor",
  draft: "hello",
  messages: [],
  outbox: { submissionId: "submission", text: "hello", status: "pending" },
};
const message: PeerMessage = {
  roomId: "room_one",
  messageId: "accepted-id",
  submissionId: "submission",
  senderUserId: "actor",
  senderName: "Synthetic learner",
  text: "hello",
  seq: 1,
  createdAt: "2026-10-22T00:00:00.000Z",
};
describe("public peer reconciliation", () => {
  it("changes pending to accepted only on a validated server message", () => {
    expect(initial.outbox?.status).toBe("pending");
    const next = mergePeerMessages(initial, [message]);
    expect(next.messages).toHaveLength(1);
    expect(next.outbox).toBeUndefined();
    expect(next.draft).toBe("");
  });
  it("deduplicates overlapping acknowledgements, live events and history", () => {
    const next = mergePeerMessages(mergePeerMessages(initial, [message]), [
      message,
      message,
    ]);
    expect(next.messages).toHaveLength(1);
  });
  it("orders out-of-order delivery and merges old history without dropping newer messages", () => {
    const third = {
      ...message,
      seq: 3,
      messageId: "third",
      submissionId: "three",
    };
    const second = {
      ...message,
      seq: 2,
      messageId: "second",
      submissionId: "two",
    };
    const next = mergePeerMessages(
      mergePeerMessages(initial, [third, message]),
      [second, message],
    );
    expect(next.messages.map((m) => m.seq)).toEqual([1, 2, 3]);
  });
  it("does not resolve another actor's scoped submission or overwrite a new draft", () => {
    const other = mergePeerMessages(initial, [
      { ...message, senderUserId: "peer" },
    ]);
    expect(other.outbox).toEqual(initial.outbox);
    expect(
      mergePeerMessages({ ...initial, draft: "next thought" }, [message]).draft,
    ).toBe("next thought");
  });
  it("keeps an uncertain retry's exact identity, text and draft", () => {
    const failed = failPeerSubmission(
      initial,
      "submission",
      "Unavailable",
      true,
    );
    expect(failed.outbox).toEqual({
      ...initial.outbox,
      status: "retryable",
      error: "Unavailable",
    });
    expect(failed.draft).toBe("hello");
    expect(failed.messages).toHaveLength(0);
  });
  it("keeps permanent failures separate and ignores obsolete failure callbacks after acceptance", () => {
    expect(
      failPeerSubmission(initial, "submission", "Forbidden", false).outbox
        ?.status,
    ).toBe("failed");
    const accepted = mergePeerMessages(initial, [message]);
    expect(
      failPeerSubmission(accepted, "submission", "Late failure", true),
    ).toBe(accepted);
  });
  it("ignores foreign/malformed records and projects only public fields", () => {
    expect(
      mergePeerMessages(initial, [
        null,
        { ...message, roomId: "foreign" },
        { ...message, seq: 0.5 },
        { ...message, text: {} },
      ]).messages,
    ).toHaveLength(0);
    const next = mergePeerMessages(initial, [
      { ...message, answer: "private", cookie: "credential", score: 1 },
    ]);
    expect(next.messages[0]).toEqual(message);
    expect(next.messages[0]).not.toHaveProperty("cookie");
  });
  it("does not replace a known immutable identity or accepted order position", () => {
    const next = mergePeerMessages(mergePeerMessages(initial, [message]), [
      { ...message, text: "conflicting stale record" },
      { ...message, messageId: "other" },
    ]);
    expect(next.messages).toEqual([message]);
  });
});
describe("actual public peer rendering", () => {
  const render = (state: PeerTextState) =>
    renderToStaticMarkup(
      <PeerChat
        connected
        chat={{
          state,
          historyStatus: "History recovered",
          isSending: false,
          invalidateRecovery: () => {},
          receive: () => {},
          recover: async () => {},
          send: async () => {},
          setDraft: () => {},
          editFailed: () => {},
        }}
      />,
    );
  it("renders HTML/script and unsafe links as inert escaped text", () => {
    const text =
      '<img src=x onerror="window.injected=true"><script>alert(1)</script> [run](javascript:alert(1))';
    const html = render({
      ...initial,
      outbox: undefined,
      messages: [{ ...message, text }],
    });
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script");
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain("<img");
  });
  it("labels pending versus failed/retryable state without fabricating acceptance", () => {
    expect(render(initial)).toContain("Pending acceptance");
    expect(
      render(failPeerSubmission(initial, "submission", "Unavailable", true)),
    ).toContain("Retry same message");
    expect(
      render(failPeerSubmission(initial, "submission", "Forbidden", false)),
    ).toContain("Edit draft");
  });
});
