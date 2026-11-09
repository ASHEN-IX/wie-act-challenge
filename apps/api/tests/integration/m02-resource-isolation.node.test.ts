import { createServer, type ServerResponse } from 'node:http';
import WebSocket from 'ws';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase, prisma } from '../../shared/database';
import { newId } from '../../shared/ids';
import {
  Course,
  LearningObjective,
  StudyPlan,
  StudySession,
  Task
} from '../../modules/study/src/models';
import { StudyRoom } from '../../modules/study/src/models/StudyRoom';
import AiJob from '../../modules/ai-orchestrator/src/models/AiJob';

// Real identity, Nest dispatch and PostgreSQL. No broker or inference is required.
test(
  'M02 resource isolation across real HTTP, internal dispatch and callbacks',
  { timeout: 90000 },
  async (t) => {
    // The suite shares the migrated test database with the rest of the run, so
    // every synthetic identity and row is unique to this process and removed at
    // the end.
    process.env.DATABASE_URL =
      process.env.DATABASE_URL || 'postgresql://ednova:ednova@127.0.0.1:5433/ednova_test';
    const uploads = await mkdtemp(path.join(os.tmpdir(), 'ednova-m02-uploads-'));
    t.after(() => rm(uploads, { recursive: true, force: true }));
    Object.assign(process.env, {
      INGEST_UPLOADS_DIR: uploads,
      BETTER_AUTH_SECRET: 'm02-isolated-session-secret-at-least-thirty-two-characters',
      INTERNAL_API_SECRET: 'm02-isolated-internal-secret',
      AUTH_TRUSTED_ORIGINS: 'http://localhost:5173',
      BETTER_AUTH_URL: 'http://localhost:5173',
      AI_SERVICE_URL: 'http://127.0.0.1:1',
      RABBITMQ_URL: 'amqp://127.0.0.1:1',
      REDIS_URL: '',
      NODE_ENV: 'test'
    });
    await connectDatabase();
    const userIds: string[] = [];
    const sessionIds: string[] = [];
    const roomIds: string[] = [];
    const planIds: string[] = [];
    const taskIds: string[] = [];
    const evalCorrelationIds: string[] = [];
    let createdCourseId = '';
    let aiCalls = 0;
    let lastAiBody: Record<string, unknown> = {};
    let holdAi = false;
    let pendingAi: ServerResponse | undefined;
    const ai = createServer((req, res) => {
      aiCalls++;
      assert.equal(req.headers.cookie, undefined);
      assert.equal(
        req.headers.authorization,
        'Bearer m02-synthetic-ai-service-key-at-least-32-characters'
      );
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        if (chunks.length) lastAiBody = JSON.parse(Buffer.concat(chunks).toString());
        if (holdAi) {
          pendingAi = res;
          return;
        }
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({ executionMode: 'MOCK_TEST', marker: 'M02_PRIVATE_SOURCE_SENTINEL' })
        );
      });
    });
    await new Promise<void>((resolve) => ai.listen(0, '127.0.0.1', resolve));
    const aiAddress = ai.address();
    assert.ok(aiAddress && typeof aiAddress === 'object');
    process.env.AI_SERVICE_URL = `http://127.0.0.1:${aiAddress.port}`;
    process.env.AI_SERVICE_API_KEY = 'm02-synthetic-ai-service-key-at-least-32-characters';
    const sockets: WebSocket[] = [];
    async function until(check: () => boolean, reason: string) {
      const deadline = Date.now() + 10000;
      while (!check()) {
        if (Date.now() > deadline) throw new Error('Timed out: ' + reason);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }

    const lifecycle: { stop?: () => Promise<void> } = {};
    const cleanupPaths: string[] = [];
    t.after(async () => {
      for (const socket of sockets) socket.terminate();
      pendingAi?.end('{}');
      await lifecycle.stop?.();
      await new Promise<void>((resolve) => ai.close(() => resolve()));
      const { closeAuth } = await import('../../shared/betterAuth.js');
      await closeAuth();
      // Rows first (foreign keys point at the courses/users created above), then
      // the identities. Never drop the shared database.
      if (createdCourseId) await prisma.course.deleteMany({ where: { id: createdCourseId } });
      await prisma.learningObjective.deleteMany({ where: { documentId: createdCourseId || '-' } });
      if (evalCorrelationIds.length)
        await prisma.evalResult.deleteMany({
          where: { correlationId: { in: evalCorrelationIds } }
        });
      await prisma.aiJob.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.taskRecord.deleteMany({ where: { id: { in: taskIds } } });
      await prisma.studyPlan.deleteMany({ where: { id: { in: planIds } } });
      await prisma.sessionChat.deleteMany({ where: { sessionId: { in: roomIds } } });
      // `roomIds` holds each room's public `roomId`, not the row id.
      await prisma.studyRoom.deleteMany({ where: { roomId: { in: roomIds } } });
      await prisma.voiceSession.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await prisma.studySession.deleteMany({ where: { id: { in: sessionIds } } });
      await prisma.authUser.deleteMany({ where: { id: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      for (const file of cleanupPaths) await rm(file, { recursive: true, force: true });
      await disconnectDatabase().catch(() => {});
    });
    const password = await bcrypt.hash('Synthetic!123', 12);
    const runId = `${process.pid}_${Date.now()}`;
    const actors = ['owner', 'peer', 'outsider', 'admin'].map((name) => ({
      id: newId(),
      name,
      // Run-unique: suites share one database and do not drop it.
      email: `${name}-${runId}@m02.test`,
      cookie: ''
    }));
    for (const actor of actors) {
      userIds.push(actor.id);
      // The old suite inserted the `users` document and then ran `migrateAuth`;
      // the migrated schema needs the identity, the Better Auth user and its
      // credential account up front.
      await prisma.user.create({
        data: {
          id: actor.id,
          name: actor.name,
          email: actor.email,
          isActive: true,
          isVerified: true,
          role: actor.name === 'admin' ? 'admin' : 'student',
          isAdmin: actor.name === 'admin',
          tier: 'vip_plus',
          notificationPreferences: {},
          onboardingDraft: {}
        }
      });
      await prisma.authUser.create({
        data: { id: actor.id, email: actor.email, name: actor.name, emailVerified: true }
      });
      await prisma.authAccount.create({
        data: {
          id: newId(),
          accountId: actor.id,
          providerId: 'credential',
          userId: actor.id,
          password
        }
      });
    }
    const { getAuth } = await import('../../shared/betterAuth.js');
    const auth = await getAuth();
    for (const actor of actors) {
      const response = await auth.api.signInEmail({
        body: { email: actor.email, password: 'Synthetic!123' },
        asResponse: true
      });
      assert.equal(response.status, 200);
      actor.cookie = response.headers
        .getSetCookie()
        .map((s: string) => s.split(';')[0])
        .join('; ');
    }
    const { start } = await import('../../src/main.js');
    const runtime = await start({ port: 0, workers: false });
    lifecycle.stop = runtime.stop;
    const address = runtime.server.address();
    assert.ok(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}`;
    const [owner, peer, outsider, admin] = actors;
    async function connect(roomId: string, actor: typeof owner) {
      const events: Array<Record<string, unknown>> = [];
      const status = { closed: 0 };
      const socket = new WebSocket(
        `${base.replace('http', 'ws')}/ws/realtime?roomId=${roomId}&userId=${actor.id}`,
        { headers: { cookie: actor.cookie, origin: 'http://localhost:5173' } }
      );
      sockets.push(socket);
      socket.on('message', (raw) => events.push(JSON.parse(raw.toString())));
      socket.on('close', (code) => {
        status.closed = code;
      });
      await new Promise<void>((resolve, reject) => {
        socket.once('open', resolve);
        socket.once('error', reject);
      });
      await until(
        () => !!status.closed || events.some((e) => e.type === 'ROOM_STATE_SYNC'),
        'authorized socket snapshot/denial'
      );
      return { socket, events, status };
    }

    const courseId = newId();
    createdCourseId = courseId;
    const privateRoot = path.resolve(
      __dirname,
      '../../modules/study/uploads/courses',
      String(courseId)
    );
    const sourceRoot = path.join(uploads, 'courses', String(courseId));
    const publicFile = path.resolve(
      __dirname,
      '../../modules/study/uploads',
      `m02-public-${process.pid}.png`
    );
    await mkdir(privateRoot, { recursive: true });
    await mkdir(sourceRoot, { recursive: true });
    await writeFile(path.join(privateRoot, 'private.pdf'), 'M02_PRIVATE_SOURCE_SENTINEL');
    await writeFile(path.join(sourceRoot, 'private.pdf'), 'M02_PRIVATE_SOURCE_SENTINEL');
    await writeFile(publicFile, Buffer.from('89504e470d0a1a0a', 'hex'));
    const linkFile = path.join(path.dirname(publicFile), `m02-link-${process.pid}.png`);
    await symlink(path.join(sourceRoot, 'private.pdf'), linkFile);
    cleanupPaths.push(privateRoot, sourceRoot, publicFile, linkFile);
    await Course.create({
      id: courseId,
      userId: String(owner.id),
      ownerUserId: String(owner.id),
      subjectId: newId(),
      title: 'M02 private course',
      status: 'completed',
      files: [
        {
          filename: 'private.pdf',
          originalName: 'private.pdf',
          mimetype: 'application/pdf',
          path: `courses/${courseId}/private.pdf`,
          size: 27
        }
      ],
      topics: [
        {
          title: 'Private topic',
          subtopics: [
            {
              id: 'private-topic',
              title: 'Private subtopic',
              summary: 'M02_PRIVATE_SOURCE_SENTINEL'
            }
          ]
        }
      ]
    });
    async function request(
      actor: typeof owner | null,
      route: string,
      method = 'GET',
      body?: unknown
    ) {
      const response = await fetch(base + route, {
        method,
        headers: {
          origin: 'http://localhost:5173',
          'x-forwarded-for': `192.0.2.${actor ? actors.indexOf(actor) + 1 : 99}`,
          ...(actor ? { cookie: actor.cookie } : {}),
          ...(body === undefined ? {} : { 'content-type': 'application/json' })
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const text = await response.text();
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(text);
      } catch {
        /* Download/static responses are bytes. */
      }
      return { status: response.status, data, text };
    }
    const course = `/api/v1/study/courses/${courseId}`;
    await t.test(
      'course metadata/status/download: owner allowed, others and admin denied',
      async () => {
        for (const suffix of ['', '/ingest-status', '/files/private.pdf']) {
          assert.equal((await request(owner, course + suffix)).status, 200);
          for (const actor of [peer, outsider, admin]) {
            const result = await request(actor, course + suffix);
            assert.equal(result.status, 404);
            assert.ok(!result.text.includes('M02_PRIVATE_SOURCE_SENTINEL'));
          }
          assert.equal((await request(null, course + suffix)).status, 401);
        }
        assert.equal((await request(owner, course + '/files/guessed.pdf')).status, 404);
      }
    );
    await t.test(
      'private static path denied anonymously while public image remains available',
      async () => {
        const result = await request(null, `/uploads/courses/${courseId}/private.pdf`);
        assert.equal(result.status, 404);
        assert.ok(!result.text.includes('M02_PRIVATE_SOURCE_SENTINEL'));
        assert.equal((await request(null, `/uploads/${path.basename(publicFile)}`)).status, 200);
      }
    );
    await t.test(
      'team creation cannot copy a foreign private course, including admin',
      async () => {
        for (const actor of [peer, admin])
          assert.equal(
            (
              await request(actor, '/api/v1/study/sessions/team', 'POST', {
                courseId: String(courseId)
              })
            ).status,
            404
          );
      }
    );
    const team = newId();
    sessionIds.push(team);
    await StudySession.create({
      id: team,
      userId: String(owner.id),
      type: 'team',
      status: 'active',
      // Unique per run: invite codes are globally unique and the DB is shared.
      inviteCode: `M02${runId.slice(-10)}`,
      startTime: new Date(Date.now() - 3600000),
      maxParticipants: 4,
      participants: [
        { userId: String(owner.id), role: 'host', name: 'Owner', joinedAt: new Date() },
        { userId: String(peer.id), role: 'member', name: 'Peer', joinedAt: new Date() }
      ],
      taskProgress: {
        currentTaskIndex: 0,
        completedTasks: 0,
        totalTasks: 1,
        tasks: [
          {
            taskId: 'fixture-task',
            title: 'Synthetic task',
            estimatedMinutes: 1,
            status: 'in-progress',
            startedAt: new Date(Date.now() - 3600000)
          }
        ]
      }
    });
    await t.test('outsider cannot skip another team task or change stored state', async () => {
      const before = await StudySession.findById(team);
      assert.equal(
        (await request(outsider, `/api/v1/study/sessions/${team}/task/skip`, 'POST', {})).status,
        403
      );
      assert.deepEqual(await StudySession.findById(team), before);
    });
    await t.test('voice HTTP checks membership before persistence and reads', async () => {
      const routes: Array<[string, string, unknown?]> = [
        ['start', 'POST', {}],
        ['end', 'POST', {}],
        ['status', 'GET'],
        ['participant', 'POST', {}],
        ['participant', 'DELETE'],
        ['mute', 'PATCH', { isMuted: true }]
      ];
      for (const [suffix, method, body] of routes)
        assert.equal(
          (await request(outsider, `/api/v1/voice/${team}/${suffix}`, method, body)).status,
          403
        );
      assert.equal(await prisma.voiceSession.count({ where: { sessionId: String(team) } }), 0);
      assert.equal((await request(peer, `/api/v1/voice/${team}/start`, 'POST', {})).status, 403);
      assert.equal(
        (
          await request(peer, `/api/v1/study/sessions/team/${team}/voice-consent`, 'PUT', {
            hasVoiceConsent: true
          })
        ).status,
        200
      );
      assert.equal((await request(peer, `/api/v1/voice/${team}/start`, 'POST', {})).status, 201);
      // Mongo addressed `participants.1.leftAt` with a dotted path; the column is
      // JSON, so the roster is read, edited and written back as a whole.
      const session = await StudySession.findById(team);
      assert.ok(session);
      const participants = structuredClone(session.participants);
      participants[1].leftAt = new Date();
      await StudySession.updateOne({ id: team }, { participants });
      assert.equal((await request(peer, `/api/v1/voice/${team}/status`)).status, 403);
    });
    await t.test(
      'completed legacy sessions deny transport even with stale active roster flags',
      async () => {
        await StudySession.updateOne({ id: team }, { status: 'completed' });
        assert.equal((await request(owner, `/api/v1/voice/${team}/status`)).status, 403);
        await StudySession.updateOne({ id: team }, { status: 'active' });
      }
    );
    await t.test('source grant is independent of legacy team invite or membership', async () => {
      const session = await StudySession.findById(team);
      assert.ok(session);
      const participants = structuredClone(session.participants);
      delete participants[1].leftAt;
      await StudySession.updateOne({ id: team }, { courseId: String(courseId), participants });
      assert.equal(
        (await request(peer, `/api/v1/study/sessions/team/${team}/participants`)).status,
        403
      );
      assert.equal(
        (
          await request(outsider, '/api/v1/study/sessions/team/join-by-code', 'POST', {
            inviteCode: 'M02SAFE'
          })
        ).status,
        403
      );
      assert.equal(
        (await request(owner, `/api/v1/study/sessions/team/${team}/participants`)).status,
        200
      );
    });
    await t.test('internal dispatch retains the owning-domain course authorization', async () => {
      const moduleClient = (await import('../../shared/moduleClient.js'))
        .default as unknown as typeof import('../../shared/moduleClient').default;
      await assert.rejects(
        moduleClient.get(`module://study${course}`, { headers: { Cookie: peer.cookie } }),
        (error: unknown) =>
          !!error &&
          typeof error === 'object' &&
          'response' in error &&
          (error.response as { status: number }).status === 404
      );
      assert.equal(
        (await moduleClient.get(`module://study${course}`, { headers: { Cookie: owner.cookie } }))
          .status,
        200
      );
    });
    const job = await AiJob.createPending({
      type: 'study.eval.step',
      userId: String(owner.id),
      requestId: 'm02-fixture',
      correlationId: randomUUID(),
      messageId: randomUUID(),
      payloadSnapshot: {
        courseId: String(courseId),
        sessionId: 'm02-private-conversation',
        step: 1
      }
    });
    evalCorrelationIds.push(job.correlationId);
    await t.test('AI/eval jobs do not grant admin or peer access to private results', async () => {
      for (const route of [`/api/v1/ai/jobs/${job.jobId}`, `/api/v1/eval/jobs/${job.jobId}`]) {
        assert.equal((await request(owner, route)).status, 200);
        for (const actor of [peer, admin]) assert.equal((await request(actor, route)).status, 404);
      }
    });
    await t.test(
      'legacy jobs without provenance fail closed; source-free scoped jobs still work',
      async () => {
        const legacy = await AiJob.create({
          type: 'study.search.query',
          userId: String(owner.id),
          correlationId: randomUUID(),
          messageId: randomUUID(),
          requestId: 'm02-legacy',
          result: { private: 'M02_PRIVATE_SOURCE_SENTINEL' }
        });
        evalCorrelationIds.push(legacy.correlationId);
        assert.equal((await request(owner, `/api/v1/ai/jobs/${legacy.jobId}`)).status, 404);
        const fresh = await AiJob.createPending({
          type: 'study.search.query',
          userId: String(owner.id),
          correlationId: randomUUID(),
          messageId: randomUUID(),
          requestId: 'm02-free'
        });
        evalCorrelationIds.push(fresh.correlationId);
        assert.equal((await request(owner, `/api/v1/ai/jobs/${fresh.jobId}`)).status, 200);
        assert.equal((await request(admin, `/api/v1/search/jobs/${fresh.jobId}`)).status, 404);
        await prisma.aiJob.updateMany({
          where: { jobId: fresh.jobId },
          data: { resourceScope: [] }
        });
        assert.equal((await request(owner, `/api/v1/ai/jobs/${fresh.jobId}`)).status, 404);
      }
    );
    await t.test('AI policy rejects foreign course for admin before inference', async () => {
      assert.equal(
        (await request(admin, '/api/v1/ai/plan', 'POST', { courseId: String(courseId) })).status,
        404
      );
    });
    await t.test('foreign objective cannot be resolved before evaluator dispatch', async () => {
      await LearningObjective.create({
        userId: String(owner.id),
        documentId: String(courseId),
        objectiveId: 'm02-private-objective',
        isActive: true,
        bloomLevel: 'Apply',
        knowledgeType: 'Conceptual',
        topicId: 'private-topic',
        verb: 'Apply',
        text: 'Private objective',
        textHash: 'm02-private-objective-hash'
      });
      const result = await request(peer, '/api/v1/eval/step', 'POST', {
        sessionId: 'synthetic',
        contextId: 'synthetic-context',
        step: 1,
        studentAnswer: 'Synthetic answer',
        objectiveId: 'm02-private-objective'
      });
      assert.equal(result.status, 422);
      assert.equal(await AiJob.countDocuments({ userId: String(peer.id) }), 0);
    });
    const { handleResult } =
      await import('../../modules/ai-orchestrator/src/services/jobResultConsumer.js');
    const result = {
      version: '1',
      timestamp: new Date().toISOString(),
      type: 'study.eval.step' as const,
      status: 'completed' as const,
      requestId: job.requestId!,
      correlationId: job.correlationId,
      messageId: job.messageId,
      userId: String(owner.id),
      payload: {
        sessionId: 'm02-private-conversation',
        step: 1,
        state: 'CONTINUE',
        mastery_score: 0.4
      }
    };
    await t.test(
      'forged callback actor/message/scope and unmatched results cause no writes',
      async () => {
        for (const forged of [
          { ...result, userId: String(peer.id) },
          { ...result, payload: { ...result.payload, userId: String(peer.id) } },
          { ...result, messageId: randomUUID() },
          { ...result, payload: { ...result.payload, sessionId: 'other-conversation' } },
          { ...result, correlationId: randomUUID() }
        ]) {
          await handleResult(forged);
          assert.equal((await AiJob.findById(job.id))!.status, 'PENDING');
        }
        // The Mongo assertion counted every document in the database because the
        // suite owned a private one. Shared here, the equivalent is "this job
        // wrote no result row".
        assert.equal(
          await prisma.evalResult.count({ where: { correlationId: job.correlationId } }),
          0
        );
      }
    );

    await t.test(
      'alternate static encodings and symlinks cannot expose private bytes',
      async () => {
        for (const url of [
          `/uploads/${path.basename(linkFile)}`,
          `/uploads/courses%2f${courseId}%2fprivate.pdf`
        ]) {
          const response = await request(null, url);
          assert.equal(response.status, 404);
          assert.ok(!response.text.includes('M02_PRIVATE_SOURCE_SENTINEL'));
        }
      }
    );
    await t.test('source checks precede AI transport and reject conflicting aliases', async () => {
      const vector = `/api/v1/ai/vector/status/${courseId}`;
      const before = aiCalls;
      for (const actor of [peer, admin]) assert.equal((await request(actor, vector)).status, 404);
      assert.equal(aiCalls, before);
      assert.equal((await request(owner, vector)).status, 200);
      assert.equal(aiCalls, before + 1);
      assert.equal((await request(owner, vector + '?courseId=' + newId())).status, 422);
      assert.equal(
        (
          await request(owner, '/api/v1/ai/plan', 'POST', {
            courseId: String(courseId),
            course_id: String(newId())
          })
        ).status,
        422
      );
      assert.equal(aiCalls, before + 1);
    });
    await t.test(
      'planning forwards only the owning Study projection and authenticated actor',
      async () => {
        const response = await request(owner, '/api/v1/ai/plan', 'POST', {
          courseId: String(courseId)
        });
        assert.equal(response.status, 201);
        assert.equal(lastAiBody.user_id, String(owner.id));
        const context = lastAiBody.course_knowledge as Record<string, unknown>;
        assert.deepEqual(Object.keys(context).sort(), ['id', 'title', 'topics']);
        assert.equal(context.id, String(courseId));
        assert.ok(JSON.stringify(context).includes('M02_PRIVATE_SOURCE_SENTINEL'));
        assert.equal(context.files, undefined);
      }
    );
    await t.test(
      'generic jobs cannot bypass objective ownership or stage arbitrary source files',
      async () => {
        assert.equal(
          (
            await request(peer, '/api/v1/ai/jobs', 'POST', {
              type: 'study.eval.step',
              payload: {
                sessionId: 'synthetic',
                contextId: 'synthetic',
                step: 1,
                studentAnswer: 'Synthetic',
                objectiveId: 'm02-private-objective'
              }
            })
          ).status,
          422
        );
        assert.equal(
          (
            await request(owner, '/api/v1/ai/jobs', 'POST', {
              type: 'study.ingest.course',
              payload: { courseId: String(courseId), fileRef: 'uploads/foreign-private.pdf' }
            })
          ).status,
          403
        );
      }
    );
    await t.test(
      'three sockets preserve room isolation, targeted signaling and revocation',
      async () => {
        const room = await request(owner, '/api/v1/study/rooms', 'POST', { enableVoice: true });
        assert.equal(room.status, 201);
        const id = String(room.data.roomId);
        roomIds.push(id);
        const doc = await StudyRoom.findOne({ roomId: id });
        assert.ok(doc);
        assert.equal(
          (
            await request(peer, '/api/v1/study/rooms/join', 'POST', {
              inviteCode: doc.inviteCode,
              hasVoiceConsent: true
            })
          ).status,
          200
        );
        const a1 = await connect(id, owner);
        const a2 = await connect(id, owner);
        const b = await connect(id, peer);
        const denied = await connect(id, outsider);
        assert.equal(denied.status.closed, 4403);
        const other = await request(outsider, '/api/v1/study/rooms', 'POST', {
          enableVoice: false
        });
        roomIds.push(String(other.data.roomId));
        const c = await connect(String(other.data.roomId), outsider);
        a1.socket.send(
          JSON.stringify({
            type: 'voice_signal',
            sessionId: String(other.data.roomId),
            signalType: 'offer',
            targetUserId: String(peer.id),
            signal: { sdp: 'M02_SYNTHETIC_SDP' }
          })
        );
        await until(() => b.events.some((e) => e.type === 'voice_signal'), 'targeted signaling');
        assert.ok(!a2.events.some((e) => e.type === 'voice_signal'));
        assert.ok(!c.events.some((e) => e.type === 'voice_signal'));
        assert.equal(
          (await request(peer, `/api/v1/study/rooms/${id}/leave`, 'POST', {})).status,
          200
        );
        await until(() => b.status.closed === 4403, 'membership ejection');
        assert.equal((await connect(id, peer)).status.closed, 4403);
        assert.equal((await request(peer, `/api/v1/session-chat/${id}/history`)).status, 403);
        assert.equal(
          (
            await request(owner, `/api/v1/study/rooms/${id}/phase`, 'PUT', {
              currentPhase: 'peer_discussion'
            })
          ).status,
          200
        );
        assert.equal((await request(owner, `/api/v1/study/rooms/${id}`)).status, 200);
      }
    );
    const materializedPlanId = newId();
    const materializedTaskId = newId();
    planIds.push(materializedPlanId);
    taskIds.push(materializedTaskId);
    await StudyPlan.create({
      id: materializedPlanId,
      userId: String(owner.id),
      courseId: String(courseId),
      resourceScope: { courseId: String(courseId) },
      goal: 'M02_PRIVATE_SOURCE_SENTINEL',
      availableTimeMinutes: 0,
      status: 'created',
      taskGraph: { tasks: [] }
    });
    await Task.create({
      id: materializedTaskId,
      userId: String(owner.id),
      studyPlanId: String(materializedPlanId),
      title: 'M02_PRIVATE_SOURCE_SENTINEL',
      status: 'todo'
    });
    await t.test('materialized private source is usable while authorized', async () => {
      assert.equal((await request(owner, `/api/v1/study/plans/${materializedPlanId}`)).status, 200);
      assert.equal((await request(owner, `/api/v1/study/tasks/${materializedTaskId}`)).status, 200);
      for (const actor of [peer, admin]) {
        assert.equal(
          (await request(actor, `/api/v1/study/tasks/${materializedTaskId}`)).status,
          404
        );
      }
      assert.equal((await request(owner, `/api/v1/coach/jobs/${job.jobId}`)).status, 404);
    });
    await t.test(
      'valid callback is private/idempotent and cached job delivery rechecks source revocation',
      async () => {
        await Promise.all([
          handleResult(result),
          handleResult({ ...result, payload: { ...result.payload, mastery_score: 0.9 } })
        ]);
        const accepted = await AiJob.findById(job.id);
        await handleResult({ ...result, payload: { ...result.payload, mastery_score: 0.1 } });
        assert.deepEqual((await AiJob.findById(job.id))!.result, accepted!.result);
        assert.equal(
          (await prisma.evalResult.findFirst({ where: { correlationId: job.correlationId } }))!
            .masteryScore,
          (accepted!.result as { mastery_score: number }).mastery_score
        );
        assert.equal((await AiJob.findById(job.id))!.status, 'COMPLETED');
        assert.equal(
          await prisma.evalResult.count({
            where: { correlationId: job.correlationId, userId: String(owner.id) }
          }),
          1
        );
        assert.equal((await request(owner, `/api/v1/eval/jobs/${job.jobId}`)).status, 200);
        const sourceRoom = await request(owner, '/api/v1/study/rooms', 'POST', {
          courseId: String(courseId),
          enableVoice: false
        });
        assert.equal(sourceRoom.status, 201);
        roomIds.push(String(sourceRoom.data.roomId));
        const sourceSocket = await connect(String(sourceRoom.data.roomId), owner);
        holdAi = true;
        const inFlight = request(owner, `/api/v1/ai/vector/status/${courseId}`);
        await until(() => !!pendingAi, 'held synthetic inference response');
        await Course.updateOne({ id: courseId }, { userId: String(outsider.id) });
        pendingAi!.setHeader('content-type', 'application/json');
        pendingAi!.end(JSON.stringify({ marker: 'M02_PRIVATE_SOURCE_SENTINEL' }));
        holdAi = false;
        const deniedResult = await inFlight;
        assert.equal(deniedResult.status, 404);
        assert.ok(!deniedResult.text.includes('M02_PRIVATE_SOURCE_SENTINEL'));
        const realtime = await import('../../modules/notification/src/realtime.js');
        await realtime.broadcastToSession(String(sourceRoom.data.roomId), {
          type: 'M02_PROTECTED_MARKER'
        });
        await until(() => sourceSocket.status.closed === 4403, 'source-revoked socket ejection');
        assert.ok(!sourceSocket.events.some((e) => e.type === 'M02_PROTECTED_MARKER'));
        assert.equal((await connect(String(sourceRoom.data.roomId), owner)).status.closed, 4403);
        assert.equal(
          (await request(owner, `/api/v1/study/plans/${materializedPlanId}`)).status,
          404
        );
        assert.equal(
          (await request(owner, `/api/v1/study/tasks/${materializedTaskId}`)).status,
          404
        );
        assert.ok(
          !(await request(owner, '/api/v1/study/plans')).text.includes(
            'M02_PRIVATE_SOURCE_SENTINEL'
          )
        );
        assert.ok(
          !(await request(owner, '/api/v1/study/tasks')).text.includes(
            'M02_PRIVATE_SOURCE_SENTINEL'
          )
        );

        assert.equal((await request(owner, `/api/v1/eval/jobs/${job.jobId}`)).status, 404);
        assert.equal(
          (await request(owner, `/api/v1/study/sessions/team/${team}/participants`)).status,
          403
        );
      }
    );
  }
);
