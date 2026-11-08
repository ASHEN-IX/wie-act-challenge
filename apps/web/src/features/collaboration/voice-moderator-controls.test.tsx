import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { VoiceModeratorControls } from "./voice-moderator-controls";

vi.mock("./livekit-voice-actions", () => ({
  dispatchAiModerator: vi.fn(),
  getLiveKitToken: vi.fn(),
  updateVoiceConsent: vi.fn(),
}));

describe("VoiceModeratorControls", () => {
  it("requires joining before offering microphone or moderator actions", () => {
    const html = renderToStaticMarkup(
      <VoiceModeratorControls roomId="room-123" isPresenterOrHost />,
    );
    expect(html).toContain("Voice discussion");
    expect(html).toContain("Join voice");
    expect(html).not.toContain("Turn on microphone");
    expect(html).not.toContain("Request voice moderator");
  });
});
