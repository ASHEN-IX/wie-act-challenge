// Turns recorded takes into finished videos: paces each section, overlays captions, adds
// title/chapter cards and joins everything. Usage: node demo/edit.mjs [master|short ...]
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { root } from './lib/app.mjs';
import { FPS, duration, ffmpeg, framesToClip } from './lib/clip.mjs';
import { BG, renderCards } from './lib/cards.mjs';
import { CHAPTERS, CUTS, OUTRO, TITLE } from './storyboard.mjs';

const takes = path.join(root, 'demo/output/takes');
const work = path.join(root, 'demo/output/work');
const out = path.join(root, 'demo/output');
const wanted = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const cuts = wanted.length ? wanted : Object.keys(CUTS);
const ENC = ['-c:v', 'libx264', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-r', String(FPS)];
const PANE = { w: 928, h: 816, y: 70, x: [16, 976] };
const SPLIT_LABELS = { left: 'Tasnim · browser 1 (presenter)', right: 'Aziz · browser 2' };

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
const sceneTimeline = (scene) => JSON.parse(readFileSync(path.join(takes, scene, 'timeline.json'), 'utf8'));
const firstFrame = (scene, track) => JSON.parse(readFileSync(path.join(takes, scene, track, 'frames.json'), 'utf8')).frames[0].t;

/** One continuous 1080p clip per scene (side by side for two-user scenes), cached. */
function sceneClip(scene) {
  const tl = sceneTimeline(scene);
  const dir = path.join(work, 'scenes', scene);
  const file = path.join(dir, 'raw.mp4');
  const origin = Math.min(...tl.tracks.map((t) => firstFrame(scene, t)));
  const fresh = existsSync(file) && statSync(file).mtimeMs > statSync(path.join(takes, scene, 'timeline.json')).mtimeMs;
  if (fresh) return { file, origin, tl };
  mkdirSync(dir, { recursive: true });
  if (tl.tracks.length === 2) {
    const [a, b] = tl.tracks;
    for (const t of tl.tracks)
      framesToClip(path.join(takes, scene, t), path.join(dir, `${t}.mp4`), { origin, end: tl.end, width: PANE.w, height: PANE.h });
    const bg = path.join(work, 'cards', 'split.png');
    ffmpeg([
      '-loop', '1', '-i', bg, '-i', path.join(dir, `${a}.mp4`), '-i', path.join(dir, `${b}.mp4`),
      '-filter_complex', `[0][1]overlay=${PANE.x[0]}:${PANE.y}:shortest=1[l];[l][2]overlay=${PANE.x[1]}:${PANE.y}:shortest=1,format=yuv420p[v]`,
      '-map', '[v]', ...ENC, '-crf', '14', file,
    ]);
  } else {
    framesToClip(path.join(takes, scene, tl.tracks[0]), file, { origin, end: tl.end });
  }
  return { file, origin, tl };
}

/** Splits a scene into pieces of constant (section, speed, caption). */
function pieces(scene, origin, tl) {
  const out = [];
  let state = { section: null, speed: 1, caption: null };
  let from = 0;
  const end = tl.end - origin;
  const push = (to) => {
    if (to - from > 0.05 && state.section) out.push({ scene, ...state, from, to });
    from = to;
  };
  for (const e of [...tl.events].sort((x, y) => x.t - y.t)) {
    const t = Math.max(0, e.t - origin);
    push(t);
    state = { ...state, [e.type]: e.value };
  }
  push(end);
  return out;
}

async function main() {
  mkdirSync(path.join(work, 'cards'), { recursive: true });
  mkdirSync(path.join(work, 'captions'), { recursive: true });
  // Cards and caption overlays.
  const cards = [
    { file: path.join(work, 'cards', 'title.png'), kind: 'title', ...TITLE },
    { file: path.join(work, 'cards', 'outro.png'), kind: 'outro', ...OUTRO },
    { file: path.join(work, 'cards', 'split.png'), kind: 'split', ...SPLIT_LABELS },
    ...Object.entries(CHAPTERS).map(([scene, c]) => ({ file: path.join(work, 'cards', `chapter-${scene}.png`), kind: 'chapter', ...c })),
  ];
  const captions = new Set();
  for (const name of cuts)
    for (const { scene } of CUTS[name].scenes)
      for (const e of sceneTimeline(scene).events) if (e.type === 'caption' && e.value) captions.add(e.value);
  for (const text of captions) cards.push({ file: path.join(work, 'captions', `${slug(text)}.png`), kind: 'caption', text });
  await renderCards(cards, path.join(work, 'html'));

  for (const name of cuts) {
    const cut = CUTS[name];
    const dir = path.join(work, name);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const list = [];
    let n = 0;
    let voiceCue;
    const still = (png, seconds) => {
      const file = path.join(dir, `${String(n++).padStart(3, '0')}-card.mp4`);
      const fade = Math.min(0.4, seconds / 4);
      ffmpeg(['-loop', '1', '-t', String(seconds), '-i', png,
        '-vf', `fps=${FPS},fade=t=in:d=${fade}:color=${BG},fade=t=out:st=${seconds - fade}:d=${fade}:color=${BG},format=yuv420p`,
        ...ENC, '-crf', '12', file]);
      list.push(file);
    };
    still(path.join(work, 'cards', 'title.png'), cut.titleSeconds ?? 4);
    for (const spec of cut.scenes) {
      const { file, origin, tl } = sceneClip(spec.scene);
      if (cut.chapters && CHAPTERS[spec.scene]) still(path.join(work, 'cards', `chapter-${spec.scene}.png`), 2.2);
      const kept = pieces(spec.scene, origin, tl).filter((p) => !spec.sections || spec.sections.includes(p.section));
      kept.forEach((p, i) => {
        const speed = p.speed * (spec.speed ?? 1) * (spec.sectionSpeed?.[p.section] ?? 1);
        const length = (p.to - p.from) / speed;
        if (length < 0.08) return;
        const target = path.join(dir, `${String(n++).padStart(3, '0')}-${spec.scene}-${p.section}.mp4`);
        const fades = [];
        if (i === 0) fades.push(`fade=t=in:d=0.35:color=${BG}`);
        if (i === kept.length - 1) fades.push(`fade=t=out:st=${Math.max(0, length - 0.35)}:d=0.35:color=${BG}`);
        const pace = `setpts=(PTS-STARTPTS)/${speed},fps=${FPS}`;
        const finish = [...fades, 'format=yuv420p'].join(','); // fades last, so captions fade too
        const args = ['-ss', p.from.toFixed(3), '-to', p.to.toFixed(3), '-i', file];
        if (p.caption) {
          args.push('-i', path.join(work, 'captions', `${slug(p.caption)}.png`),
            '-filter_complex', `[0:v]${pace}[v];[v][1]overlay=0:0,${finish}[o]`, '-map', '[o]');
        } else {
          args.push('-vf', `${pace},${finish}`);
        }
        ffmpeg([...args, '-t', length.toFixed(3), '-an', ...ENC, '-crf', '12', target]);
        if (p.section === spec.voiceSection) {
          if (speed !== 1 || voiceCue) throw new Error('Expected one voice section at its recorded speed');
          voiceCue = { index: list.length, file: path.join(takes, spec.scene, 'voice.mp3') };
        }
        list.push(target);
      });
    }
    still(path.join(work, 'cards', 'outro.png'), cut.outroSeconds ?? 5);
    const concat = path.join(dir, 'list.txt');
    writeFileSync(concat, list.map((f) => `file '${f}'`).join('\n'));
    const final = path.join(out, cut.file);
    const picture = voiceCue ? path.join(dir, 'picture.mp4') : final;
    ffmpeg(['-f', 'concat', '-safe', '0', '-i', concat, ...ENC, '-crf', String(cut.crf ?? 16), '-movflags', '+faststart', picture]);
    if (voiceCue) {
      const offsetMs = Math.round(list.slice(0, voiceCue.index).reduce((t, file) => t + duration(file), 0) * 1000);
      ffmpeg(['-i', picture, '-i', voiceCue.file, '-map', '0:v:0', '-map', '1:a:0',
        '-af', `adelay=${offsetMs}:all=1,apad`, '-c:v', 'copy', '-c:a', 'aac',
        '-b:a', '128k', '-shortest', '-movflags', '+faststart', final]);
    }
    const seconds = duration(final);
    const over = cut.maxSeconds && seconds > cut.maxSeconds ? `  ⚠ over the ${cut.maxSeconds} s limit` : '';
    console.log(`${name}: ${path.relative(root, final)} ${seconds.toFixed(1)} s${over}`);
  }
}

await main();
