/** Explicit infrastructure gate: real Node publisher/Python BaseAIWorker, deterministic handler.
 * Run with M01_PYTHON pointing to Python 3.12 with the locked messaging dependencies.
 * Owns disposable RabbitMQ/Redis containers; never connects to an existing broker.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import amqp from 'amqplib';

const suffix = String(process.pid);
const broker = `ednova-m01-broker-${suffix}`;
const redis = `ednova-m01-redis-${suffix}`;
const owned: string[] = [];
let worker: ChildProcess | undefined;
let connection: amqp.ChannelModel | undefined;
let publisher: typeof import('../../shared/ai-messaging/publisher') | undefined;
const results: import('../../shared/ai-messaging/envelope').AiResultEnvelope[] = [];
const docker = (...args: string[]) =>
  execFileSync('docker', args, { encoding: 'utf8', timeout: 30000 }).trim();
async function until(
  check: () => boolean | Promise<boolean>,
  description: string,
  timeout = 20000
) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await delay(100);
  }
  throw new Error(`Timed out: ${description}`);
}
async function stopWorker() {
  if (!worker || worker.exitCode !== null) return;
  const exited = once(worker, 'exit');
  worker.kill('SIGTERM');
  const timeout = setTimeout(() => worker?.kill('SIGKILL'), 10000);
  try {
    const [code] = await exited;
    assert.equal(code, 0, 'worker must drain and stop cleanly');
  } finally {
    clearTimeout(timeout);
  }
}
async function startWorker(behavior: 'ok' | 'fail_retryable') {
  let output = '';
  worker = spawn(process.env.M01_PYTHON || 'python3.12', ['-u', 'tests/e2e_stub_worker.py'], {
    cwd: path.resolve(__dirname, '../../../ai'),
    env: {
      ...process.env,
      PYTHONPATH: '.',
      NODE_ENV: 'test',
      APP_ENV: 'test',
      BEHAVIOR: behavior,
      JOB_TYPE: 'study.plan.generate'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  worker.stdout?.on('data', (data: Buffer) => {
    output += data.toString();
    process.stdout.write(data);
  });
  worker.stderr?.on('data', (data: Buffer) => process.stderr.write(data));
  await until(() => {
    if (worker?.exitCode !== null)
      throw new Error(`Worker exited before ready: ${worker?.exitCode}`);
    return output.includes('STUB_WORKER_READY');
  }, `worker ready (${behavior})`);
}
async function main() {
  try {
    docker(
      'run',
      '-d',
      '--name',
      broker,
      '-p',
      '127.0.0.1::5672',
      '-e',
      'ERL_FLAGS=+S 2:2 +SDcpu 1 +SDio 1',
      'rabbitmq:3-management'
    );
    owned.push(broker);
    docker('run', '-d', '--rm', '--name', redis, '-p', '127.0.0.1::6379', 'redis:7-alpine');
    owned.push(redis);
    const brokerPort = docker('port', broker, '5672/tcp').split(':').at(-1);
    const redisPort = docker('port', redis, '6379/tcp').split(':').at(-1);
    process.env.RABBITMQ_URL = `amqp://guest:guest@127.0.0.1:${brokerPort}/%2F`;
    process.env.REDIS_URL = `redis://127.0.0.1:${redisPort}/0`;
    process.env.AI_RETRY_DELAYS_MS = '[100,200,400]';
    await until(
      () => {
        const running = docker('inspect', '--format', '{{.State.Running}}', broker);
        const logs = docker('logs', broker);
        if (running !== 'true') throw new Error(`Broker startup failed: ${logs}`);
        return logs.includes('Server startup complete');
      },
      'dedicated broker startup',
      60000
    );
    await startWorker('ok');
    publisher = await import('../../shared/ai-messaging/publisher.js');
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createConfirmChannel();
    await publisher.consumeAiResults(async (event) => {
      results.push(event);
    });
    const job = await publisher.publishAiJob('study.plan.generate', 'm01-synthetic-user', {
      goal: 'fixture transport'
    });
    await until(() => results.some((r) => r.messageId === job.messageId), 'completed result');
    const completed = results.find((r) => r.messageId === job.messageId)!;
    assert.equal(completed.status, 'completed');
    assert.equal(completed.correlationId, job.correlationId);
    assert.equal(completed.payload?.stub, true);
    await publisher.publishAiJob(
      'study.plan.generate',
      'm01-synthetic-user',
      { goal: 'fixture transport' },
      job
    );
    await delay(750);
    assert.equal(
      results.filter((r) => r.messageId === job.messageId).length,
      1,
      'duplicate must not process twice'
    );
    await stopWorker();
    await startWorker('ok');
    await publisher.publishAiJob(
      'study.plan.generate',
      'm01-synthetic-user',
      { goal: 'fixture transport' },
      job
    );
    await delay(750);
    assert.equal(
      results.filter((r) => r.messageId === job.messageId).length,
      1,
      'Redis completion must survive worker restart'
    );
    const fresh = await publisher.publishAiJob('study.plan.generate', 'm01-synthetic-user', {
      goal: 'after restart'
    });
    await until(
      () => results.some((r) => r.messageId === fresh.messageId),
      'fresh job after restart'
    );
    assert.equal(results.find((r) => r.messageId === fresh.messageId)?.status, 'completed');
    await stopWorker();
    await startWorker('fail_retryable');
    const failed = await publisher.publishAiJob('study.plan.generate', 'm01-synthetic-user', {
      goal: 'retry fixture'
    });
    await until(
      () => results.some((r) => r.messageId === failed.messageId),
      'retry exhaustion result'
    );
    assert.equal(results.find((r) => r.messageId === failed.messageId)?.status, 'failed');
    const dlqName = 'ai.dlq.study.plan.generate';
    await until(async () => (await channel.checkQueue(dlqName)).messageCount === 1, 'terminal DLQ');
    const dead = await channel.get(dlqName, { noAck: true });
    assert.ok(dead);
    assert.equal(dead.properties.headers?.['x-retry-count'], 3);
    assert.equal(JSON.parse(dead.content.toString()).messageId, failed.messageId);
    await assert.rejects(
      publisher.publishAiJob('unregistered.type', 'm01-synthetic-user', {}),
      /invalid job envelope/
    );
    channel.publish('ai.jobs', 'study.plan.generate', Buffer.from('{"invalid":true}'), {
      persistent: true
    });
    await channel.waitForConfirms();
    await until(
      async () => (await channel.checkQueue(dlqName)).messageCount === 1,
      'invalid worker envelope DLQ'
    );
    const invalid = await channel.get(dlqName, { noAck: true });
    assert.ok(invalid);
    assert.deepEqual(JSON.parse(invalid.content.toString()), { invalid: true });
    await stopWorker();
    const queueState = docker(
      'exec',
      broker,
      'rabbitmqctl',
      '-q',
      'list_queues',
      'name',
      'messages_ready',
      'messages_unacknowledged'
    );
    process.stdout.write(`${queueState}\n`);
    assert.ok(
      queueState.split('\n').every((line) => !line.startsWith('ai.') || /\s0\s+0$/.test(line)),
      'all owned queues drained and acknowledged'
    );
    process.stdout.write(
      'PASS real publisher/worker: completed, duplicate, Redis restart, fresh work, three retries, failed result, invalid schema DLQ, ACK/drain. Handler is deterministic; no inference.\n'
    );
  } finally {
    await stopWorker();
    await publisher?.closeAiMessaging();
    await connection?.close();
    for (const name of owned.reverse()) {
      try {
        docker('rm', '-f', name);
      } catch {
        /* Already removed by the daemon. */
      }
    }
  }
}
main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
