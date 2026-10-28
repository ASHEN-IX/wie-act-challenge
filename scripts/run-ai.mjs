import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';
const cwd = fileURLToPath(new URL('../apps/ai/', import.meta.url));
const envFile = path.join(cwd, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const workers = ['ingestion', 'planner', 'schedule', 'coach', 'evaluator', 'search'];
const [mode, worker] = process.argv.slice(2);
if (mode && (mode !== 'worker' || !workers.includes(worker))) {
  console.error(`Usage: pnpm dev:ai OR pnpm dev:worker <${workers.join('|')}>`);
  process.exit(1);
}
const python = process.env.EDNOVA_AI_PYTHON;
const moduleArgs = mode === 'worker'
  ? ['-m', `workers.${worker}_worker`]
  : ['-m', 'uvicorn', 'services.api.main:app', '--host', '127.0.0.1', '--port', '8000'];
const child = spawn(python || 'poetry', python ? moduleArgs : ['run', 'python', ...moduleArgs], { cwd, env: process.env, stdio: 'inherit' });
child.on('error', () => { console.error('Could not launch Python. Install Poetry and locked dependencies, or set EDNOVA_AI_PYTHON to a compatible prepared environment.'); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
