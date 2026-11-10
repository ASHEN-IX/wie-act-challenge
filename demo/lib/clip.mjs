// Frames (variable rate, wall-clock stamped) -> constant 30 fps clip aligned to a given origin.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const FPS = 30;

export function ffmpeg(args) {
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
}

export function duration(file) {
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString());
}

/**
 * Builds `out` from a PageRecorder directory. The first frame is held from `origin`
 * (seconds, epoch) and the last one until `end`, so several pages share one time axis.
 */
export function framesToClip(dir, out, { origin, end, width = 1920, height = 1080 } = {}) {
  const { frames, end: recEnd } = JSON.parse(readFileSync(path.join(dir, 'frames.json'), 'utf8'));
  if (!frames.length) throw new Error(`no frames in ${dir}`);
  const start = origin ?? frames[0].t;
  const stop = end ?? recEnd;
  const lines = [];
  frames.forEach((f, i) => {
    const from = i === 0 ? start : f.t;
    const to = i + 1 < frames.length ? frames[i + 1].t : stop;
    if (to <= from) return;
    lines.push(`file 'frames/${f.file}'`, `duration ${(to - from).toFixed(4)}`);
  });
  lines.push(`file 'frames/${frames.at(-1).file}'`); // concat demuxer needs the last file twice
  const list = path.join(dir, 'frames.txt');
  writeFileSync(list, lines.join('\n'));
  ffmpeg([
    '-f', 'concat', '-safe', '0', '-i', list,
    '-vf', `scale=${width}:${height}:flags=lanczos:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x0b0d1f,fps=${FPS},format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', out,
  ]);
}
