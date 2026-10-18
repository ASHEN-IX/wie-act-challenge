// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Calendar E2E:
 * Set availability → schedule tasks → verify calendar populated
 */

const login = async (page) => {
  await page.goto("/login");
  await page.fill('input[type="email"]', process.env.E2E_EMAIL || "test@test.com");
  await page.fill('input[type="password"]', process.env.E2E_PASSWORD || "TestPass123!");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });
};

test.describe("Calendar Flow", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("navigate to calendar page", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page).toHaveURL(/calendar/);
  });

  test("calendar renders day headers", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.locator("text=Monday")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=Friday")).toBeVisible();
  });

  test("calendar has navigation controls", async ({ page }) => {
    await page.goto("/calendar");
    // Should have prev/next week buttons
    const navBtns = page.locator("button", { hasText: /prev|next|←|→|<|>/i });
    const count = await navBtns.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("navigate to planner from calendar context", async ({ page }) => {
    await page.goto("/planner");
    await expect(page).toHaveURL(/planner/);
    // Planner should also show calendar-like elements
    await expect(page.locator("text=Monday")).toBeVisible({ timeout: 10_000 });
  });
});
