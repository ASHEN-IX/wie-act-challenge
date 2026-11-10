// Renders title cards, chapter cards, caption overlays and split-screen frames as 1920x1080 PNGs,
// using the product's own fonts, colours and brand assets (no network needed).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, root } from './app.mjs';

const pub = path.join(root, 'apps/web/public');
const fontCss = readFileSync(path.join(pub, 'fonts/gf.css'), 'utf8').replaceAll('url(/fonts/', `url(${pathToFileURL(pub).href}/fonts/`);
const asset = (p) => pathToFileURL(path.join(pub, p)).href;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export const BG = '#0b0d1f';
const base = `
${fontCss}
*{box-sizing:border-box;margin:0}
html,body{width:1920px;height:1080px;overflow:hidden}
body{font-family:Inter,Arial,sans-serif;color:#f4f2ff;-webkit-font-smoothing:antialiased}
.bg{background:radial-gradient(1200px 700px at 18% 12%,rgba(124,58,237,.38),transparent 60%),radial-gradient(900px 600px at 92% 100%,rgba(56,189,248,.16),transparent 60%),${BG}}
h1,h2,.sora{font-family:Sora,Inter,sans-serif;letter-spacing:-.02em}
.grad{background:linear-gradient(90deg,#c4b5fd,#8b5cf6 45%,#38bdf8);-webkit-background-clip:text;color:transparent}
.kicker{font:600 26px/1 Inter;letter-spacing:.18em;text-transform:uppercase;color:#a78bfa}
.muted{color:#b9b4d6}
`;

const templates = {
  title: ({ subtitle, note }) => `<body class="bg" style="display:flex;align-items:center;padding:0 170px">
    <div style="display:flex;align-items:center;gap:90px">
      <img src="${asset('images/nardouch-hero-transparent.png')}" style="height:600px">
      <div>
        <img src="${asset('brand/noveris-lockup-dark.svg')}" style="height:110px">
        <h1 style="font-size:84px;line-height:1.05;margin-top:44px">Learn Together.<br><span class="grad">Grow Further.</span></h1>
        <p class="muted" style="font-size:34px;line-height:1.4;margin-top:34px;max-width:900px">${esc(subtitle)}</p>
        ${note ? `<p style="font-size:24px;margin-top:40px;color:#8f89b3">${esc(note)}</p>` : ''}
      </div>
    </div></body>`,
  chapter: ({ kicker, title, subtitle }) => `<body class="bg" style="display:flex;flex-direction:column;justify-content:center;padding:0 200px">
    <p class="kicker">${esc(kicker)}</p>
    <h2 style="font-size:96px;line-height:1.05;margin-top:30px">${esc(title)}</h2>
    ${subtitle ? `<p class="muted" style="font-size:36px;line-height:1.4;margin-top:30px;max-width:1300px">${esc(subtitle)}</p>` : ''}
    <img src="${asset('brand/noveris-symbol.svg')}" style="position:absolute;right:120px;bottom:100px;height:90px;opacity:.85"></body>`,
  outro: ({ points }) => `<body class="bg" style="display:flex;align-items:center;padding:0 170px;gap:100px">
    <div style="flex:1">
      <img src="${asset('brand/noveris-lockup-dark.svg')}" style="height:96px">
      <h1 style="font-size:76px;line-height:1.08;margin-top:40px">Learn Together.<br><span class="grad">Grow Further.</span></h1>
      <ul style="list-style:none;padding:0;margin-top:46px;display:grid;gap:18px">
        ${points.map((p) => `<li style="font-size:30px;display:flex;gap:18px;align-items:center"><span style="width:12px;height:12px;border-radius:50%;background:#8b5cf6;flex:none"></span>${esc(p)}</li>`).join('')}
      </ul>
    </div>
    <img src="${asset('images/nardouch-graduate-transparent.png')}" style="height:620px"></body>`,
  caption: ({ text }) => `<body style="background:transparent">
    <div style="position:absolute;left:50%;bottom:42px;transform:translateX(-50%);max-width:1560px;width:max-content;
      background:rgba(15,10,40,.9);border:1.5px solid rgba(167,139,250,.75);border-radius:18px;padding:16px 34px;
      font:600 34px/1.3 Inter,Arial,sans-serif;color:#fff;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.5)">${esc(text)}</div></body>`,
  split: ({ left, right }) => `<body class="bg">
    ${[left, right].map((label, i) => `<div style="position:absolute;top:26px;left:${i ? 976 : 16}px;width:928px;display:flex;align-items:center;gap:14px;font:600 26px/1 Inter">
      <span style="width:12px;height:12px;border-radius:50%;background:#34d399"></span>${esc(label)}</div>`).join('')}
    ${[16, 976].map((x) => `<div style="position:absolute;top:70px;left:${x - 2}px;width:932px;height:820px;border-radius:14px;border:2px solid rgba(167,139,250,.45)"></div>`).join('')}
  </body>`,
};

/** Renders cards: [{ file, kind, ...props }]. */
export async function renderCards(cards, dir) {
  mkdirSync(dir, { recursive: true });
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const card of cards) {
    const html = path.join(dir, `${path.basename(card.file, '.png')}.html`);
    writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>${base}</style></head>${templates[card.kind](card)}</html>`);
    await page.goto(pathToFileURL(html).href);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    await page.screenshot({ path: card.file, omitBackground: card.kind === 'caption' });
  }
  await browser.close();
}
