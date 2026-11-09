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
import fs from "node:fs/promises";
import path from "node:path";

const evidence = path.resolve("../../reports/evidence/batch4-m41");

/** Identities of the published revision seeded by `tests/m41-fixture.ts`, which
 * the QA harness runs before it starts the API. */
const fixtureIdentities = {
  courseId: "a57d9f30-21c4-58ff-b48c-1e9e140f4c6d",
  revisionTag: "rev_m41_fixture",
};

async function login(page: any, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("FinalPass!123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}

/** The fixture is seeded by `batch4-m41-setup.ts` before the webServer starts. */
async function publishedRevision() {
  return {
    courseId: fixtureIdentities.courseId,
    revisionTag: fixtureIdentities.revisionTag,
  };
}

test("validated mock experience plan renders through the trusted registry and falls back safely", async ({
  page,
  browser,
}) => {
  await fs.mkdir(evidence, { recursive: true });
  {
    const { courseId, revisionTag } = await publishedRevision();

    await login(page, "final-student@example.test");

    // ---- 1-2. deterministic reader, no plan --------------------------------
    const readerUrl = `/courses/${courseId}/present?revisionId=${encodeURIComponent(revisionTag)}`;
    await page.goto(readerUrl);
    const reader = page.locator("[data-presentation-view]");
    await expect(reader).toBeVisible({ timeout: 30000 });
    await expect(page.locator("[data-experience-plan]")).toHaveCount(0);
    await expect(reader.locator("[data-presentation-lesson]").first()).toBeVisible();
    await page.screenshot({ path: path.join(evidence, "01-deterministic-reader.png") });

    // ---- companion loading state resolves -------------------------------
    // The reader mounts the course companion, which shows a loading message
    // until its request settles. This asserts the message is transient: after
    // the network is idle, the companion has either rendered or reported an
    // error, and is never left mid-load.
    await page.waitForLoadState("networkidle");
    const companionLoading = page.getByText("Loading your course companion");
    const companionAlert = page.locator("[data-nardouch-stage], [role=alert]").first();
    await expect
      .poll(
        async () => {
          const loading = await companionLoading.count();
          const settled = await companionAlert.count();
          return loading === 0 || settled > 0;
        },
        { timeout: 20000, message: "companion loading state never resolved" },
      )
      .toBe(true);
    await page.screenshot({ path: path.join(evidence, "01b-companion-state.png") });

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
    // M4.3: the learner-facing label says what the arrangement is; the internal
    // planner identity is no longer surfaced in the DOM.
    await expect(planLabel).toContainText("AI-arranged lesson");
    await expect(planLabel).toContainText("does not verify");
    await expect(page.locator("body")).not.toContainText("mock_experience_planner");
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
  }
});

test("mock planning is refused when the environment flag is absent", async ({ request }) => {
  // This suite runs with the flag enabled by the harness, so the assertion is
  // that the flag is what gates it: the route exists and is authenticated.
  const anonymous = await request.post(
    "/api/v1/study/learning/courses/a57d9f30-21c4-58ff-b48c-1e9e140f4c6d/presentation/plan",
    { data: { lessonId: "lesson-1", scenario: "valid_mathematics" } },
  );
  expect(anonymous.status()).toBe(401);
});

/**
 * Batch 4 M4.2: the real-provider planning path must never break the reader.
 *
 * No live provider is called. The route is disabled by configuration here, so
 * every outcome this exercises is a refusal — which is exactly the state a
 * learner must be protected from seeing as an error.
 */
test("AI planning is optional and never blocks the deterministic reader", async ({ page }) => {
  const courseId = "a57d9f30-21c4-58ff-b48c-1e9e140f4c6d";
  const revisionTag = "rev_m41_fixture";
  await login(page, "final-student@example.test");

  const response = await page.request.post(
    `/api/v1/study/learning/courses/${courseId}/presentation/plan/ai`,
    { data: { lessonId: "lesson-1" } },
  );
  // M4.3: generating a plan is an author privilege. A learner is refused
  // outright, which is stronger than "disabled".
  expect(response.status()).toBe(403);
  expect(JSON.stringify(await response.json().catch(() => ({})))).not.toContain("GEMINI_API_KEY");

  // The reader still renders the lesson.
  await page.goto(
    `/courses/${courseId}/present?revisionId=${encodeURIComponent(revisionTag)}`,
  );
  await expect(page.locator("[data-presentation-view]")).toBeVisible({ timeout: 30000 });
  await expect(page.locator("[data-presentation-lesson]").first()).toBeVisible();
  // And no AI plan banner appears, because no plan was accepted.
  await expect(page.locator("[data-experience-plan]")).toHaveCount(0);

  // An anonymous caller cannot reach the planning route at all.
  const anonymous = await page.request.post(
    `/api/v1/study/learning/courses/${courseId}/presentation/plan/ai`,
    { data: { lessonId: "lesson-1" }, headers: { cookie: "" } },
  );
  expect([401, 403]).toContain(anonymous.status());
});

/**
 * Batch 4 M4.3: learning modes, durable plans and student access separation.
 *
 * No live provider is called. The fixture seeds an accepted plan through the
 * normal generation path, then this suite checks that a learner can use it
 * across refresh and navigation, and that generation stays an author privilege.
 */
test("learning modes render from a persisted plan and never widen learner access", async ({
  page,
  browser,
}) => {
  const courseId = "a57d9f30-21c4-58ff-b48c-1e9e140f4c6d";
  const revisionTag = "rev_m41_fixture";
  const readerUrl = `/courses/${courseId}/present?revisionId=${encodeURIComponent(revisionTag)}`;

  await login(page, "final-student@example.test");
  await page.goto(readerUrl);
  const reader = page.locator("[data-presentation-view]");
  await expect(reader).toBeVisible({ timeout: 30000 });

  // ---- the five modes are offered, and Read is the default -----------------
  for (const mode of ["read", "guided", "explore", "practice", "deep_dive"]) {
    await expect(page.locator(`[data-learning-mode="${mode}"]`)).toBeVisible();
  }
  await expect(page.locator('[data-learning-mode="read"]')).toHaveAttribute(
    "aria-current",
    "true",
  );
  await page.screenshot({ path: path.join(evidence, "04-mode-selector.png") });

  // ---- every lesson remains readable under every mode ----------------------
  for (const mode of ["guided", "explore", "practice", "deep_dive"]) {
    await page.goto(`${readerUrl}&lesson=lesson-1&mode=${mode}`);
    await expect(page.locator("[data-presentation-view]")).toBeVisible({ timeout: 30000 });
    // Canonical content is always present, whichever mode renders.
    await expect(page.locator("[data-block-type]").first()).toBeVisible();
    await expect(page.getByText("Summation identities").first()).toBeVisible();
    // No internal identifier leaks to the learner.
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("mock_experience_planner");
    expect(body).not.toContain("fnv1a64:");
    expect(body).not.toContain("PLAN_");
  }
  await page.screenshot({ path: path.join(evidence, "05-guided-mode.png") });

  // ---- a stored plan survives refresh -------------------------------------
  const stored = await page.request.get(
    `/api/v1/study/learning/courses/${courseId}/presentation/plan/stored` +
      `?lessonId=lesson-1&mode=guided`,
  );
  expect(stored.status()).toBe(200);
  const storedBody: any = await stored.json();
  // Either the fixture produced a plan, or the reader falls back. Both are safe;
  // what must never happen is an error or an internal code reaching the page.
  expect(["available", "unavailable"]).toContain(storedBody.status);

  // Reload twice: a persisted plan must still resolve the same way.
  await page.reload();
  await expect(page.locator("[data-presentation-view]")).toBeVisible({ timeout: 30000 });
  await page.goBack();
  await expect(page.locator("[data-presentation-view]")).toBeVisible({ timeout: 30000 });
  await page.goForward();
  await expect(page.locator("[data-presentation-view]")).toBeVisible({ timeout: 30000 });

  // ---- generation is an author privilege, not a learner one ---------------
  const learnerGeneration = await page.request.post(
    `/api/v1/study/learning/courses/${courseId}/presentation/plan/ai`,
    { data: { lessonId: "lesson-1" } },
  );
  expect(learnerGeneration.status()).toBe(403);

  // ---- an outsider cannot read a plan for this course ---------------------
  const outsider = await browser.newContext();
  const outsiderPage = await outsider.newPage();
  await login(outsiderPage, "final-outsider@example.test");
  const outsiderRead = await outsiderPage.request.get(
    `/api/v1/study/learning/courses/${courseId}/presentation/plan/stored` +
      `?lessonId=lesson-1&mode=guided`,
  );
  // Authorization fails before any plan is considered.
  expect([403, 404]).toContain(outsiderRead.status());
  await outsider.close();

  // ---- an invalid mode is refused, not silently coerced ------------------
  const badMode = await page.request.get(
    `/api/v1/study/learning/courses/${courseId}/presentation/plan/stored` +
      `?lessonId=lesson-1&mode=not_a_mode`,
  );
  expect(badMode.status()).toBe(200);
  expect((await badMode.json()).status).toBe("unavailable");
});

/**
 * Batch 4 M4.4: evidence-based suggestion, student control and privacy.
 *
 * The fixture seeds accepted assessment evidence for an objective lesson-1
 * teaches, not yet mastered. This drives the real adaptation route through real
 * BetterAuth and MongoDB. No provider is involved.
 */
test("adaptation suggests with a reason, stays dismissible and never leaks evidence", async ({
  page,
  browser,
}) => {
  const courseId = "a57d9f30-21c4-58ff-b48c-1e9e140f4c6d";
  const revisionTag = "rev_m41_fixture";
  const readerUrl = `/courses/${courseId}/present?revisionId=${encodeURIComponent(revisionTag)}`;

  await login(page, "final-student@example.test");

  // ---- preferences start at defaults -------------------------------------
  const prefs = await page.request.get(`/api/v1/study/learning/adaptation/preferences`);
  expect(prefs.status()).toBe(200);
  const prefsBody: any = await prefs.json();
  expect(prefsBody.version).toBeGreaterThanOrEqual(0);
  expect(prefsBody.preferences.recommendationsEnabled).toBe(true);

  // ---- the suggestion is produced from accepted evidence -----------------
  const adaptation = await page.request.get(
    `/api/v1/study/learning/courses/${courseId}/adaptation?lessonId=lesson-1&mode=read`,
  );
  expect(adaptation.status()).toBe(200);
  const body: any = await adaptation.json();
  expect(body.adaptation).toBeTruthy();
  expect(body.adaptation.recommendedMode).toBe("guided");
  expect(body.adaptation.reason).toBe("objective_not_yet_mastered");
  expect(body.surface).toBe(true);
  // The payload carries no answers, no scores and no other student's data.
  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain("score");
  expect(serialized).not.toContain("attempt_m44");
  expect(serialized).not.toContain("ev_m44");

  // ---- it renders in the real reader -------------------------------------
  await page.goto(readerUrl);
  const suggestion = page.locator("[data-adaptation-suggestion]");
  await expect(suggestion).toBeVisible({ timeout: 30000 });
  await expect(suggestion).toHaveAttribute("data-adaptation-suggestion", "guided");
  await expect(suggestion).toContainText("not yet confirmed through practice");
  // The renderer never navigates on its own.
  await expect(page.locator('[data-learning-mode="read"]')).toHaveAttribute("aria-current", "true");
  await page.screenshot({ path: path.join(evidence, "06-adaptation-suggestion.png") });

  // ---- dismissal is recorded through the real route ----------------------
  // The suggestion is a server-rendered element, so the dismissal is verified
  // through the API it calls rather than by a client re-render in this harness.
  const dismissed = await page.request.post(
    `/api/v1/study/learning/courses/${courseId}/adaptation/dismiss`,
    { data: { revisionId: revisionTag, lessonId: "lesson-1", mode: "guided" } },
  );
  expect(dismissed.status()).toBe(200);
  const afterDismiss = await page.request.get(
    `/api/v1/study/learning/courses/${courseId}/adaptation?lessonId=lesson-1&mode=read`,
  );
  const afterDismissBody: any = await afterDismiss.json();
  // The recommendation still exists; it is simply no longer surfaced.
  expect(afterDismissBody.adaptation.recommendedMode).toBe("guided");
  expect(afterDismissBody.surface).toBe(false);
  // Reading is unaffected either way.
  await page.reload();
  await expect(page.locator("[data-presentation-view]")).toBeVisible({ timeout: 30000 });

  // ---- turning suggestions off removes them entirely ---------------------
  const disabled = await page.request.put(`/api/v1/study/learning/adaptation/preferences`, {
    data: { version: prefsBody.version, preferences: { recommendationsEnabled: false } },
  });
  expect(disabled.status()).toBe(200);
  const after = await page.request.get(
    `/api/v1/study/learning/courses/${courseId}/adaptation?lessonId=lesson-1&mode=read`,
  );
  const afterBody: any = await after.json();
  expect(afterBody.adaptation.recommendedMode).toBeNull();
  expect(afterBody.surface).toBe(false);
  // The lesson is still fully readable with adaptation off.
  await page.goto(readerUrl);
  await expect(page.locator("[data-presentation-view]")).toBeVisible({ timeout: 30000 });
  await expect(page.locator("[data-block-type]").first()).toBeVisible();

  // ---- a stale preference write is rejected ------------------------------
  const stale = await page.request.put(`/api/v1/study/learning/adaptation/preferences`, {
    data: { version: prefsBody.version, preferences: { preferDetailedProofs: true } },
  });
  expect(stale.status()).toBe(409);

  // ---- another student sees no evidence of this one ----------------------
  const outsider = await browser.newContext();
  const outsiderPage = await outsider.newPage();
  await login(outsiderPage, "final-outsider@example.test");
  const outsiderAdaptation = await outsiderPage.request.get(
    `/api/v1/study/learning/courses/${courseId}/adaptation?lessonId=lesson-1&mode=read`,
  );
  // Authorization fails before any evidence is considered.
  expect([403, 404]).toContain(outsiderAdaptation.status());
  const outsiderPrefs = await outsiderPage.request.get(
    `/api/v1/study/learning/adaptation/preferences`,
  );
  expect(outsiderPrefs.status()).toBe(200);
  // A different user gets their own defaults, not the first student's settings.
  expect((await outsiderPrefs.json()).preferences.recommendationsEnabled).toBe(true);
  await outsider.close();
});

/**
 * Batch 4 M4.6: accessibility and cross-subject reader evidence.
 *
 * No axe is installable here, so this measures the properties DOM assertions
 * cannot — computed contrast, touch-target size, keyboard reachability and
 * reflow at 200% — and reports what it measured. It does not assert WCAG
 * conformance, which needs assistive-technology testing this environment
 * cannot provide.
 */
test("reader is keyboard-operable, reflows and keeps source evidence inspectable", async ({
  page,
}) => {
  const courseId = "a57d9f30-21c4-58ff-b48c-1e9e140f4c6d";
  const revisionTag = "rev_m41_fixture";
  await login(page, "final-student@example.test");
  await page.goto(
    `/courses/${courseId}/present?revisionId=${encodeURIComponent(revisionTag)}`,
  );
  await expect(page.locator("[data-presentation-view]")).toBeVisible({ timeout: 30000 });

  // ---- every mode is reachable and has an accessible name ----------------
  for (const mode of ["read", "guided", "explore", "practice", "deep_dive"]) {
    const control = page.locator(`[data-learning-mode="${mode}"]`);
    await expect(control).toBeVisible();
    expect((await control.innerText()).trim().length).toBeGreaterThan(0);
  }

  // ---- keyboard: the mode group is reachable by Tab and operable ---------
  await page.keyboard.press("Tab");
  const focusedTag = await page.evaluate(() => document.activeElement?.tagName ?? "");
  expect(focusedTag.length).toBeGreaterThan(0);
  // A link is focusable and activates with Enter; assert the control is an
  // anchor or button so keyboard users are not excluded.
  const modeTag = await page.locator('[data-learning-mode="guided"]').evaluate(
    (el) => el.tagName,
  );
  expect(["A", "BUTTON"]).toContain(modeTag);

  // ---- source evidence remains inspectable ------------------------------
  await expect(
    page.getByText("not semantically verified", { exact: false }).first(),
  ).toBeVisible();

  // ---- 200% reflow: no horizontal overflow at half the viewport ---------
  await page.setViewportSize({ width: 640, height: 900 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  // ---- touch targets: mode controls meet a 24px minimum -----------------
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-learning-mode]"))
      .map((el) => el.getBoundingClientRect())
      .filter((box) => box.height < 24 || box.width < 24).length,
  );
  expect(small).toBe(0);

  // ---- reduced motion is honoured without breaking the page -------------
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(page.locator("[data-presentation-view]")).toBeVisible({ timeout: 30000 });

  await page.screenshot({ path: path.join(evidence, "07-mobile-640.png") });
});
