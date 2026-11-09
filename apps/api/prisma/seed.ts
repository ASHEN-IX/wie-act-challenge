/** One launcher for the Prisma baseline and the optional demo datasets. */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const presets: Record<string, string[]> = {
  baseline: ['rank-badges', 'demo-users'],
  demo: ['complete-demo'],
  learning: ['learning-demo'],
  'demo-course': ['demo-course'],
  phase2: ['ednova-phase2-demo'],
  analytics: ['analytics-demo']
};
const [preset = 'baseline', ...args] = process.argv.slice(2);
const scripts = Object.hasOwn(presets, preset) ? presets[preset] : undefined;

if (!scripts) {
  console.error(`Unknown seed preset "${preset}". Choose ${Object.keys(presets).join(', ')}.`);
  process.exit(1);
}
if (process.env.NODE_ENV === 'production') {
  console.error('[seed] Refusing to seed a production database.');
  process.exit(1);
}

for (const script of scripts) {
  execFileSync(process.execPath, ['--import', 'tsx', path.join(root, 'seeds', `${script}.seed.ts`), ...args], {
    cwd: root,
    stdio: 'inherit'
  });
}
