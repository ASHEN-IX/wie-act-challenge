import express from 'express';
import { config } from 'dotenv';
import request from 'supertest';
import { connectDatabase, disconnectDatabase, prisma } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, ChildProcess } from 'node:child_process';
import amqp from 'amqplib';
import { Course, CourseRevision } from '../models';
import { FormulaRecognitionJob as Jobs } from '../models/FormulaRecognitionJob';
import { FormulaProposal } from '../models/FormulaProposal';
process.env.FORMULA_QUEUE = 'ai.test.formula.jobs.' + process.pid;
const { dispatch, processJob, recover, FORMULA_QUEUE } =
  require('../services/formulaJobs') as typeof import('../services/formulaJobs');
const routes = require('../routes/courses');
const docId = 'doc_' + 'a'.repeat(16),
  regionId = 'region_' + 'b'.repeat(20);
let dbName: string,
  root: string,
  course: any,
  draft: any,
  hash: string,
  server: http.Server,
  worker: ChildProcess;
let calls = 0,
  mode = 'ok',
  base: string,
  published: any,
  publishedSnapshot: string;
const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  if (req.header('x-user')) req.user = { userId: req.header('x-user') };
  next();
});
app.use('/courses', routes);
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function startWorker() {
  worker = spawn(
    process.execPath,
    ['--import', 'tsx', '--no-warnings', 'scripts/formula-recognition-worker.ts'],
    { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('worker readiness timeout')), 15000);
    worker.stdout!.on('data', (data) => {
      if (String(data).includes('formula-worker-ready')) {
        clearTimeout(timer);
        resolve();
      }
    });
    worker.once('exit', () => {
      clearTimeout(timer);
      reject(new Error('worker exited before readiness'));
    });
  });
}
async function stopWorker() {
  if (worker && worker.exitCode === null) {
    const ended = new Promise((r) => worker.once('exit', r));
    worker.kill('SIGTERM');
    await ended;
  }
}
async function freshVersion() {
  draft = await CourseRevision.findOneAndUpdate(
    { _id: draft._id },
    { $inc: { __v: 1 } },
    { new: true }
  );
  return draft.__v;
}
async function submit(version = draft.__v) {
  return request(app)
    .post(base + '/recognition-jobs')
    .set('x-user', 'owner')
    .send({ documentId: docId, regionId, draftVersion: version });
}
async function waitJob(id: string) {
  for (let i = 0; i < 200; i++) {
    const row: any = await Jobs.findById(id).lean();
    if (!['queued', 'running'].includes(row.state)) return row;
    await pause(40);
  }
  throw new Error('job did not finish');
}
beforeAll(async () => {
  dbName = 'test_formula_jobs_' + process.pid;
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || 'postgresql://ednova:ednova@127.0.0.1:5433/ednova_test';
  config({ path: path.resolve('../../.env') });
  process.env.RABBITMQ_URL = `amqp://${encodeURIComponent(process.env.RABBITMQ_USER || 'ednova')}:${encodeURIComponent(process.env.RABBITMQ_PASS || '')}@localhost:5672/${encodeURIComponent(process.env.RABBITMQ_VHOST || 'ednova')}`;
  process.env.FORMULA_QUEUE = FORMULA_QUEUE; // queue name was set by test invocation before imports
  process.env.FORMULA_ROUTING_KEY = 'test.formula.' + process.pid;
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'formula-job-'));
  process.env.INGEST_UPLOADS_DIR = root;
  await fs.mkdir(path.join(root, 'originals'));
  const bytes = Buffer.from('%PDF-1.4\nisolated-source\n');
  hash = 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
  await fs.writeFile(path.join(root, 'originals', hash.slice(7)), bytes);
  await connectDatabase();
  await prisma.formulaProviderEligibility.deleteMany({});
  // Tables and indexes come from the Prisma migrations.
  course = await Course.create({
    userId: 'owner',
    ownerUserId: 'owner',
    subjectId: 's',
    title: 'Job fixture'
  });
  draft = await CourseRevision.create({
    courseId: course._id,
    revisionTag: 'rev_jobs',
    status: 'draft',
    contentHash: hash.slice(7),
    isInstructorReviewed: false,
    topics: [{ id: 't', title: 'T' }],
    sourceManifest: [
      {
        documentId: docId,
        filename: 'source.pdf',
        contentHash: hash,
        provenance: 'extracted',
        storageRef: 'originals/' + hash.slice(7),
        mediaType: 'application/pdf'
      }
    ]
  });
  published = await CourseRevision.create({
    courseId: course._id,
    revisionTag: 'rev_old',
    status: 'published',
    contentHash: hash.slice(7),
    isInstructorReviewed: true
  });
  publishedSnapshot = JSON.stringify(await CourseRevision.findById(published._id).lean());
  base = `/courses/${course._id}/drafts/rev_jobs`;
  server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    res.setHeader('Content-Type', 'application/json');
    if (req.url?.endsWith('recognition-preflight')) {
      if (mode === 'approval' || mode === 'budget') {
        res.statusCode = 503;
        return res.end('{}');
      }
      return res.end('{"available":true}');
    }
    const region = {
      documentId: docId,
      documentHash: hash,
      regionId,
      cropHash: 'sha256:' + 'c'.repeat(64),
      page: 1,
      bbox: [1, 2, 40, 50],
      text: 'x²'
    };
    if (req.url?.endsWith('region-inspect')) return res.end(JSON.stringify(region));
    calls++;
    if (mode === 'delayed') await pause(300);
    if (mode === 'timeout') {
      res.statusCode = 504;
      return res.end('{}');
    }
    if (mode === 'malformed') return res.end('{}');
    res.end(
      JSON.stringify({
        modelVersion: 'mock-gemini-v1',
        usage: { totalTokens: 100 },
        proposal: {
          source: {
            page: region.page,
            bbox: region.bbox,
            source_sha256: hash,
            document_id: docId,
            revision_id: body.revisionId,
            region_id: regionId
          },
          provider: 'gemini',
          model: 'gemini/gemini-2.5-flash',
          review_disposition: 'pending',
          proposal_sha256: 'sha256:' + 'd'.repeat(64),
          response: { status: 'proposed', content: 'x^2' },
          validation: { syntax_warnings: [] }
        }
      })
    );
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  process.env.AI_SERVICE_URL = 'http://127.0.0.1:' + (server.address() as any).port;
  await prisma.formulaProviderEligibility.create({
    data: {
      id: newId(),
      provider: 'gemini',
      model: 'gemini/gemini-2.5-flash',
      freeTier: true,
      billingAttached: false,
      expiresAt: new Date(Date.now() + 60000),
      keySha256: 'test-only',
      verifiedBy: 'test',
      projectId: 'fixture'
    }
  });
  await startWorker();
}, 20000);
afterAll(async () => {
  await stopWorker();
  await new Promise<void>((r) => server.close(() => r()));
  const conn = await amqp.connect(process.env.RABBITMQ_URL!);
  const ch = await conn.createChannel();
  await ch.deleteQueue(FORMULA_QUEUE);
  await ch.close();
  await conn.close();
  await prisma.formulaProviderEligibility.deleteMany({});
  await disconnectDatabase();
  await fs.rm(root, { recursive: true, force: true });
});
it('denies missing consent, authorization, approval, budget and stale version', async () => {
  expect((await submit()).status).toBe(403);
  expect(
    (
      await request(app)
        .post(base + '/recognition-jobs')
        .send({ documentId: docId, regionId, draftVersion: 0 })
    ).status
  ).toBe(401);
  expect(
    (
      await request(app)
        .post(base + '/recognition-jobs')
        .set('x-user', 'other')
        .send({ documentId: docId, regionId, draftVersion: 0 })
    ).status
  ).toBe(403);
  expect(
    (
      await request(app)
        .post(base + '/formula-consent')
        .set('x-user', 'owner')
        .send({ consent: true, documentId: docId, draftVersion: 0 })
    ).status
  ).toBe(200);
  mode = 'approval';
  expect((await submit()).status).toBe(503);
  mode = 'budget';
  expect((await submit()).status).toBe(503);
  mode = 'ok';
  expect((await submit(99)).status).toBe(409);
});
it('HTTP -> RabbitMQ -> separate worker -> MongoDB proposal -> authenticated GET; duplicate-safe', async () => {
  const a = await submit();
  expect(a.status).toBe(202);
  const job = await waitJob(a.body.job._id);
  expect(job.state).toBe('completed');
  expect(calls).toBe(1);
  const proposal = await request(app)
    .get(base + '/formula-proposals/' + job.proposalId)
    .set('x-user', 'owner');
  expect(proposal.status).toBe(200);
  expect(proposal.body.proposal.state).toBe('pending');
  expect((await submit()).body.job._id).toBe(job._id.toString());
  await dispatch(String(job._id));
  await pause(100);
  expect(calls).toBe(1);
  expect(
    (
      await request(app)
        .get(base + '/recognition-jobs/' + job._id)
        .set('x-user', 'owner')
    ).status
  ).toBe(200);
});
it.each(['timeout', 'malformed'])(
  'records %s without replaying uncertain calls',
  async (variant) => {
    await freshVersion();
    mode = variant;
    const response = await submit();
    expect(response.status).toBe(202);
    const job = await waitJob(response.body.job._id);
    expect(job.state).toBe('uncertain');
    const before = calls;
    await dispatch(String(job._id));
    await pause(100);
    expect(calls).toBe(before);
    mode = 'ok';
  }
);
it('recovers queued messages after restart; competing claims and cancellation are safe', async () => {
  await stopWorker();
  await freshVersion();
  const response = await submit();
  expect(response.status).toBe(202);
  await startWorker();
  const job = await waitJob(response.body.job._id);
  expect(job.state).toBe('completed');
  await stopWorker();
  await freshVersion();
  const next = await submit();
  const before = calls;
  await Promise.all([processJob(next.body.job._id), processJob(next.body.job._id)]);
  expect(calls).toBe(before + 1);
  await freshVersion();
  const cancelled = await submit();
  expect(
    (
      await request(app)
        .post(base + '/recognition-jobs/' + cancelled.body.job._id + '/cancel')
        .set('x-user', 'owner')
    ).body.job.state
  ).toBe('cancelled');
  await processJob(cancelled.body.job._id);
  expect(calls).toBe(before + 1);
  await startWorker();
  expect(JSON.stringify(await CourseRevision.findById(published._id).lean())).toBe(
    publishedSnapshot
  );
});

