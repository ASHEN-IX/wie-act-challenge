import { test, expect } from "@playwright/test";
import { MongoClient } from "mongodb";
import crypto from "node:crypto";
import path from "node:path";

test("reviewed formulas publish into an immutable reader snapshot and original source inspector", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("formula@example.test");
  await page.getByLabel("Password", { exact: true }).fill("FormulaPass!123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/courses/bbbbbbbbbbbbbbbbbbbbbbbb/studio");
  await page
    .getByText("Check individual equations (optional)", { exact: true })
    .click();
  const workspace = page.getByRole("region", { name: "Formula review" });
  await expect(
    workspace.getByLabel("Mathematical source region"),
  ).toBeVisible();
  await workspace
    .getByRole("button", { name: "Authorize this document for Gemini" })
    .click();
  await expect(workspace.getByRole("status").first()).toContainText(
    "consent recorded",
  );
  const select = workspace.getByLabel("Mathematical source region");
  const values = await select
    .locator("option")
    .evaluateAll((nodes) => nodes.map((n) => (n as HTMLOptionElement).value));
  for (let i = 0; i < 3; i++) {
    await select.selectOption(values[i]);
    await workspace
      .getByRole("button", { name: "Request Gemini recognition", exact: true })
      .click();
    await expect(
      workspace.getByRole("button", { name: "Accept proposal" }),
    ).toBeVisible({ timeout: 30000 });
    if (i === 0) {
      await workspace
        .getByLabel("Corrected LaTeX")
        .fill("S_n = \\sum_{p=0}^{n} u_p");
      await workspace.getByRole("button", { name: "Save correction" }).click();
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
  await expect(
    workspace.getByLabel("Formula publication readiness"),
  ).toContainText("accepted: 1");
  await page
    .getByRole("button", { name: "Publish course", exact: true })
    .click();
  const link = page.getByRole("link", {
    name: "View published course",
  });
  await expect(link).toBeVisible({ timeout: 30000 });
  const href = await link.getAttribute("href");
  expect(href).toContain("rev_formula_");
  await link.click();
  await expect(page.locator('[data-block-type="math"] .katex')).toHaveCount(2);
  await expect(
    page.getByText(
      "Instructor-approved corrected representation; not independently verified.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Instructor-approved accepted representation; not independently verified.",
    ),
  ).toBeVisible();
  await page
    .locator('[data-block-type="math"]')
    .first()
    .getByRole("button", { name: "Inspect formula source" })
    .click();
  const dialog = page.getByRole("dialog");
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
  const original = await page.request.get(
    (await dialog
      .getByRole("link", { name: "Open original" })
      .getAttribute("href"))!,
  );
  expect(original.status()).toBe(200);
  const bytes = await original.body();
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  await page.screenshot({
    path: path.resolve(
      "../../reports/evidence/reviewed-formula-publication/source-inspector.png",
    ),
    fullPage: false,
  });
  await dialog.getByRole("button", { name: "Back to reading" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.resolve(
      "../../reports/evidence/reviewed-formula-publication/reader-reviewed.png",
    ),
    fullPage: true,
  });
  const client = new MongoClient(
    "mongodb://127.0.0.1:27017/" + process.env.FORMULA_E2E_DB_NAME,
  );
  await client.connect();
  try {
    const db = client.db();
    const revision = await db
      .collection("course_revisions")
      .findOne({ status: "published" });
    expect(revision).toBeTruthy();
    expect(
      "sha256:" + crypto.createHash("sha256").update(bytes).digest("hex"),
    ).toBe(revision!.sourceManifest[0].contentHash);
    const before = JSON.stringify(revision!.contentDocument);
    await db.collection("formulaproposals").updateMany(
      {},
      {
        $set: {
          reviewedLatex: "tampered",
          latex: "tampered",
          state: "rejected",
        },
      },
    );
    await page.reload();
    await expect(page.locator('[data-block-type="math"] .katex')).toHaveCount(
      2,
    );
    expect(
      JSON.stringify(
        (await db
          .collection("course_revisions")
          .findOne({ _id: revision!._id }))!.contentDocument,
      ),
    ).toBe(before);
    expect(
      (await db.collection("course_revisions").findOne({
        revisionTag: "rev_browser",
      }))!.contentDocument.chapters[0].lessons[0].blocks.every(
        (b: any) => !b.reviewedFormula,
      ),
    ).toBe(true);
  } finally {
    await client.close();
  }
});
