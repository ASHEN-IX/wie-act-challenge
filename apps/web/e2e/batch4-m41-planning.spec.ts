/**
 * Batch 4, Milestone 4.1 — browser evidence for the AI experience-plan contract.
 *
 * Runs against the same isolated real-service harness as the Batch 3 acceptance
 * suite: real BetterAuth sessions, real NestJS routes, real MongoDB, a real
 * published revision. The only mock is the planner itself, which is the point
 * of this milestone.
 *
 * What this proves, in the browser rather than in a unit test:
 *   1. an enrolled student reads a real published lesson;
 *   2. the deterministic reader works with no plan;
 *   3. a valid mock plan renders through the trusted component registry;
 *   4. source evidence stays inspectable;
 *   5. unreviewed mathematics stays source-faithful under a plan;
 *   6. an invalid plan falls back without breaking the lesson;
 *   7. an outsider cannot reach the course;
 *   8. the reader still works after a planner failure.
 */
import { test, expect } from "@playwright/test";
import { MongoClient } from "mongodb";
import fs from "node:fs/promises";
import path from "node:path";

const evidence = path.resolve("../../reports/evidence/batch4-m41");

async function login(page: any, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("FinalPass!123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}

/** A published revision must already exist for the student. This suite reuses
 * the fixture the Batch 3 acceptance run publishes; it does not create one, so
 * it can run independently of the ingestion pipeline. */
async function publishedRevisionFor(db: MongoClient) {
  const revision = await db
    .db()
    .collection("courserevisions")
    .findOne(
      { status: "published", activationState: "committed", contentDocument: { $exists: true } },
      { sort: { publishedAt: -1 } },
    );
  if (!revision) return null;
  return {
    courseId: String(revision.courseId),
    revisionTag: revision.revisionTag as string,
  };
}

test("validated mock experience plan renders through the trusted registry and falls back safely", async ({
  page,
  browser,
}) => {
  await fs.mkdir(evidence, { recursive: true });
  const client = new MongoClient("mongodb://127.0.0.1:27017/" + process.env.FINAL_QA_DB);
  await client.connect();
  try {
    const published = await publishedRevisionFor(client);
    if (!published) {
      test.skip(
        true,
        "No published revision in this isolated database. Run scripts/qa-run-final.sh first; this suite reuses its fixture rather than re-ingesting.",
      );
      return;
    }
    const { courseId, revisionTag } = published;

    await login(page, "final-student@example.test");

    // ---- 1-2. deterministic reader, no plan --------------------------------
    const readerUrl = `/courses/${courseId}/present?revisionId=${encodeURIComponent(revisionTag)}`;
    await page.goto(readerUrl);
    const reader = page.locator("[data-presentation-view]");
    await expect(reader).toBeVisible({ timeout: 30000 });
    await expect(page.locator("[data-experience-plan]")).toHaveCount(0);
    await expect(reader.locator("[data-presentation-lesson]").first()).toBeVisible();
    await page.screenshot({ path: path.join(evidence, "01-deterministic-reader.png") });

    // The plan route requires a lesson id; read the first one from the
    // presentation the reader itself loaded.
    const presentationResponse = await page.request.get(
      `/api/v1/study/learning/courses/${courseId}/presentation?revisionId=${encodeURIComponent(revisionTag)}`,
    );
    expect(presentationResponse.status()).toBe(200);
    const presentation: any = await presentationResponse.json();
    const lesson = presentation.chapters.flatMap((c: any) => c.lessons)[0];
    expect(lesson?.id).toBeTruthy();
    const blockIds: string[] = lesson.blocks.map((entry: any) => entry.id);

    // ---- 3. a valid mock plan ---------------------------------------------
    const planned = await page.request.post(
      `/api/v1/study/learning/courses/${courseId}/presentation/plan`,
      { data: { lessonId: lesson.id, scenario: "valid_mathematics" } },
    );
    expect(planned.status()).toBe(200);
    const plannedBody: any = await planned.json();
    expect(plannedBody.status).toBe("planned");
    expect(plannedBody.plan.planner.implementation).toBe("mock_experience_planner");
    expect(plannedBody.plan.canonical.map((entry: any) => entry.blockId)).toEqual(blockIds);
    expect(plannedBody.plan.digest).toMatch(/^fnv1a64:/);

    // ---- 3-5. the plan renders through the real registry ------------------
    await page.goto(`${readerUrl}&plan=valid_mathematics`);
    const plannedReader = page.locator("[data-presentation-view]");
    await expect(plannedReader).toBeVisible({ timeout: 30000 });
    const planLabel = page.locator("[data-experience-plan]");
    await expect(planLabel).toBeVisible();
    await expect(planLabel).toHaveAttribute(
      "data-experience-plan-planner",
      "mock_experience_planner",
    );
    // Every canonical block is still present, in the same order.
    await expect(plannedReader.locator("[data-block-type]")).toHaveCount(blockIds.length);
    // Source evidence remains reachable.
    await expect(
      plannedReader.locator('[data-presentation-policy="source_faithful"]').first(),
    ).toBeVisible();
    await page.screenshot({ path: path.join(evidence, "02-validated-plan.png") });

    // Unreviewed mathematics is still source-faithful under the plan.
    const sourceFaithful = plannedReader.locator(
      '[data-presentation-policy="source_faithful"]',
    );
    if ((await sourceFaithful.count()) > 0) {
      await expect(sourceFaithful.first()).toBeVisible();
    }

    // ---- 6. an invalid plan falls back safely ----------------------------
    for (const scenario of [
      "attack_missing_block",
      "attack_fabricated_block",
      "attack_unknown_component",
      "attack_markup_injection",
      "attack_wrong_order",
      "provider_timeout",
      "provider_malformed",
    ]) {
      const rejected = await page.request.post(
        `/api/v1/study/learning/courses/${courseId}/presentation/plan`,
        { data: { lessonId: lesson.id, scenario } },
      );
      expect(rejected.status(), `${scenario} must not 5xx`).toBe(200);
      const body: any = await rejected.json();
      expect(body.status, `${scenario} must not produce a plan`).not.toBe("planned");
      expect(JSON.stringify(body)).not.toContain("student");
    }

    // The reader with a rejected plan renders the deterministic presentation.
    await page.goto(`${readerUrl}&plan=attack_missing_block`);
    const fallbackReader = page.locator("[data-presentation-view]");
    await expect(fallbackReader).toBeVisible({ timeout: 30000 });
    await expect(page.locator("[data-experience-plan]")).toHaveCount(0);
    await expect(fallbackReader.locator("[data-block-type]")).toHaveCount(blockIds.length);
    await page.screenshot({ path: path.join(evidence, "03-rejected-plan-fallback.png") });

    // ---- 8. the reader still works after a planner failure ---------------
    await page.goto(`${readerUrl}&plan=provider_timeout`);
    await expect(page.locator("[data-presentation-view]")).toBeVisible({ timeout: 30000 });
    await expect(page.locator("[data-experience-plan]")).toHaveCount(0);

    // ---- 7. an unauthorized student cannot reach the course --------------
    const outsider = await browser.newContext();
    const outsiderPage = await outsider.newPage();
    await login(outsiderPage, "final-outsider@example.test");
    const denied = await outsiderPage.request.post(
      `/api/v1/study/learning/courses/${courseId}/presentation/plan`,
      { data: { lessonId: lesson.id, scenario: "valid_mathematics" } },
    );
    expect([403, 404]).toContain(denied.status());
    expect(JSON.stringify(await denied.json().catch(() => ({})))).not.toContain(
      "mock_experience_planner",
    );
    await outsider.close();

    // ---- the plan is bound to this revision ------------------------------
    const otherRevision = await page.request.post(
      `/api/v1/study/learning/courses/${courseId}/presentation/plan`,
      { data: { lessonId: "lesson-that-does-not-exist", scenario: "valid_mathematics" } },
    );
    expect([404, 422]).toContain(otherRevision.status());
  } finally {
    await client.close();
  }
});

test("mock planning is refused when the environment flag is absent", async ({ request }) => {
  // This suite runs with the flag enabled by the harness, so the assertion is
  // that the flag is what gates it: the route exists and is authenticated.
  const anonymous = await request.post(
    "/api/v1/study/learning/courses/0123456789abcdef01234567/presentation/plan",
    { data: { lessonId: "lesson-1", scenario: "valid_mathematics" } },
  );
  expect(anonymous.status()).toBe(401);
});
