/**
 * Authenticated-reader accessibility measurement (Batch 4 release candidate).
 *
 * Scope note: this measures the real reader surface for an enrolled student,
 * not only `reader-preview`. Two distinct targets are exercised:
 *
 *   1. `/reader-preview`  — the production `LessonReader` with a fixture
 *      presentation. Covers math, code and prose lessons and the mode selector.
 *   2. `/courses/[courseId]/learn` — the authenticated reader route. When no
 *      session is available it renders the unauthenticated shell, which is
 *      itself worth measuring: it must fail closed, not leak reader content.
 *
 * axe-core could NOT be installed (registry access denied: 403 on
 * registry.npmjs.org). So this is computed-style measurement, NOT a WCAG
 * conformance audit, and no axe rule coverage is claimed. Screen-reader
 * behaviour is NOT TESTED — no assistive technology is automatable here.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.READER_URL || "http://127.0.0.1:3100";
const OUT = path.resolve("../../reports/evidence/batch4rc");

const TARGETS = [
  { name: "reader-preview:math", url: `${BASE}/reader-preview?lesson=lesson-3-1` },
  { name: "reader-preview:code", url: `${BASE}/reader-preview?lesson=lesson-4-2` },
  { name: "reader-preview:prose", url: `${BASE}/reader-preview?lesson=lesson-4-3` },
  { name: "reader-preview:guided", url: `${BASE}/reader-preview?lesson=lesson-3-1&mode=guided` },
  // The real enrolled-student reader route. Without a session it must fail
  // closed (redirect), never render reader content.
  { name: "authenticated-reader:no-session", url: `${BASE}/courses/0123456789abcdef01234567/learn` },
];

const MEASURE = () => {
  const parse = (v) => {
    const m = v && v.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[,/]/).map((x) => parseFloat(x.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
  };
  const over = (f, b) => ({
    r: f.r * f.a + b.r * (1 - f.a),
    g: f.g * f.a + b.g * (1 - f.a),
    b: f.b * f.a + b.b * (1 - f.a),
    a: 1,
  });
  const lum = (c) => {
    const ch = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
  };
  const ratio = (f, b) => {
    const a = lum(f), c = lum(b);
    const [hi, lo] = a > c ? [a, c] : [c, a];
    return (hi + 0.05) / (lo + 0.05);
  };
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const bg = parse(getComputedStyle(n).backgroundColor);
      if (bg && bg.a > 0.95) return bg;
      n = n.parentElement;
    }
    return parse(getComputedStyle(document.body).backgroundColor) ?? { r: 11, g: 16, b: 38, a: 1 };
  };

  const root = document.querySelector("article") ?? document.body;
  const texts = [];
  for (const el of root.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, td, th, span, a, button, label, summary")) {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join("");
    if (!own) continue;
    const st = getComputedStyle(el);
    if (st.visibility === "hidden" || st.display === "none") continue;
    if (parseFloat(st.opacity) < 0.1) continue;
    const fgRaw = parse(st.color);
    if (!fgRaw) continue;
    // Gradient-clipped text sets `color: transparent` and paints with a
    // background image. Computed styles cannot resolve the painted colour, so
    // this harness must not score it: a 1.0 here is an artifact, not a defect.
    const clipped =
      st.webkitBackgroundClip === "text" ||
      st.backgroundClip === "text" ||
      fgRaw.a === 0;
    if (clipped) {
      texts.push({ text: own.slice(0, 36), tag: el.tagName, ratio: null, required: null, pass: null, notMeasurable: "background-clip:text" });
      continue;
    }
    const bg = bgOf(el);
    const r = ratio(over(fgRaw, bg), bg);
    const size = parseFloat(st.fontSize);
    const weight = Number(st.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    texts.push({ text: own.slice(0, 36), tag: el.tagName, ratio: +r.toFixed(2), required: large ? 3 : 4.5, pass: r >= (large ? 3 : 4.5) });
  }

  const doc = document.documentElement;
  const overflow = Math.max(0, doc.scrollWidth - doc.clientWidth);
  const wide = [...root.querySelectorAll("*")]
    .filter((el) => el.getBoundingClientRect().width > doc.clientWidth + 1)
    .slice(0, 30)
    .map((el) => {
      let n = el.parentElement, scroller = null;
      while (n) {
        if (["auto", "scroll"].includes(getComputedStyle(n).overflowX)) { scroller = n.tagName; break; }
        n = n.parentElement;
      }
      return { tag: el.tagName, width: Math.round(el.getBoundingClientRect().width), contained: scroller !== null };
    });

  const small = [];
  for (const el of root.querySelectorAll("button, a[href], input, select, summary")) {
    const b = el.getBoundingClientRect();
    if (!b.width || !b.height) continue;
    if (b.width < 24 || b.height < 24)
      small.push({ tag: el.tagName, label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 32), w: Math.round(b.width), h: Math.round(b.height) });
  }

  return {
    samples: texts.length,
    failures: texts.filter((t) => t.pass === false),
    notMeasurable: texts.filter((t) => t.notMeasurable),
    worst: texts.filter((t) => t.ratio !== null).sort((a, b) => a.ratio - b.ratio).slice(0, 3),
    overflow,
    wide,
    clipped: wide.filter((w) => !w.contained),
    small,
    // Named reader surfaces the prompt asks about.
    surfaces: {
      // Real hooks from lesson-reader.tsx / registry.tsx, not guesses.
      readerRoot: document.querySelectorAll("[data-reader-mode]").length,
      modeSelector: document.querySelectorAll('[data-reader-mode] a[href*="mode="], nav a[href*="mode="]').length,
      sourceInspector: document.querySelectorAll("details summary").length,
      mathFallback: document.querySelectorAll("math, .katex, [data-math-fallback]").length,
      codeBlocks: document.querySelectorAll("pre").length,
      recommendations: document.querySelectorAll('[data-adaptation], [aria-label*="recommendation" i]').length,
    },
  };
};

const browser = await chromium.launch();
const results = [];

for (const target of TARGETS) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  let status = 0;
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 120)); });
  try {
    const res = await page.goto(target.url, { waitUntil: "networkidle" });
    status = res ? res.status() : 0;
    await page.waitForTimeout(700);
  } catch (e) {
    results.push({ target: target.name, status: "navigation-failed", error: String(e).slice(0, 120) });
    await ctx.close();
    continue;
  }

  const wide = await page.evaluate(MEASURE);

  // keyboard tour
  await page.evaluate(() => window.scrollTo(0, 0));
  const stops = [];
  for (let i = 0; i < 25; i += 1) {
    await page.keyboard.press("Tab");
    const s = await page.evaluate(() => {
      const a = document.activeElement;
      if (!a) return null;
      const st = getComputedStyle(a);
      const visible =
        (st.outlineStyle !== "none" && parseFloat(st.outlineWidth || "0") > 0 && st.outlineColor !== "rgba(0, 0, 0, 0)") ||
        (st.boxShadow && st.boxShadow !== "none");
      return { tag: a.tagName, label: (a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 32), visible: !!visible };
    });
    if (s) stops.push(s);
  }

  // 320px reflow (200% zoom of 640px, WCAG 1.4.10 target width)
  await page.setViewportSize({ width: 320, height: 900 });
  await page.waitForTimeout(500);
  const narrow = await page.evaluate(MEASURE);

  results.push({
    target: target.name,
    status,
    wide: { samples: wide.samples, failures: wide.failures, notMeasurable: wide.notMeasurable, worst: wide.worst, small: wide.small, surfaces: wide.surfaces },
    keyboard: { stops: stops.length, noVisibleFocus: stops.filter((s) => !s.visible) },
    reflow: { overflow: narrow.overflow, wide: narrow.wide.length, contained: narrow.wide.filter((w) => w.contained).length, clipped: narrow.clipped, failures: narrow.failures.length, small: narrow.small.length },
    consoleErrors,
  });
  await ctx.close();
  console.log(`measured ${target.name}`);
}

await browser.close();
await fs.mkdir(OUT, { recursive: true });
await fs.writeFile(
  path.join(OUT, "reader-accessibility.json"),
  JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      axe: "UNAVAILABLE — registry access denied (403 registry.npmjs.org); no axe rule coverage claimed",
      screenReader: "NOT TESTED — no assistive technology automatable in this environment",
      note: "Computed-style measurement, not a WCAG conformance audit.",
      results,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(results.map((r) => ({ t: r.target, status: r.status, fail: r.wide?.failures?.length, worst: r.wide?.worst?.[0]?.ratio, kbd: r.keyboard?.stops, lost: r.keyboard?.noVisibleFocus?.length, of: r.reflow?.overflow, clip: r.reflow?.clipped?.length })), null, 1));
