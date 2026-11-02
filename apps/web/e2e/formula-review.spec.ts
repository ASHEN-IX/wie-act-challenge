import { test, expect } from "@playwright/test";
import path from "node:path";
import { MongoClient } from "mongodb";
async function database(work: (db: any) => Promise<void>) {
  const name = process.env.FORMULA_E2E_DB_NAME!;
  if (!/^test_formula_browser_\d+$/.test(name))
    throw new Error("isolated DB required");
  const client = new MongoClient("mongodb://127.0.0.1:27017/" + name);
  await client.connect();
  try {
    expect(
      await client.db().collection("courses").countDocuments(),
    ).toBeGreaterThan(0);
    await work(client.db());
  } finally {
    await client.close();
  }
}
async function login(page: any) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("formula@example.test");
  await page.getByLabel("Password", { exact: true }).fill("FormulaPass!123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/courses/bbbbbbbbbbbbbbbbbbbbbbbb/studio");
}

test("instructor recognizes, reviews and reloads persisted formulas in Studio", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("formula@example.test");
  await page.getByLabel("Password", { exact: true }).fill("FormulaPass!123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/courses/bbbbbbbbbbbbbbbbbbbbbbbb/studio");
  const workspace = page.getByRole("region", { name: "Formula review" });
  await expect(workspace.getByLabel("Mathematical source region")).toBeVisible({
    timeout: 30000,
  });
  await expect(workspace.locator("img")).toBeVisible();
  await expect
    .poll(() =>
      workspace
        .locator("img")
        .evaluate((e: HTMLImageElement) => e.naturalWidth),
    )
    .toBeGreaterThan(0);
  await workspace
    .getByRole("button", { name: "Authorize this document for Gemini" })
    .click();
  await expect(workspace.getByRole("status").first()).toContainText(
    "consent recorded",
  );
  const selector = workspace.getByLabel("Mathematical source region");
  const values = await selector
    .locator("option")
    .evaluateAll((nodes) => nodes.map((n) => (n as HTMLOptionElement).value));
  for (let i = 0; i < 3; i++) {
    await selector.selectOption(values[i]);
    await workspace
      .getByRole("button", { name: "Request Gemini recognition", exact: true })
      .click();
    await expect(
      workspace.getByText("No saved proposal for this region."),
    ).not.toBeVisible({ timeout: 30000 });
    await expect(
      workspace.getByText("Original generated LaTeX", { exact: true }),
    ).toBeVisible();
    await expect(workspace.locator(".katex").first()).toBeVisible();
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
  await page.reload();
  await expect(
    workspace.getByLabel("Mathematical source region"),
  ).toBeVisible();
  await expect(
    workspace.getByText("This decision is final for this proposal."),
  ).toBeVisible();
  await workspace.getByText("Review history (1)").click();
  await expect(workspace.getByText(/pending → corrected/)).toBeVisible();
  const evidence = path.resolve("../../reports/evidence/studio-formula-review");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(evidence, "studio-reviewed-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(evidence, "studio-reviewed-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("unavailability and terminal jobs retain source inspection; stale reviews refresh saved state", async ({
  page,
}) => {
  await database(async (db) => {
    await db.collection("formulaproposals").deleteMany({});
    await db.collection("formularecognitionjobs").deleteMany({});
    await db
      .collection("formula_provider_eligibility")
      .updateMany({}, { $set: { revoked: true } });
  });
  await login(page);
  const workspace = page.getByRole("region", { name: "Formula review" });
  await expect(
    workspace.getByLabel("Mathematical source region"),
  ).toBeVisible();
  await workspace
    .getByRole("button", { name: "Request Gemini recognition", exact: true })
    .click();
  await expect(
    workspace.getByText("FREE_TIER_UNVERIFIED", { exact: true }),
  ).toBeVisible();
  await expect(workspace.locator("img")).toBeVisible();
  await database(async (db) => {
    await db
      .collection("formula_provider_eligibility")
      .updateMany({}, { $set: { revoked: false } });
  });
  await workspace
    .getByRole("button", { name: "Request Gemini recognition", exact: true })
    .click();
  await expect(
    workspace.getByText("Job: running", { exact: true }),
  ).toBeVisible();
  await workspace.getByRole("button", { name: "Cancel recognition" }).click();
  await expect(
    workspace.getByText("Job: cancelled", { exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(3000);
  await database(async (db) => {
    await db.collection("formularecognitionjobs").deleteMany({});
  });
  await page.reload();
  await workspace
    .getByRole("button", { name: "Request Gemini recognition", exact: true })
    .click();
  await expect(
    workspace.getByRole("button", { name: "Accept proposal" }),
  ).toBeVisible({ timeout: 30000 });
  await workspace
    .getByLabel("Corrected LaTeX")
    .fill("<script>window.formulaInjected=true</script>");
  await workspace.getByRole("button", { name: "Save correction" }).click();
  await expect(
    workspace.getByText("INVALID_LATEX", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => "formulaInjected" in window)).toBe(false);
  let proposal: any;
  await database(async (db) => {
    proposal = await db.collection("formulaproposals").findOne({});
  });
  const reviewed = await page.request.post(
    `http://localhost:5351/api/v1/study/courses/bbbbbbbbbbbbbbbbbbbbbbbb/drafts/rev_browser/formula-proposals/${proposal._id}/review`,
    {
      headers: { origin: "http://localhost:5350" },
      data: { action: "accept", reviewVersion: 0, draftVersion: 0 },
    },
  );
  expect(reviewed.status()).toBe(200);
  await workspace.getByRole("button", { name: "Accept proposal" }).click();
  await expect(
    workspace.getByText(
      "The draft or review changed. Refreshed the saved state.",
    ),
  ).toBeVisible();
  await expect(
    workspace.getByText("This decision is final for this proposal."),
  ).toBeVisible();
  await database(async (db) => {
    await db.collection("formulaproposals").deleteMany({});
  });
  for (const state of ["failed", "cancelled", "uncertain", "stale"]) {
    await database(async (db) => {
      await db
        .collection("formularecognitionjobs")
        .updateMany({}, { $set: { state, error: "TEST_" + state } });
    });
    await page.reload();
    await expect(
      workspace.getByText(`Job: ${state} · TEST_${state}`, { exact: true }),
    ).toBeVisible();
    await expect(
      workspace.getByText("No saved proposal for this region."),
    ).toBeVisible();
    await expect(workspace.locator("img")).toBeVisible();
  }
});
test("unauthorized course users cannot access formula controls", async ({
  page,
}) => {
  await database(async (db) => {
    await db
      .collection("courses")
      .updateOne(
        {
          _id: new (await import("mongodb")).ObjectId(
            "bbbbbbbbbbbbbbbbbbbbbbbb",
          ),
        },
        { $set: { ownerUserId: "other", userId: "other" } },
      );
  });
  await login(page);
  await expect(
    page.getByRole("region", { name: "Formula review" }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Authorize this document for Gemini" }),
  ).not.toBeVisible();
});

test("assigned instructors inspect sources but cannot grant owner consent", async ({
  page,
}) => {
  await database(async (db) => {
    const { ObjectId } = await import("mongodb");
    const institutionId = new ObjectId("cccccccccccccccccccccccc");
    await db
      .collection("institutions")
      .insertOne({
        _id: institutionId,
        name: "Fixture institution",
        slug: "fixture",
        status: "active",
      });
    await db
      .collection("institution_memberships")
      .insertOne({
        institutionId,
        userId: "aaaaaaaaaaaaaaaaaaaaaaaa",
        role: "instructor",
        status: "active",
      });
    await db
      .collection("courses")
      .updateOne(
        { _id: new ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb") },
        {
          $set: {
            scope: "institutional",
            institutionId,
            assignedInstructorIds: ["aaaaaaaaaaaaaaaaaaaaaaaa"],
          },
        },
      );
  });
  await login(page);
  const workspace = page.getByRole("region", { name: "Formula review" });
  await expect(
    workspace.getByLabel("Mathematical source region"),
  ).toBeVisible();
  await expect(
    workspace.getByText(
      "New document consent must be granted by the course owner.",
    ),
  ).toBeVisible();
  await expect(
    workspace.getByRole("button", {
      name: "Authorize this document for Gemini",
    }),
  ).not.toBeVisible();
});
