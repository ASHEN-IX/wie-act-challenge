/** Builds the Noveris Brand Book (HTML -> A4 landscape PDF). Run from the repo root: node design/brandbook/build.mjs */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {color as c, type as t, stages} from '../tokens.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../..');
const require = createRequire(import.meta.url);
const pw = require(path.join(root, 'node_modules/.pnpm/playwright-core@1.63.0/node_modules/playwright-core'));
const chrome = process.env.CHROME_PATH || path.join(process.env.HOME, '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome');
const out = path.join(root, 'output/pdf/Noveris-Brand-Book.pdf');
const ex3 = '../exports-3x/', pub = '../../apps/web/public/';
const symbol = `${pub}brand/noveris-symbol.svg`;

// Text colour that stays readable on a swatch.
const ink = hex => { const n = parseInt(hex.slice(1), 16), l = (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; return l > 0.6 ? c.ink : '#fff'; };

let n = 0;
const page = (section, body, {theme = 'dark', cls = ''} = {}) => {
  n++;
  return `<section class="page ${theme} ${cls}"><header><span><img src="${symbol}">NOVERIS BRAND BOOK</span><span>${section}</span></header><main>${body}</main><footer><span>LEARN TOGETHER. GROW FURTHER.</span><span class="num">${String(n).padStart(2, '0')}</span></footer></section>`;
};
const opener = (num, title, intro, art) => page(`${num} / ${title.toUpperCase()}`, `<div class="opener"><div class="big">${num}</div><div class="otext"><h1>${title}</h1><p>${intro}</p></div>${art}</div>`, {cls: 'openerpage'});
const title = (eyebrow, h, p = '') => `<div class="title"><small>${eyebrow}</small><h2>${h}</h2>${p ? `<p>${p}</p>` : ''}</div>`;

const pages = [];

// Cover
pages.push(`<section class="page dark cover"><div class="glow g1"></div><div class="glow g2"></div><img class="cmark" src="${symbol}"><div class="ctext"><img class="clock" src="${pub}brand/noveris-lockup-dark.svg"><h1>Brand<br>book<em>.</em></h1><p>Learn together.<br><span>Grow further.</span></p></div><div class="cmeta"><span>VISUAL IDENTITY SYSTEM</span><span>STARTUP EDITION · 2026</span></div></section>`);
n++;

// Manifesto
pages.push(page('MANIFESTO', `<div class="manifesto"><small>WHY WE EXIST</small><h1>Technology should bring <em>learning closer.</em></h1><div class="values">${[['01', 'Clarity', 'Make complex ideas easier to approach.', c.violetSoft], ['02', 'Connection', 'Keep peers part of the learning process.', c.cyan], ['03', 'Curiosity', 'Support questions, exploration and practice.', c.pink]].map(([k, h, p, col]) => `<div><b style="color:${col}">${k}</b><h3>${h}</h3><p>${p}</p></div>`).join('')}</div></div>`));

// Contents
const toc = [['01', 'Brand', 'Positioning, voice, claims'], ['02', 'Identity', 'Mark, lockups, clear space, misuse'], ['03', 'Foundations', 'Colour, typography, grid'], ['04', 'System', 'Components and Nardouch'], ['05', 'Applications', 'Feed, badges, flyer, stickers, posters'], ['06', 'Handoff', 'Sources, scripts, formats']];
pages.push(page('CONTENTS', `<div class="toc"><div class="tocl"><small>CONTENTS</small><h2>Everything Noveris needs to look like Noveris.</h2><img src="${pub}images/nardouch-learner-transparent.png"></div><ol>${toc.map(([k, h, p]) => `<li><b>${k}</b><div><h3>${h}</h3><p>${p}</p></div></li>`).join('')}</ol></div>`));

// 01 Brand
pages.push(opener('01', 'Brand', 'Noveris is an AI-powered peer learning companion. It brings course material, guided practice and peer discussion into one connected learning experience.', `<img class="oart" src="${pub}images/nardouch-explorer-transparent.png">`));
pages.push(page('01 / BRAND', `${title('POSITIONING & VOICE', 'A capable study partner.', 'Clear, encouraging and grounded in the work learners actually do.')}
<div class="g3">${[['Make learning social', 'Peers explain ideas, compare approaches and solve problems together.'], ['Guide with questions', 'Nardouch offers a hint or a question before a full explanation.'], ['Show real progress', 'Progress reflects completed work. Examples are labelled as illustrative.']].map(([h, p], i) => `<div class="tile"><b>0${i + 1}</b><h3>${h}</h3><p>${p}</p></div>`).join('')}</div>
<div class="g2b"><div class="quote"><small>VOICE IN PRACTICE</small><p>“What have you tried so far? Compare your approach with a peer.”</p></div><div class="rules"><div class="okr"><small>WE SAY</small><p>Direct verbs. One clear next step. English, French and Darija, with room for code-switching.</p></div><div class="nor"><small>WE NEVER</small><p>Invent customers, results, partnerships, prices or release dates.</p></div></div></div>`, {theme: 'light'}));

// 02 Identity
pages.push(opener('02', 'Identity', 'A continuous N stroke rises toward a star, with an orbit crossing the mark. The wordmark is set in Sora Bold.', `<img class="oart mark" src="${symbol}">`));
pages.push(page('02 / IDENTITY', `${title('THE MARK', 'One mark, four ways to use it.')}
<div class="logos"><div class="lg hero"><img src="${pub}brand/noveris-lockup-dark.svg"><small>Primary lockup · dark grounds</small></div><div class="lg white"><img src="${pub}brand/noveris-lockup-light.svg"><small>Light grounds</small></div><div class="lg vio"><img src="${pub}brand/noveris-lockup-monochrome.svg"><small>One colour</small></div><div class="lg sym"><img src="${symbol}"><small>Symbol · app icon, avatar, sticker</small></div></div>`));
const misuse = [['Stretched', 'transform:scaleX(1.5)'], ['Recoloured', 'filter:hue-rotate(140deg)'], ['Effects added', 'filter:drop-shadow(6px 6px 0 #FF7AB8)'], ['Rotated', 'transform:rotate(-25deg)']];
pages.push(page('02 / IDENTITY', `${title('CLEAR SPACE & MISUSE', 'Give the mark room.', 'Keep at least half the symbol height clear on every side. Minimum size: 24 px digital, 12 mm print.')}
<div class="clearrow"><div class="clear"><div class="zone"><img src="${symbol}"><i class="t">½H</i><i class="l">½H</i></div><small>CLEAR SPACE</small></div><div class="mis">${misuse.map(([h, s]) => `<div><div class="mi"><img src="${symbol}" style="${s}"><span>✕</span></div><small>${h}</small></div>`).join('')}</div></div>`, {theme: 'light'}));

// 03 Foundations
pages.push(opener('03', 'Foundations', 'Colour, type and space are shared by the product, the feed and print. Every value comes from design/tokens.mjs.', `<svg class="oart" viewBox="0 0 120 130">${[c.violetLight, c.violet, c.cyan, c.amber, c.pink].map((x, i) => `<rect x="${i * 24}" y="${i % 2 ? 0 : 22}" width="18" height="${i % 2 ? 130 : 108}" rx="9" fill="${x}"/>`).join('')}</svg>`));
const palette = [['Night', c.night], ['Navy', c.navy], ['Ink', c.ink], ['White', c.white], ['Violet', c.violet], ['Violet Soft', c.violetSoft], ['Violet Light', c.violetLight], ['Cyan', c.cyan], ['Cyan Soft', c.cyanSoft], ['Amber', c.amber], ['Pink', c.pink], ['Rose', c.rose]];
pages.push(page('03 / FOUNDATIONS', `${title('COLOUR', 'Colour with a purpose.', 'Night and Ink anchor the system. Violet carries identity and action; cyan, amber and pink mark progress and stages.')}
<div class="pal">${palette.map(([h, x]) => `<div style="background:${x};color:${ink(x)}"><b>${h}</b><span>${x}</span></div>`).join('')}</div>
<div class="grads">${[['Orbit', 'Mark, headline emphasis, progress', 'linear-gradient(120deg,#BC96FF,#7B3FF2,#06D6FF)'], ['Action', 'CTA bars, buttons, badges', 'linear-gradient(120deg,#7B3FF2,#4B22B5)'], ['Divider', 'Active rules and progress', 'linear-gradient(120deg,#BC64FF,#40E4FA)']].map(([h, p, g]) => `<div style="background:${g}"><b>${h}</b><span>${p}</span></div>`).join('')}</div>`));
pages.push(page('03 / FOUNDATIONS', `${title('COLOUR IN CONTEXT', 'Same roles, two themes.', 'Assign tokens by role so dark and light keep the same hierarchy.')}
<div class="themes"><div class="th dk"><small>DARK / MARKETING</small><h3>Learn together.</h3><p>Body copy #B9BEDB on #0B0E28 · 10.34:1</p><div class="btn">Explore Noveris ↗</div></div><div class="th lt"><small>LIGHT / PRODUCT</small><h3>Course resources</h3><p>Muted #616682 on #F6F5FF · 5.21:1</p><div class="btn">Open course ↗</div></div>
<table>${[['Background', c.night, c.lBg], ['Foreground', c.white, c.lFg], ['Card', c.card, c.lCard], ['Secondary', c.secondary, c.lSecondary], ['Muted text', c.mutedFg, c.lMutedFg], ['Primary', c.violet, c.lPrimary]].map(([r, d, l]) => `<tr><td>${r}</td><td><i style="background:${d}"></i>${d}</td><td><i style="background:${l}"></i>${l}</td></tr>`).join('')}</table></div>`));
pages.push(page('03 / FOUNDATIONS', `${title('TYPOGRAPHY', 'Two voices, one hierarchy.')}
<div class="type"><div class="spec"><div class="aa sora">Aa</div><div><h3>Sora</h3><p>Headlines, numerals, labels on posts. Bold and ExtraBold, tight tracking.</p><div class="glyph sora">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>abcdefghijklmnopqrstuvwxyz 0123456789</div></div></div><div class="spec"><div class="aa inter">Aa</div><div><h3>Inter</h3><p>Body copy, interface text and production notes. Regular to Bold.</p><div class="glyph inter">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>abcdefghijklmnopqrstuvwxyz 0123456789</div></div></div></div>
<div class="scale">${['display', 'h1', 'h2', 'h3', 'lead', 'body'].map(k => { const v = t[k]; return `<div><small>${k.toUpperCase()} · ${v.size}px · ${v.style}</small><span style="font-family:${v.family};font-weight:${/Extra/.test(v.style) ? 800 : /Semi/.test(v.style) ? 600 : /Bold/.test(v.style) ? 700 : 400};font-size:${Math.max(9, v.size * 0.32)}pt">Learn together.</span></div>`; }).join('')}</div>`));
pages.push(page('03 / FOUNDATIONS', `${title('LAYOUT & SURFACES', 'Build on a grid.', 'Posts use a 64 px margin on a 1080 px canvas; reference boards use 72 px margins and 12 columns.')}
<div class="gridvis">${Array.from({length: 12}, (_, i) => `<i>${String(i + 1).padStart(2, '0')}</i>`).join('')}</div>
<div class="g3">${[['Spacing', [4, 8, 12, 16, 24, 32, 48, 64, 96, 120].map(x => `<span>${x}</span>`).join('')], ['Radius', [8, 12, 16, 22, 28, 36].map(x => `<span style="border-radius:${x / 3}px">${x}</span>`).join('') + '<span style="border-radius:99px">pill</span>'], ['Atmosphere', '<p>Violet glow top-right, cyan glow bottom-left. Never behind small text. Elevation stays violet-tinted.</p>']].map(([h, b]) => `<div class="tile"><h3>${h}</h3><div class="chips">${b}</div></div>`).join('')}</div>`));

// 04 System
pages.push(page('04 / SYSTEM', `${title('COMPONENTS', 'One action leads.', 'One primary action per surface. Chips describe, cards group, numerals sequence.')}
<div class="comps"><div class="cta"><span>Explore the course-to-practice workflow.</span><i>↗</i></div>
<div class="row">${['Hints', 'A clearer next step.', 'Questions', 'Examples', 'A way forward'].map((x, i) => `<span class="chip ${i === 1 ? 'on' : ''}">${x}</span>`).join('')}</div>
<div class="row">${[['01', 'Bring your material', c.violetSoft], ['02', 'Review the content', c.violetSoft], ['03', 'Learn and practise', c.cyan]].map(([k, h, col]) => `<div class="step"><b style="color:${col}">${k}</b><h4>${h}</h4></div>`).join('')}</div>
<div class="row"><div class="bubble">“Why does this step work?”</div><div class="tutor"><small>NARDOUCH</small>“Let’s break it down. What changes if we try a simpler example?”</div></div>
<div class="row">${[['EN', 'Let’s understand it.', c.violet], ['FR', 'Comprendre, ensemble.', '#4B22B5'], ['DAR', 'Nefhmou m3a baadhna.', '#0A7C99']].map(([k, h, bg]) => `<div class="lang"><i style="background:${bg}">${k}</i>${h}</div>`).join('')}</div></div>`));
pages.push(page('04 / SYSTEM', `${title('NARDOUCH', 'Five stages. One companion.', 'Nardouch grows with the learner. Use the stage artwork and accent that match the learner’s progress.')}
<div class="stages">${stages.map((s, i) => `<div style="--a:${s.accent}"><div class="im"><img src="${pub}images/nardouch-${s.id}-transparent.png"></div><b>0${i + 1}</b><h3>${s.name}</h3><p>${s.threshold}</p></div>`).join('')}</div><p class="foot">Keep the original transparent artwork, proportions and stage tint. Mascot art does not certify knowledge or qualifications.</p>`));

// 05 Applications
pages.push(opener('05', 'Applications', 'One system across the feed, team badges, the A5 flyer, stickers and A3 posters.', `<img class="oart post" src="assets/post-04.png">`));
pages.push(page('05 / APPLICATIONS', `${title('FEED', 'Twelve posts, one system.', 'Alternate dark and light grounds, one idea per post, always close with the call-to-action bar.')}<img class="feed" src="assets/feed-preview.png">`));
pages.push(page('05 / APPLICATIONS', `<div class="anat"><img src="assets/post-04.png"><div>${title('POST ANATOMY', '1080 × 1350, fully editable.')}<ol>${[['Header', 'Logo, wordmark and a letter-spaced topic label over a hairline rule.'], ['Headline', 'Sora Bold 84–124 px. The last line takes the accent colour.'], ['Support', 'Inter 34–40 px. Break lines by hand to avoid orphans.'], ['Content', 'One component: steps, chat, graph, chips, panels or mascot.'], ['CTA bar', 'Gradient pill with an arrow disc, then the signature line.']].map(([h, p], i) => `<li><b>${i + 1}</b><div><h4>${h}</h4><p>${p}</p></div></li>`).join('')}</ol></div></div>`));
pages.push(page('05 / APPLICATIONS', `${title('TEAM BADGES', '90 × 120 mm. One accent per person.')}<div class="shelf">${['TEAM-1-FRONT', 'TEAM-2-FRONT', 'TEAM-3-FRONT', 'SHARED-BACK'].map(k => `<img src="${ex3}04-Badges-equipe/NOVERIS-ID-${k}@3x.png">`).join('')}</div><p class="foot">Violet Soft · CEO &nbsp; Cyan Soft · CTO &nbsp; Amber · Head of Product. Replace names, titles and photos only.</p>`));
pages.push(page('05 / APPLICATIONS', `<div class="split"><div>${title('A5 FLYER', 'Front and back.', 'A framed QR call-to-action on the front; four numbered features on the back.')}</div><div class="shelf tall"><img src="${ex3}07-Flyer-A5/NOVERIS-A5-FLYER-FRONT@3x.png"><img src="${ex3}07-Flyer-A5/NOVERIS-A5-FLYER-BACK@3x.png"></div></div>`));
pages.push(page('05 / APPLICATIONS', `${title('STICKERS', 'A little curiosity, everywhere.', 'Seven die-cut designs. Rounded shapes only; magenta cut guides ship as separate SVGs.')}<div class="stk">${[1, 2, 3, 4, 5, 6, 7].map((k, i) => `<img src="${ex3}05-Stickers/NOVERIS-STICKER-0${k}@3x.png" style="transform:rotate(${[-6, 4, -3, 6, -5, 3, -4][i]}deg)">`).join('')}</div>`));
pages.push(page('05 / APPLICATIONS', `<div class="split"><div>${title('A3 POSTERS', 'Seen from across the room.', 'A large headline, a mascot or numbered steps, and a QR panel at the bottom.')}</div><div class="shelf tall"><img src="${ex3}06-Affiches-A3/NOVERIS-A3-01-BRAND@3x.png"><img src="${ex3}06-Affiches-A3/NOVERIS-A3-02-WORKFLOW@3x.png"></div></div>`));

// 06 Handoff
pages.push(page('06 / HANDOFF', `${title('HANDOFF', 'Start with the source.', 'The Figcraft file holds every template. Rebuild and export with these scripts.')}
<div class="g2b"><div class="tile"><h3>Before you export</h3><ol class="check">${['Match the frame to the channel.', 'Check logo clearance and text size at final output.', 'Replace placeholder contact details and test the QR code.', 'Confirm print profiles and cut contours with the vendor.'].map(x => `<li>${x}</li>`).join('')}</ol></div>
<div class="tile"><h3>Source & scripts</h3><dl>${[['design/design-noveris.figcraft', 'Master file'], ['design/tokens.mjs', 'Colour, type, space'], ['design/startup-posts.mjs', 'Feed posts'], ['design/print-materials.mjs', 'Badges, stickers, posters, flyer'], ['design/export-3x.mjs', '3× PNG exports'], ['design/brandbook/build.mjs', 'This book']].map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl></div></div>
<div class="formats">${[['Feed', '1080 × 1350'], ['Story', '1080 × 1920'], ['A3', '297 × 420 mm'], ['A5', '148 × 210 mm'], ['Badge', '90 × 120 mm'], ['Sticker', '600 × 600']].map(([a, b]) => `<div><small>${a}</small><b>${b}</b></div>`).join('')}</div>`, {theme: 'light'}));

// Back cover
pages.push(`<section class="page dark cover back"><div class="glow g1"></div><img class="bmark" src="${symbol}"><h2>Learn together.<br><span>Grow further.</span></h2><p>noveris.live</p></section>`);
n++;

const css = `
@page{size:297mm 210mm;margin:0}*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:297mm;height:210mm;position:relative;overflow:hidden;display:flex;flex-direction:column;padding:11mm 16mm 10mm;page-break-after:always}
.dark{background:radial-gradient(ellipse 60% 70% at 92% 0%,rgba(123,63,242,.42),transparent 70%),radial-gradient(ellipse 50% 60% at 0% 100%,rgba(6,214,255,.14),transparent 70%),${c.mBg};color:${c.mInk}}
.light{background:${c.lBg};color:${c.lFg}}
header,footer{display:flex;justify-content:space-between;align-items:center;font:700 6.5pt Inter;letter-spacing:.24em;opacity:.7}
header img{height:4mm;vertical-align:middle;margin-right:2.5mm}
main{flex:1;display:flex;flex-direction:column;justify-content:center;padding:5mm 0}
footer .num{font:800 9pt Sora;letter-spacing:0;opacity:1;color:${c.violetSoft}}.light footer .num{color:${c.lPrimary}}
small{font:700 7pt Inter;letter-spacing:.22em;text-transform:uppercase}
.title{margin-bottom:7mm;max-width:200mm}.title small{color:${c.violetSoft}}.light .title small{color:${c.lPrimary}}
.title h2{font:800 32pt/1.04 Sora;letter-spacing:-.035em;margin:2.5mm 0}.title p{font-size:11pt;line-height:1.5;opacity:.72;max-width:170mm}
h3{font:700 13pt/1.2 Sora;letter-spacing:-.01em}h4{font:700 11pt Sora}
p{font-size:9.5pt;line-height:1.5}.dark p{color:${c.mMuted}}.light p{color:${c.lMutedFg}}
em{font-style:normal;background:linear-gradient(100deg,#BC96FF,#7B3FF2 45%,#06D6FF);-webkit-background-clip:text;background-clip:text;color:transparent}
.foot{margin-top:6mm;font-size:9pt}
/* cover */
.cover{padding:0;justify-content:center}.glow{position:absolute;border-radius:50%;filter:blur(30px)}.g1{width:170mm;height:170mm;right:-30mm;top:-40mm;background:radial-gradient(circle,rgba(123,63,242,.75),transparent 65%)}.g2{width:140mm;height:140mm;left:-50mm;bottom:-70mm;background:radial-gradient(circle,rgba(6,214,255,.3),transparent 65%)}
.cmark{position:absolute;right:14mm;top:22mm;height:160mm;filter:drop-shadow(0 0 30px rgba(123,63,242,.9))}
.ctext{position:relative;padding-left:20mm}.clock{height:12mm;margin-bottom:14mm}.cover h1{font:800 104pt/.86 Sora;letter-spacing:-.05em}
.cover h1 em,.cover p span{background:linear-gradient(100deg,#BC96FF,#7B3FF2 50%,#06D6FF);-webkit-background-clip:text;background-clip:text;color:transparent}
.cover .ctext p{font:700 18pt/1.25 Sora;color:#fff;margin-top:10mm}.cmeta{position:absolute;left:20mm;right:20mm;bottom:12mm;display:flex;justify-content:space-between;font:700 7pt Inter;letter-spacing:.24em;opacity:.65}
.back{align-items:center;text-align:center}.bmark{height:46mm;margin-bottom:10mm;filter:drop-shadow(0 0 24px rgba(123,63,242,.9))}.back h2{font:800 40pt/1.05 Sora;letter-spacing:-.04em;position:relative}.back h2 span{background:linear-gradient(100deg,#BC96FF,#7B3FF2 50%,#06D6FF);-webkit-background-clip:text;background-clip:text;color:transparent}.back p{margin-top:7mm;font:700 10pt Inter;letter-spacing:.24em;color:${c.violetSoft}}
/* manifesto */
.manifesto small{color:${c.violetSoft}}.manifesto h1{font:800 54pt/1 Sora;letter-spacing:-.045em;margin:4mm 0 14mm;max-width:240mm}
.values{display:grid;grid-template-columns:repeat(3,1fr);gap:8mm;border-top:.3mm solid ${c.border};padding-top:8mm}.values b{font:800 30pt Sora;display:block;margin-bottom:2mm}.values h3{margin-bottom:1.5mm}
/* contents */
.toc{display:grid;grid-template-columns:.9fr 1.1fr;gap:12mm;align-items:center}.tocl small{color:${c.violetSoft}}.tocl h2{font:800 30pt/1.05 Sora;letter-spacing:-.035em;margin:3mm 0 4mm}.tocl img{height:72mm}
.toc ol{list-style:none}.toc li{display:flex;gap:6mm;align-items:center;padding:3.6mm 0;border-bottom:.3mm solid ${c.border}}.toc li b{font:800 22pt Sora;width:16mm;background:linear-gradient(120deg,#BC96FF,#06D6FF);-webkit-background-clip:text;background-clip:text;color:transparent}.toc li h3{font-size:14pt}
/* openers */
.openerpage main{justify-content:flex-end}.opener{position:relative;height:100%;display:flex;flex-direction:column;justify-content:flex-end}
.big{position:absolute;left:-3mm;top:7mm;font:800 230pt/.8 Sora;letter-spacing:-.06em;color:rgba(169,135,255,.32)}
.otext{position:relative;max-width:150mm;padding-bottom:4mm}.otext h1{font:800 60pt/1 Sora;letter-spacing:-.05em;margin-bottom:4mm}.otext p{font-size:12pt}
.oart{position:absolute;right:0;top:50%;transform:translateY(-55%);height:135mm;filter:drop-shadow(0 10mm 18mm rgba(0,0,0,.45))}.oart.mark{height:120mm;filter:drop-shadow(0 0 30px rgba(123,63,242,.9))}.oart.post{height:132mm;border-radius:4mm;transform:translateY(-55%) rotate(4deg)}
.oart.sws{display:flex;gap:4mm;height:130mm}.oart.sws{align-items:flex-end}.oart.sws i{width:18mm;height:100%;border-radius:9mm}.oart.sws i:nth-child(odd){height:82%}
/* tiles & grids */
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm}.g2b{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-top:5mm}
.tile{border-radius:5mm;padding:6mm;background:#fff;border:.3mm solid ${c.lBorder}}.dark .tile{background:${c.mSurfaceDeep};border-color:${c.border}}.tile b{font:800 20pt Sora;color:${c.lPrimary};display:block;margin-bottom:2mm}.tile h3{margin-bottom:2mm}
.quote{border-radius:5mm;padding:7mm;background:linear-gradient(130deg,#7B3FF2,#3A1A99);color:#fff}.quote small{opacity:.75}.quote p{font:700 17pt/1.3 Sora;color:#fff;margin-top:3mm}
.rules{display:grid;gap:4mm}.rules>div{border-radius:5mm;padding:5mm 6mm;background:#fff;border:.3mm solid ${c.lBorder}}.okr{border-left:2mm solid #18A56B !important}.nor{border-left:2mm solid ${c.rose} !important}.okr small{color:#18A56B}.nor small{color:${c.rose}}.rules p{margin-top:1.5mm}
/* logos */
.logos{display:grid;grid-template-columns:1.5fr 1fr;grid-template-rows:62mm 50mm;gap:5mm}.lg{border-radius:6mm;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6mm;position:relative;padding:6mm}.lg small{position:absolute;left:6mm;bottom:5mm;opacity:.7;text-transform:none;letter-spacing:.05em;font-size:8pt}
.lg.hero{grid-row:span 2;background:radial-gradient(circle at 50% 40%,rgba(123,63,242,.45),transparent 60%),${c.night};border:.3mm solid ${c.border}}.lg.hero img{width:80%}
.lg.white{background:#fff;color:${c.ink}}.lg.white img{width:72%}.lg.vio{background:${c.violet}}.lg.vio img{width:72%}.lg.sym{display:none}
/* clear space */
.clearrow{display:grid;grid-template-columns:.8fr 1.2fr;gap:8mm;align-items:center}.clear .zone{position:relative;background:${c.mBg};border-radius:6mm;height:95mm;display:grid;place-items:center}.zone img{height:42mm;outline:.5mm dashed ${c.violetSoft};outline-offset:10mm}.zone i{position:absolute;font:700 8pt Inter;color:${c.violetSoft};font-style:normal}.zone .t{top:12mm}.zone .l{left:14mm}.clear small{display:block;margin-top:3mm;color:${c.lPrimary}}
.mis{display:grid;grid-template-columns:1fr 1fr;gap:5mm}.mi{position:relative;background:#fff;border:.3mm solid ${c.lBorder};border-radius:5mm;height:42mm;display:grid;place-items:center;overflow:hidden}.mi img{height:24mm}.mi span{position:absolute;right:4mm;top:3mm;width:8mm;height:8mm;border-radius:50%;background:${c.rose};color:#fff;font:800 10pt Inter;display:grid;place-items:center}.mis small{display:block;margin-top:2mm;color:${c.lMutedFg}}
/* colour */
.pal{display:grid;grid-template-columns:repeat(6,1fr);gap:3mm}.pal div{height:34mm;border-radius:4mm;padding:4mm;display:flex;flex-direction:column;justify-content:flex-end;border:.3mm solid rgba(255,255,255,.08)}.pal b{font:700 10pt Sora}.pal span{font:500 7.5pt Inter;opacity:.8;margin-top:.5mm}
.grads{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm;margin-top:3mm}.grads div{height:24mm;border-radius:4mm;padding:4mm 5mm;display:flex;flex-direction:column;justify-content:flex-end;color:#fff}.grads b{font:700 13pt Sora}.grads span{font-size:8pt;opacity:.9}
.themes{display:grid;grid-template-columns:1fr 1fr 1.15fr;gap:5mm;align-items:stretch}.th{border-radius:6mm;padding:7mm;display:flex;flex-direction:column;gap:2mm}.th.dk{background:${c.mBg};border:.3mm solid ${c.border}}.th.lt{background:${c.lBg};color:${c.lFg}}.th.lt p{color:${c.lMutedFg}}.th small{color:${c.violetSoft}}.th.lt small{color:${c.lPrimary}}.th h3{font-size:20pt;margin-top:auto}
.btn{margin-top:4mm;align-self:flex-start;padding:3mm 6mm;border-radius:9mm;background:linear-gradient(120deg,#7B3FF2,#4B22B5);color:#fff;font:700 9pt Sora}
table{border-collapse:collapse;font-size:9pt;width:100%}td{padding:2.6mm 0;border-bottom:.3mm solid ${c.border}}td:first-child{opacity:.75}td i{display:inline-block;width:5mm;height:5mm;border-radius:1.5mm;margin-right:2mm;vertical-align:middle;border:.3mm solid rgba(255,255,255,.2)}
/* type */
.type{display:grid;grid-template-columns:1fr 1fr;gap:5mm}.spec{display:flex;gap:6mm;align-items:center;border-radius:6mm;padding:6mm;background:${c.mSurfaceDeep};border:.3mm solid ${c.border}}.aa{font-size:70pt;line-height:1;background:linear-gradient(140deg,#BC96FF,#7B3FF2 55%,#06D6FF);-webkit-background-clip:text;background-clip:text;color:transparent}.aa.sora{font-family:Sora;font-weight:800;letter-spacing:-.05em}.aa.inter{font-family:Inter;font-weight:400}.spec h3{font-size:18pt;margin-bottom:1mm}.glyph{margin-top:3mm;font-size:8pt;line-height:1.5;opacity:.75}.glyph.sora{font-family:Sora}
.scale{margin-top:5mm;display:grid;grid-template-columns:1.6fr 1fr;gap:0 10mm}.scale div{display:flex;flex-direction:column;padding:2mm 0;border-bottom:.3mm solid ${c.border}}.scale small{color:${c.violetSoft};font-size:6pt}.scale span{line-height:1.1;white-space:nowrap;overflow:hidden}
/* grid */
.gridvis{display:grid;grid-template-columns:repeat(12,1fr);gap:2.5mm;height:34mm;margin-bottom:5mm}.gridvis i{background:linear-gradient(180deg,rgba(123,63,242,.4),rgba(123,63,242,.08));border-radius:2mm;font:700 7pt Inter;font-style:normal;padding:2mm;color:${c.violetSoft}}
.chips{display:flex;flex-wrap:wrap;gap:2mm}.chips span{padding:1.5mm 3mm;border-radius:2mm;background:rgba(169,135,255,.16);color:${c.violetSoft};font:700 8pt Inter}
/* components */
.comps .cta{display:flex;justify-content:space-between;align-items:center;background:linear-gradient(120deg,#7B3FF2,#4B22B5);color:#fff;border-radius:12mm;padding:4.5mm 5mm 4.5mm 8mm;font:700 15pt Sora;margin-bottom:4mm;box-shadow:0 6mm 16mm rgba(123,63,242,.35)}.cta i{font-style:normal;background:rgba(255,255,255,.2);width:11mm;height:11mm;border-radius:50%;display:grid;place-items:center}
.row{display:flex;gap:4mm;margin-bottom:4mm}.chip{padding:2.5mm 6mm;border-radius:9mm;border:.3mm solid ${c.border};background:${c.mSurfaceDeep};font:700 10pt Sora;color:${c.violetSoft}}.chip.on{background:${c.violet};color:#fff;border-color:${c.violet}}
.step{flex:1;display:flex;gap:5mm;align-items:center;background:${c.mSurfaceDeep};border:.3mm solid ${c.border};border-radius:5mm;padding:4mm 6mm}.step b{font:800 24pt Sora}
.bubble{flex:1;background:linear-gradient(120deg,#7B3FF2,#4B22B5);border-radius:6mm;padding:6mm;font:700 13pt Sora}.tutor{flex:1.2;background:${c.mSurfaceDeep};border:.5mm solid ${c.cyan};border-radius:6mm;padding:5mm 6mm;font:700 11pt/1.35 Sora}.tutor small{display:block;color:${c.cyan};margin-bottom:1.5mm}
.lang{flex:1;background:${c.mSurfaceDeep};border:.3mm solid ${c.border};border-radius:5mm;padding:4mm;font:700 11pt Sora;display:flex;gap:3mm;align-items:center}.lang i{font:700 8pt Inter;font-style:normal;padding:2.5mm 3mm;border-radius:3mm}
/* stages */
.stages{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4mm}.stages .im{height:70mm;border-radius:6mm;display:grid;place-items:center;margin-bottom:3mm;background:radial-gradient(circle at 50% 45%,color-mix(in srgb,var(--a) 45%,transparent),transparent 68%),${c.mSurfaceDeep};border:.3mm solid ${c.border}}.stages img{height:60mm;max-width:92%;object-fit:contain}.stages b{font:800 9pt Sora;color:var(--a)}.stages h3{font-size:15pt}.stages p{font-size:8.5pt}
/* applications */
.feed{width:100%;height:120mm;object-fit:contain;filter:drop-shadow(0 8mm 16mm rgba(0,0,0,.5))}
.anat{display:grid;grid-template-columns:auto 1fr;gap:14mm;align-items:center}.anat>img{height:150mm;border-radius:4mm;box-shadow:0 10mm 24mm rgba(0,0,0,.55)}.anat ol{list-style:none}.anat li{display:flex;gap:4mm;padding:3mm 0;border-bottom:.3mm solid ${c.border}}.anat li b{width:8mm;height:8mm;flex:none;border-radius:50%;background:${c.violet};display:grid;place-items:center;font:800 9pt Sora}.anat h4{margin-bottom:.5mm}
.shelf{display:flex;gap:6mm;justify-content:center;align-items:flex-end}.shelf img{height:82mm;border-radius:2.5mm;box-shadow:0 8mm 20mm rgba(0,0,0,.55)}.shelf.tall img{height:132mm}
.split{display:grid;grid-template-columns:1fr auto;gap:8mm;align-items:center}
.stk{display:flex;flex-wrap:wrap;justify-content:center;gap:3mm 9mm;width:230mm;margin:0 auto}.stk img{width:48mm;filter:drop-shadow(0 4mm 8mm rgba(0,0,0,.5))}
/* handoff */
.check{list-style:none;counter-reset:k}.check li{counter-increment:k;padding:2.4mm 0 2.4mm 9mm;position:relative;font-size:9.5pt;color:${c.lMutedFg};border-bottom:.3mm solid ${c.lBorder}}.check li:before{content:counter(k);position:absolute;left:0;width:6mm;height:6mm;border-radius:50%;background:${c.lPrimary};color:#fff;font:800 7.5pt Sora;display:grid;place-items:center}
dl{display:grid;grid-template-columns:auto 1fr;gap:1.8mm 5mm;font-size:8.5pt}dt{font-family:ui-monospace,monospace;color:${c.lPrimary}}dd{color:${c.lMutedFg}}
.formats{display:grid;grid-template-columns:repeat(6,1fr);gap:3mm;margin-top:5mm}.formats div{background:${c.mBg};color:#fff;border-radius:4mm;padding:4mm}.formats small{color:${c.violetSoft};font-size:6pt}.formats b{display:block;font:700 10pt Sora;margin-top:1mm}
`;
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Noveris Brand Book</title><style>${css}</style></head><body>${pages.join('')}</body></html>`;
fs.writeFileSync(path.join(dir, 'brand-book.html'), html);
const browser = await pw.chromium.launch({executablePath: chrome});
const pg = await browser.newPage();
await pg.goto(pathToFileURL(path.join(dir, 'brand-book.html')).href, {waitUntil: 'networkidle'});
await pg.evaluate(() => document.fonts.ready);
fs.mkdirSync(path.dirname(out), {recursive: true});
await pg.pdf({path: out, preferCSSPageSize: true, printBackground: true});
await browser.close();
console.log(`Brand book: ${n} pages -> ${out}`);
