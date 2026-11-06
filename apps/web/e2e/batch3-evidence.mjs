/**
 * Batch 3 evidence capture. Drives the development preview of the real reader
 * and writes screenshots plus a machine-readable result file.
 *
 * Run against a dev server started with `EDNOVA_NEXT_DIST_DIR=.next-preview`.
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.PREVIEW_URL || "http://localhost:3100/reader-preview";
const OUT = path.resolve("../../reports/evidence/batch3");

const scenarios = [
  {
    name: "math-read",
    url: `${BASE}?lesson=lesson-3-1`,
    viewport: { width: 1440, height: 1100 },
    check: async (page) => ({
      reviewedFormulaTypeset: await page.locator(".katex").count(),
      unreviewedFallback: await page.locator("[data-uncertain-math]").count(),
      definitionCards: await page.locator('[data-component="DefinitionCard"]').count(),
      theoremCards: await page.locator('[data-component="TheoremCard"]').count(),
      proofBlocks: await page.locator('[data-component="ProofBlock"]').count(),
      exerciseBlocks: await page.locator('[data-component="ExerciseBlock"]').count(),
      disclosure: (await page.locator('[aria-label="Content verification status"]').innerText()).slice(0, 80),
    }),
  },
  {
    name: "math-explore",
    url: `${BASE}?lesson=lesson-3-1&mode=explore`,
    viewport: { width: 1440, height: 1100 },
    check: async (page) => ({
      explorationPanel: await page.locator('[aria-labelledby="explorations-title"]').count(),
      sequenceVisualizers: await page.locator('[data-component="SequenceVisualizer"]').count(),
      svgCount: await page.locator('[aria-labelledby="explorations-title"] svg').count(),
      hasDataTable: await page.locator('[data-component="SequenceVisualizer"] details table').count(),
    }),
  },
  {
    name: "engineering-read",
    url: `${BASE}?lesson=lesson-4-2`,
    viewport: { width: 1440, height: 1100 },
    check: async (page) => ({
      tables: await page.locator("article table").count(),
      codeBlocks: await page.locator('[data-block-type="code"]').count(),
      processDiagram: await page.locator('[data-component="ProcessDiagram"]').count(),
      charts: await page.locator('[data-component="DataChart"]').count(),
      figureGraceful: await page.locator('[data-block-type="media"] [role="status"]').count(),
    }),
  },
  {
    name: "engineering-explore",
    url: `${BASE}?lesson=lesson-4-2&mode=explore`,
    viewport: { width: 1440, height: 1100 },
    check: async (page) => {
      const walkthrough = page.locator('[data-component="CodeWalkthrough"]');
      const topology = page.locator('[data-component="InteractiveDiagram"]');
      const stepBefore = await walkthrough.locator('[aria-live="polite"]').innerText();
      await walkthrough.getByRole("button", { name: /Next/ }).click();
      await page.waitForTimeout(400);
      const stepAfter = await walkthrough.locator('[aria-live="polite"]').innerText();
      await topology.locator("button[aria-pressed]").first().click();
      await page.waitForTimeout(300);
      return {
        codeWalkthroughs: await walkthrough.count(),
        interactiveDiagrams: await topology.count(),
        stepBefore: stepBefore.slice(0, 60),
        stepAfter: stepAfter.slice(0, 60),
        stepAdvanced: stepBefore !== stepAfter,
        lineHighlighted: await walkthrough.locator('[data-current-line="true"]').count(),
        topologyDetail: (await topology.locator('[id$="-detail"]').innerText()).slice(0, 70),
        topologyTextAlternative: await topology.locator("details").count(),
      };
    },
  },
  {
    name: "prose-no-forced-interaction",
    url: `${BASE}?lesson=lesson-4-3&mode=explore`,
    viewport: { width: 1440, height: 1100 },
    check: async (page) => ({
      explorationPanel: await page.locator('[aria-labelledby="explorations-title"]').count(),
      quote: await page.locator("article blockquote").count(),
      list: await page.locator("article ol, article ul").count(),
      headings: await page.locator("article h1, article h2, article h3").evaluateAll((els) =>
        els.map((el) => el.tagName),
      ),
    }),
  },
  {
    name: "mobile-outline",
    url: `${BASE}?lesson=lesson-3-1`,
    viewport: { width: 390, height: 844 },
    check: async (page) => {
      await page.getByRole("button", { name: "Outline" }).click();
      const dialog = page.getByRole("dialog");
      const result = {
        dialogVisible: await dialog.isVisible(),
        lessonLinks: await dialog.getByRole("link").count(),
        horizontalOverflow: await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 1,
        ),
      };
      await page.keyboard.press("Escape");
      result.dialogClosedOnEscape = !(await dialog.isVisible().catch(() => false));
      return result;
    },
  },
];

const results = [];
const browser = await chromium.launch();
await fs.mkdir(OUT, { recursive: true });
try {
  for (const scenario of scenarios) {
    const context = await browser.newContext({
      viewport: scenario.viewport,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text().slice(0, 200));
    });
    await page.goto(scenario.url, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const observed = await scenario.check(page);
    await page.screenshot({
      path: path.join(OUT, `${scenario.name}.png`),
      fullPage: false,
    });
    results.push({
      scenario: scenario.name,
      url: scenario.url,
      viewport: scenario.viewport,
      observed,
      consoleErrors: consoleErrors.filter((line) => !/api\/v1\/study/.test(line)),
    });
    await context.close();
    console.log(`captured ${scenario.name}`);
  }
} finally {
  await browser.close();
}

await fs.writeFile(
  path.join(OUT, "reader-journeys.json"),
  JSON.stringify({ capturedAt: new Date().toISOString(), base: BASE, results }, null, 2),
);
console.log(JSON.stringify(results, null, 2));
