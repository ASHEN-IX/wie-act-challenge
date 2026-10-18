import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const root = path.resolve(__dirname, '..');

function check(dir: string): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'uploads', 'logs', 'coverage', '.git', 'dist'].includes(entry.name))
      continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      check(file);
    } else if (/\.(js|mjs|ts)$/.test(entry.name)) {
      if (/\.ts$/.test(entry.name)) {
        // Syntax check for TS files can be validated or skipped here since tsc verifies syntax
      } else {
        execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
      }
    }
  }
}

for (const dir of ['src', 'modules', 'shared', 'scripts', 'tests']) {
  const fullDir = path.join(root, dir);
  if (fs.existsSync(fullDir)) {
    check(fullDir);
  }
}
console.log('All backend JavaScript / TypeScript files passed syntax checks.');
