// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * BLOOM-12 — Competency Map E2E Tests
 *
 * Proves the frontend renders the competency feedback-loop output correctly:
 *   1. Happy path: competency map renders per-subject radar + topic scores,
 *      and drilling into a topic shows its scored Bloom rows + evidence.
 *   2. Negative path A: empty map → "No competency data yet" empty state.
 *   3. Negative path B: failed fetch → error state with retry.
 *
 * The backend loop (behavior of eval → profile → plan) is covered by the
 * Node integration test `bloom-loop.integration.test.js`. This spec mocks the
 * API responses to isolate the frontend rendering.
 */

const authUser = { _id: "e2e-user", email: "e2e@test.com", role: "student", isVerified: true };

/**
 * Authenticate by driving the real login UI with a mocked login API. This sets
 * `isAuthenticated=true` in live React state (no zustand persistence race) and
 * redirects to /dashboard, after which protected routes are reachable.
 */
const login = async (page) => {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: authUser }),
    })
  );
  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { user: authUser } }),
    })
  );

  await page.goto("/login");
  await page.fill('input[name="email"], input[type="email"]', authUser.email);
  await page.fill('input[name="password"], input[type="password"]', "Password123!");
  await page.click('button[type="submit"]');

  // Successful login redirects to /dashboard (proves auth is established).
  await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });
};

const SAMPLE_MAP = {
  competencies: [
    {
      subjectId: "subj-1",
      subjectName: "Computer Science",
      topics: [
        {
          topicId: "t1",
          topicName: "Recursion Basics",
          parentTopic: "Recursion",
          levels: [
            { bloomLevel: "remember", score: 0.74, count: 1 },
            { bloomLevel: "apply", score: 0.5, count: 1 },
          ],
        },
        {
          topicId: "t2",
          topicName: "Sorting Algorithms",
          parentTopic: "Sorting",
          levels: [{ bloomLevel: "remember", score: 0.8, count: 1 }],
        },
      ],
    },
  ],
};

const SAMPLE_TOPIC = {
  topic: {
    topicId: "t1",
    topicName: "Recursion Basics",
    parentTopic: "Recursion",
    competencies: [
      {
        bloomLevel: "remember",
        knowledgeType: "conceptual",
        score: 0.74,
        evidence: [
          {
            objectiveId: "obj-1",
            demonstratedBloomLevel: "REMEMBER",
            masteryScore: 0.9,
          },
        ],
      },
    ],
  },
};

test.describe("BLOOM-12: Competency Map E2E", () => {
  test("happy path: map renders + topic drill-down shows scored rows", async ({ page }) => {
    await login(page);

    await page.route("**/api/v1/competencies", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SAMPLE_MAP),
      })
    );
    await page.route("**/api/v1/competencies/topics/t1", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SAMPLE_TOPIC),
      })
    );

    // SPA-navigate to /competency (a full page.goto reload would reset the
    // authenticated session back to the login/rehydration race).
    await page.click('nav a[href="/competency"], aside a[href="/competency"]');
    await expect(page.locator("text=Competency Map")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("tab", { name: "Computer Science" })).toBeVisible();

    // Topic list renders both topics with their scores.
    await expect(page.locator('[data-testid="topic-list"]')).toContainText("Recursion Basics");
    await expect(page.locator('[data-testid="topic-list"]')).toContainText("Sorting Algorithms");

    // Drill into a topic: detail panel shows the Bloom row + evidence.
    await page.locator("button:has-text('Recursion Basics')").first().click();
    await expect(page.locator('[data-testid="topic-detail-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="topic-competency-row"]')).toContainText("Remember");
    await expect(page.locator('[data-testid="topic-competency-row"]')).toContainText("74%");
    await expect(page.locator('[data-testid="topic-competency-row"]')).toContainText("Evidence");

    // Close the panel.
    await page.locator('button[aria-label="Close topic details"]').click();
    await expect(page.locator('[data-testid="topic-detail-panel"]')).not.toBeVisible();
  });

  test("negative path: empty map shows the empty state", async ({ page }) => {
    await login(page);

    await page.route("**/api/v1/competencies", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ competencies: [] }),
      })
    );

    // SPA-navigate to /competency (a full page.goto reload would reset the
    // authenticated session back to the login/rehydration race).
    await page.click('nav a[href="/competency"], aside a[href="/competency"]');
    await expect(page.locator("text=No competency data yet")).toBeVisible({ timeout: 10_000 });
  });

  test("negative path: failed fetch shows error state with retry", async ({ page }) => {
    await login(page);

    let calls = 0;
    await page.route("**/api/v1/competencies", (route) => {
      calls++;
      if (calls === 1) {
        return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
      }
      // Retry succeeds.
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SAMPLE_MAP),
      });
    });

    // SPA-navigate to /competency (a full page.goto reload would reset the
    // authenticated session back to the login/rehydration race).
    await page.click('nav a[href="/competency"], aside a[href="/competency"]');
    await expect(page.locator("text=Couldn't load your competency map")).toBeVisible({
      timeout: 10_000,
    });

    // Press "Try again" → second fetch succeeds and the map renders.
    await page.locator("button:has-text('Try again')").click();
    await expect(page.getByRole("tab", { name: "Computer Science" })).toBeVisible({ timeout: 10_000 });
  });
});
