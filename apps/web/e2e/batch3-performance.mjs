/**
 * Reader performance evidence (Batch 3, Milestone 3.6).
 *
 * Measures the concrete concern from the brief: a lesson with many
 * source-faithful mathematics images must not fetch them all eagerly. Uses the
 * real reader against a contract built with many unreviewed formulas.
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.PREVIEW_URL || "http://localhost:3100/reader-preview";
const OUT = path.resolve("../../reports/evidence/batch3");

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

const imageRequests = [];
page.on("request", (request) => {
  if (request.resourceType() === "image") imageRequests.push(request.url());
});

const started = Date.now();
await page.goto(`${BASE}?lesson=lesson-4-4`, { waitUntil: "domcontentloaded" });
const domContentLoaded = Date.now() - started;

// Measure before scrolling, then after scrolling the full page.
await page.waitForTimeout(1500);
const imagesAtTop = imageRequests.length;

// Count all image elements and how many lazy-loaded.
const imgStats = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll("img")];
  return {
    total: imgs.length,
    lazy: imgs.filter((img) => img.loading === "lazy").length,
    withDimensions: imgs.filter((img) => img.width > 0 && img.height > 0).length,
  };
});

// Scroll through the whole document to trigger lazy loads.
await page.evaluate(async () => {
  const step = window.innerHeight;
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(1200);
const imagesAfterScroll = imageRequests.length;

// Layout shift measurement.
const cls = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let total = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) total += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
      setTimeout(() => resolve(Number(total.toFixed(4))), 500);
    }),
);

// JavaScript payload for the reader route.
const transfer = await page.evaluate(() => {
  const entries = performance.getEntriesByType("resource");
  const scripts = entries.filter((entry) => entry.initiatorType === "script");
  const bytes = scripts.reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
  return {
    scriptRequests: scripts.length,
    scriptTransferKiB: Math.round(bytes / 1024),
    domNodes: document.querySelectorAll("*").length,
  };
});

const result = {
  capturedAt: new Date().toISOString(),
  url: `${BASE}?lesson=lesson-4-4`,
  domContentLoadedMs: domContentLoaded,
  images: {
    elements: imgStats.total,
    lazyElements: imgStats.lazy,
    eagerElements: imgStats.total - imgStats.lazy,
    requestedAtTop: imagesAtTop,
    requestedAfterFullScroll: imagesAfterScroll,
    // The load-bearing assertion: images are not all fetched on open.
    notAllFetchedEagerly: imagesAtTop < imgStats.total,
  },
  cumulativeLayoutShift: cls,
  javascript: transfer,
};

await fs.mkdir(OUT, { recursive: true });
await fs.writeFile(path.join(OUT, "reader-performance.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
