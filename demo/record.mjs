// Records demo scenes into demo/output/takes/<scene>/ (frames + timeline). Edit with demo/edit.mjs.
// Usage: node demo/record.mjs [scene ...] [--headed]      (no scene = all, in storyboard order)
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { launch, root } from './lib/app.mjs';
import { PageRecorder, Timeline } from './lib/recorder.mjs';
import { SCENES } from './scenes/index.mjs';

const args = process.argv.slice(2);
const headed = args.includes('--headed');
const wanted = args.filter((a) => !a.startsWith('--'));
const unknown = wanted.filter((name) => !SCENES[name]);
if (unknown.length) {
  console.error(`unknown scene(s): ${unknown.join(', ')}. Known: ${Object.keys(SCENES).join(', ')}`);
  process.exit(2);
}
const names = wanted.length ? wanted : Object.keys(SCENES);
// The API allows 100 requests per user per minute; automated scenes back to back can exceed it.
const COOLDOWN_MS = Number(process.env.DEMO_COOLDOWN ?? 45) * 1000;
const browser = await launch({ headed });
let failed = 0;

for (const [index, name] of names.entries()) {
  if (index > 0 && COOLDOWN_MS) await new Promise((r) => setTimeout(r, COOLDOWN_MS));
  const dir = path.join(root, 'demo/output/takes', name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(path.join(dir, 'checks'), { recursive: true });
  const tl = new Timeline(dir);
  const recorders = [];
  const pages = [];
  const started = Date.now();
  const ctx = {
    browser,
    tl,
    /** Starts capturing a page; `id` names its track (e.g. "learner", "peer"). */
    async record(page, id) {
      const rec = new PageRecorder(page, path.join(dir, id));
      await rec.start();
      recorders.push({ id, rec });
      pages.push(page);
      return rec;
    },
    /** Debug screenshot of the current state (not part of the video). */
    async check(page, label) {
      await page.screenshot({ path: path.join(dir, 'checks', `${label}.png`) }).catch(() => {});
    },
    log: (msg) => console.log(`  [${name} ${((Date.now() - started) / 1000).toFixed(1)}s] ${msg}`),
  };
  console.log(`▶ ${name}`);
  try {
    await SCENES[name](ctx);
  } catch (error) {
    failed++;
    console.error(`✖ ${name}: ${error.message.split('\n')[0]}`);
    for (const [i, page] of pages.entries()) await ctx.check(page, `failure-${i}`);
  } finally {
    for (const { rec } of recorders) await rec.stop();
    tl.save({ tracks: recorders.map((r) => r.id) }); // two tracks = side-by-side scene
    for (const page of pages) await page.context().close().catch(() => {});
  }
  console.log(`  ${name}: ${((Date.now() - started) / 1000).toFixed(0)} s recorded`);
}
await browser.close();
process.exit(failed ? 1 : 0);
