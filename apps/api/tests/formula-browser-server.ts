// Isolated browser fixture. No production key or external provider is used.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { config } from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MongoClient, ObjectId } from 'mongodb';
import amqp from 'amqplib';

async function main() {
  config({ path: path.resolve('../../.env') });
  process.env.NODE_ENV = 'test';
  const name = process.env.FORMULA_E2E_DB_NAME!;
  if (!/^test_formula_browser_\d+$/.test(name)) throw new Error('isolated database required');
  const origin = 'http://localhost:5350';
  Object.assign(process.env, {
    MONGODB_URI: 'mongodb://127.0.0.1:27017/' + name,
    BETTER_AUTH_SECRET: 'isolated-formula-browser-secret-at-least-32-chars',
    BETTER_AUTH_URL: origin,
    AUTH_TRUSTED_ORIGINS: origin,
    INTERNAL_API_SECRET: 'isolated-formula-internal-secret',
    REDIS_URL: '',
    FORMULA_QUEUE: 'ai.test.' + name,
    FORMULA_ROUTING_KEY: 'test.' + name
  });
  process.env.RABBITMQ_URL = `amqp://${encodeURIComponent(process.env.RABBITMQ_USER || 'ednova')}:${encodeURIComponent(process.env.RABBITMQ_PASS || '')}@localhost:5672/${encodeURIComponent(process.env.RABBITMQ_VHOST || 'ednova')}`;
  const uploads = await fs.mkdtemp(path.join(os.tmpdir(), 'ednova-formula-browser-'));
  process.env.INGEST_UPLOADS_DIR = uploads;
  process.env.FAISS_INDEX_DIR = path.join(uploads, 'indexes');
  await fs.mkdir(path.join(uploads, 'originals'));
  const fixture = path.resolve('../ai/agents/course_ingestion/extraction/benchmarks/formula');
  const bytes = await fs.readFile(path.join(fixture, '../reference-course.pdf'));
  const hash = 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
  await fs.writeFile(path.join(uploads, 'originals', hash.slice(7)), bytes);
  const selected = ['eq-000', 'eq-063', 'eq-017'];
  const cases = JSON.parse(
    await fs.readFile(path.join(fixture, 'dataset.json'), 'utf8')
  ).cases.filter((c: any) => selected.includes(c.id));
  const outputs = (await fs.readFile(path.join(fixture, 'gemini-2.5-flash.research.jsonl'), 'utf8'))
    .trim()
    .split('\n')
    .map((s) => JSON.parse(s))
    .filter((c) => c.case_id);
  const documentId = 'doc_' + hash.slice(7, 23);
  const mock = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    res.setHeader('Content-Type', 'application/json');
    if (req.url?.endsWith('/recognition-preflight')) return res.end('{"available":true}');
    if (req.url?.endsWith('/sources/index')) {
      const units = body.units || [];
      if (units.length !== 3) {
        res.statusCode = 422;
        return res.end('{}');
      }
      const index = await fs.readFile(path.resolve('tests/fixtures/formula-three-vectors.faiss'));
      const digest = (b: Buffer | string) =>
        'sha256:' + crypto.createHash('sha256').update(b).digest('hex');
      const chunks = units.map((u: any) => u.text);
      const meta = {
        schemaVersion: '1.0.0',
        courseId: body.courseId,
        revisionId: body.revisionId,
        contentHash: body.contentHash,
        documents: body.documents,
        manifestDigest: body.manifestDigest,
        indexHash: digest(index),
        chunks,
        metas: units.map((u: any) => ({
          course_id: body.courseId,
          revision_id: body.revisionId,
          document_id: body.documents[0].documentId,
          content_hash: body.documents[0].contentHash,
          text_hash: digest(u.text),
          chunk_id: 'chk_' + digest(u.text).slice(7),
          page_number: 1,
          section_id: 'lesson',
          provenance: 'extracted',
          representation: u.formulaReview ? 'instructor_reviewed' : 'source_extraction',
          formula_review: u.formulaReview,
          block_ids: u.blockIds,
          source_chunk_ids: u.chunkIds
        }))
      };
      const dest = path.join(process.env.FAISS_INDEX_DIR!, body.courseId, body.revisionId);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      for (const [suffix, data] of [
        ['.faiss', index],
        ['.meta.json', Buffer.from(JSON.stringify(meta))]
      ] as const) {
        try {
          await fs.writeFile(dest + suffix, data, { flag: 'wx' });
        } catch (e) {
          if ((e as any).code !== 'EEXIST' || !(await fs.readFile(dest + suffix)).equals(data))
            throw e;
        }
      }
      return res.end(
        JSON.stringify({
          ready: true,
          manifestDigest: body.manifestDigest,
          indexHash: meta.indexHash
        })
      );
    }
    const c = cases.find((c: any) => c.region_id === body.regionId);
    if (!c || body.documentId !== documentId) {
      res.statusCode = 404;
      return res.end('{}');
    }
    const image = await fs.readFile(path.join(fixture, c.crop));
    const cropHash = 'sha256:' + crypto.createHash('sha256').update(image).digest('hex');
    if (req.url?.endsWith('/region-crop')) {
      res.setHeader('Content-Type', 'image/png');
      return res.end(image);
    }
    const region = {
      documentId,
      documentHash: hash,
      regionId: c.region_id,
      page: c.page,
      bbox: c.region_bbox,
      text: c.baseline_text,
      cropHash
    };
    if (req.url?.endsWith('/region-inspect')) return res.end(JSON.stringify(region));
    // Deterministic mock transport delay makes running status observable.
    await new Promise((r) => setTimeout(r, 2500));
    const output = outputs.find((o) => o.case_id === c.id);
    res.end(
      JSON.stringify({
        modelVersion: 'mock-gemini-browser',
        usage: { totalTokens: 100 },
        proposal: {
          ...output.proposal,
          source: {
            ...output.proposal.source,
            document_id: documentId,
            revision_id: body.revisionId
          },
          model: 'gemini/gemini-2.5-flash'
        }
      })
    );
  });
  await new Promise<void>((r) => mock.listen(0, '127.0.0.1', r));
  process.env.AI_SERVICE_URL = 'http://127.0.0.1:' + (mock.address() as any).port;
  const dbClient = new MongoClient(process.env.MONGODB_URI!);
  await dbClient.connect();
  const db = dbClient.db();
  const userId = new ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa');
  await db.collection('users').insertOne({
    _id: userId,
    email: 'formula@example.test',
    name: 'Formula Instructor',
    password: await bcrypt.hash('FormulaPass!123', 12),
    isVerified: true,
    isActive: true,
    role: 'student',
    tier: 'vip'
  });
  const { migrateAuth } = require('../scripts/migrate-auth');
  await migrateAuth(db, { apply: true });
  const { start } = require('../dist/main');
  const runtime = await start({ port: 5351, workers: false });
  const { Course, CourseRevision } = require('../modules/study/src/models');
  const { activityDigest } = require('../modules/study/src/services/activityIdentity');
  const courseId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
  const topics = [
    {
      id: 'chapter',
      title: 'Reference mathematics',
      subtopics: [
        {
          id: 'lesson',
          title: 'Formula review examples',
          summary: 'Source-backed expressions.',
          learning_objectives: []
        }
      ]
    }
  ];
  await Course.create({
    _id: courseId,
    userId: String(userId),
    ownerUserId: String(userId),
    scope: 'personal',
    subjectId: 'math',
    title: 'Formula review browser course',
    status: 'completed',
    topics,
    files: [
      {
        filename: 'cours-chap3et4.pdf',
        originalName: 'cours-chap3et4.pdf',
        fileHash: hash.slice(7),
        size: bytes.length
      }
    ]
  });
  const span = (c: any) => ({
    chunkId: 'chunk_' + c.id,
    documentId,
    pageNumber: c.page,
    lineStart: 1,
    lineEnd: 1
  });
  const canonical = {
    schemaVersion: '1.0.0',
    courseId,
    title: 'Formula review browser course',
    provenance: { content: 'extracted', structure: 'deterministic' },
    verification: 'source_text_unverified',
    chapters: [
      {
        id: 'chapter',
        title: 'Reference mathematics',
        lessons: [
          {
            id: 'lesson',
            title: 'Formula review examples',
            summary: 'Source-backed expressions.',
            source_spans: cases.map(span),
            blocks: cases.map((c: any) => ({
              id: 'blk_' + c.id,
              type: 'math',
              regionId: c.region_id,
              page: c.page,
              bbox: c.region_bbox,
              expression: c.baseline_text,
              notation: 'plain',
              evidence: [span(c)],
              provenance: 'extracted',
              verification: 'source_backed',
              issues: []
            }))
          }
        ]
      }
    ]
  };
  await CourseRevision.create({
    courseId,
    revisionTag: 'rev_browser',
    status: 'draft',
    contentHash: hash.slice(7),
    isInstructorReviewed: false,
    topics,
    contentDocument: canonical,
    contentDocumentHash: activityDigest(canonical),
    sourceManifest: [
      {
        documentId,
        filename: 'cours-chap3et4.pdf',
        contentHash: hash,
        provenance: 'extracted',
        storageRef: 'originals/' + hash.slice(7),
        mediaType: 'application/pdf'
      }
    ]
  });
  await db.collection('formula_provider_eligibility').insertOne({
    provider: 'gemini',
    model: 'gemini/gemini-2.5-flash',
    freeTier: true,
    billingAttached: false,
    expiresAt: new Date(Date.now() + 900000),
    keySha256: 'mock-key-no-external-call',
    verifiedBy: 'isolated fixture',
    projectId: 'fixture'
  });
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', 'scripts/formula-recognition-worker.ts'],
    { cwd: process.cwd(), env: process.env, stdio: 'inherit' }
  );
  async function stop() {
    child.kill('SIGTERM');
    await new Promise((r) => child.once('exit', r));
    await runtime.stop();
    await new Promise<void>((r) => mock.close(() => r()));
    const conn = await amqp.connect(process.env.RABBITMQ_URL!);
    const ch = await conn.createChannel();
    await ch.deleteQueue(process.env.FORMULA_QUEUE!);
    await ch.close();
    await conn.close();
    await db.dropDatabase();
    await dbClient.close();
    await fs.rm(uploads, { recursive: true, force: true });
    process.exit(0);
  }
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  console.log('formula-browser-ready');
}
main().catch(() => {
  console.error('formula-browser-start-failed');
  process.exit(1);
});
