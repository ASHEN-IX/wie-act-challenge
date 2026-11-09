// Isolate Next's generated files and hot reload from an active IDE/dev server.
import { cp, mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const authOnly = process.argv.includes('--auth');
if (!authOnly && !process.env.P0R2_PYTHON) throw new Error('P0R2_PYTHON must select the locked test interpreter');
const source = path.join(root, 'apps/web');
await mkdir(path.join(root, '.cache'), { recursive: true });
const copy = await mkdtemp(path.join(root, '.cache/ednova-browser-'));
let runningChild, interrupted = false, killTimer;
function interrupt(signal) {
  interrupted = true;
  if (!runningChild?.pid) return;
  const send = (value) => {
    try {
      if (process.platform === 'win32') runningChild.kill(value);
      else process.kill(-runningChild.pid, value);
    } catch { /* Process group already exited. */ }
  };
  send(signal);
  killTimer = setTimeout(() => send('SIGKILL'), 8000);
  killTimer.unref();
}
const onInterrupt = () => interrupt('SIGINT'), onTerminate = () => interrupt('SIGTERM');
process.on('SIGINT', onInterrupt);
process.on('SIGTERM', onTerminate);
try {
  const copied = [];
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.isDirectory() && ['src', 'public'].includes(entry.name)) {
      await cp(path.join(source, entry.name), path.join(copy, entry.name), { recursive: true });
    } else if (entry.isFile() && /\.(json|mjs|js|ts)$/.test(entry.name) &&
      !entry.name.startsWith('.') && entry.name !== 'next-env.d.ts' &&
      entry.name !== 'playwright.config.ts' && entry.name !== 'vitest.config.ts') {
      await cp(path.join(source, entry.name), path.join(copy, entry.name));
    }
  }
  // Resolve dependencies from the existing locked installation; no install or
  // environment/credential file is copied into the disposable application.
  // A symlink for the entire node_modules directory confuses CSS package
  // resolution in relocated pnpm projects. Link each real package instead.
  const modules = path.join(source, 'node_modules'), copyModules = path.join(copy, 'node_modules');
  await mkdir(copyModules);
  const manifest = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
  for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })) {
    const to = path.join(copyModules, name);
    await mkdir(path.dirname(to), { recursive: true });
    await symlink(await realpath(path.join(modules, name)), to);
  }
  await mkdir(path.join(copyModules, '.bin'));
  await symlink(await realpath(path.join(modules, '.bin/next')), path.join(copyModules, '.bin/next'));
  async function inventory(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const filename = path.join(directory, entry.name), name = path.join(prefix, entry.name);
      if (entry.isDirectory()) await inventory(filename, name);
      else if (entry.isFile()) copied.push({ path: name, sha256: createHash('sha256').update(await readFile(filename)).digest('hex') });
    }
  }
  await inventory(copy);
  copied.sort((a, b) => a.path.localeCompare(b.path));
  const evidence = path.resolve((authOnly ? process.env.AUTH_E2E_EVIDENCE_DIR : process.env.P0R3_EVIDENCE_DIR) || path.join(root, authOnly ? 'reports/evidence/ednova-auth-browser' : 'reports/evidence/ednova-p0-r3'));
  await mkdir(evidence, { recursive: true });
  await writeFile(path.join(evidence, 'browser-source-copy.json'), JSON.stringify({
    capturedAt: new Date().toISOString(), source, disposableCopy: copy,
    sourceDigest: createHash('sha256').update(JSON.stringify(copied)).digest('hex'), files: copied
  }, null, 2) + '\n');
  const command = authOnly ? ['--filter', 'web', 'test:auth:e2e'] : ['--filter', 'api', 'exec', 'tsx', '--tsconfig', 'tsconfig.json', '../../apps/web/e2e/p0r3-integrated-learning.test.ts'];
  if (interrupted) process.exitCode = 130;
  else {
    runningChild = spawn('pnpm', command, {
      cwd: root, stdio: 'inherit', detached: process.platform !== 'win32',
      env: { ...process.env, P0R3_WEB_DIR: copy, AUTH_E2E_WEB_DIR: copy, EDNOVA_NEXT_DIST_DIR: '.next' }
    });
    const code = await new Promise((resolve, reject) => {
      runningChild.once('error', reject);
      runningChild.once('exit', (value) => resolve(value ?? 1));
    });
    process.exitCode = interrupted ? 130 : code;
  }
} finally {
  clearTimeout(killTimer);
  process.off('SIGINT', onInterrupt);
  process.off('SIGTERM', onTerminate);
  await rm(copy, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
