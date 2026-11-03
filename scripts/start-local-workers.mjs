// Derive Compose's broker settings from the same URL the local Node API uses.
// Never log credentials or reuse a different vhost from the root .env file.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const dotenv = createRequire(path.join(root, 'apps/api/package.json'))('dotenv');
const api = dotenv.parse(readFileSync(path.join(root, 'apps/api/.env')));
const broker = new URL(api.RABBITMQ_URL);
if (!['localhost', '127.0.0.1'].includes(broker.hostname)) throw Error('Local broker required');
const database = new URL(api.MONGODB_URI);
if (!['localhost', '127.0.0.1'].includes(database.hostname)) throw Error('Local database required');
const child = spawn('docker', ['compose', '--env-file', 'apps/api/.env', 'up', '-d', '--no-deps', '--force-recreate',
  'ai-service', 'ingestion-worker', 'evaluator-worker', 'planner-worker', 'search-worker', 'schedule-worker', 'coach-worker'], {
  cwd: root, stdio: 'inherit', env: { ...process.env,
    RABBITMQ_USER: decodeURIComponent(broker.username),
    RABBITMQ_PASS: decodeURIComponent(broker.password),
    RABBITMQ_VHOST: decodeURIComponent(broker.pathname.slice(1)),
    AI_DB_NAME: database.pathname.slice(1),
  },
});
child.on('exit', (code) => { process.exitCode = code ?? 1; });
