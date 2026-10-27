import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { VoiceModeratorControls } from "./voice-moderator-controls";

vi.mock("./livekit-voice-actions", () => ({
  getLiveKitToken: vi.fn().mockResolvedValue({
    data: {
      token: "test.jwt.token",
      livekitUrl: "wss://ednova.test",
      roomName: "room-123",
      participantIdentity: "usr-1",
      participantName: "Alice",
      expiresInSeconds: 3600,
      canPublishAudio: true,
      canSubscribeAudio: true,
    },
  }),
  updateVoiceConsent: vi.fn().mockResolvedValue({
    data: {
      roomId: "room-123",
      hasVoiceConsent: true,
    },
  }),
  dispatchAiModerator: vi.fn().mockResolvedValue({
    data: {
      dispatched: true,
      roomId: "room-123",
      agentIdentity: "agent-ednova-moderator",
      mode: "peer_first_facilitator",
      status: "ready",
    },
  }),
}));

describe("VoiceModeratorControls Component", () => {
  it("renders with honest zero audio retention disclosure", () => {
    const html = renderToStaticMarkup(
      <VoiceModeratorControls roomId="room-123" isPresenterOrHost={true} />,
    );

    expect(html).toContain("Live Voice Discussion");
    expect(html).toContain("Zero audio retention");
    expect(html).toContain("No audio is ever written to disk");
    expect(html).toContain("Voice Inactive");
    expect(html).toContain("AI Facilitator: Idle");
    expect(html).toContain("Join Voice Room");
    expect(html).toContain("Grant Consent");
    expect(html).toContain("Dispatch AI Moderator");
  });

  it("renders with active consent and active facilitator badges when initial state is true", () => {
    const html = renderToStaticMarkup(
      <VoiceModeratorControls
        roomId="room-456"
        initialVoiceConsent={true}
        initialFacilitatorActive={true}
        isPresenterOrHost={true}
      />,
    );

    expect(html).toContain("Revoke Consent");
    expect(html).toContain("AI Facilitator: Active");
    // When facilitator is already active, dispatch button is omitted
    expect(html).not.toContain("Dispatch AI Moderator");
  });

  it("provides accessible controls with aria labels", () => {
    const html = renderToStaticMarkup(
      <VoiceModeratorControls roomId="room-789" initialVoiceConsent={false} />,
    );

    expect(html).toContain('aria-label="LiveKit Voice &amp; AI Moderator"');
    expect(html).toContain('aria-pressed="false"');
  });
});