it('fails closed for missing eligibility and source mismatch', async () => {
  await freshVersion();
  await prisma.formulaProviderEligibility.updateMany({ data: { revoked: true } });
  expect((await submit()).status).toBe(503);
  await prisma.formulaProviderEligibility.updateMany({ data: { revoked: false } });
  expect(
    (
      await request(app)
        .post(base + '/recognition-jobs')
        .set('x-user', 'owner')
        .send({ documentId: 'doc_' + 'f'.repeat(16), regionId, draftVersion: draft.__v })
    ).status
  ).toBe(404);
});
it('does not accept cancelled or stale in-flight results and marks interrupted work uncertain', async () => {
  await freshVersion();
  mode = 'delayed';
  let before = calls;
  const response = await submit();
  for (let i = 0; i < 100 && calls === before; i++) await pause(10);
  expect(calls).toBe(before + 1);
  await request(app)
    .post(base + '/recognition-jobs/' + response.body.job._id + '/cancel')
    .set('x-user', 'owner');
  await pause(500);
  expect((await waitJob(response.body.job._id)).state).toBe('cancelled');
  await freshVersion();
  before = calls;
  const stale = await submit();
  for (let i = 0; i < 100 && calls === before; i++) await pause(10);
  await freshVersion();
  expect((await waitJob(stale.body.job._id)).state).toBe('stale');
  mode = 'ok';
  await stopWorker();
  await Jobs.updateOne(
    { _id: stale.body.job._id },
    { $set: { state: 'running', startedAt: new Date(Date.now() - 180000) } }
  );
  before = calls;
  await recover();
  expect((await waitJob(stale.body.job._id)).state).toBe('uncertain');
  expect(calls).toBe(before);
  await startWorker();
});
