// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * Study Flow E2E:
 * Create subject → upload course → view ingestion → create plan → view tasks
 */

// Helper to login before each test
const login = async (page) => {
  await page.goto("/login");
  await page.fill('input[type="email"]', process.env.E2E_EMAIL || "test@test.com");
  await page.fill('input[type="password"]', process.env.E2E_PASSWORD || "TestPass123!");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });
};

test.describe("Study Flow", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("navigate to subjects page", async ({ page }) => {
    await page.goto("/subjects");
    await expect(page.locator("h1, h2")).toContainText(/SUBJECTS|Subjects/i);
  });

  test("navigate to course upload page", async ({ page }) => {
    await page.goto("/upload");
    await expect(page.locator("h1, h2")).toContainText(/UPLOAD|Upload|Course/i);
  });

  test("navigate to study planner", async ({ page }) => {
    await page.goto("/planner");
    await expect(page.locator("h1, h2")).toContainText(/STUDY|Planner|Plan/i);
  });

  test("navigate to tasks page", async ({ page }) => {
    await page.goto("/tasks");
    await expect(page.locator("h1, h2")).toContainText(/TASKS|Tasks/i);
  });

  test("full study flow navigation", async ({ page }) => {
    // Subjects
    await page.goto("/subjects");
    await expect(page).toHaveURL(/subjects/);

    // Upload
    await page.goto("/upload");
    await expect(page).toHaveURL(/upload/);

    // Planner
    await page.goto("/planner");
    await expect(page).toHaveURL(/planner/);

    // Tasks
    await page.goto("/tasks");
    await expect(page).toHaveURL(/tasks/);
  });
});
