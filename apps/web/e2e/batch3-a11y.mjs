/**
 * Accessibility measurement (Batch 3, Milestone 3.6).
 *
 * No axe is installable in this environment, so this script measures the two
 * things DOM assertions cannot: computed contrast ratios and touch-target
 * sizes, plus reduced-motion behaviour. It reports what it measured and what it
 * could not, rather than asserting WCAG conformance.
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.PREVIEW_URL || "http://localhost:3100/reader-preview";
const OUT = path.resolve("../../reports/evidence/batch3");

const SCENARIOS = [
  { name: "math-read", url: `${BASE}?lesson=lesson-3-1` },
  { name: "engineering-read", url: `${BASE}?lesson=lesson-4-2` },
  { name: "prose", url: `${BASE}?lesson=lesson-4-3` },
];

const browser = await chromium.launch();
const results = [];

for (const scenario of SCENARIOS) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(scenario.url, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const measured = await page.evaluate(() => {
    // --- colour parsing -----------------------------------------------------
    const parse = (value) => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return null;
      const parts = match[1].split(/[,/]/).map((part) => parseFloat(part.trim()));
      return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
    };
    const over = (fg, bg) => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1,
    });
    const luminance = (c) => {
      const channel = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
    };
    const contrast = (fg, bg) => {
      const a = luminance(fg);
      const b = luminance(bg);
      const [light, dark] = a > b ? [a, b] : [b, a];
      return (light + 0.05) / (dark + 0.05);
    };
    // Walk ancestors for the first opaque background.
    const backgroundOf = (element) => {
      let node = element;
      while (node && node !== document.documentElement) {
        const bg = parse(getComputedStyle(node).backgroundColor);
        if (bg && bg.a > 0.95) return bg;
        node = node.parentElement;
      }
      const root = parse(getComputedStyle(document.body).backgroundColor);
      return root ?? { r: 11, g: 16, b: 38, a: 1 };
    };

    // --- text contrast ------------------------------------------------------
    const textContrast = [];
    const article = document.querySelector("article") ?? document.body;
    const nodes = [...article.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, td, th, span, a, button")];
    for (const element of nodes) {
      // Only elements that directly own visible text.
      const ownText = [...element.childNodes]
        .filter((node) => node.nodeType === 3)
        .map((node) => node.textContent.trim())
        .join("");
      if (!ownText) continue;
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (parseFloat(style.opacity) < 0.1) continue;
      const fgRaw = parse(style.color);
      if (!fgRaw) continue;
      const bg = backgroundOf(element);
      const fg = over(fgRaw, bg);
      const size = parseFloat(style.fontSize);
      const weight = Number(style.fontWeight) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const ratio = contrast(fg, bg);
      textContrast.push({
        text: ownText.slice(0, 40),
        tag: element.tagName,
        ratio: Number(ratio.toFixed(2)),
        size,
        weight,
        required: large ? 3 : 4.5,
        pass: ratio >= (large ? 3 : 4.5),
      });
    }

    // --- touch targets ------------------------------------------------------
    const smallTargets = [];
    for (const element of article.querySelectorAll("button, a[href], input, select")) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (box.width < 24 || box.height < 24)
        smallTargets.push({
          tag: element.tagName,
          label: (element.getAttribute("aria-label") || element.textContent || "").trim().slice(0, 40),
          width: Math.round(box.width),
          height: Math.round(box.height),
        });
    }

    // --- reduced motion -----------------------------------------------------
    const animations = [...document.querySelectorAll("article *")].filter((element) => {
      const style = getComputedStyle(element);
      return (
        style.animationName !== "none" &&
        style.animationDuration !== "0s" &&
        style.animationIterationCount === "infinite"
      );
    }).length;
    const transitions = [...document.querySelectorAll("article *")].filter((element) => {
      const style = getComputedStyle(element);
      return style.transitionDuration !== "0s" && parseFloat(style.transitionDuration) > 0.4;
    }).length;

    return {
      textSamples: textContrast.length,
      contrastFailures: textContrast.filter((entry) => !entry.pass),
      worstContrast: textContrast.sort((a, b) => a.ratio - b.ratio).slice(0, 5),
      smallTargets,
      infiniteAnimations: animations,
      longTransitions: transitions,
    };
  });

  results.push({ scenario: scenario.name, ...measured });
  await context.close();
  console.log(`measured ${scenario.name}`);
}

await browser.close();
await fs.mkdir(OUT, { recursive: true });
await fs.writeFile(
  path.join(OUT, "reader-accessibility.json"),
  JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      tool: "computed-style measurement (axe unavailable: no network for install)",
      reducedMotionEmulated: true,
      note: "Contrast is measured against the first opaque ancestor background. This is a measurement, not a WCAG conformance audit.",
      results,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(results, null, 2));
