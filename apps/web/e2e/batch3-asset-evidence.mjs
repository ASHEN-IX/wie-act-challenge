/**
 * Structured-asset rendering evidence (Batch 3, Milestone 3.6).
 *
 * Drives the real reader on a lesson that carries one authorized structured
 * asset and records what actually rendered, including one live interaction, so
 * the asset path is proven rather than asserted.
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.PREVIEW_URL || "http://localhost:3100/reader-preview";
const OUT = path.resolve("../../reports/evidence/batch3");

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1200 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

await page.goto(`${BASE}?lesson=lesson-4-2`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const asset = page.locator("[data-structured-asset]");
const observed = {
  assetCount: await asset.count(),
  assetId: await asset.getAttribute("data-structured-asset"),
  provenance: await asset.getAttribute("data-asset-provenance"),
  component: await asset.getAttribute("data-asset-component"),
  label: (await asset.innerText()).split("\n")[0],
  walkthroughSteps: await page.locator('[data-component="CodeWalkthrough"] [aria-live="polite"]').count(),
  staticCodeViewerAlsoPresent: await page.locator('[data-component="CodeViewer"]').count(),
};

// Step the walkthrough to prove it is live, not decorative.
await page
  .locator('[data-component="CodeWalkthrough"]')
  .getByRole("button", { name: /Next/ })
  .click();
await page.waitForTimeout(400);
observed.stepAfterNext = (
  await page.locator('[data-component="CodeWalkthrough"] [aria-live="polite"]').innerText()
).slice(0, 60);

await page.locator("[data-structured-asset]").scrollIntoViewIfNeeded();
await page.screenshot({ path: path.join(OUT, "structured-asset.png"), fullPage: false });

await fs.mkdir(OUT, { recursive: true });
await fs.writeFile(
  path.join(OUT, "structured-asset.json"),
  JSON.stringify(
    { capturedAt: new Date().toISOString(), url: `${BASE}?lesson=lesson-4-2`, observed },
    null,
    2,
  ),
);
console.log(JSON.stringify(observed, null, 2));
await browser.close();
