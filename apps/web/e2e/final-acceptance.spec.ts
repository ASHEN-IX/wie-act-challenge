import { test, expect } from "@playwright/test";
import { MongoClient, ObjectId } from "mongodb";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
const evidence = path.resolve("../../reports/evidence/batch2-final");
async function login(page: any, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("FinalPass!123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
test("real reference upload, Python ingestion/index, SDK replay, instructor publication and enrolled student reader", async ({
  page,
  browser,
}) => {
  await fs.mkdir(evidence, { recursive: true });
  const client = new MongoClient(
    "mongodb://127.0.0.1:27017/" + process.env.FINAL_QA_DB,
  );
  await client.connect();
  const db = client.db();
  try {
    await login(page, "final-instructor@example.test");
    // Internal AI routes require a service credential, not a browser session.
    const denied = await page.request.post(
      "http://127.0.0.1:5362/api/ai/sources/recognition-preflight",
      { data: { model: "gemini/gemini-2.5-flash", keySha256: "a".repeat(64) } },
    );
    expect(denied.status()).toBe(401);
    const bytes = await fs.readFile(
      path.resolve(
        "../ai/agents/course_ingestion/extraction/benchmarks/reference-course.pdf",
      ),
    );
    const upload = await page.request.post("/api/v1/study/courses", {
      multipart: {
        title: "Reference QA mathematics",
        subject_id: "bbbbbbbbbbbbbbbbbbbbbbbb",
        scope: "institutional",
        institutionId: "eeeeeeeeeeeeeeeeeeeeeeee",
        files: {
          name: "reference-course.pdf",
          mimeType: "application/pdf",
          buffer: bytes,
        },
      },
    });
    expect(upload.status(), await upload.text()).toBe(202);
    const { courseId } = await upload.json();
    await expect
      .poll(
        async () => {
          return (
            await db
              .collection("courses")
              .findOne({ _id: new ObjectId(courseId) })
          )?.status;
        },
        { timeout: 180000, intervals: [1000, 3000] },
      )
      .toBe("completed");
    const draft: any = await db
      .collection("course_revisions")
      .findOne({ courseId: new ObjectId(courseId), status: "draft" });
    const chapters = draft.contentDocument.chapters;
    expect(chapters).toHaveLength(2);
    expect(chapters.flatMap((c: any) => c.lessons)).toHaveLength(16);
    expect(
      chapters
        .flatMap((c: any) => c.lessons)
        .some((l: any) => l.title.includes("f′ = f")),
    ).toBe(false);
    expect(
      "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex"),
    ).toBe(draft.sourceManifest[0].contentHash);
    await db
      .collection("course_enrollments")
      .insertOne({
        courseId: new ObjectId(courseId),
        institutionId: new ObjectId("eeeeeeeeeeeeeeeeeeeeeeee"),
        userId: "cccccccccccccccccccccccc",
        status: "active",
        enrolledAt: new Date(),
      });
    await page.goto(`/courses/${courseId}/studio`);
    const workspace = page.getByRole("region", { name: "Formula review" });
    await expect(
      workspace.getByLabel("Mathematical source region"),
    ).toBeVisible({ timeout: 30000 });
    const selected = [
      "region_1e2aeb86289d9d44e7c0",
      "region_aec9301c4a673be7a909",
      "region_43d9fa3583e1890b41fa",
    ].map(
      (raw) =>
        "region_" +
        crypto
          .createHash("sha256")
          .update(draft.sourceManifest[0].documentId + "\x1f" + raw)
          .digest("hex")
          .slice(0, 20),
    );
    for (let i = 0; i < 3; i++) {
      const select = workspace.getByLabel("Mathematical source region");
      const value = await select
        .locator("option")
        .evaluateAll(
          (nodes, region) =>
            nodes
              .map((n) => ({ v: (n as HTMLOptionElement).value }))
              .find((n) => n.v.includes(region))?.v,
          selected[i],
        );
      expect(value).toBeTruthy();
      await select.selectOption(value!);
      if (i === 0) {
        await workspace
          .getByRole("button", { name: "Authorize this document for Gemini" })
          .click();
        await expect(workspace.getByRole("status").first()).toContainText(
          "consent recorded",
        );
      }
      await workspace
        .getByRole("button", {
          name: "Request Gemini recognition",
          exact: true,
        })
        .click();
      await expect(
        workspace.getByRole("button", { name: "Accept proposal" }),
      ).toBeVisible({ timeout: 45000 });
      if (i === 0) {
        await workspace
          .getByLabel("Corrected LaTeX")
          .fill("S_n = \\sum_{p=0}^{n} u_p");
        await workspace
          .getByRole("button", { name: "Save correction" })
          .click();
      } else
        await workspace
          .getByRole("button", {
            name: i === 1 ? "Accept proposal" : "Reject proposal",
          })
          .click();
      await expect(
        workspace.getByText("This decision is final for this proposal."),
      ).toBeVisible();
    }
    const jobs = await db
      .collection("formularecognitionjobs")
      .find({ courseId })
      .toArray();
    expect(jobs).toHaveLength(3);
    expect(jobs.every((j) => j.state === "completed")).toBe(true);
    expect(await db.collection("formula_dispatches").countDocuments()).toBe(3);
    expect(
      (
        await db
          .collection("llm_approval_budgets")
          .findOne({ _id: process.env.FINAL_QA_DB as any })
      )?.used,
    ).toBe(3);
    // Acknowledge source extraction quality through the existing Studio policy.
    await page.getByText("Source tools and audit", { exact: true }).click();
    const acknowledgement = page.getByRole("checkbox", {
      name: /reviewed.*flagged|acknowledge|inspected/i,
    });
    await expect(acknowledgement).toBeVisible();
    await acknowledgement.check();
    await expect(acknowledgement).toBeChecked();
    await page
      .getByRole("button", { name: "Review & Publish", exact: true })
      .click();
    const published = page.getByRole("link", {
      name: "Open committed immutable revision",
    });
    await expect(published).toBeVisible({ timeout: 90000 });
    const href = (await published.getAttribute("href"))!;
    const revision: any = await db
      .collection("course_revisions")
      .findOne({ courseId: new ObjectId(courseId), status: "published" });
    expect(revision.revisionTag).toContain("rev_formula_");
    const student = await browser.newContext();
    const studentPage = await student.newPage();
    await login(studentPage, "final-student@example.test");
    await studentPage.goto(href);
    // The earlier clipped summand must be visible through the authorized
    // published-reader context crop, while the region identity stays stable.
    const eq001 = "region_" + crypto.createHash("sha256")
      .update(draft.sourceManifest[0].documentId + "\x1f" + "region_66ae1f964f8407b30376")
      .digest("hex").slice(0, 20);
    const expandedCrop = await studentPage.request.get(
      `/api/v1/study/courses/${courseId}/revisions/${revision.revisionTag}/sources/${draft.sourceManifest[0].documentId}/regions/${eq001}`,
    );
    expect(expandedCrop.status()).toBe(200);
    const expandedBytes = await expandedCrop.body();
    expect(expandedBytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(expandedBytes.readUInt32BE(16)).toBeGreaterThanOrEqual(210);
    await expect(
      studentPage.locator('[data-block-type="math"] .katex'),
    ).toHaveCount(2);
    await studentPage.locator('[data-block-type="math"] .katex').first().scrollIntoViewIfNeeded();
    await studentPage.screenshot({path:path.join(evidence,'student-reviewed-formula.png')});
    await expect(
      studentPage
        .getByText("Automatic transcription is unverified.", { exact: false })
        .first(),
    ).toBeVisible();
    const fallback = studentPage
      .locator('[data-block-type="math"]')
      .filter({ hasText: "Automatic transcription is unverified." })
      .first();
    await fallback.scrollIntoViewIfNeeded();
    const image = fallback.locator("img");
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    // Check the specifically rejected region, not merely an arbitrary fallback.
    const rejected = studentPage.locator(`img[src*="${selected[2]}"]`);
    await expect(rejected).toHaveCount(1);
    await rejected.scrollIntoViewIfNeeded();
    await expect.poll(() => rejected.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    expect(await image.getAttribute("src")).not.toContain(selected[2]);
    await fallback
      .getByRole("button", { name: "Inspect formula source" })
      .click();
    const dialog = studentPage.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Source reference" }),
    ).toBeVisible();
    await expect
      .poll(() =>
        dialog
          .locator("img")
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0);
    const originalHref = (await dialog
      .getByRole("link", { name: "Open original" })
      .getAttribute("href"))!;
    const original = await studentPage.request.get(originalHref);
    expect(original.status()).toBe(200);
    expect(Buffer.compare(await original.body(), bytes)).toBe(0);
    await studentPage.screenshot({
      path: path.join(evidence, "student-source.png"),
    });
    await dialog.getByRole("button", { name: "Back to reading" }).click();
    await studentPage.evaluate(() => scrollTo(0, 0));
    await studentPage.screenshot({
      path: path.join(evidence, "student-desktop.png"),
    });
    await studentPage.setViewportSize({ width: 390, height: 844 });
    await studentPage
      .getByRole("button", { name: "Outline", exact: false })
      .click();
    await expect(
      studentPage.getByRole("navigation", { name: "Mobile course outline" }),
    ).toBeVisible();
    await studentPage.screenshot({
      path: path.join(evidence, "student-mobile.png"),
    });
    await studentPage.getByRole("button", { name: "Close outline" }).click();
    await studentPage.setViewportSize({ width: 1280, height: 900 });
    // Milestone 3.1: the same published revision through the versioned
    // presentation contract, with unreviewed formulas staying source-faithful.
    await studentPage.goto(
      `/courses/${courseId}/present?revisionId=${encodeURIComponent(revision.revisionTag)}`,
    );
    const presentation = studentPage.locator("[data-presentation-view]");
    await expect(presentation).toBeVisible({ timeout: 30000 });
    await expect(presentation).toHaveAttribute(
      "data-presentation-status",
      "partially_reviewed",
    );
    await expect(
      presentation.getByText("not semantically verified", { exact: false }).first(),
    ).toBeVisible();
    await expect(presentation.locator("[data-presentation-lesson]").first()).toBeVisible();
    await expect(
      presentation.locator('[data-presentation-policy="source_faithful"]').first(),
    ).toBeVisible();
    await expect(presentation.locator('[data-block-type="math"] .katex')).toHaveCount(2, {
      timeout: 30000,
    });
    const presentationFallback = presentation.getByRole("link", {
      name: "Deterministic source-faithful reader",
    });
    await expect(presentationFallback).toHaveAttribute(
      "href",
      `/courses/${courseId}/learn?revisionId=${revision.revisionTag}`,
    );
    await presentation
      .getByText("Automatic transcription is unverified.", { exact: false })
      .first()
      .scrollIntoViewIfNeeded();
    await studentPage.screenshot({
      path: path.join(evidence, "student-presentation.png"),
    });
    const presentationApi = await studentPage.request.get(
      `/api/v1/study/learning/courses/${courseId}/presentation?revisionId=${encodeURIComponent(revision.revisionTag)}`,
    );
    expect(presentationApi.status()).toBe(200);
    const presentationBody: any = await presentationApi.json();
    expect(presentationBody.schemaVersion).toBe("1.0.0");
    expect(presentationBody.verification.status).toBe("partially_reviewed");
    expect(presentationBody.verification.math.reviewed).toBe(2);
    expect(presentationBody.verification.math.sourceFallback).toBeGreaterThan(0);

    const outsider = await browser.newContext();
    const outsiderPage = await outsider.newPage();
    await login(outsiderPage, "final-outsider@example.test");
    expect((await outsiderPage.request.get(originalHref)).status()).toBe(403);
    await outsider.close();
    const indexed = await db
      .collection("chunk_embeddings")
      .find({ course_id: courseId, revision_id: revision.revisionTag })
      .toArray();
    expect(indexed.length).toBeGreaterThan(0);
    expect(
      indexed.flatMap((c) => c.metas || []).some((m) => m.formula_review),
    ).toBe(true);
    await fs.writeFile(
      path.join(evidence, "application-run.json"),
      JSON.stringify(
        {
          courseId,
          sourceHash: draft.sourceManifest[0].contentHash,
          sourcePages: 20,
          chapters: chapters.map((c: any) => ({
            title: c.title,
            lessons: c.lessons.map((l: any) => ({
              title: l.title,
              source_spans: l.source_spans,
            })),
          })),
          revision: revision.revisionTag,
          jobs: jobs.map((j) => ({ state: j.state, regionId: j.regionId })),
          indexedChunks: indexed.reduce(
            (n, c) => n + (c.chunks?.length || 0),
            0,
          ),
          serviceBoundary:
            "real Node/Python HTTP; only Gemini SDK replay mocked",
          presentation: {
            schemaVersion: presentationBody.schemaVersion,
            status: presentationBody.verification.status,
            math: presentationBody.verification.math,
            fallbackHref: presentationBody.fallback.readerHref,
          },
          independentMathApproval: false,
        },
        null,
        2,
      ),
    );
    await student.close();
  } finally {
    await client.close();
  }
});

test("representative networking PDF preserves code, table, caption and diagram through real ingestion and student reader", async ({
  page,
  browser,
}) => {
  const client = new MongoClient(
    "mongodb://127.0.0.1:27017/" + process.env.FINAL_QA_DB,
  );
  await client.connect();
  const db = client.db();
  try {
    await login(page, "final-instructor@example.test");
    const bytes = await fs.readFile(
      path.resolve(
        "../ai/agents/course_ingestion/extraction/benchmarks/networking-qa.pdf",
      ),
    );
    const response = await page.request.post("/api/v1/study/courses", {
      multipart: {
        title: "Representative networking QA fixture",
        subject_id: "bbbbbbbbbbbbbbbbbbbbbbbb",
        scope: "institutional",
        institutionId: "eeeeeeeeeeeeeeeeeeeeeeee",
        files: {
          name: "networking-qa.pdf",
          mimeType: "application/pdf",
          buffer: bytes,
        },
      },
    });
    expect(response.status(), await response.text()).toBe(202);
    const { courseId } = await response.json();
    await expect
      .poll(
        async () =>
          (
            await db
              .collection("courses")
              .findOne({ _id: new ObjectId(courseId) })
          )?.status,
        { timeout: 180000, intervals: [1000, 3000] },
      )
      .toBe("completed");
    const draft: any = await db
      .collection("course_revisions")
      .findOne({ courseId: new ObjectId(courseId), status: "draft" });
    const lessons = draft.contentDocument.chapters.flatMap(
      (c: any) => c.lessons,
    );
    expect(lessons.map((l: any) => l.title)).toEqual([
      "1 Networking: reliable delivery",
      "2 Failure handling",
    ]);
    const blocks = lessons.flatMap((l: any) => l.blocks);
    expect(blocks.find((b: any) => b.type === "code")?.code).toContain(
      "\n    if sequence < 0:\n        return None",
    );
    expect(blocks.find((b: any) => b.type === "table")?.rows).toEqual([
      ["SYN", "Open"],
      ["ACK", "Confirm"],
    ]);
    expect(blocks.filter((b: any) => b.type === "media")).toHaveLength(1);
    expect(blocks.findIndex((b: any) => b.type === "media")).toBeGreaterThan(
      blocks.findIndex((b: any) => b.type === "table"),
    );
    await db
      .collection("course_enrollments")
      .insertOne({
        courseId: new ObjectId(courseId),
        institutionId: new ObjectId("eeeeeeeeeeeeeeeeeeeeeeee"),
        userId: "cccccccccccccccccccccccc",
        status: "active",
        enrolledAt: new Date(),
      });
    // Exercise the same authenticated approval/prepare/publication endpoints used by Studio.
    const approve = await page.request.post(
      `/api/v1/study/courses/${courseId}/drafts/${draft.revisionTag}/approve`,
      { data: { draftVersion: draft.__v, extractionReviewAcknowledged: true } },
    );
    expect(approve.status(), await approve.text()).toBe(200);
    const prepare = await page.request.post(
      `/api/v1/study/courses/${courseId}/draft/sources/prepare`,
      { data: { expectedRevisionTag: draft.revisionTag } },
    );
    expect(prepare.status(), await prepare.text()).toBe(200);
    const publication = await page.request.post(
      `/api/v1/study/courses/${courseId}/publish`,
      { data: { expectedRevisionTag: draft.revisionTag } },
    );
    expect(publication.status(), await publication.text()).toBe(200);
    const published = await publication.json();
    const ctx = await browser.newContext();
    const student = await ctx.newPage();
    await login(student, "final-student@example.test");
    await student.goto(
      `/courses/${courseId}/learn?revisionId=${published.publishedRevisionTag}`,
    );
    await expect(
      student.locator('[data-block-type="code"]:visible'),
    ).toHaveCount(1);
    await expect(
      student.locator('[data-block-type="code"]:visible'),
    ).toContainText("def acknowledge");
    expect(
      await student.locator('[data-block-type="code"]:visible').textContent(),
    ).toContain("\n    if sequence < 0:");
    await expect(
      student.getByRole("cell", { name: "SYN", exact: true }),
    ).toBeVisible();
    const diagram = student.locator('[data-block-type="media"] img');
    await diagram.scrollIntoViewIfNeeded();
    await expect
      .poll(() => diagram.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    await expect(
      student.getByText("Source text integrity has not been verified.", {
        exact: false,
      }),
    ).toHaveCount(0);
    await expect(
      student.getByText("verified passages", { exact: false }),
    ).toHaveCount(0);
    await student.screenshot({
      path: path.join(evidence, "networking-reader.png"),
      fullPage: true,
    });
    await fs.writeFile(
      path.join(evidence, "networking-run.json"),
      JSON.stringify(
        {
          courseId,
          sourceHash: draft.sourceManifest[0].contentHash,
          revision: published.publishedRevisionTag,
          blockTypes: blocks.map((b: any) => b.type),
          lessonTitles: lessons.map((l: any) => l.title),
          fixture: "authored representative; not independent corpus",
        },
        null,
        2,
      ),
    );
    await ctx.close();
  } finally {
    await client.close();
  }
});
