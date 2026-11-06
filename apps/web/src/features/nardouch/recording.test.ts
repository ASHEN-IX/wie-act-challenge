import { describe, it, expect } from "vitest";
import { encodeWav } from "./recording";
describe("browser PCM encoding", () => {
  it("resamples a 48 kHz microphone into mono PCM16 at 16 kHz", () => {
    const result = encodeWav([new Float32Array(48000).fill(0.5)], 48000),
      view = new DataView(result.buffer as ArrayBuffer);
    expect(new TextDecoder().decode(result.slice(0, 4))).toBe("RIFF");
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getInt16(44, true)).toBe(16384);
    expect(result.length).toBe(32044);
  });
  it("caps recordings at 30 seconds and clips samples safely", () => {
    const result = encodeWav([new Float32Array(16000 * 31).fill(9)], 16000);
    expect(result.length).toBe(960044);
    expect(new DataView(result.buffer as ArrayBuffer).getInt16(44, true)).toBe(
      32767,
    );
  });
  it("rejects a recording too short for recognition", () => {
    expect(() => encodeWav([new Float32Array(20)], 16000)).toThrow();
    expect(() => encodeWav([], 0)).toThrow();
  });
});
