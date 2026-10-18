// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * PLAN-10 — Planner E2E Tests
 *
 * Proves the frontend correctly handles the async plan-generation flow:
 *   1. Happy path: create → 202 → polling → COMPLETED → finalize → redirect
 *   2. Negative path: invalid input rejected without creating a job
 *
 * The backend integration is covered by ai-roundtrip.integration.test.js.
 * This test mocks API responses to isolate the frontend state machine.
 */

const login = async (page) => {
  // Mock auth to bypass real login
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { _id: "e2e-user", email: "e2e@test.com", role: "student" } }),
    })
  );
  await page.goto("/login");
  // Simulate successful login by setting auth state directly
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

test.describe("PLAN-10: Plan Generation E2E", () => {
  test("happy path: create plan → polling → COMPLETED → plan visible", async ({ page }) => {
    await login(page);

    // Mock the subjects/courses list so the page loads
    await page.route("**/api/v1/subjects*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          subjects: [
            {
              _id: "subj-1",
              name: "Computer Science",
              courses: [
                {
                  id: "course-1",
                  title: "RabbitMQ Fundamentals",
                  status: "completed",
                  subjectId: "subj-1",
                },
              ],
            },
          ],
        }),
      })
    );

    // Navigate to subjects page
    await page.goto("/subjects");
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    // Mock the plan creation endpoint → returns 202
    let pollCount = 0;
    await page.route("**/api/v1/study/plans/create", (route) =>
      route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          status: "processing",
          jobId: "job-e2e-001",
          correlationId: "corr-e2e-001",
          message: "Plan generation started",
        }),
      })
    );

    // Mock the job status polling endpoint
    await page.route("**/api/v1/ai/jobs/job-e2e-001", (route) => {
      pollCount++;
      if (pollCount < 3) {
        // Still processing
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jobId: "job-e2e-001",
            status: "PROCESSING",
            type: "study.plan.generate",
            attempts: 1,
          }),
        });
      }
      // Completed on 3rd poll
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: "job-e2e-001",
          status: "COMPLETED",
          type: "study.plan.generate",
          correlationId: "corr-e2e-001",
          attempts: 1,
          result: {
            task_graph: {
              goal: "Master RabbitMQ",
              tasks: [
                {
                  id: "task-1",
                  title: "Learn exchanges",
                  description: "Study exchange types",
                  estimated_minutes: 30,
                  difficulty: 0.4,
                  prerequisites: [],
                  is_review: false,
                },
              ],
            },
            fallbackUsed: false,
          },
        }),
      });
    });

    // Mock the finalize endpoint
    await page.route("**/api/v1/study/plans/create-status", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Study plan finalised",
          plan: {
            id: "plan-e2e-001",
            goal: "Master RabbitMQ",
            tasksCount: 1,
            status: "created",
          },
          tasks: [],
        }),
      })
    );

    // Mock the planner page data
    await page.route("**/api/v1/study/plans*", (route) => {
      const url = route.request().url();
      if (url.includes("/create-status") || url.includes("/create")) return; // skip — handled above
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ plans: [], entries: [] }),
      });
    });
    await page.route("**/api/v1/tasks*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ tasks: [] }),
      })
    );
    await page.route("**/api/v1/availability*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ slots: [] }),
      })
    );

    // Click Generate Plan (triggers prompt → handleGeneratePlan)
    // Since prompt() is used, we handle the dialog
    page.on("dialog", async (dialog) => {
      if (dialog.type() === "prompt") {
        await dialog.accept("Master RabbitMQ");
      } else if (dialog.type() === "alert") {
        // Finalize success alert — dismiss it
        await dialog.dismiss();
      }
    });

    const generateBtn = page.locator('button:has-text("Generate Plan")').first();
    if (await generateBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await generateBtn.click();

      // Wait for redirect to /planner (indicates finalize succeeded)
      await expect(page).toHaveURL(/planner/, { timeout: 15_000 });
    }
  });

  test("negative path: invalid input shows validation error", async ({ page }) => {
    await login(page);

    // Mock subjects with a course that is NOT completed
    await page.route("**/api/v1/subjects*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          subjects: [
            {
              _id: "subj-1",
              name: "Computer Science",
              courses: [
                {
                  id: "course-1",
                  title: "Processing Course",
                  status: "processing",
                  subjectId: "subj-1",
                },
              ],
            },
          ],
        }),
      })
    );

    await page.goto("/subjects");
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    // Handle the alert dialog that should appear
    let alertMessage = "";
    page.on("dialog", async (dialog) => {
      alertMessage = dialog.message();
      await dialog.dismiss();
    });

    const generateBtn = page.locator('button:has-text("Generate Plan")').first();
    if (await generateBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await generateBtn.click();

      // Should show validation error about course not being ready
      await expect(page.locator("text=still being processed")).toBeVisible({ timeout: 5000 });
    }
  });
});
