/**
 * Authenticated reader accessibility measurement (Batch 4 release-integrity).
 *
 * Reuses the Batch 3 measurement approach — computed contrast, touch targets,
 * reduced motion — and adds the two things that milestone did not cover:
 * 200% reflow (WCAG 1.4.10) and keyboard operability.
 *
 * axe-core cannot be installed here (no registry access), so this is a
 * *measurement*, not a conformance audit. A screen reader could not be
 * automated in this environment at all; that is reported as NOT TESTED rather
 * than assumed to pass.
 */
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.READER_URL || "http://127.0.0.1:3100/reader-preview";
const OUT = path.resolve("../../reports/evidence/batch4b");

const SCENARIOS = [
  { name: "math-read", url: `${BASE}?lesson=lesson-3-1` },
  { name: "engineering-read", url: `${BASE}?lesson=lesson-4-2` },
  { name: "prose", url: `${BASE}?lesson=lesson-4-3` },
];

const MEASURE = () => {
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

  const textContrast = [];
  const article = document.querySelector("article") ?? document.body;
  const nodes = [
    ...article.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, td, th, span, a, button"),
  ];
  for (const element of nodes) {
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

  const smallTargets = [];
  for (const element of article.querySelectorAll("button, a[href], input, select")) {
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    if (box.width < 24 || box.height < 24)
      smallTargets.push({
        tag: element.tagName,
        label: (element.getAttribute("aria-label") || element.textContent || "")
          .trim()
          .slice(0, 40),
        width: Math.round(box.width),
        height: Math.round(box.height),
      });
  }

  const animations = [...article.querySelectorAll("article *")].filter((element) => {
    const style = getComputedStyle(element);
    return (
      style.animationName !== "none" &&
      style.animationDuration !== "0s" &&
      style.animationIterationCount === "infinite"
    );
  }).length;

  // WCAG 1.4.10: no loss of content or functionality at 320 CSS px width
  // (400% zoom of a 1280px viewport), with no two-dimensional scrolling.
  const doc = document.documentElement;
  const horizontalOverflow = Math.max(0, doc.scrollWidth - doc.clientWidth);

  // An element wider than the viewport is only a 1.4.10 problem if it is
  // *clipped*. Code blocks legitimately scroll inside an ancestor, which the
  // criterion permits. Classify each one rather than judging by width alone.
  const wideElements = [...article.querySelectorAll("*")]
    .filter((element) => element.getBoundingClientRect().width > doc.clientWidth + 1)
    .slice(0, 20)
    .map((element) => {
      let node = element.parentElement;
      let scroller = null;
      while (node) {
        const style = getComputedStyle(node);
        if (["auto", "scroll"].includes(style.overflowX)) {
          scroller = node.tagName;
          break;
        }
        node = node.parentElement;
      }
      return {
        tag: element.tagName,
        width: Math.round(element.getBoundingClientRect().width),
        containedByScroll: scroller !== null,
      };
    });
  const clippedElements = wideElements.filter((entry) => !entry.containedByScroll);

  return {
    textSamples: textContrast.length,
    contrastFailures: textContrast.filter((entry) => !entry.pass),
    worstContrast: [...textContrast].sort((a, b) => a.ratio - b.ratio).slice(0, 5),
    smallTargets,
    infiniteAnimations: animations,
    horizontalOverflow,
    wideElements,
    clippedElements,
  };
};

const browser = await chromium.launch();
const results = [];

for (const scenario of SCENARIOS) {
  // ---- 1440px, reduced motion -------------------------------------------
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(scenario.url, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const wide = await page.evaluate(MEASURE);

  // ---- keyboard tour -----------------------------------------------------
  // Tab from the top and record whether focus is always visible and never
  // lands on a non-interactive container.
  const keyboard = await (async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.keyboard.press("Tab");
    const stops = [];
    for (let index = 0; index < 25; index += 1) {
      const stop = await page.evaluate(() => {
        const active = document.activeElement;
        if (!active) return null;
        const style = getComputedStyle(active);
        const hasOutline =
          style.outlineStyle !== "none" &&
          parseFloat(style.outlineWidth || "0") > 0 &&
          style.outlineColor !== "rgba(0, 0, 0, 0)";
        const hasShadow = style.boxShadow && style.boxShadow !== "none";
        return {
          tag: active.tagName,
          role: active.getAttribute("role"),
          label: (active.getAttribute("aria-label") || active.textContent || "")
            .trim()
            .slice(0, 40),
          focusVisible: Boolean(hasOutline || hasShadow),
        };
      });
      if (stop) stops.push(stop);
      await page.keyboard.press("Tab");
    }
    return {
      stops: stops.length,
      withoutVisibleFocus: stops.filter((stop) => !stop.focusVisible),
    };
  })();

  // ---- 320px reflow ------------------------------------------------------
  await page.setViewportSize({ width: 320, height: 900 });
  await page.waitForTimeout(600);
  const reflow = await page.evaluate(MEASURE);

  results.push({
    scenario: scenario.name,
    wide: {
      textSamples: wide.textSamples,
      contrastFailures: wide.contrastFailures,
      worstContrast: wide.worstContrast,
      smallTargets: wide.smallTargets,
      infiniteAnimations: wide.infiniteAnimations,
    },
    keyboard,
    reflow: {
      horizontalOverflow: reflow.horizontalOverflow,
      wideElements: reflow.wideElements.length,
      containedByScroll: reflow.wideElements.filter((e) => e.containedByScroll).length,
      clippedElements: reflow.clippedElements,
      contrastFailures: reflow.contrastFailures.length,
      smallTargets: reflow.smallTargets.length,
    },
  });

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
      tool: "computed-style measurement (axe unavailable: no registry access)",
      screenReader: "NOT TESTED — no screen reader automatable in this environment",
      note:
        "Contrast is measured against the first opaque ancestor background. " +
        "This is a measurement, not a WCAG conformance audit.",
      results,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(results, null, 2));
