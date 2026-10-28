// Disposable internal network only. Never touches the development broker/Redis.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const image = process.argv[2];
if (!image) throw new Error('Usage: node scripts/verify-worker-recovery.mjs <built-image>');
const prefix = `ednova-worker-check-${randomUUID()}`;
const network = `${prefix}-net`, broker = `${prefix}-broker`, redis = `${prefix}-redis`;
const volumes = [`${prefix}-rabbit-data`, `${prefix}-redis-data`];
const fixture = fileURLToPath(new URL('../apps/ai/tests/fixtures/worker_recovery_smoke.py', import.meta.url));
function docker(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 90000 });
  assert.equal(result.status, 0, `${args[0]}: ${result.stderr}\n${result.stdout}`);
  return result.stdout.trim();
}
async function ready() {
  for (let i = 0; i < 100; i++) {
    // Running diagnostics as root during first boot can create a root-owned
    // Erlang cookie before the broker user initializes its own home.
    const rabbit = spawnSync('docker', ['exec', '--user', 'rabbitmq', broker, 'rabbitmq-diagnostics', '-q', 'check_running'], { encoding: 'utf8', timeout: 5000 });
    const ping = spawnSync('docker', ['exec', redis, 'redis-cli', 'ping'], { encoding: 'utf8', timeout: 5000 });
    if (rabbit.status === 0 && ping.stdout.trim() === 'PONG') return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Isolated broker/Redis failed readiness');
}
function phase(stage) {
  console.log(docker(['run', '--rm', '--network', network,
    '--mount', `type=bind,src=${fixture},dst=/worker-recovery.py,readonly`,
    '-e', 'RABBITMQ_URL=amqp://fixture:synthetic-local-only@broker:5672/',
    '-e', 'REDIS_URL=redis://redis:6379/0', '-e', 'APP_ENV=production',
    '-e', 'LLM_MOCK=1', '-e', 'LLM_APPROVALS_JSON={}',
    '-e', 'AI_RETRY_DELAYS_MS=[100,200]', image, 'python', '/worker-recovery.py', stage]));
}
try {
  docker(['network', 'create', '--internal', network]);
  for (const volume of volumes) docker(['volume', 'create', volume]);
  docker(['run', '-d', '--name', broker, '--hostname', 'broker', '--network', network, '--network-alias', 'broker',
    '--mount', `type=volume,src=${volumes[0]},dst=/var/lib/rabbitmq`,
    '-e', 'RABBITMQ_SERVER_ADDITIONAL_ERL_ARGS=+S 2:2 +A 4',
    '-e', 'RABBITMQ_DEFAULT_USER=fixture', '-e', 'RABBITMQ_DEFAULT_PASS=synthetic-local-only', 'rabbitmq:3-management']);
  docker(['run', '-d', '--name', redis, '--network', network, '--network-alias', 'redis',
    '--mount', `type=volume,src=${volumes[1]},dst=/data`, 'redis:7-alpine',
    'redis-server', '--appendonly', 'yes', '--appendfsync', 'always']);
  await ready();
  phase('crash');
  // Abrupt stops exercise durable broker messages and Redis AOF, not just a
  // graceful service restart. Only these disposable containers are killed.
  docker(['kill', '--signal', 'KILL', broker, redis]);
  docker(['start', broker, redis]);
  await ready();
  phase('resume');
} catch (error) {
  for (const name of [broker, redis]) {
    const logs = spawnSync('docker', ['logs', '--tail', '60', name], { encoding: 'utf8' });
    console.error(`${name}\n${logs.stdout}\n${logs.stderr}`);
  }
  throw error;
} finally {
  for (const name of [broker, redis]) spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
  for (const volume of volumes) spawnSync('docker', ['volume', 'rm', volume], { stdio: 'ignore' });
  spawnSync('docker', ['network', 'rm', network], { stdio: 'ignore' });
}
