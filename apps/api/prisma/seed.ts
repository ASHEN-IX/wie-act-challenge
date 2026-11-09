/**
 * Prisma seed entry point (`prisma db seed`).
 *
 * The demo datasets are maintained as individual scripts under `seeds/` so they
 * can be run alone. This wires the safe baseline (users and rank badges) into
 * the Prisma lifecycle without duplicating their content.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(__dirname, '..');

function run(script: string, args: string[] = []): void {
  execFileSync(process.execPath, ['--import', 'tsx', path.join(root, 'seeds', script), ...args], {
    cwd: root,
    stdio: 'inherit',
    env: process.env
  });
}

if (process.env.NODE_ENV === 'production') {
  console.error('[seed] Refusing to seed a production database.');
  process.exit(1);
}

run('rank-badges.seed.ts');
run('demo-users.seed.ts');
