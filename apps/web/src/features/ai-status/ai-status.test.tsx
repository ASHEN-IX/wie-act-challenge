import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AiModeNote, AiWaitStatus } from "./ai-status-view";
import { AI_WAIT_STAGES } from "./ai-status";

describe("AiModeNote", () => {
  it("shows the simulated-outage fallback in plain language with a neutral tone", () => {
    const html = renderToStaticMarkup(<AiModeNote mode="DETERMINISTIC_FALLBACK" />);
    expect(html).toContain("Built-in guidance.");
    expect(html).toContain('data-tone="notice"');
    expect(html).not.toContain("DETERMINISTIC_FALLBACK");
  });

  it("shows an unavailable state when the mode is missing", () => {
    const html = renderToStaticMarkup(<AiModeNote mode={undefined} />);
    expect(html).toContain("AI unavailable.");
    expect(html).toContain('data-tone="warning"');
  });
});

describe("AiWaitStatus", () => {
  it("announces progress politely with the first stage while pending", () => {
    const html = renderToStaticMarkup(<AiWaitStatus />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain(`${AI_WAIT_STAGES[0]}…`);
  });
});
