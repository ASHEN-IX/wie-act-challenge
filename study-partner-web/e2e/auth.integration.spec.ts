// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Auth E2E Flow:
 * Register → verify → login → dashboard → logout
 */

test.describe("Authentication Flow", () => {
  const timestamp = Date.now();
  const testUser = {
    name: `E2E User ${timestamp}`,
    email: `e2e-${timestamp}@test.com`,
    password: "TestPass123!",
  };

  test("register a new account", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator("h1, h2")).toContainText(/register|sign up|create/i);

    await page.fill('input[name="name"], input[placeholder*="name" i]', testUser.name);
    await page.fill('input[name="email"], input[type="email"]', testUser.email);
    await page.fill('input[name="password"], input[placeholder*="password" i]', testUser.password);

    // If there's a confirm password field
    const confirmField = page.locator('input[name="confirmPassword"], input[placeholder*="confirm" i]');
    if (await confirmField.isVisible()) {
      await confirmField.fill(testUser.password);
    }

    await page.click('button[type="submit"]');

    // Should navigate to dashboard or verification page
    await expect(page).toHaveURL(/dashboard|verify/i, { timeout: 10_000 });
  });

  test("login with credentials", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h1, h2")).toContainText(/login|sign in/i);

    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });
  });

  test("dashboard is accessible when logged in", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });

    await expect(page.locator("text=DASHBOARD")).toBeVisible();
  });

  test("logout returns to login", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });

    // Logout
    await page.click("text=LOGOUT");
    await expect(page).toHaveURL(/login/);
  });

  test("unauthenticated users are redirected to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/login/);
  });
});
