import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const dotenv = createRequire(path.join(root, 'apps/api/package.json'))('dotenv');
let failures = 0;
function check(ok, message) { console.log(`${ok ? 'OK' : 'FIX'} ${message}`); if (!ok) failures++; }
check(Number(process.versions.node.split('.')[0]) >= 24, 'Node >=24');
const pnpm = spawnSync('pnpm', ['--version'], { encoding: 'utf8', cwd: root });
check(pnpm.status === 0 && pnpm.stdout.trim() === '11.3.0', 'pnpm 11.3.0');
const envs = {};
for (const name of ['apps/api/.env', 'apps/web/.env.local', 'apps/ai/.env']) {
  const file = path.join(root, name); check(existsSync(file), `${name} exists (pnpm dev:setup)`);
  envs[name] = existsSync(file) ? dotenv.parse(readFileSync(file, 'utf8')) : {};
}
const api = envs['apps/api/.env']; const web = envs['apps/web/.env.local']; const ai = envs['apps/ai/.env'];
for (const key of ['MONGODB_URI', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL']) {
  check(Boolean(api[key]) && api[key] === web[key], `API/web ${key} matches`);
}
check(Boolean(api.BETTER_AUTH_SECRET) && api.BETTER_AUTH_SECRET.length >= 32 && !api.BETTER_AUTH_SECRET.includes('replace-with'), 'Auth secret is configured');
check(Boolean(api.INTERNAL_API_SECRET) && !api.INTERNAL_API_SECRET.includes('replace-with'), 'Internal API secret is configured');
check(Boolean(api.AI_SERVICE_API_KEY) && api.AI_SERVICE_API_KEY === ai.AI_SERVICE_API_KEY, 'Node/Python service keys match');
for (const key of ['MONGODB_URI', 'RABBITMQ_URL', 'REDIS_URL']) {
  check(Boolean(ai[key]) && ai[key] === api[key], `Node/Python ${key} matches`);
}
for (const key of ['INGEST_UPLOADS_DIR', 'FAISS_INDEX_DIR']) {
  check(Boolean(api[key]) && path.isAbsolute(api[key]) && api[key] === ai[key], `Node/Python ${key} matches as an absolute path`);
}
const docker = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], { encoding: 'utf8' });
check(docker.status === 0, 'Docker daemon available for local infrastructure');
let compatiblePython;
for (const executable of ['python3', 'python3.11', 'python3.12', 'python3.13', 'python3.14']) {
  const result = spawnSync(executable, ['-c', 'import sys; sys.exit(not ((3,11) <= sys.version_info[:2] < (3,15)))']);
  if (result.status === 0) { compatiblePython = executable; break; }
}
check(Boolean(compatiblePython), `Supported Python available${compatiblePython ? ` (${compatiblePython}; select it with poetry env use)` : ' (install Python 3.11–3.14)'}`);
const selectedAiPython = process.env.EDNOVA_AI_PYTHON || ai.EDNOVA_AI_PYTHON;
const aiRunner = selectedAiPython
  ? spawnSync(selectedAiPython, ['-c', 'import sys; assert (3,11) <= sys.version_info[:2] < (3,15); import uvicorn, pymongo, fastapi'])
  : spawnSync('poetry', ['--version']);
check(aiRunner.status === 0, selectedAiPython ? 'Selected AI Python and basic runtime dependencies available' : 'Poetry available for AI service (or set EDNOVA_AI_PYTHON)');
console.log('Checks configuration only; no secret values printed. Does not certify services, tests or real inference.');
process.exitCode = failures ? 1 : 0;
