// Browser + app helpers shared by every scene. Synthetic demo accounts only.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(root, 'node_modules/.pnpm/playwright-core@1.63.0/node_modules/playwright-core'));

export const BASE = 'http://localhost:3100';
export const PASSWORD = 'EdNovaDemo!2026';
export const USERS = {
  learner: 'learner@ednova.test', // Tasnim
  peer: 'peer@ednova.test', // Aziz
  instructor: 'instructor@ednova.test',
};
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Visible cursor with a click ripple. Headless Chromium draws no pointer of its own. */
const cursorInit = () => {
  const install = () => {
    if (document.getElementById('demo-cursor')) return;
    const c = document.createElement('div');
    c.id = 'demo-cursor';
    c.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l16 9.5-7 1.6-3.6 6.9z" fill="#fff" stroke="#140c30" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    c.style.cssText =
      'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45));will-change:transform';
    const saved = JSON.parse(sessionStorage.getItem('demo-cursor') || '[-60,-60]');
    const move = (x, y) => {
      c.style.transform = `translate(${x - 4}px,${y - 2}px)`;
      sessionStorage.setItem('demo-cursor', JSON.stringify([x, y]));
    };
    move(saved[0], saved[1]);
    document.documentElement.appendChild(c);
    addEventListener('mousemove', (e) => move(e.clientX, e.clientY), true);
    addEventListener(
      'mousedown',
      (e) => {
        const r = document.createElement('div');
        r.style.cssText = `position:fixed;left:${e.clientX - 18}px;top:${e.clientY - 18}px;width:36px;height:36px;border-radius:50%;border:3px solid #a78bfa;background:rgba(167,139,250,.25);z-index:2147483646;pointer-events:none;transition:transform .45s ease-out,opacity .45s ease-out`;
        document.documentElement.appendChild(r);
        requestAnimationFrame(() => {
          r.style.transform = 'scale(1.8)';
          r.style.opacity = '0';
        });
        setTimeout(() => r.remove(), 500);
      },
      true,
    );
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', install);
  else install();
};

export async function launch({ headed = false } = {}) {
  return chromium.launch({ headless: !headed, args: ['--no-sandbox', '--force-color-profile=srgb', '--hide-scrollbars'] });
}

/** One isolated browser profile (cookies, storage) per user. */
export async function newUserPage(browser, { width = 1280, height = 720, scale = 1.5 } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
  });
  await context.addInitScript(cursorInit);
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.__cursor = { x: width / 2, y: height / 2 };
  return page;
}

/** Moves the visible cursor smoothly (ease-in-out) to a point. */
export async function glide(page, x, y, ms = 450) {
  const from = page.__cursor;
  const steps = Math.max(8, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
    await sleep(ms / steps);
  }
  page.__cursor = { x, y };
}

/** Scrolls an element into view smoothly so the viewer keeps context. */
export async function reveal(locator, block = 'center') {
  await locator.waitFor();
  await locator.evaluate((el, b) => el.scrollIntoView({ behavior: 'smooth', block: b }), block);
  await sleep(650);
}

/** Glides to the element, then clicks it. */
export async function click(page, locator, { pause = 140, reveal: doReveal = true } = {}) {
  await locator.waitFor({ state: 'visible' });
  if (doReveal) {
    const inView = await locator.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 60 && r.bottom <= innerHeight - 90;
    });
    if (!inView) await reveal(locator);
  }
  const box = await locator.boundingBox();
  await glide(page, box.x + box.width / 2, box.y + box.height / 2);
  await sleep(pause);
  await locator.click();
}

export async function type(page, locator, text, delay = 28) {
  await click(page, locator);
  await locator.pressSequentially(text, { delay });
}

/** Smooth page scroll by a number of CSS pixels. */
export async function scrollBy(page, dy, ms = 900) {
  await page.evaluate((d) => window.scrollBy({ top: d, behavior: 'smooth' }), dy);
  await sleep(ms);
}

export async function login(page, email, { slow = true } = {}) {
  if (!page.url().includes('/login')) await page.goto(`${BASE}/login`);
  const delay = slow ? 22 : 0;
  await type(page, page.locator('input[type=email]'), email, delay);
  await type(page, page.locator('input[type=password]'), PASSWORD, delay);
  await click(page, page.getByRole('button', { name: /^(Log in|Sign in)/i }).first());
  await page.waitForURL('**/dashboard', { timeout: 30000 });
}

/** Deep Focus opens automatically on study pages; scenes that are not about it close it. */
export async function exitDeepFocus(page) {
  const btn = page.getByRole('button', { name: /Exit Deep Focus/i });
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click({ timeout: 4000 }).catch(() => {});
  }
}

export function courseId(titlePrefix) {
  return execFileSync(
    'psql',
    ['-h', '127.0.0.1', '-p', '5433', '-U', 'ednova', '-d', process.env.DEMO_DB || 'noveris_demo', '-At', '-c',
      `select id from courses where title like '${titlePrefix.replace(/'/g, "''")}%' order by \"createdAt\" limit 1`],
    { env: { ...process.env, PGPASSWORD: 'ednova' } },
  ).toString().trim();
}
