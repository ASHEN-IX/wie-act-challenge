import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dotenv = createRequire(path.join(root, 'apps/api/package.json'))('dotenv');
const temp = await mkdtemp(path.join(os.tmpdir(), 'ednova-dev-setup-'));
const read = async (name) => dotenv.parse(await readFile(path.join(temp, name), 'utf8'));
const run = () => {
  const result = spawnSync(process.execPath, [path.join(temp, 'scripts/setup.mjs')], { stdio: 'pipe' });
  assert.equal(result.status, 0, 'Setup must complete');
};
try {
  for (const dir of ['scripts', 'apps/api', 'apps/web', 'apps/ai'])
    await mkdir(path.join(temp, dir), { recursive: true });
  await copyFile(path.join(root, 'scripts/setup.mjs'), path.join(temp, 'scripts/setup.mjs'));
  await copyFile(path.join(root, '.env.example'), path.join(temp, '.env.example'));
  await copyFile(path.join(root, 'apps/api/package.json'), path.join(temp, 'apps/api/package.json'));
  await symlink(path.join(root, 'apps/api/node_modules'), path.join(temp, 'apps/api/node_modules'));
  run();
  const api = await read('apps/api/.env'), web = await read('apps/web/.env.local'), ai = await read('apps/ai/.env');
  for (const key of ['MONGODB_URI', 'RABBITMQ_URL', 'AI_SERVICE_API_KEY', 'INGEST_UPLOADS_DIR', 'FAISS_INDEX_DIR'])
    assert.equal(api[key], ai[key], `${key} must match`);
  assert.equal(api.BETTER_AUTH_SECRET, web.BETTER_AUTH_SECRET);
  for (const key of ['INGEST_UPLOADS_DIR', 'FAISS_INDEX_DIR']) assert.ok(path.isAbsolute(api[key]));
  const before = await Promise.all(['apps/api/.env', 'apps/web/.env.local', 'apps/ai/.env'].map((f) => readFile(path.join(temp, f), 'utf8')));
  run();
  const after = await Promise.all(['apps/api/.env', 'apps/web/.env.local', 'apps/ai/.env'].map((f) => readFile(path.join(temp, f), 'utf8')));
  assert.deepEqual(after, before, 'Existing environment files must remain unchanged');
  await rm(path.join(temp, 'apps/web/.env.local'));
  await writeFile(path.join(temp, 'apps/api/.env'), 'BETTER_AUTH_SECRET="quoted#secret with spaces and length at least 32"\n');
  run();
  assert.equal((await read('apps/web/.env.local')).BETTER_AUTH_SECRET, (await read('apps/api/.env')).BETTER_AUTH_SECRET);
  console.log('Development setup: shared configuration, repeat safety and quoted values pass.');
} finally {
  await rm(temp, { recursive: true, force: true });
}
