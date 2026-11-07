import { chromium } from "@playwright/test";
import path from "node:path";

async function capture() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  await page.goto("http://localhost:3000");
  await page.waitForTimeout(600);

  const baseDir = path.resolve(import.meta.dirname, "../../../var/tmp");

  // 1. Hero initial state
  await page.screenshot({
    path: path.join(baseDir, "cinematic-scroll/01-hero-initial.png"),
    clip: { x: 0, y: 0, width: 1440, height: 800 },
  });

  // 2. Hero Phase 1 (orbit activation)
  await page.evaluate(() => window.scrollTo(0, 350));
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(baseDir, "cinematic-scroll/02-hero-phase1-activation.png"),
    clip: { x: 0, y: 0, width: 1440, height: 800 },
  });

  // 3. Meet Nardouch Initial State: Baby visible, remaining 4 hidden
  const nardouchSection = page.locator("#nardouch");
  await nardouchSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);

  const triggerTop = await page.evaluate(() => {
    const el = document.getElementById("nardouch");
    return window.scrollY + (el ? el.getBoundingClientRect().top : 0);
  });

  await page.evaluate((top) => window.scrollTo(0, top), triggerTop);
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(baseDir, "cinematic-scroll/03-evolution-baby.png"),
    clip: { x: 0, y: 0, width: 1440, height: 900 },
  });

  // 4. Meet Nardouch Mid-Progress: Baby, Learner, Explorer visible
  await page.evaluate((top) => window.scrollTo(0, top + 1100), triggerTop);
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(baseDir, "cinematic-scroll/04-evolution-explorer.png"),
    clip: { x: 0, y: 0, width: 1440, height: 900 },
  });

  // 5. Meet Nardouch Graduation Finale: All five characters visible together
  await page.evaluate((top) => window.scrollTo(0, top + 2100), triggerTop);
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(baseDir, "cinematic-scroll/05-evolution-graduate-finale.png"),
    clip: { x: 0, y: 0, width: 1440, height: 900 },
  });

  // 6. How It Works Laptop
  await page.locator("#how-it-works").scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(baseDir, "cinematic-scroll/06-how-it-works-laptop.png"),
    clip: { x: 0, y: 0, width: 1440, height: 850 },
  });

  // 7. Full page desktop
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(baseDir, "cinematic-scroll/07-fullpage-desktop.png"),
    fullPage: true,
  });
  await page.screenshot({
    path: path.join(baseDir, "nardouch-growth-landing.png"),
    fullPage: true,
  });

  // 8. Mobile view
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3000");
  const mobileHero = page.locator(".hero-nardouch img");
  await mobileHero.evaluate((el) => el.complete && el.naturalWidth > 0);
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(baseDir, "cinematic-scroll/08-mobile-fullpage.png"),
    fullPage: true,
  });
  await page.screenshot({
    path: path.join(baseDir, "nardouch-growth-landing-mobile.png"),
    fullPage: true,
  });

  await browser.close();
  console.log("Capture completed successfully!");
}

capture().catch((e) => {
  console.error(e);
  process.exit(1);
});
