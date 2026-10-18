import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';
const cwd = fileURLToPath(new URL('../study-partner-ai/', import.meta.url));
const envFile = path.join(cwd, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const workers = ['ingestion', 'planner', 'schedule', 'coach', 'evaluator', 'search'];
const [mode, worker] = process.argv.slice(2);
if (mode && (mode !== 'worker' || !workers.includes(worker))) {
  console.error(`Usage: pnpm dev:ai OR pnpm dev:worker <${workers.join('|')}>`);
  process.exit(1);
}
const args = mode === 'worker'
  ? ['run', 'python', '-m', `workers.${worker}_worker`]
  : ['run', 'uvicorn', 'services.api.main:app', '--host', '127.0.0.1', '--port', '8000'];
const child = spawn('poetry', args, { cwd, env: process.env, stdio: 'inherit' });
child.on('error', () => { console.error('Could not launch Poetry. Install Poetry 2 and run poetry install --with dev in study-partner-ai.'); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
