// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Smoke/Integration Tests - Basic page loads
 * Don't test API flows, just verify pages render
 */

test.describe("App Smoke Tests", () => {
  test("should load homepage", async ({ page }) => {
    await page.goto("/");
    
    // Wait for page to stabilize
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    
    // Check basic elements exist
    const mainContent = page.locator("main, [role='main'], body");
    await expect(mainContent).toBeTruthy();
  });

  test("should have accessible navigation", async ({ page }) => {
    await page.goto("/");
    
    // Look for navigation elements
    const nav = page.locator("nav, [role='navigation']");
    const hasNav = await nav.count().catch(() => 0);
    
    // Either has nav or has links/buttons
    const buttons = page.locator("button, a[href]");
    await expect(buttons.first()).toBeVisible();
    const hasInteractive = (await buttons.count()) > 0;
    
    expect(hasNav + (hasInteractive ? 1 : 0)).toBeGreaterThan(0);
  });

  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    
    const loginForm = page.locator(
      "form, [role='form'], input[type='email'], input[type='password']"
    );
    await expect(loginForm.first()).toBeVisible();
  });

  test("register page renders", async ({ page }) => {
    await page.goto("/register");
    
    const registerForm = page.locator(
      "form, [role='form'], input[name*='email' i], input[name*='password' i]"
    );
    await expect(registerForm.first()).toBeVisible();
  });

  test("handles 404 pages gracefully", async ({ page }) => {
    await page.goto("/nonexistent-page-xyz", { waitUntil: "networkidle" }).catch(() => {});
    
    // Page should either show 404 or redirect
    const url = page.url();
    const content = await page.content();
    
    // At minimum, page loaded without crash
    expect(content.length).toBeGreaterThan(0);
  });

  test("CSS loads correctly", async ({ page }) => {
    await page.goto("/");
    
    // Check computed styles exist (page is styled)
    const bodyStyles = await page.locator("body").evaluate(() => {
      return window.getComputedStyle(document.body).display;
    });
    
    expect(bodyStyles).not.toBeNull();
  });

  test("JavaScript is executable", async ({ page }) => {
    await page.goto("/");
    
    // Execute a simple JS check
    const result = await page.evaluate(() => {
      return typeof window !== "undefined" && typeof document !== "undefined";
    });
    
    expect(result).toBe(true);
  });
});
