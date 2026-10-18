// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * AI Search E2E:
 * Enter query → results load → view history
 */

const login = async (page) => {
  await page.goto("/login");
  await page.fill('input[type="email"]', process.env.E2E_EMAIL || "test@test.com");
  await page.fill('input[type="password"]', process.env.E2E_PASSWORD || "TestPass123!");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });
};

test.describe("AI Search", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("navigate to search page", async ({ page }) => {
    await page.goto("/search");
    await expect(page).toHaveURL(/search/);
  });

  test("search page has input field", async ({ page }) => {
    await page.goto("/search");
    const input = page.locator('input[placeholder*="search" i], input[placeholder*="ask" i], input[placeholder*="query" i], textarea');
    await expect(input.first()).toBeVisible({ timeout: 10_000 });
  });

  test("search page has submit button", async ({ page }) => {
    await page.goto("/search");
    const button = page.locator("button", { hasText: /search/i });
    await expect(button).toBeVisible({ timeout: 10_000 });
  });

  test("search page renders heading", async ({ page }) => {
    await page.goto("/search");
    await expect(page.locator("h1, h2")).toContainText(/SEARCH|AI Search|Search/i);
  });
});
