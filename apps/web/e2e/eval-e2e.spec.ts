// @ts-check
const { test, expect } = require("@playwright/test");

/**
 * EVAL-10 — Evaluator E2E
 *
 * Proves the Socratic flow end-to-end through the async job API:
 *   1. Happy path: answer → eval job completes (LLM mocked) → next question
 *      displayed → session completes with a mastery score
 *   2. Negative: submitting an empty answer shows validation feedback and
 *      never creates an eval job
 *
 * The LLM is mocked at the API boundary (POST /api/v1/eval/step →
 * GET /api/v1/eval/jobs/:jobId) so no backend/broker is required — same
 * isolation strategy as plan-e2e.spec.js. A seeded session store + mocked
 * task-complete call get StudySession into its full task view and open the
 * Socratic card the way a real user would (complete a task → evaluation).
 */

const login = async (page) => {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: { _id: "e2e-user", email: "e2e@test.com", role: "student" },
      }),
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
          sessionExpiry: Date.now() + 3600_000,
        },
        version: 0,
      })
    );
  });
};

const seedSession = async (page) => {
  await page.evaluate(async () => {
    const mod = await import("/src/store/sessionStore.js");
    const task1 = {
      _id: "t1",
      title: "Recursion",
      description: "Understand recursion with a base case",
      status: "in-progress",
      estimatedMinutes: 1,
      startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    };
    const task2 = {
      _id: "t2",
      title: "Memoization",
      description: "Optimize recursion with caching",
      status: "pending",
      estimatedMinutes: 1,
    };
    mod.default.setState({
      step: "session",
      mode: "solo",
      activeSession: {
        _id: "sess-e2e",
        name: "Solo Study",
        userId: "e2e-user",
        inviteCode: null,
      },
      taskProgress: {
        tasks: [task1, task2],
        currentTaskIndex: 0,
        totalTasks: 2,
        completedTasks: 0,
      },
      currentTask: task1,
    });
  });
};

const mockCompleteTask = async (page) => {
  await page.route("**/api/v1/study/sessions/sess-e2e/task/complete", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        xpEarned: 10,
        currentTaskIndex: 1,
        completedTasks: 1,
        allTasksComplete: false,
        nextTask: { _id: "t2", title: "Memoization" },
      }),
    });
  });
};

const openSocratic = async (page) => {
  const completeBtn = page.getByRole("button", { name: /mark complete/i });
  await expect(completeBtn).toBeEnabled({ timeout: 10_000 });
  await completeBtn.click();
  await expect(page.getByText(/Socratic Q&A/)).toBeVisible({ timeout: 10_000 });
};

test.describe("EVAL-10: Socratic Evaluation E2E", () => {
  test("answer → eval job completes → next question → mastery confirmed with score", async ({ page }) => {
    await login(page);
    await mockCompleteTask(page);

    let lastStep = 0;
    await page.route("**/api/v1/eval/step", (route) => {
      const body = route.request().postDataJSON();
      lastStep = body.step;
      route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: `job-${body.step}`,
          status: "PENDING",
          correlationId: "corr-e2e",
          sessionId: body.sessionId,
          step: body.step,
          poll: `/api/v1/eval/jobs/job-${body.step}`,
        }),
      });
    });

    await page.route("**/api/v1/eval/jobs/*", (route) => {
      const result =
        lastStep === 2
          ? {
              state: "mastery_confirmed",
              mastery_score: 0.9,
              feedback: "Excellent mastery of recursion.",
              next_question: null,
            }
          : {
              state: "continue",
              mastery_score: 0.6,
              feedback: "Solid start — what stops the recursion?",
              next_question: "What happens if the base case is missing?",
            };
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: `job-${lastStep}`,
          status: "COMPLETED",
          result,
        }),
      });
    });

    await page.goto("/session-live");
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await seedSession(page);
    await openSocratic(page);

    await page.getByPlaceholder("Type your answer...").fill("Recursion needs a base case");
    await page.getByRole("button", { name: /submit answer/i }).click();

    await expect(page.getByText("What happens if the base case is missing?")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("Q2")).toBeVisible();

    await page.getByPlaceholder("Type your answer...").fill("Infinite recursion");
    await page.getByRole("button", { name: /submit answer/i }).click();

    await expect(page.getByText(/Evaluation Passed/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("90%")).toBeVisible();
  });

  test("empty answer shows validation feedback and does not create a job", async ({ page }) => {
    await login(page);
    await mockCompleteTask(page);

    let evalStepCalls = 0;
    await page.route("**/api/v1/eval/step", (route) => {
      evalStepCalls += 1;
      route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ jobId: "job-0", status: "PENDING" }),
      });
    });

    await page.goto("/session-live");
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await seedSession(page);
    await openSocratic(page);

    await page.getByRole("button", { name: /submit answer/i }).click();
    await expect(page.getByText("Please enter your answer before submitting.")).toBeVisible();
    expect(evalStepCalls).toBe(0);
  });
});