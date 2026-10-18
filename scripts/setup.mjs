import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const readEnv = (name) => {
  const file = path.join(root, name);
  return existsSync(file) ? Object.fromEntries(readFileSync(file, 'utf8').split('\n')
    .filter((line) => /^[A-Z_][A-Z_0-9]*=/.test(line))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)])) : {};
};
const existingApi = readEnv('apps/api/.env');
const existingWeb = readEnv('apps/web/.env.local');
const secret = () => randomBytes(32).toString('hex');
const common = {
  MONGODB_URI: existingApi.MONGODB_URI || existingWeb.MONGODB_URI || 'mongodb://127.0.0.1:27018/ednova_dev',
  BETTER_AUTH_SECRET: existingApi.BETTER_AUTH_SECRET || existingWeb.BETTER_AUTH_SECRET || secret(),
  BETTER_AUTH_URL: 'http://localhost:5173',
  AUTH_TRUSTED_ORIGINS: 'http://localhost:5173',
  SMTP_HOST: '127.0.0.1', SMTP_PORT: '1026', SMTP_SECURE: 'false'
};
const broker = existingApi.RABBITMQ_URL || 'amqp://ednova:ednova-local@127.0.0.1:5673/ednova';
const redis = existingApi.REDIS_URL || 'redis://127.0.0.1:6381';
const serviceKey = existingApi.AI_SERVICE_API_KEY || readEnv('apps/ai/.env').AI_SERVICE_API_KEY || secret();
function create(name, values) {
  const file = path.join(root, name);
  if (existsSync(file)) { console.log(`Kept existing ${name}`); return; }
  writeFileSync(file, Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600, flag: 'wx' });
  console.log(`Created ${name}`);
}
create('apps/api/.env', {
  ...readEnv('.env.example'), ...common,
  NODE_ENV: 'development', PORT: '3000', INTERNAL_API_SECRET: secret(),
  FRONTEND_URL: 'http://localhost:5173', APP_URL: 'http://localhost:5173', CORS_ORIGIN: 'http://localhost:5173',
  RABBITMQ_URL: broker,
  RABBITMQ_USER: 'ednova', RABBITMQ_PASS: 'ednova-local', RABBITMQ_VHOST: 'ednova',
  REDIS_URL: redis, AI_SERVICE_API_KEY: serviceKey
});
create('apps/web/.env.local', {
  ...readEnv('apps/web/.env.example'), ...common,
  BACKEND_URL: 'http://localhost:3000', NEXT_PUBLIC_WS_URL: 'ws://localhost:3000'
});
create('apps/ai/.env', {
  MONGODB_URI: common.MONGODB_URI,
  MONGO_URI: common.MONGODB_URI,
  DB_NAME: new URL(common.MONGODB_URI).pathname.slice(1) || "study_partner",
  RABBITMQ_URL: broker,
  REDIS_URL: redis, AI_SERVICE_API_KEY: serviceKey,
  INGEST_UPLOADS_DIR: path.join(root, 'apps/api/uploads'),
  LLM_MOCK: '1'
});
console.log('Local setup uses mock inference explicitly. Configure approved providers before real-model acceptance. Run pnpm dev:doctor next.');
