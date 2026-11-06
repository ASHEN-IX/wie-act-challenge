// Isolated real-service QA harness. Only the Gemini SDK is mocked in Python.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { config } from 'dotenv';
import bcrypt from 'bcryptjs';
import { MongoClient, ObjectId } from 'mongodb';

async function main() {
  config({ path: path.resolve('../../.env') });
  const name = process.env.FINAL_QA_DB!;
  if (!/^test_formula_final_\d+$/.test(name)) throw Error('Isolated QA database required');
  const qaRoot = path.resolve('../../var/final-qa');
  await fs.mkdir(qaRoot, { recursive: true });
  const root = await fs.mkdtemp(path.join(qaRoot, name));
  await fs.chmod(root, 0o777);
  const container = 'ednova-final-qa-' + name.split('_').at(-1);
  const run = (args: string[]) => execFileSync('docker', args, { stdio: 'pipe' });
  const rabbitUser = process.env.RABBITMQ_USER || 'ednova';
  run(['exec', 'rabbitmq', 'rabbitmqctl', 'add_vhost', name]);
  run([
    'exec',
    'rabbitmq',
    'rabbitmqctl',
    'set_permissions',
    '-p',
    name,
    rabbitUser,
    '.*',
    '.*',
    '.*'
  ]);
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/' + name,
    BETTER_AUTH_SECRET: 'isolated-final-browser-secret-at-least-32-chars',
    BETTER_AUTH_URL: 'http://localhost:5360',
    AUTH_TRUSTED_ORIGINS: 'http://localhost:5360',
    INTERNAL_API_SECRET: 'isolated-final-internal-secret',
    AI_SERVICE_API_KEY: 'isolated-final-service-credential-32-characters',
    AI_SERVICE_URL: 'http://127.0.0.1:5362',
    AI_SERVICE_TIMEOUT_MS: '120000',
    REDIS_URL: '',
    // Batch 4 M4.1: the isolated QA harness is the only place the mock planner
    // is enabled. The route and the service both refuse without this flag, so a
    // production deployment keeps the deterministic reader.
    EDNOVA_ENABLE_MOCK_EXPERIENCE_PLANNING: 'true',
    RABBITMQ_URL: `amqp://${encodeURIComponent(rabbitUser)}:${encodeURIComponent(process.env.RABBITMQ_PASS || '')}@localhost:5672/${name}`,
    INGEST_UPLOADS_DIR: path.join(root, 'uploads'),
    FAISS_INDEX_DIR: path.join(root, 'indexes'),
    FORMULA_QUEUE: 'ai.work.study.formula.recognize',
    FORMULA_ROUTING_KEY: 'study.formula.recognize'
  });
  for (const dir of ['uploads', 'indexes', 'hf']) {
    await fs.mkdir(path.join(root, dir), { recursive: true });
    await fs.chmod(path.join(root, dir), 0o777);
  }
  // Existing cached embedding model, copied without downloading another model.
  run(['cp', 'ednova-ai:/home/ednova/.cache/huggingface/.', path.join(root, 'hf')]);
  const approval = {
    approvalId: name,
    task: 'course_multimodal_prototype',
    model: 'gemini/gemini-2.5-flash',
    expiresAt: Date.now() / 1000 + 1800,
    maxRequests: 6,
    maxTokens: 393216
  };
  // Get the exact existing alias; no other LLM operation is approved.
  const alias = 'course_multimodal_prototype';
  const env: Record<string, string> = {
    ...Object.fromEntries(
      ['MONGODB_URI', 'RABBITMQ_URL', 'AI_SERVICE_API_KEY'].map((k) => [k, process.env[k]!])
    ),
    DB_NAME: name,
    EDNOVA_FINAL_QA: '1',
    NODE_ENV: 'test',
    INGEST_UPLOADS_DIR: '/qa/uploads',
    FAISS_INDEX_DIR: '/qa/indexes',
    GEMINI_API_KEY: 'isolated-qa-never-sent',
    LLM_BUDGET_MONGODB_URI: process.env.MONGODB_URI!,
    LLM_BUDGET_DB_NAME: name,
    LLM_APPROVALS_JSON: JSON.stringify({ [alias]: approval }),
    LLM_MODE: 'REAL_APPROVED',
    HF_HOME: '/qa/hf',
    HF_HUB_OFFLINE: '1',
    TRANSFORMERS_OFFLINE: '1',
    TOKENIZERS_PARALLELISM: 'false',
    OMP_NUM_THREADS: '2'
  };
  for (const k of ['MONGODB_URI', 'RABBITMQ_URL', 'LLM_BUDGET_MONGODB_URI'])
    env[k] = env[k]
      .replace('127.0.0.1', 'host.docker.internal')
      .replace('@localhost:', '@host.docker.internal:');
  const args = [
    'run',
    '--rm',
    '--name',
    container,
    '-p',
    '127.0.0.1:5362:5362',
    '--memory',
    '4g',
    '--cpus',
    '2',
    '--user',
    '0',
    // The env below rewrites every loopback service to host.docker.internal.
    // Without this mapping that name does not resolve inside the container, so
    // the QA service cannot reach MongoDB or RabbitMQ on the host.
    '--add-host',
    'host.docker.internal:host-gateway',
    '-v',
    path.resolve('../ai') + ':/app:ro',
    '-v',
    root + ':/qa',
    '-w',
    '/app'
  ];
  for (const [k, v] of Object.entries(env)) args.push('-e', k + '=' + v);
  const py = spawn(
    'docker',
    [
      ...args,
      '--entrypoint',
      '/opt/venv/bin/python',
      'ednova-api-ai-service',
      '-m',
      'uvicorn',
      'tests.final_acceptance_app:app',
      '--host',
      '0.0.0.0',
      '--port',
      '5362'
    ],
    { stdio: 'inherit' }
  );
  let runtime: any, worker: any, ingestion: any;
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db();
  async function stop() {
    if (worker) worker.kill('SIGTERM');
    try {
      run(['stop', '-t', '5', container]);
    } catch {}
    if (runtime) await Promise.race([runtime.stop(), new Promise((r) => setTimeout(r, 5000))]);
    await client.db().dropDatabase();
    await client.close();
    try {
      run(['exec', 'rabbitmq', 'rabbitmqctl', 'delete_vhost', name]);
    } catch {}
    await fs.rm(root, { recursive: true, force: true });
    process.exit(0);
  }
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch('http://127.0.0.1:5362/health')).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
    if (i === 119) throw Error('QA Python unavailable');
  }
  for (const [id, email, role] of [
    ['aaaaaaaaaaaaaaaaaaaaaaaa', 'final-instructor@example.test', 'instructor'],
    ['cccccccccccccccccccccccc', 'final-student@example.test', 'student'],
    ['dddddddddddddddddddddddd', 'final-outsider@example.test', 'student']
  ]) {
    await db
      .collection('users')
      .insertOne({
        _id: new ObjectId(id),
        email,
        name: role,
        password: await bcrypt.hash('FinalPass!123', 12),
        isVerified: true,
        isActive: true,
        role: 'student',
        tier: 'vip'
      });
  }
  const institutionId = new ObjectId('eeeeeeeeeeeeeeeeeeeeeeee');
  await db
    .collection('institutions')
    .insertOne({
      _id: institutionId,
      name: 'Isolated QA',
      slug: name,
      status: 'active',
      createdByUserId: 'aaaaaaaaaaaaaaaaaaaaaaaa'
    });
  for (const [userId, role] of [
    ['aaaaaaaaaaaaaaaaaaaaaaaa', 'instructor'],
    ['cccccccccccccccccccccccc', 'university_student']
  ])
    await db
      .collection('institution_memberships')
      .insertOne({ institutionId, userId, role, status: 'active' });
  await db
    .collection('subjects')
    .insertOne({
      _id: new ObjectId('bbbbbbbbbbbbbbbbbbbbbbbb'),
      userId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      name: 'Final QA'
    });
  const { migrateAuth } = require('../scripts/migrate-auth');
  await migrateAuth(db, { apply: true });
  const { start } = require('../dist/main');
  runtime = await start({ port: 5361, workers: true });
  await db
    .collection('formula_provider_eligibility')
    .insertOne({
      provider: 'gemini',
      model: approval.model,
      freeTier: true,
      billingAttached: false,
      expiresAt: new Date(Date.now() + 1800000),
      keySha256: crypto.createHash('sha256').update(env.GEMINI_API_KEY).digest('hex'),
      verifiedBy: 'isolated SDK test only',
      projectId: 'not-a-real-provider-project'
    });
  ingestion = spawn(
    'docker',
    ['exec', container, '/opt/venv/bin/python', '-m', 'workers.ingestion_worker'],
    { stdio: 'inherit' }
  );
  worker = spawn(process.execPath, ['--import', 'tsx', 'scripts/formula-recognition-worker.ts'], {
    env: process.env,
    stdio: 'inherit'
  });
  process.removeAllListeners('SIGTERM');
  process.removeAllListeners('SIGINT');
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  console.log('final-acceptance-ready');
}
main().catch((e) => {
  console.error('final-acceptance-start-failed', e.message);
  process.exit(1);
});
