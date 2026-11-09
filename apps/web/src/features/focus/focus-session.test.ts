import { describe, expect, it } from "vitest";
import {
  endFocus,
  focusedMs,
  nextStepFor,
  pauseFocus,
  remainingMs,
  restoreFocus,
  resumeFocus,
  startAutoFocus,
  startFocus,
  tick,
  type FocusState,
} from "./focus-session";

const T0 = 1_000_000;
const min = (n: number) => n * 60_000;

describe("focus session", () => {
  it("counts running time from timestamps and excludes paused time", () => {
    let s: FocusState = startFocus(T0, 25, "Chapter 2", "/courses/a/learn");
    s = pauseFocus(s, T0 + min(10));
    expect(focusedMs(s, T0 + min(40))).toBe(min(10));
    s = resumeFocus(s, T0 + min(40));
    expect(focusedMs(s, T0 + min(45))).toBe(min(15));
    expect(remainingMs(s, T0 + min(45))).toBe(min(10));
  });

  it("ends itself at the planned time and never reports more than planned", () => {
    const s = tick(startFocus(T0, 25, "", "/x"), T0 + min(30));
    expect(s.status).toBe("ended");
    if (s.status === "ended") {
      expect(s.focusedMs).toBe(min(25));
      expect(s.completed).toBe(true);
    }
  });

  it("marks an early end as not completed", () => {
    const s = endFocus(startFocus(T0, 45, "", "/x"), T0 + min(12));
    expect(s.status === "ended" && s.completed).toBe(false);
    expect(s.status === "ended" && s.focusedMs).toBe(min(12));
  });

  it("clamps minutes and trims the objective", () => {
    const s = startFocus(T0, 9999, `  ${"x".repeat(300)} `, "/x");
    expect(s.status === "running" && s.plannedMs).toBe(min(180));
    expect(s.status === "running" && s.objective).toHaveLength(140);
  });

  it("restores a recent running session and keeps counting", () => {
    const running = startFocus(T0, 25, "a", "/x");
    const restored = restoreFocus(JSON.stringify(tick(running, T0 + 10_000)), T0 + 20_000);
    expect(restored.status).toBe("running");
    expect(focusedMs(restored, T0 + 20_000)).toBe(20_000);
  });

  it("does not bank time while the browser was closed", () => {
    const running = tick(startFocus(T0, 45, "a", "/x"), T0 + min(5));
    const restored = restoreFocus(JSON.stringify(running), T0 + min(600));
    expect(restored.status).toBe("paused");
    expect(focusedMs(restored, T0 + min(600))).toBe(min(5));
  });

  it.each([null, "", "not json", "{}", JSON.stringify({ status: "running", plannedMs: -1 }), JSON.stringify({ status: "paused", plannedMs: min(25), startedAt: 1, focusedMs: 0, objective: "", route: "https://evil.test" })])(
    "treats corrupt storage as idle: %s",
    (raw) => expect(restoreFocus(raw, T0).status).toBe("idle"),
  );

  it("never links time spent to mastery in the next step", () => {
    const ended = endFocus(startFocus(T0, 25, "", "/x"), T0 + min(25));
    if (ended.status === "ended") expect(nextStepFor(ended)).not.toMatch(/\b(mastery|xp|score)\b/i);
  });

  it("starts Deep Focus with no timer and counts only active time", () => {
    let s = startAutoFocus(T0, "/courses/a/learn");
    expect(s.status === "running" && s.auto).toBe(true);
    s = pauseFocus(s, T0 + min(20)); // tab hidden
    s = resumeFocus(s, T0 + min(50)); // back
    expect(focusedMs(s, T0 + min(55))).toBe(min(25));
    const ended = endFocus(s, T0 + min(55));
    expect(ended.status === "ended" && ended.auto).toBe(true);
  });

  it("keeps the auto flag across a refresh and defaults old sessions to manual", () => {
    const auto = startAutoFocus(T0, "/x");
    expect(restoreFocus(JSON.stringify(auto), T0 + 1000)).toMatchObject({ status: "running", auto: true });
    const legacy = { ...startFocus(T0, 25, "", "/x") } as Record<string, unknown>;
    delete legacy.auto;
    expect(restoreFocus(JSON.stringify(legacy), T0 + 1000)).toMatchObject({ auto: false });
  });
});
