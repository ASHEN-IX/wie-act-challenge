import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
function resolveCompose(file, env = {}) {
  const result = spawnSync('docker', ['compose', '-f', file, 'config', '--format', 'json'], {
    cwd: root, env: { ...process.env, ...env }, encoding: 'utf8'
  });
  if (result.status !== 0) throw new Error(`Cannot resolve ${file} (Compose exit ${result.status})`);
  return JSON.parse(result.stdout);
}
const main = resolveCompose('docker-compose.yml', { RABBITMQ_PASS: 'configuration-check-only', INTERNAL_API_SECRET: 'configuration-check-only' });
const mount = (service, target) => main.services[service]?.volumes?.find((v) => v.target === target);
for (const target of ['/app/faiss', '/app/uploads']) {
  const http = mount('ai-service', target), worker = mount('ingestion-worker', target);
  if (!http || !worker || http.source !== worker.source || http.read_only || worker.read_only)
    throw new Error(`Python HTTP and ingestion worker require the same writable ${target} volume`);
}
for (const service of ['ai-service', 'ingestion-worker']) {
  if (main.services[service].environment.APP_ENV !== 'production' ||
      main.services[service].environment.REDIS_URL !== 'redis://redis:6379/0' ||
      main.services[service].depends_on.redis?.condition !== 'service_healthy')
    throw new Error(`${service} requires shared Redis and fail-closed production idempotency`);
}
if (!main.services.redis.command.includes('--appendonly') ||
    !main.services.redis.volumes?.some((v) => v.target === '/data'))
  throw new Error('Worker Redis must retain completion markers on a persistent volume');
for (const name of ['evaluator', 'planner', 'search', 'schedule', 'coach']) {
  const worker = main.services[`${name}-worker`];
  if (!worker || worker.command.join(' ') !== `python -m workers.${name}_worker` ||
      worker.environment.RABBITMQ_URL !== main.services['ai-service'].environment.RABBITMQ_URL ||
      worker.ports?.length) throw new Error(`${name} worker must share the broker without publishing HTTP ports`);
}
for (const name of ['development', 'test']) {
  const config = resolveCompose(path.join('deploy', `compose.${name}.yml`));
  if (!config.services.postgres || !config.services.mailpit)
    throw new Error(`${name} stack must include PostgreSQL and Mailpit`);
}
console.log('Compose files resolve; both Python writers share writable source/index volumes.');
