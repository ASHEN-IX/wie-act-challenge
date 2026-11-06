import { describe, it, expect, vi } from "vitest";
import { sessionSpeech, cachedSpeech } from "./speech-cache";
describe("session audio billing protection", () => {
  it("merges duplicate requests and reuses audio for replay/remount", async () => {
    const blob = new Blob(["test"]);
    const generate = vi.fn(async () => blob);
    const [a, b] = await Promise.all([
      sessionSpeech("test-message", generate),
      sessionSpeech("test-message", generate),
    ]);
    expect(a).toBe(blob);
    expect(b).toBe(blob);
    expect(cachedSpeech("test-message")).toBe(blob);
    expect(await sessionSpeech("test-message", generate)).toBe(blob);
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
