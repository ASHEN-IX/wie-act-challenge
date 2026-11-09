import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase, prisma } from '../../shared/database';
import { newId } from '../../shared/ids';
import { StudyRoom } from '../../modules/study/src/models';
import { DEFAULT_BINARY_SEARCH } from '../../shared/visualization';

test(
  'ED-35 real authenticated deterministic room cursor, replay and privacy',
  { timeout: 90000 },
  async (t) => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL || 'postgresql://ednova:ednova@127.0.0.1:5433/ednova_test';
    Object.assign(process.env, {
      NODE_ENV: 'test',
      BETTER_AUTH_SECRET: 'ed35-test-secret-at-least-32-characters',
      BETTER_AUTH_URL: 'http://localhost:5173',
      AUTH_TRUSTED_ORIGINS: 'http://localhost:5173',
      INTERNAL_API_SECRET: 'ed35-internal-secret',
      AI_SERVICE_URL: 'http://127.0.0.1:1',
      RABBITMQ_URL: 'amqp://127.0.0.1:1',
      REDIS_URL: ''
    });
    await connectDatabase();
    const runtime: {
      current?: Awaited<ReturnType<(typeof import('../../src/main.js'))['start']>>;
    } = {};
    const password = await bcrypt.hash('Synthetic!123', 12);
    // One migrated database is shared by every suite; keep run-unique identity.
    const run = `${process.pid}_${Date.now()}`;
    const actors = ['presenter', 'peer', 'late', 'outsider'].map((name) => ({
      id: newId(),
      name,
      email: `ed35-${name}-${run}@synthetic.test`,
      cookie: ''
    }));
    const ids = actors.map((actor) => actor.id);
    t.after(async () => {
      await runtime.current?.stop().catch(() => {});
      try {
        await StudyRoom.deleteMany({ hostUserId: { $in: ids } });
        await prisma.studentAttempt.deleteMany({ where: { userId: { in: ids } } });
        await prisma.learningEvidence.deleteMany({ where: { userId: { in: ids } } });
        await prisma.learningRewardLedger.deleteMany({ where: { userId: { in: ids } } });
        await prisma.authSession.deleteMany({ where: { userId: { in: ids } } });
        await prisma.authAccount.deleteMany({ where: { userId: { in: ids } } });
        await prisma.authUser.deleteMany({ where: { id: { in: ids } } });
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
        await prisma.authRateLimit.deleteMany({});
      } catch {
        /* Cleanup is best-effort; the run's rows are namespaced. */
      } finally {
        await disconnectDatabase().catch(() => {});
      }
    });
    await prisma.authRateLimit.deleteMany({});
    for (const actor of actors) {
      await prisma.user.create({
        data: {
          id: actor.id,
          email: actor.email,
          name: actor.name,
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
    const auth = await (await import('../../shared/betterAuth.js')).getAuth();
    for (const actor of actors) {
      const response = await auth.api.signInEmail({
        body: { email: actor.email, password: 'Synthetic!123' },
        asResponse: true
      });
      assert.equal(response.status, 200);
      actor.cookie = response.headers
        .getSetCookie()
        .map((value: string) => value.split(';')[0])
        .join('; ');
    }
    runtime.current = await (await import('../../src/main.js')).start({ port: 0, workers: false });
    const address = runtime.current.server.address();
    assert.ok(address && typeof address === 'object');
    const origin = 'http://127.0.0.1:' + address.port;
    const [presenter, peer, late, outsider] = actors;
    async function request(
      actor: typeof presenter | null,
      method: string,
      endpoint: string,
      body?: unknown
    ) {
      const response = await fetch(origin + '/api/v1/study/rooms' + endpoint, {
        method,
        headers: {
          ...(actor ? { cookie: actor.cookie } : {}),
          'content-type': 'application/json',
          origin: 'http://localhost:5173'
        },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      return { status: response.status, body: await response.json() };
    }
    const created = await request(presenter, 'POST', '', {
      commandId: randomUUID(),
      title: 'Binary search demonstration',
      enableVoice: false
    });
    assert.equal(created.status, 201);
    const roomId = created.body.roomId,
      endpoint = '/' + roomId + '/visualization';
    assert.equal(
      (
        await request(peer, 'POST', '/join', {
          commandId: randomUUID(),
          inviteCode: created.body.inviteCode
        })
      ).status,
      200
    );
    const initial = await request(presenter, 'GET', endpoint);
    assert.equal(initial.status, 200);
    assert.deepEqual(initial.body.state, DEFAULT_BINARY_SEARCH);
    const next = {
      commandId: randomUUID(),
      expectedSeq: initial.body.seq,
      ...DEFAULT_BINARY_SEARCH,
      step: 1
    };
    await t.test('only current presenter may mutate a member-authorized illustration', async () => {
      assert.equal((await request(null, 'GET', endpoint)).status, 401);
      assert.equal((await request(outsider, 'GET', endpoint)).status, 403);
      assert.equal((await request(outsider, 'PUT', endpoint, next)).status, 403);
      assert.equal((await request(peer, 'PUT', endpoint, next)).status, 403);
      assert.equal(
        (
          await request(presenter, 'PUT', endpoint, {
            ...DEFAULT_BINARY_SEARCH,
            expectedSeq: initial.body.seq
          })
        ).status,
        400
      );
    });
    await t.test(
      'concurrent exact retries create one durable state change and conflict on changed content',
      async () => {
        const replies = await Promise.all(
          Array.from({ length: 8 }, () => request(presenter, 'PUT', endpoint, next))
        );
        replies.forEach((reply) => {
          assert.equal(reply.status, 200);
          assert.equal(reply.body.seq, initial.body.seq + 1);
        });
        assert.equal((await request(presenter, 'PUT', endpoint, { ...next, step: 2 })).status, 409);
        const snapshot = await request(peer, 'GET', endpoint);
        assert.equal(snapshot.body.state.step, 1);
        assert.equal(snapshot.body.seq, initial.body.seq + 1);
        const row = await StudyRoom.findOne({ roomId });
        assert.equal(
          row!.commandReceipts.filter(
            (receipt: { commandId: string }) => receipt.commandId === next.commandId
          ).length,
          1
        );
      }
    );
    await t.test(
      'unknown type, executable fields, invalid parameters and stale commands cannot mutate state',
      async () => {
        const current = (await request(presenter, 'GET', endpoint)).body;
        for (const state of [
          { ...DEFAULT_BINARY_SEARCH, exampleId: 'execute' },
          { ...DEFAULT_BINARY_SEARCH, script: 'PRIVATE_EXECUTABLE_SENTINEL' },
          { ...DEFAULT_BINARY_SEARCH, values: [4, 1] },
          { ...DEFAULT_BINARY_SEARCH, step: 999 },
          { ...DEFAULT_BINARY_SEARCH, values: Array(13).fill(1) }
        ]) {
          assert.equal(
            (
              await request(presenter, 'PUT', endpoint, {
                commandId: randomUUID(),
                expectedSeq: current.seq,
                ...state
              })
            ).status,
            400
          );
        }
        assert.equal(
          (
            await request(presenter, 'PUT', endpoint, {
              commandId: randomUUID(),
              expectedSeq: current.seq - 1,
              ...DEFAULT_BINARY_SEARCH
            })
          ).status,
          409
        );
        assert.equal((await request(peer, 'GET', endpoint)).body.state.step, 1);
      }
    );
    await t.test(
      'late join, recovered GET and back/reset reuse the same deterministic cursor',
      async () => {
        assert.equal(
          (
            await request(late, 'POST', '/join', {
              commandId: randomUUID(),
              inviteCode: created.body.inviteCode
            })
          ).status,
          200
        );
        const recovered = (await request(late, 'GET', endpoint)).body;
        assert.equal(recovered.state.step, 1);
        const reset = await request(presenter, 'PUT', endpoint, {
          commandId: randomUUID(),
          expectedSeq: recovered.seq,
          ...DEFAULT_BINARY_SEARCH
        });
        assert.equal(reset.status, 200);
        for (const actor of [presenter, peer, late])
          assert.deepEqual(
            (await request(actor, 'GET', endpoint)).body.state,
            DEFAULT_BINARY_SEARCH
          );
      }
    );
    await t.test(
      'presenter handoff revokes old writer and leaving revokes both reads and receipt replay',
      async () => {
        const current = (await request(presenter, 'GET', endpoint)).body;
        const handoff = await request(presenter, 'PUT', '/' + roomId + '/presenter', {
          commandId: randomUUID(),
          expectedSeq: current.seq,
          presenterUserId: peer.id
        });
        assert.equal(handoff.status, 200);
        assert.equal((await request(presenter, 'PUT', endpoint, next)).status, 403);
        const fresh = (await request(peer, 'GET', endpoint)).body;
        const moved = await request(peer, 'PUT', endpoint, {
          commandId: randomUUID(),
          expectedSeq: fresh.seq,
          ...DEFAULT_BINARY_SEARCH,
          step: 1
        });
        assert.equal(moved.status, 200);
        const left = await request(late, 'POST', '/' + roomId + '/leave', {
          commandId: randomUUID(),
          expectedSeq: moved.body.seq
        });
        assert.equal(left.status, 200);
        assert.equal((await request(late, 'GET', endpoint)).status, 403);
      }
    );
    await t.test(
      'illustration has no assessment, accepted evidence or reward side effects',
      async () => {
        // Scoped to this suite's actors: the migrated database is shared.
        assert.equal(await prisma.studentAttempt.count({ where: { userId: { in: ids } } }), 0);
        assert.equal(await prisma.learningEvidence.count({ where: { userId: { in: ids } } }), 0);
        assert.equal(
          await prisma.learningRewardLedger.count({ where: { userId: { in: ids } } }),
          0
        );
        const projected = JSON.stringify((await request(peer, 'GET', endpoint)).body);
        for (const privateKey of ['answers', 'rubric', 'attemptId', 'userId', 'commandReceipts'])
          assert.ok(!projected.includes(privateKey));
      }
    );
  }
);
