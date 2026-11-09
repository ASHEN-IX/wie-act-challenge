/** Real Nest + Better Auth + PostgreSQL + revision artifacts. Inference alone is a test HTTP fixture. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase, prisma } from '../../shared/database';
import { newId } from '../../shared/ids';
import { materializeRevisionFixture } from '../helpers/revisionArtifactFixture';
import { Course, CourseRevision } from '../../modules/study/src/models';
import { NardouchConversationModel } from '../../modules/study/src/models/NardouchConversation';

test(
  'Nardouch: real authorization, continuity, persistence and stale-write protection',
  { timeout: 60000 },
  async (t) => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL || 'postgresql://ednova:ednova@127.0.0.1:5433/ednova_test';
    await connectDatabase();
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nardouch-integration-'));
    const seen: Array<{ history: unknown[] }> = [];
    const source = 'Recursion requires a base case. factorial(0) = 1.';
    const ai = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        assert.equal(req.headers.authorization, 'Bearer ' + 'n'.repeat(40));
        const body = JSON.parse(Buffer.concat(chunks).toString());
        seen.push(body);
        res.setHeader('content-type', 'application/json');
        const text = 'El récursivité test7a9 base case. factorial(0) = 1.';
        const answer = {
          displayText: text,
          speechText: text,
          followups: ['3lech base case?'],
          citations: [
            {
              documentId: document.documentId,
              pageNumber: null,
              chunkId: 'chk_' + document.contentHash.slice(7),
              textHash: document.contentHash,
              quote: source,
              verified: true
            }
          ],
          evidenceStatus: 'source_linked',
          mode: body.mode,
          language: body.language,
          usage: {
            traceId: body.traceId,
            model: 'test-http-fixture',
            tier: 'capable',
            executionMode: 'REAL_APPROVED',
            latencyMs: 1,
            tokens: null,
            fallbackUsed: false
          }
        };
        setTimeout(() => res.end(JSON.stringify(answer)), 100);
      });
    });
    await new Promise<void>((resolve) => ai.listen(0, '127.0.0.1', resolve));
    Object.assign(process.env, {
      NODE_ENV: 'test',
      BETTER_AUTH_SECRET: 'nardouch-integration-secret-at-least-32-characters',
      BETTER_AUTH_URL: 'http://localhost:5173',
      AUTH_TRUSTED_ORIGINS: 'http://localhost:5173',
      INTERNAL_API_SECRET: 'nardouch-integration-internal-secret',
      AI_SERVICE_API_KEY: 'n'.repeat(40),
      AI_SERVICE_URL: `http://127.0.0.1:${(ai.address() as AddressInfo).port}`,
      RABBITMQ_URL: 'amqp://127.0.0.1:1',
      REDIS_URL: '',
      INGEST_UPLOADS_DIR: path.join(directory, 'uploads'),
      FAISS_INDEX_DIR: path.join(directory, 'faiss')
    });
    const runtime: {
      current?: Awaited<ReturnType<(typeof import('../../src/main.js'))['start']>>;
    } = {};
    const actorIds = ['owner', 'stranger'].map(() => newId());
    let courseId: string | undefined; // eslint-disable-line prefer-const -- assigned after teardown registration
    t.after(async () => {
      await runtime.current?.stop();
      try {
        if (courseId) {
          await NardouchConversationModel.deleteMany({ courseId });
          await CourseRevision.deleteMany({ courseId });
          await Course.deleteMany({ id: courseId });
        }
        await prisma.authSession.deleteMany({ where: { userId: { in: actorIds } } });
        await prisma.authAccount.deleteMany({ where: { userId: { in: actorIds } } });
        await prisma.authUser.deleteMany({ where: { id: { in: actorIds } } });
        await prisma.user.deleteMany({ where: { id: { in: actorIds } } });
        await prisma.authRateLimit.deleteMany({});
      } finally {
        await disconnectDatabase().catch(() => {});
        await new Promise<void>((r) => ai.close(() => r()));
        await fs.rm(directory, { recursive: true, force: true });
      }
    });
    const runTag = `${process.pid}_${Date.now()}`;
    const actors = ['owner', 'stranger'].map((name, index) => ({
      id: actorIds[index],
      name,
      email: `nardouch-${name}-${runTag}@synthetic.test`,
      cookie: ''
    }));
    const password = await bcrypt.hash('Synthetic!123', 12);
    await prisma.authRateLimit.deleteMany({});
    for (const a of actors) {
      await prisma.user.create({
        data: {
          id: a.id,
          name: a.name,
          email: a.email,
          password,
          role: 'student',
          tier: 'vip',
          isActive: true,
          isVerified: true,
          notificationPreferences: {},
          onboardingDraft: {}
        }
      });
      await prisma.authUser.create({
        data: { id: a.id, email: a.email, name: a.name, emailVerified: true }
      });
      await prisma.authAccount.create({
        data: { id: newId(), accountId: a.id, providerId: 'credential', userId: a.id, password }
      });
    }
    const auth = await (await import('../../shared/betterAuth.js')).getAuth();
    for (const actor of actors) {
      const response = await auth.api.signInEmail({
        body: { email: actor.email, password: 'Synthetic!123' },
        asResponse: true
      });
      assert.equal(response.status, 200);
      actor.cookie = response.headers
        .getSetCookie()
        .map((v) => v.split(';')[0])
        .join('; ');
    }
    runtime.current = await (await import('../../src/main.js')).start({ port: 0, workers: false });
    const base = `http://127.0.0.1:${(runtime.current.server.address() as AddressInfo).port}/api/v1/study/nardouch`;
    const course = await Course.create({
      userId: actors[0].id.toString(),
      ownerUserId: actors[0].id.toString(),
      scope: 'personal',
      subjectId: 'test-subject',
      title: 'Recursion',
      status: 'completed',
      activeRevisionId: 'rev_nardouch'
    });
    courseId = course.id.toString();
    await CourseRevision.create({
      courseId: course.id,
      revisionTag: 'rev_nardouch',
      contentHash: 'c'.repeat(64),
      status: 'published',
      activationState: 'committed',
      topics: [],
      isInstructorReviewed: true
    });
    const document = await materializeRevisionFixture(courseId!, 'rev_nardouch', source);

    async function call(actor: number | null, method: string, endpoint: string, body?: unknown) {
      const response = await fetch(base + endpoint, {
        method,
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:5173',
          ...(actor === null ? {} : { cookie: actors[actor].cookie })
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      return {
        status: response.status,
        body: (await response.json()) as {
          conversation: {
            id: string;
            messages: Array<{ answer: { citations: Array<{ documentId: string }> } }>;
            version: number;
            userId?: never;
            feedback?: never;
          };
        },
        cache: response.headers.get('cache-control')
      };
    }
    const input = {
      courseId,
      revisionId: 'rev_nardouch',
      message: 'Ya Nardouch mafhemtech el récursivité',
      mode: 'explain',
      language: { language: 'darija', script: 'arabizi' },
      expectedVersion: 0
    };
    await t.test('real sessions and course ownership are required', async () => {
      assert.equal((await call(null, 'POST', '/turn', input)).status, 401);
      assert.equal((await call(1, 'POST', '/turn', input)).status, 403);
      assert.equal(seen.length, 0);
    });
    let id = '';
    await t.test('a real source-linked answer persists privately', async () => {
      const result = await call(0, 'POST', '/turn', input);
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.equal(result.cache, 'private, no-store');
      id = result.body.conversation.id;
      assert.equal(
        result.body.conversation.messages[1].answer.citations[0].documentId,
        document.documentId
      );
      const saved = await NardouchConversationModel.findById(id).lean();
      assert.equal(saved?.messages.length, 2);
      assert.equal(saved?.version, 1);
      assert.ok(!saved?.lockToken);
    });
    await t.test('retrieval and continuation cannot cross owners', async () => {
      assert.equal((await call(1, 'GET', `/conversations/${id}`)).status, 404);
      assert.equal(
        (await call(1, 'POST', '/turn', { ...input, conversationId: id, expectedVersion: 1 }))
          .status,
        403
      );
      const result = await call(0, 'POST', '/turn', {
        ...input,
        conversationId: id,
        expectedVersion: 1,
        message: 'I meant call stack, not a stack exercise.'
      });
      assert.equal(result.status, 200, JSON.stringify(result.body));
      assert.equal(result.body.conversation.messages.length, 4);
      assert.equal(seen[1].history.length, 2);
    });
    await t.test('only one concurrent continuation wins a version', async () => {
      const responses = await Promise.all([
        call(0, 'POST', '/turn', { ...input, conversationId: id, expectedVersion: 2 }),
        call(0, 'POST', '/turn', { ...input, conversationId: id, expectedVersion: 2 })
      ]);
      assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
      const result = await call(0, 'GET', `/conversations/${id}`);
      assert.equal(result.body.conversation.version, 3);
      assert.equal(result.body.conversation.messages.length, 6);
      assert.equal(result.body.conversation.userId, undefined);
      assert.equal(result.body.conversation.feedback, undefined);
    });
    await t.test('course revocation removes access to stored history', async () => {
      await Course.updateOne(
        { id: course.id },
        { $set: { userId: 'revoked', ownerUserId: 'revoked' } }
      );
      assert.equal((await call(0, 'GET', `/conversations/${id}`)).status, 403);
    });
  }
);
