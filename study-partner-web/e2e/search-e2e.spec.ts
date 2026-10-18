// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * SEARCH-08 — Search E2E Tests
 *
 * Proves the frontend correctly handles the async search flow (F05 / SEARCH-07):
 *   1. Happy path: submit query → 202 { jobId } → poll → COMPLETED →
 *      answer + sources displayed
 *   2. Negative path: empty query shows a validation error, no job created
 *
 * The crawler + LLM are mocked at the API boundary, so no real web crawl or
 * model call happens.
 */

const login = async (page) => {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { _id: "e2e-user", email: "e2e@test.com", role: "student" } }),
    })
  );
  await page.goto("/login");
  await page.evaluate(() => {
    localStorage.setItem(
      "auth-storage",
      JSON.stringify({
        state: {
          user: { _id: "e2e-user", email: "e2e@test.com", role: "student" },
          token: "mock-jwt-token",
        },
        version: 0,
      })
    );
  });
};

test.describe("SEARCH-08: Search E2E", () => {
  test("happy path: submit query → polling → answer + sources displayed", async ({ page }) => {
    await login(page);

    // Mock search history (loaded on mount)
    await page.route("**/api/v1/ai/search/history/*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ searches: [] }),
      })
    );

    // Mock search job creation → 202 { jobId }
    await page.route("**/api/v1/search/query", (route) =>
      route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: "job-search-e2e",
          status: "PENDING",
          correlationId: "corr-search-e2e",
          poll: "/api/v1/search/jobs/job-search-e2e",
        }),
      })
    );

    // Mock polling — PROCESSING first, then COMPLETED with answer + sources
    let pollCount = 0;
    await page.route("**/api/v1/search/jobs/job-search-e2e", (route) => {
      pollCount++;
      if (pollCount < 2) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jobId: "job-search-e2e",
            status: "PROCESSING",
            attempts: 1,
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: "job-search-e2e",
          status: "COMPLETED",
          attempts: 1,
          result: {
            answer: "Recursion is when a function calls itself.",
            sources: [
              {
                url: "https://en.wikipedia.org/wiki/Recursion",
                title: "Recursion — Wikipedia",
              },
            ],
            degraded: false,
          },
        }),
      });
    });

    await page.goto("/search");
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    await page.fill('input[placeholder*="Ask anything"]', "what is recursion");
    await page.click('button[type="submit"]');

    // Answer displayed after polling completes
    await expect(
      page.locator("text=Recursion is when a function calls itself.")
    ).toBeVisible({ timeout: 10_000 });

    // Source displayed
    await expect(
      page.locator("a:has-text('Recursion — Wikipedia')")
    ).toBeVisible({ timeout: 5_000 });

    expect(pollCount).toBeGreaterThanOrEqual(2);
  });

  test("negative path: empty query shows validation error, no job created", async ({ page }) => {
    await login(page);

    await page.route("**/api/v1/ai/search/history/*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ searches: [] }),
      })
    );

    // Fail loudly if a job is attempted
    let jobCreated = false;
    await page.route("**/api/v1/search/query", (route) => {
      jobCreated = true;
      return route.fulfill({ status: 422, contentType: "application/json", body: "{}" });
    });

    await page.goto("/search");
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    // Submit with an empty query → show validation error, no job created
    await page.click('button[type="submit"]');

    await expect(page.locator("text=Please enter a search query.")).toBeVisible({
      timeout: 5_000,
    });
    expect(jobCreated).toBe(false);
  });
});
