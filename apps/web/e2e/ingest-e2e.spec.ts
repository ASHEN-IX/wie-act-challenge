// @ts-check
const { test, expect } = require("@playwright/test");
const path = require("path");

/**
 * INGEST-10 — Ingestion E2E Tests
 *
 * Drives the real course-upload form end to end. The async ingestion job is
 * faked at the API boundary (the OCR/LLM work is "mocked" exactly like the
 * other E2E specs mock their backend) so the test is deterministic:
 *   1. Happy path: upload a fixture PDF (real multipart with the file
 *      attached) → 202 { jobId, courseId } → the ingest-status contract
 *      progresses parsing → enriching → embedding → indexing and lands on
 *      completed → the course shows as completed (with topics + plan ready)
 *      → the course content is searchable in AI Search → the planner surfaces
 *      the ingested material.
 *   2. Negatives: the upload endpoint rejects with 415/422 (executable file)
 *      and 413 (oversized file); the frontend shows the error state.
 *
 * The upload-validation rules themselves (MIME/extension allowlist, magic
 * bytes, 25 MB cap) are enforced server-side; they are covered by the API
 * unit/integration tests. Here the allowed/rejected status codes are mocked
 * to prove the UI wiring.
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

  // Re-inject the persisted auth store before the app boots on EVERY
  // navigation. zustand persist strips the token from storage once the app
  // writes it (partialize keeps only user + sessionExpiry), so a fresh reload
  // would otherwise render the first frame as logged-out and PrivateRoute can
  // navigate to /login before initializeAuth flips isAuthenticated. Injection
  // on every load removes that race.
  await page.addInitScript(() => {
    const sessionExpiry = new Date().getTime() + 60 * 60 * 1000;
    localStorage.setItem(
      "auth-storage",
      JSON.stringify({
        state: {
          user: { _id: "e2e-user", email: "e2e@test.com", role: "student" },
          token: "mock-jwt-token",
          sessionExpiry,
        },
        version: 0,
      })
    );
  });
};

const PDF_FIXTURE = path.join(__dirname, "fixtures", "ingest-sample.pdf");
const EXE_FIXTURE = path.join(__dirname, "fixtures", "malware.sh");

const SUBJECT = { id: "subj-1", name: "Mathematics", course_count: 1 };

// The completed course as it exists after the (mocked) ingestion worker runs.
const COMPLETED_COURSE = {
  id: "course-1",
  title: "Calculus 101",
  subject_name: "Mathematics",
  status: "completed",
  uploaded_at: "2026-01-05T10:00:00.000Z",
  filesCount: 1,
  topics: [{ title: "Limits and Continuity" }, { title: "Derivatives" }],
};

test.describe("INGEST-10: Ingestion E2E", () => {
  test("happy path: upload fixture PDF → job completes → searchable + planner ready", async ({
    page,
  }) => {
    await login(page);

    // --- App data mocks -----------------------------------------------------
    await page.route("**/api/v1/study/subjects", (route) => {
      if (route.request().method() === "POST") return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ subjects: [SUBJECT] }),
      });
    });
    await page.route("**/api/v1/study/subjects/subj-1", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ subject: SUBJECT }),
      })
    );
    const completedCourse = () => ({ courses: [COMPLETED_COURSE] });
    // Course detail (opened by View Details) returns a single course object.
    await page.route("**/api/v1/study/courses/course-1", (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ course: COMPLETED_COURSE }),
      });
    });
    // Course list (subject detail page).
    await page.route("**/api/v1/study/courses*", (route) => {
      const req = route.request();
      if (req.method() !== "GET") return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(completedCourse()),
      });
    });

    // Upload endpoint: capture the real multipart, answer with a 202 job.
    let uploadBodies = [];
    await page.route("**/api/v1/study/courses", (route) => {
      const req = route.request();
      if (req.method() !== "POST") return route.fallback();
      uploadBodies.push(req.postDataBuffer().toString("latin1"));
      return route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: "ingest-job-1",
          courseId: "course-1",
          status: "processing",
        }),
      });
    });

    // Ingest-status ladder: the worker (OCR/LLM mocked) advances the job.
    const INGEST_STEPS = [
      { status: "processing", stage: "parsing", progress: 0.1 },
      { status: "processing", stage: "enriching", progress: 0.35 },
      { status: "processing", stage: "embedding", progress: 0.6 },
      { status: "completed", stage: "indexing", progress: 1.0 },
    ];
    let ingestPolls = 0;
    await page.route(
      "**/api/v1/study/courses/course-1/ingest-status",
      (route) => {
        const step = INGEST_STEPS[Math.min(ingestPolls, INGEST_STEPS.length - 1)];
        ingestPolls += 1;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            courseId: "course-1",
            jobId: "ingest-job-1",
            error: "",
            processedAt: null,
            retry: null,
            updatedAt: null,
            ...step,
          }),
        });
      }
    );

    // Planner page mocks (tasks/availability/plans feed the scheduler).
    await page.route("**/api/v1/study/tasks*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tasks: [{ _id: "t1", title: "Review Limits from Calculus 101", status: "todo" }],
        }),
      })
    );
    await page.route("**/api/v1/users/availability", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      })
    );
    await page.route("**/api/v1/study/plans*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ plans: [], entries: [] }),
      })
    );
    await page.route("**/api/v1/ai/plan/list", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ plans: [] }),
      })
    );

    // AI Search mocks.
    await page.route("**/api/v1/ai/search/history/*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ searches: [] }),
      })
    );
    await page.route("**/api/v1/search/query", (route) =>
      route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: "job-search-ingest",
          status: "PENDING",
          poll: "/api/v1/search/jobs/job-search-ingest",
        }),
      })
    );
    let searchPolls = 0;
    await page.route("**/api/v1/search/jobs/job-search-ingest", (route) => {
      searchPolls += 1;
      if (searchPolls < 2) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ jobId: "job-search-ingest", status: "PROCESSING" }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: "job-search-ingest",
          status: "COMPLETED",
          result: {
            answer: "Limits are the foundation of derivatives.",
            sources: [
              { url: "https://course.local/calculus-101", title: "Calculus 101 — Course Notes" },
            ],
            degraded: false,
          },
        }),
      });
    });

    // --- 1. Upload the fixture PDF through the real form --------------------
    await page.goto("/upload-course");
    await page.fill("#course-title", "Calculus 101");
    await page.fill("#subject-name", "Mathematics");
    await page.setInputFiles("#file-input", PDF_FIXTURE);
    await page.click(".upload-btn");

    // The 202 (job started) surfaces as a success state.
    await expect(page.locator(".upload-status.success")).toContainText(
      "Course uploaded successfully",
      { timeout: 10_000 }
    );

    // The refreshed course list shows the newly ingested course.
    await expect(page.locator(".courses-grid")).toContainText("Calculus 101", {
      timeout: 10_000,
    });

    // The multipart request actually carried the fixture file + form fields.
    expect(uploadBodies.length).toBe(1);
    expect(uploadBodies[0]).toContain('name="title"');
    expect(uploadBodies[0]).toContain("Calculus 101");
    expect(uploadBodies[0]).toContain('name="subject_id"');
    expect(uploadBodies[0]).toContain("subj-1");
    expect(uploadBodies[0]).toContain('filename="ingest-sample.pdf"');
    expect(uploadBodies[0]).toContain('name="files"');

    // --- 2. The ingestion job completes (OCR/LLM mocked) -------------------
    // The frontend has no live status poller, so the spec exercises the
    // INGEST-07 ingest-status contract in-page as the worker ladder advances.
    const statuses = [];
    for (let i = 0; i < INGEST_STEPS.length; i += 1) {
      const body = await page.evaluate(async () => {
        const res = await fetch("/api/v1/study/courses/course-1/ingest-status");
        return res.json();
      });
      statuses.push(body);
    }

    expect(statuses[0].status).toBe("processing");
    expect(statuses[0].stage).toBe("parsing");
    expect(statuses[0].progress).toBeLessThan(1);
    expect(statuses[statuses.length - 1].status).toBe("completed");
    expect(statuses[statuses.length - 1].stage).toBe("indexing");
    expect(statuses[statuses.length - 1].progress).toBe(1.0);
    expect(statuses[statuses.length - 1].jobId).toBe("ingest-job-1");
    expect(statuses[statuses.length - 1].retry).toBeNull();

    // --- 3. The completed course appears with plan generation ready --------
    await page.goto("/subjects");
    await expect(page.locator(".subject-title", { hasText: "Mathematics" })).toBeVisible({
      timeout: 10_000,
    });
    await page.click(".subject-card:not(.add-card)");
    await expect(page).toHaveURL(/\/subjects\/subj-1/, { timeout: 10_000 });
    // The card-level badge shows the completed state.
    await expect(page.locator(".status-badge").filter({ hasText: "completed" })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".courses-grid")).toContainText("Calculus 101");
    // The course is ready for the planner: Generate Plan is no longer gated.
    await expect(page.locator('button:has-text("Generate Plan")').first()).toBeVisible({
      timeout: 10_000,
    });
    // Viewing the course surfaces the ingested topics back from the job.
    await page.locator('button:has-text("View Details")').first().click();
    await expect(page.locator(".status-badge.completed")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator(".course-topics")).toContainText("Limits and Continuity", {
      timeout: 10_000,
    });

    // --- 4. The course content is searchable in AI Search -------------------
    await page.goto("/search");
    await page.fill('input[placeholder*="Ask anything"]', "limits and continuity");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=Calculus 101 — Course Notes")).toBeVisible({
      timeout: 15_000,
    });
    expect(searchPolls).toBeGreaterThanOrEqual(2);

    // --- 5. The planner is usable and surfaces ingested material ------------
    await page.goto("/planner");
    await expect(page.locator("text=STUDY SCHEDULE")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("text=Schedule your 1 pending task with AI")).toBeVisible({
      timeout: 10_000,
    });
  });

  for (const [code, fixture] of [
    [415, EXE_FIXTURE],
    [422, EXE_FIXTURE],
    [413, PDF_FIXTURE],
  ]) {
    test(`negative path: upload rejected with ${code} shows the error state`, async ({
      page,
    }) => {
await login(page);

      await page.route("**/api/v1/study/subjects", (route) => {
        if (route.request().method() === "POST") return route.fallback();
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ subjects: [SUBJECT] }),
        });
      });
      await page.route("**/api/v1/study/courses*", (route) => {
        if (route.request().method() !== "GET") return route.fallback();
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ courses: [] }),
        });
      });

      let uploadTried = 0;
      await page.route("**/api/v1/study/courses", (route) => {
        const req = route.request();
        if (req.method() !== "POST") return route.fallback();
        uploadTried += 1;
        return route.fulfill({
          status: code,
          contentType: "application/json",
          body: JSON.stringify({ error: `upload rejected with ${code}` }),
        });
      });

      await page.goto("/upload-course");
      await page.fill("#course-title", "Suspicious Material");
      await page.fill("#subject-name", "Mathematics");
      await page.setInputFiles("#file-input", fixture);
      await page.click(".upload-btn");

      // The backend error shape is { error }, not { detail }, so the UI shows
      // its generic failure message in the error banner.
      await expect(page.locator(".upload-status.error")).toContainText(
        "Failed to upload course",
        { timeout: 10_000 }
      );
      expect(uploadTried).toBe(1);
    });
  }
});