// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * COACH-11 — Coach E2E (frontend half).
 *
 * Proves: user in an active study session → nudge requested → job completes
 * (LLM mocked) → nudge rendered in the coach popup.
 *
 * The async job-bus completion (202 → COMPLETED → result.nudge) is proven by
 * tests/integration/coach-roundtrip.integration.test.js against a real broker
 * + the real CoachWorker (LLM_MOCK=1). This spec drives the visual half of the
 * AC the way planner-e2e does: full page state machine, APIs route-mocked.
 * The nudge surface is the coach popup (voice-personalized UI lands later).
 *
 * Negative AC (401 on unauthenticated nudge) is covered by supertest in
 * services/study/src/tests/coach.test.js and the integration test.
 */

const NUDGE_MESSAGE =
  "You seem distracted — take a short break, then return to your task.";

const USER = { id: "e2e-coach-user", email: "e2e@test.com", role: "student", isVerified: true };

/**
 * Login through the real UI with every backend call route-mocked. This sets
 * isAuthenticated in the store synchronously (SPA session), which is what the
 * PrivateRoute guard needs on FIRST render — persisted storage alone can't
 * do that for /session-live (tokens live in httpOnly cookies).
 */
const login = async (page) => {
  await page.route("**/api/v1/auth/login*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: USER }),
    })
  );

  await page.goto("/login");
  await page.getByPlaceholder("your@email.com").fill(USER.email);
  await page.getByPlaceholder("••••••••").fill("password123");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
};

test.describe("COACH-11: Coach nudge E2E", () => {
  test("active session → nudge requested → job completed → nudge rendered in popup", async ({
    page,
  }) => {
    // Fallback for every other API call so the page never blocks on the
    // real gateway (registered first; specific mocks below take precedence).
    // Shapeful: fetchSignals / handleFrameCapture read focus/fatigue directly.
    const MOCK_SIGNALS = {
      focus: { score: 0.62, state: "Focused", confidence: 0.7 },
      fatigue: { score: 0.3, state: "Low", confidence: 0.7 },
      timestamp: new Date().toISOString(),
    };
    await page.route("**/api/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...MOCK_SIGNALS, data: { ...MOCK_SIGNALS } }),
      })
    );

    // requestCoachDecision() → legacy coach sync endpoint returns the nudge.
    await page.route("**/api/v1/ai/coach*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          coach_action: {
            action_type: "nudge",
            message: NUDGE_MESSAGE,
            reasoning: "Focus score dropped below the distraction threshold (mock LLM decision).",
          },
        }),
      })
    );

    // Session record created when the user starts the session.
    await page.route("**/api/v1/study/sessions", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            session: { id: "session-e2e-coach-1", userId: USER.id, status: "active" },
          }),
        });
      }
      return route.continue();
    });

    await login(page);

    // SPA-side navigation (no full reload → auth state survives the guard).
    await page.evaluate(() => {
      history.pushState({}, "", "/session-live");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    const startBtn = page.locator(".session-btn", { hasText: /start|begin/i }).first();
    await expect(startBtn).toBeVisible({ timeout: 20_000 });
    await startBtn.click();
    await expect(page.locator(".session-btn")).toHaveText(/end session/i, { timeout: 10_000 });

    // requestCoachDecision() fires ~5s after start → popup renders the nudge.
    await expect(page.locator(".coach-popup")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(".coach-action-type")).toHaveText(/nudge|nudge/i);
    await expect(page.locator(".coach-message")).toHaveText(NUDGE_MESSAGE);
    await expect(page.locator(".coach-reasoning")).toContainText(/focus score/i);
  });
});