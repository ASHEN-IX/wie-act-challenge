import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dotenv = createRequire(path.join(root, 'apps/api/package.json'))('dotenv');
const readEnv = (name) => {
  const file = path.join(root, name);
  return existsSync(file) ? dotenv.parse(readFileSync(file, 'utf8')) : {};
};
const existingApi = readEnv('apps/api/.env');
const existingWeb = readEnv('apps/web/.env.local');
const existingAi = readEnv('apps/ai/.env');
const secret = () => randomBytes(32).toString('hex');
const common = {
  DATABASE_URL: existingApi.DATABASE_URL || existingWeb.DATABASE_URL || 'postgresql://ednova:ednova@127.0.0.1:5433/ednova',
  BETTER_AUTH_SECRET: existingApi.BETTER_AUTH_SECRET || existingWeb.BETTER_AUTH_SECRET || secret(),
  BETTER_AUTH_URL: 'http://localhost:3000',
  AUTH_TRUSTED_ORIGINS: 'http://localhost:3000',
  SMTP_HOST: '127.0.0.1', SMTP_PORT: '1026', SMTP_SECURE: 'false'
};
const internalKey = existingApi.INTERNAL_API_SECRET || existingAi.INTERNAL_API_SECRET || secret();
const apiPort = existingApi.PORT || '3001';
const broker = existingApi.RABBITMQ_URL || 'amqp://ednova:ednova-local@127.0.0.1:5673/ednova';
const redis = existingApi.REDIS_URL || 'redis://127.0.0.1:6381';
const serviceKey = existingApi.AI_SERVICE_API_KEY || existingAi.AI_SERVICE_API_KEY || secret();
const uploads = existingApi.INGEST_UPLOADS_DIR || existingAi.INGEST_UPLOADS_DIR || path.join(root, 'var', 'dev-uploads');
const indexes = existingApi.FAISS_INDEX_DIR || existingAi.FAISS_INDEX_DIR || path.join(root, 'var', 'dev-faiss');
function create(name, values) {
  const file = path.join(root, name);
  if (existsSync(file)) { console.log(`Kept existing ${name}`); return; }
  writeFileSync(file, Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600, flag: 'wx' });
  console.log(`Created ${name}`);
}
create('apps/api/.env', {
  ...readEnv('apps/api/.env.example'), ...common,
  NODE_ENV: 'development', PORT: '3001', INTERNAL_API_SECRET: internalKey,
  FRONTEND_URL: 'http://localhost:3000', APP_URL: 'http://localhost:3000', CORS_ORIGIN: 'http://localhost:3000',
  RABBITMQ_URL: broker,
  RABBITMQ_USER: 'ednova', RABBITMQ_PASS: 'ednova-local', RABBITMQ_VHOST: 'ednova',
  REDIS_URL: redis, AI_SERVICE_API_KEY: serviceKey,
  INGEST_UPLOADS_DIR: uploads, FAISS_INDEX_DIR: indexes
});
create('apps/web/.env.local', {
  ...readEnv('apps/web/.env.example'), ...common,
  BACKEND_URL: `http://localhost:${apiPort}`, NEXT_PUBLIC_WS_URL: `ws://localhost:${apiPort}`
});
create('apps/ai/.env', {
  AI_DATABASE_URL: common.DATABASE_URL,
  API_SERVICE_URL: `http://localhost:${apiPort}`,
  INTERNAL_API_SECRET: internalKey,
  RABBITMQ_URL: broker,
  REDIS_URL: redis, AI_SERVICE_API_KEY: serviceKey,
  INGEST_UPLOADS_DIR: uploads, FAISS_INDEX_DIR: indexes,
  LLM_MOCK: '1'
});
console.log('Local setup uses mock inference explicitly. Configure approved providers before real-model acceptance. Run pnpm dev:doctor next.');
