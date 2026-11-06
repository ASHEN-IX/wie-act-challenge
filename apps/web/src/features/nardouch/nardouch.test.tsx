import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("./actions", () => ({
  sendNardouchTurn: vi.fn(),
  loadNardouchConversation: vi.fn(),
  sendNardouchFeedback: vi.fn(),
}));
import { NardouchAssistant } from "./nardouch-assistant";
import { MessageBubble, SourceReferences } from "./conversation-panel";
import { LearningModeSelector, LanguageSelector } from "./selectors";
describe("Nardouch workspace", () => {
  it("offers text, four learning modes and explicit language/script controls", () => {
    const html = renderToStaticMarkup(
      <NardouchAssistant
        courseId={"a".repeat(24)}
        revisionId="revision"
        userId="owner"
      />,
    );
    expect(html).toContain("Nardouch learning assistant");
    expect(html).toContain("Your question or answer");
    expect(html).toContain("Tunisian Darija");
    expect(html).toContain("Arabizi");
    expect(html).toContain("Practice together");
    expect(html).toContain("Guide me with hints");
    expect(html).not.toContain("owner");
    expect(html).not.toContain("revision");
  });
  it("escapes untrusted content, retains readable text and handles mixed direction", () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        message={{
          id: "1",
          role: "user",
          content: "<script>secret()</script> ما فهمتش stack",
        }}
        courseId="course"
        revisionId="rev"
        conversationId="conv"
      />,
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain('dir="auto"');
    expect(html).toContain("stack");
  });
  it("provides real authorized source locations and no fake citations for missing evidence", () => {
    const html = renderToStaticMarkup(
      <SourceReferences
        courseId="course"
        revisionId="rev"
        citations={[
          {
            documentId: "doc",
            pageNumber: 3,
            chunkId: "chunk",
            textHash: "hash",
            quote: "quote",
            verified: true,
          },
        ]}
      />,
    );
    expect(html).toContain("/courses/course/revisions/rev/sources/doc#page=3");
    expect(
      renderToStaticMarkup(
        <SourceReferences courseId="course" revisionId="rev" citations={[]} />,
      ),
    ).toContain("evidence is missing");
  });
  it("has independently reusable mode and language selectors", () => {
    expect(
      renderToStaticMarkup(
        <LearningModeSelector
          value="socratic"
          onChange={() => {}}
          disabled={true}
        />,
      ),
    ).toContain("disabled");
    expect(
      renderToStaticMarkup(
        <LanguageSelector
          value={{ language: "darija", script: "arabic" }}
          onChange={() => {}}
          disabled={false}
        />,
      ),
    ).toContain("العربية");
  });
});
