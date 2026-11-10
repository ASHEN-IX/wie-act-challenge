import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';
const cwd = fileURLToPath(new URL('../apps/ai/', import.meta.url));
const envFile = path.join(cwd, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
process.env.APP_ENV ??= 'development';
const workers = ['ingestion', 'planner', 'schedule', 'coach', 'evaluator', 'search'];
const [mode, worker] = process.argv.slice(2);
if (mode && mode !== 'workers' && (mode !== 'worker' || !workers.includes(worker))) {
  console.error(`Usage: pnpm dev:ai OR pnpm dev:workers OR pnpm dev:worker <${workers.join('|')}>`);
  process.exit(1);
}
const python = process.env.EDNOVA_AI_PYTHON;
const commands = mode === 'workers'
  ? workers.map((name) => ['-m', `workers.${name}_worker`])
  : mode === 'worker'
    ? [['-m', `workers.${worker}_worker`]]
    : [['-m', 'uvicorn', 'services.api.main:app', '--host', '127.0.0.1', '--port', '8000']];
const children = commands.map((args) =>
  spawn(python || 'poetry', python ? args : ['run', 'python', ...args], {
    cwd, env: process.env, stdio: 'inherit'
  })
);
function stop(signal) {
  for (const child of children) child.kill(signal);
}
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { stopping = true; stop(signal); });
}
for (const child of children) {
  child.on('error', () => {
    console.error('Could not launch Python. Install Poetry and locked dependencies, or set EDNOVA_AI_PYTHON.');
    process.exitCode = 1;
    stopping = true;
    stop('SIGTERM');
  });
  child.on('exit', (code) => {
    if (stopping) return;
    process.exitCode = code || (children.length > 1 ? 1 : 0);
    stopping = true;
    stop('SIGTERM');
  });
}
