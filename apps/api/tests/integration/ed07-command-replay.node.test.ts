import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import { connectDatabase, disconnectDatabase, prisma } from '../../shared/database';
import { newId } from '../../shared/ids';
import { Course, StudyRoom } from '../../modules/study/src/models';

interface RoomResponse {
  roomId: string;
  seq: number;
  rooms: Array<{ roomId: string }>;
  room?: unknown;
  participants?: unknown;
}
interface RoomEvent {
  type: string;
  seq: number;
  currentPhase: string;
  participants: Array<Record<string, unknown>>;
}

test('ED-07 durable replay against real Nest and PostgreSQL', { timeout: 60000 }, async (t) => {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || 'postgresql://ednova:ednova@127.0.0.1:5433/ednova_test';
  process.env.BETTER_AUTH_SECRET = 'isolated-ed07-security-secret-at-least-32-characters';
  process.env.AUTH_TRUSTED_ORIGINS = 'http://localhost:5173';
  process.env.BETTER_AUTH_URL = 'http://localhost:5173';
  process.env.INTERNAL_API_SECRET = 'isolated-ed07-security-internal';
  process.env.RABBITMQ_URL = 'amqp://localhost:5672';
  process.env.REDIS_URL = '';
  process.env.NODE_ENV = 'test';
  await connectDatabase();
  const cleanups: Array<() => Promise<void>> = [];
  const sockets: WebSocket[] = [];
  const password = await bcrypt.hash('Synthetic!123', 12);
  // This suite shares one migrated database; keep run-unique identities.
  const run = `${process.pid}_${Date.now()}`;
  const actors = ['Host', 'Peer', 'Outsider'].map((name) => ({
    id: newId(),
    name,
    email: `${name.toLowerCase()}_${run}@ed07.test`,
    cookie: ''
  }));
  const courseIds: string[] = [];
  t.after(async () => {
    for (const socket of sockets) socket.terminate();
    for (const cleanup of cleanups) await cleanup();
    await StudyRoom.deleteMany({ hostUserId: { $in: actors.map((actor) => actor.id) } });
    if (courseIds.length) await Course.deleteMany({ _id: { $in: courseIds } });
    const ids = actors.map((actor) => actor.id);
    await prisma.authSession.deleteMany({ where: { userId: { in: ids } } });
    await prisma.authAccount.deleteMany({ where: { userId: { in: ids } } });
    await prisma.authUser.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.authRateLimit.deleteMany({});
    await disconnectDatabase().catch(() => {});
  });
  // Sign-in is rate limited per IP; this suite owns its own attempts.
  await prisma.authRateLimit.deleteMany({});
  for (const actor of actors) {
    await prisma.user.create({
      data: {
        id: actor.id,
        email: actor.email,
        name: actor.name,
        password,
        isVerified: true,
        isActive: true,
        role: 'student',
        tier: 'normal',
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
  let runtime = await start({ port: 0, workers: false });
  cleanups.push(() => runtime.stop());
  const address = runtime.server.address();
  assert.ok(address && typeof address === 'object');
  let base = `http://127.0.0.1:${address.port}`;
  const [host, peer, outsider] = actors;
  async function request(actor: typeof host | null, path: string, method = 'GET', body?: unknown) {
    const response = await fetch(base + path, {
      method,
      headers: {
        origin: 'http://localhost:5173',
        ...(actor ? { cookie: actor.cookie } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' })
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, body: (await response.json()) as RoomResponse };
  }
  const path = (id: string, suffix = '') => `/api/v1/study/rooms/${id}${suffix}`;
  async function create() {
    const response = await request(host, '/api/v1/study/rooms', 'POST', {
      commandId: randomUUID(),
      enableVoice: false
    });
    assert.equal(response.status, 201);
    return response.body.roomId;
  }
  async function snapshot(id: string) {
    return StudyRoom.findOne({ roomId: id });
  }
  async function join(id: string) {
    const room = await snapshot(id);
    const response = await request(peer, '/api/v1/study/rooms/join', 'POST', {
      commandId: randomUUID(),
      inviteCode: room!.inviteCode
    });
    assert.equal(response.status, 200);
  }
  async function connect(id: string, actor: typeof host, queryOnly = false) {
    const received: RoomEvent[] = [];
    const socket = new WebSocket(
      `${base.replace('http', 'ws')}/ws/realtime?roomId=${id}&userId=${actor.id}${queryOnly ? '&token=' + encodeURIComponent(actor.cookie) : ''}`,
      {
        headers: {
          origin: 'http://localhost:5173',
          ...(queryOnly ? {} : { cookie: actor.cookie })
        }
      }
    );
    sockets.push(socket);
    socket.on('message', (raw) => received.push(JSON.parse(raw.toString())));
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    return { socket, received };
  }
  async function waitFor(predicate: () => boolean) {
    const end = Date.now() + 4000;
    while (!predicate() && Date.now() < end) await new Promise((r) => setTimeout(r, 20));
    assert.ok(predicate(), 'Expected condition within 4 seconds');
  }

  await t.test(
    'concurrent create retries persist one room and exact original response',
    async () => {
      const body = { commandId: randomUUID(), title: 'One room', enableVoice: false };
      const results = await Promise.all(
        Array.from({ length: 8 }, () => request(host, '/api/v1/study/rooms', 'POST', body))
      );
      for (const result of results) {
        assert.equal(result.status, 201);
        assert.deepEqual(result.body, results[0].body);
      }
      assert.equal(
        await StudyRoom.countDocuments({
          hostUserId: host.id,
          createCommandId: body.commandId
        }),
        1
      );
      const room = await snapshot(results[0].body.roomId);
      assert.equal(room!.seq, 1);
      assert.equal(room!.commandReceipts.length, 1);
      assert.equal(
        (await request(host, '/api/v1/study/rooms', 'POST', { ...body, title: 'Conflicting' }))
          .status,
        409
      );
    }
  );
  await t.test(
    'concurrent joins consume one slot and cannot replay a join after leaving',
    async () => {
      const id = await create();
      const room = await snapshot(id);
      const body = { commandId: randomUUID(), inviteCode: room!.inviteCode };
      const results = await Promise.all(
        Array.from({ length: 8 }, () => request(peer, '/api/v1/study/rooms/join', 'POST', body))
      );
      for (const result of results) {
        assert.equal(result.status, 200);
        assert.deepEqual(result.body, results[0].body);
      }
      assert.equal((await snapshot(id))!.seq, 2);
      assert.equal((await snapshot(id))!.participants.length, 2);
      assert.equal((await snapshot(id))!.commandReceipts.length, 2);
      await request(peer, path(id, '/leave'), 'POST', {
        commandId: randomUUID(),
        expectedSeq: 2
      });
      assert.equal((await request(peer, '/api/v1/study/rooms/join', 'POST', body)).status, 403);
    }
  );
  await t.test('concurrent phase retries apply one mutation, receipt and publication', async () => {
    const id = await create();
    const connection = await connect(id, host);
    await waitFor(() => connection.received.some((m) => m.type === 'ROOM_STATE_SYNC'));
    connection.received.length = 0;
    const body = { commandId: randomUUID(), expectedSeq: 1, currentPhase: 'peer_discussion' };
    const results = await Promise.all(
      Array.from({ length: 10 }, () => request(host, path(id, '/phase'), 'PUT', body))
    );
    for (const result of results) {
      assert.equal(result.status, 200);
      assert.deepEqual(result.body, results[0].body);
    }
    await waitFor(() =>
      connection.received.some((m) => m.type === 'ROOM_STATE_SYNC' && m.seq === 2)
    );
    assert.equal(
      connection.received.filter((m) => m.type === 'ROOM_STATE_SYNC' && m.seq === 2).length,
      1
    );
    assert.equal((await snapshot(id))!.seq, 2);
    assert.equal((await snapshot(id))!.commandReceipts.length, 2);
    assert.deepEqual(await request(host, path(id, '/phase'), 'PUT', body), results[0]);
    assert.equal(
      connection.received.filter((m) => m.type === 'ROOM_STATE_SYNC' && m.seq === 2).length,
      1
    );
  });
  await t.test(
    'delayed replay returns original result after later changes and conflicting reuse is rejected',
    async () => {
      const id = await create();
      const first = { commandId: randomUUID(), expectedSeq: 1, currentPhase: 'peer_discussion' };
      const accepted = await request(host, path(id, '/phase'), 'PUT', first);
      assert.equal(accepted.status, 200);
      assert.equal(
        (
          await request(host, path(id, '/phase'), 'PUT', {
            commandId: randomUUID(),
            expectedSeq: 2,
            currentPhase: 'individual_attempt'
          })
        ).status,
        200
      );
      assert.deepEqual(await request(host, path(id, '/phase'), 'PUT', first), accepted);
      assert.equal((await snapshot(id))!.currentPhase, 'individual_attempt');
      assert.equal((await snapshot(id))!.seq, 3);
      assert.deepEqual(
        await request(host, path(id, '/phase'), 'PUT', {
          ...first,
          commandId: first.commandId.toUpperCase()
        }),
        accepted
      );
      assert.equal(
        (await request(host, path(id, '/phase'), 'PUT', { ...first, currentPhase: 'debrief' }))
          .status,
        409
      );
    }
  );
  await t.test('receipt and exact response survive full Nest stop and restart', async () => {
    const id = await create();
    const body = { commandId: randomUUID(), expectedSeq: 1, currentPhase: 'peer_discussion' };
    const accepted = await request(host, path(id, '/phase'), 'PUT', body);
    assert.equal(accepted.status, 200);
    for (const socket of sockets) socket.terminate();
    await runtime.stop();
    runtime = await start({ port: 0, workers: false });
    const next = runtime.server.address();
    assert.ok(next && typeof next === 'object');
    base = `http://127.0.0.1:${next.port}`;
    assert.deepEqual(await request(host, path(id, '/phase'), 'PUT', body), accepted);
    assert.equal((await snapshot(id))!.seq, 2);
    assert.equal((await snapshot(id))!.commandReceipts.length, 2);
  });
  await t.test(
    'room, actor, revoked membership and stale presenter boundaries hold on replay',
    async () => {
      const id = await create();
      await join(id);
      const body = { commandId: randomUUID(), expectedSeq: 2, currentPhase: 'peer_discussion' };
      assert.equal((await request(host, path(id, '/phase'), 'PUT', body)).status, 200);
      for (const actor of [outsider, peer])
        assert.equal((await request(actor, path(id, '/phase'), 'PUT', body)).status, 403);
      const other = await request(outsider, '/api/v1/study/rooms', 'POST', {
        commandId: randomUUID()
      });
      assert.equal(
        (await request(host, path(other.body.roomId, '/phase'), 'PUT', body)).status,
        403
      );
      const handoff = {
        commandId: randomUUID(),
        expectedSeq: 3,
        presenterUserId: peer.id
      };
      assert.equal((await request(host, path(id, '/presenter'), 'PUT', handoff)).status, 200);
      assert.equal((await request(host, path(id, '/phase'), 'PUT', body)).status, 403);
      assert.equal((await request(host, path(id, '/presenter'), 'PUT', handoff)).status, 403);
      assert.equal(
        (
          await request(host, path(id, '/leave'), 'POST', {
            commandId: randomUUID(),
            expectedSeq: 4
          })
        ).status,
        200
      );
      assert.equal((await request(host, path(id, '/phase'), 'PUT', body)).status, 403);
      assert.equal((await snapshot(id))!.seq, 5);
    }
  );
  await t.test(
    'leave replays only its own minimal acknowledgement without restoring access',
    async () => {
      const id = await create();
      const body = { commandId: randomUUID(), expectedSeq: 1 };
      const first = await request(host, path(id, '/leave'), 'POST', body);
      assert.equal(first.status, 200);
      assert.deepEqual(first.body, { success: true, roomId: id });
      assert.deepEqual(await request(host, path(id, '/leave'), 'POST', body), first);
      assert.equal((await snapshot(id))!.seq, 2);
      assert.equal((await snapshot(id))!.status, 'closed');
      assert.equal((await request(outsider, path(id, '/leave'), 'POST', body)).status, 403);
      assert.equal((await request(host, path(id))).status, 403);
    }
  );
  await t.test('validation and stale sequence failures never strand a command claim', async () => {
    const id = await create();
    const commandId = randomUUID();
    assert.equal(
      (
        await request(host, path(id, '/phase'), 'PUT', {
          commandId,
          expectedSeq: 99,
          currentPhase: 'peer_discussion'
        })
      ).status,
      409
    );
    assert.equal(
      (
        await request(host, path(id, '/phase'), 'PUT', {
          commandId,
          expectedSeq: 1,
          currentPhase: 'execute_script'
        })
      ).status,
      400
    );
    assert.equal(
      (
        await request(host, path(id, '/phase'), 'PUT', {
          commandId,
          currentPhase: 'peer_discussion'
        })
      ).status,
      400
    );
    assert.equal((await snapshot(id))!.commandReceipts.length, 1);
    assert.equal(
      (
        await request(host, path(id, '/phase'), 'PUT', {
          commandId,
          expectedSeq: 1,
          currentPhase: 'peer_discussion'
        })
      ).status,
      200
    );
  });
  await t.test(
    'competing commands at one version accept one and no-op receipts are durable',
    async () => {
      const id = await create();
      const results = await Promise.all(
        ['peer_discussion', 'individual_attempt'].map((currentPhase) =>
          request(host, path(id, '/phase'), 'PUT', {
            commandId: randomUUID(),
            expectedSeq: 1,
            currentPhase
          })
        )
      );
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      const room = await snapshot(id);
      const noop = { commandId: randomUUID(), expectedSeq: 2, currentPhase: room!.currentPhase };
      const response = await request(host, path(id, '/phase'), 'PUT', noop);
      assert.equal(response.status, 200);
      assert.equal((await snapshot(id))!.seq, 2);
      assert.deepEqual(await request(host, path(id, '/phase'), 'PUT', noop), response);
      assert.equal((await snapshot(id))!.commandReceipts.length, 3);
    }
  );
  await t.test(
    'pre-commit write failure is retryable without a receipt or partial effect',
    async () => {
      const id = await create();
      const body = { commandId: randomUUID(), expectedSeq: 1, currentPhase: 'peer_discussion' };
      // The guarded room write is the single compare-and-set statement; a
      // failure before it commits leaves the room at seq 1 with no receipt.
      const original = prisma.studyRoom.updateMany.bind(prisma.studyRoom);
      prisma.studyRoom.updateMany = (() => {
        throw new Error('synthetic write unavailable');
      }) as typeof original;
      try {
        assert.equal((await request(host, path(id, '/phase'), 'PUT', body)).status, 503);
      } finally {
        prisma.studyRoom.updateMany = original as unknown as typeof prisma.studyRoom.updateMany;
      }
      assert.equal((await snapshot(id))!.seq, 1);
      assert.equal((await snapshot(id))!.commandReceipts.length, 1);
      assert.equal((await request(host, path(id, '/phase'), 'PUT', body)).status, 200);
    }
  );
  await t.test(
    'lost acknowledgement after real commit recovers without a second mutation',
    async () => {
      const id = await create();
      const body = { commandId: randomUUID(), expectedSeq: 1, currentPhase: 'peer_discussion' };
      const original = prisma.studyRoom.updateMany.bind(prisma.studyRoom);
      prisma.studyRoom.updateMany = (async (...args: Parameters<typeof original>) => {
        await original(...args);
        throw new Error('synthetic response lost after commit');
      }) as unknown as typeof prisma.studyRoom.updateMany;
      try {
        assert.equal((await request(host, path(id, '/phase'), 'PUT', body)).status, 503);
      } finally {
        prisma.studyRoom.updateMany = original as unknown as typeof prisma.studyRoom.updateMany;
      }
      assert.equal((await snapshot(id))!.seq, 2);
      const replay = await request(host, path(id, '/phase'), 'PUT', body);
      assert.equal(replay.status, 200);
      assert.equal(replay.body.seq, 2);
      assert.equal((await snapshot(id))!.commandReceipts.length, 2);
      const connection = await connect(id, host);
      await waitFor(() =>
        connection.received.some((m) => m.type === 'ROOM_STATE_SYNC' && m.seq === 2)
      );
    }
  );
  await t.test(
    'receipt replay rechecks course grants and unsupported commands leave no receipt',
    async () => {
      const courseId = newId();
      courseIds.push(courseId);
      await Course.create({
        id: courseId,
        userId: host.id,
        title: 'Synthetic private course',
        subjectId: 'synthetic',
        status: 'completed'
      });
      const created = await request(host, '/api/v1/study/rooms', 'POST', {
        commandId: randomUUID(),
        courseId
      });
      assert.equal(created.status, 201);
      const id = created.body.roomId;
      const body = { commandId: randomUUID(), expectedSeq: 1, currentPhase: 'peer_discussion' };
      const accepted = await request(host, path(id, '/phase'), 'PUT', body);
      assert.equal(accepted.status, 200);
      assert.deepEqual(
        await request(host, path(id, '/phase'), 'PUT', {
          currentPhase: body.currentPhase,
          commandId: body.commandId,
          expectedSeq: 1
        }),
        accepted
      );
      assert.equal(
        (
          await request(host, path(id, '/presenter'), 'PUT', {
            commandId: body.commandId,
            expectedSeq: 2,
            presenterUserId: host.id
          })
        ).status,
        409
      );
      assert.equal(
        (
          await request(host, path(id, '/phase'), 'PUT', {
            commandId: randomUUID(),
            expectedSeq: 2,
            currentPhase: 'individual_attempt',
            activeActivityId: 'unsupported'
          })
        ).status,
        404
      );
      assert.equal((await snapshot(id))!.commandReceipts.length, 2);
      await Course.updateOne({ _id: courseId }, { userId: outsider.id });
      assert.equal((await request(host, path(id, '/phase'), 'PUT', body)).status, 403);
      assert.equal((await snapshot(id))!.seq, 2);
    }
  );
  await t.test('creation with lost acknowledgement recovers without another insert', async () => {
    const body = { commandId: randomUUID(), title: 'Lost creation acknowledgement' };
    const original = StudyRoom.create;
    StudyRoom.create = (async (...args: Parameters<typeof original>) => {
      await original.apply(StudyRoom, args);
      throw new Error('synthetic creation acknowledgement loss');
    }) as typeof original;
    let first: Awaited<ReturnType<typeof request>>;
    try {
      first = await request(host, '/api/v1/study/rooms', 'POST', body);
    } finally {
      StudyRoom.create = original;
    }
    assert.equal(first.status, 201);
    assert.deepEqual(await request(host, '/api/v1/study/rooms', 'POST', body), first);
    assert.equal(await StudyRoom.countDocuments({ createCommandId: body.commandId }), 1);
  });
  await t.test(
    'bounded history never evicts receipts and receipts are not public state',
    async () => {
      const id = await create();
      const body = { commandId: randomUUID(), expectedSeq: 1, currentPhase: 'peer_discussion' };
      const accepted = await request(host, path(id, '/phase'), 'PUT', body);
      const filler = Array.from({ length: 510 }, () => ({
        actorId: host.id,
        commandId: randomUUID(),
        payloadHash: 'fixture',
        status: 200,
        response: { success: true }
      }));
      const current = await snapshot(id);
      await StudyRoom.updateOne(
        { roomId: id },
        { commandReceipts: [...current!.commandReceipts, ...filler] }
      );
      assert.deepEqual(await request(host, path(id, '/phase'), 'PUT', body), accepted);
      assert.equal(
        (
          await request(host, path(id, '/phase'), 'PUT', {
            ...body,
            commandId: randomUUID(),
            expectedSeq: 2,
            currentPhase: 'debrief'
          })
        ).status,
        409
      );
      assert.equal((await snapshot(id))!.seq, 2);
      assert.equal(
        JSON.stringify((await request(host, path(id))).body).includes('commandReceipts'),
        false
      );
      const exit = { commandId: randomUUID(), expectedSeq: 2 };
      assert.equal((await request(host, path(id, '/leave'), 'POST', exit)).status, 200);
      assert.equal((await snapshot(id))!.status, 'closed');
      assert.equal((await snapshot(id))!.commandReceipts.length, 513);
      assert.equal((await request(host, path(id, '/leave'), 'POST', exit)).status, 200);
      assert.equal((await snapshot(id))!.commandReceipts.length, 513);
    }
  );
});
