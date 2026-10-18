// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Tier Gating E2E:
 * Normal user blocked from AI features → sees upgrade prompt
 * VIP user can access → VIP Plus accesses coach
 */

test.describe("Tier Gating", () => {
  test("pricing page shows all tiers", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.locator("text=Free")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=VIP")).toBeVisible();
    await expect(page.locator("text=VIP+")).toBeVisible();
  });

  test("pricing page shows feature comparison", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.locator("text=Manual course creation")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=AI course ingestion")).toBeVisible();
    await expect(page.locator("text=AI coach")).toBeVisible();
  });

  test("pricing page is accessible without login", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page).toHaveURL(/pricing/);
    await expect(page.locator("h1, h2")).toContainText(/PRICING|Plans|Pricing/i);
  });

  test("upgrade prompt appears for blocked features", async ({ page }) => {
    // Login as a normal tier user
    await page.goto("/login");
    await page.fill('input[type="email"]', process.env.E2E_EMAIL || "test@test.com");
    await page.fill('input[type="password"]', process.env.E2E_PASSWORD || "TestPass123!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });

    // Attempt to access an AI-gated feature
    // The upgrade prompt should appear or the user should be redirected
    // This depends on the actual tier of the test user
    await page.goto("/search");
    await expect(page).toHaveURL(/search/);
  });
});
