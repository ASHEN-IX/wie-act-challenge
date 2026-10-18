// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Session Flow E2E:
 * Start study session → coach advice → end session → XP awarded
 */

const login = async (page) => {
  await page.goto("/login");
  await page.fill('input[type="email"]', process.env.E2E_EMAIL || "test@test.com");
  await page.fill('input[type="password"]', process.env.E2E_PASSWORD || "TestPass123!");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });
};

test.describe("Session Flow", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("navigate to lobby", async ({ page }) => {
    await page.goto("/lobby");
    await expect(page.locator("h1, h2, [class*=heading]")).toContainText(/LOBBY|Session|Mode/i);
  });

  test("lobby shows mode options", async ({ page }) => {
    await page.goto("/lobby");
    await expect(page.locator("text=DEEP FOCUS")).toBeVisible();
    await expect(page.locator("text=POMODORO")).toBeVisible();
  });

  test("navigate to study session page", async ({ page }) => {
    await page.goto("/study-session");
    await expect(page).toHaveURL(/study-session/);
  });

  test("study session page has webcam area", async ({ page }) => {
    await page.goto("/study-session");
    // Look for video element or webcam container
    const hasVideo = await page.locator("video, [data-testid='webcam'], .webcam").count();
    expect(hasVideo).toBeGreaterThan(0);
  });

  test("study session has start control", async ({ page }) => {
    await page.goto("/study-session");
    const startBtn = page.locator("button", { hasText: /start|begin|lock in/i });
    await expect(startBtn).toBeVisible();
  });
});
