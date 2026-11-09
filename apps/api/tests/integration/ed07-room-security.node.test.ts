import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import WebSocket from 'ws';
import { connectDatabase, disconnectDatabase, prisma } from '../../shared/database';
import { newId } from '../../shared/ids';
import { Course, StudyRoom } from '../../modules/study/src/models';
import SessionChat from '../../modules/notification/src/models/SessionChat';

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

test('ED-07 real Nest/PostgreSQL authorization regressions', { timeout: 60000 }, async (t) => {
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
    await SessionChat.deleteOne({ content: 'room-only text' });
    if (courseIds.length) await Course.deleteMany({ _id: { $in: courseIds } });
    const ids = actors.map((actor) => actor.id);
    await prisma.authSession.deleteMany({ where: { userId: { in: ids } } });
    await prisma.authAccount.deleteMany({ where: { userId: { in: ids } } });
    await prisma.authUser.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.authRateLimit.deleteMany({});
    await disconnectDatabase().catch(() => {});
  });
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
  const runtime = await start({ port: 0, workers: false });
  cleanups.push(runtime.stop);
  const address = runtime.server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
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
    const response = await request(host, '/api/v1/study/rooms', 'POST', { enableVoice: false });
    assert.equal(response.status, 201);
    return response.body.roomId as string;
  }
  async function join(id: string) {
    const room = await snapshot(id);
    assert.equal(
      (await request(peer, '/api/v1/study/rooms/join', 'POST', { inviteCode: room!.inviteCode }))
        .status,
      200
    );
  }
  async function snapshot(id: string) {
    return StudyRoom.findOne({ roomId: id });
  }
  async function connect(id: string, actor: typeof host, queryOnly = false) {
    const received: RoomEvent[] = [];
    const socket = new WebSocket(
      `${base.replace('http', 'ws')}/ws/realtime?roomId=${id}&userId=${actor.id}${queryOnly ? '&token=' + encodeURIComponent(actor.cookie) : ''}`,
      {
        headers: { origin: 'http://localhost:5173', ...(queryOnly ? {} : { cookie: actor.cookie }) }
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
    'microphone consent is explicit, current and distinct from room membership',
    async () => {
      const id = await create();
      await join(id);
      assert.equal(
        (await request(peer, `/api/v1/voice/${id}/participant`, 'POST', {})).status,
        403
      );
      assert.equal(
        (await request(peer, path(id, '/voice-consent'), 'PUT', { hasVoiceConsent: true })).status,
        200
      );
      assert.equal(
        (await request(peer, `/api/v1/voice/${id}/participant`, 'POST', {})).status,
        201
      );
      assert.equal((await request(outsider, `/api/v1/voice/${id}/status`)).status, 403);
      assert.equal(
        (await request(peer, path(id, '/voice-consent'), 'PUT', { hasVoiceConsent: false })).status,
        200
      );
      assert.equal((await request(peer, `/api/v1/voice/${id}/status`)).status, 403);
      assert.equal((await request(peer, path(id))).status, 200);
    }
  );
  await t.test(
    'unauthenticated and outsider HTTP reads cannot disclose room or roster',
    async () => {
      const id = await create();
      assert.equal((await request(null, path(id))).status, 401);
      assert.equal(
        (await request(outsider, '/api/v1/study/rooms/join', 'POST', { roomId: id })).status,
        403
      );
      for (const suffix of ['', '/participants']) {
        const response = await request(outsider, path(id, suffix));
        assert.equal(response.status, 403);
        assert.equal(response.body.room, undefined);
        assert.equal(response.body.participants, undefined);
      }
    }
  );
  await t.test('phase commands remain scoped to the requested room', async () => {
    const id = await create();
    const before = await snapshot(id);
    assert.equal(
      (
        await request(host, path('room_missing', '/phase'), 'PUT', {
          currentPhase: 'peer_discussion'
        })
      ).status,
      404
    );
    assert.equal((await snapshot(id))!.seq, before!.seq);
    assert.equal((await snapshot(id))!.currentPhase, 'idle');
  });
  await t.test('presenter delegation cannot mutate a different room', async () => {
    const id = await create();
    await join(id);
    const before = await snapshot(id);
    assert.equal(
      (
        await request(host, path('room_missing', '/presenter'), 'PUT', {
          presenterUserId: peer.id
        })
      ).status,
      404
    );
    assert.equal((await snapshot(id))!.seq, before!.seq);
    assert.equal((await snapshot(id))!.presenterUserId, host.id);
  });
  await t.test('after handoff only the active presenter controls the shared view', async () => {
    const id = await create();
    await join(id);
    assert.equal(
      (await request(host, path(id, '/presenter'), 'PUT', { presenterUserId: peer.id })).status,
      200
    );
    assert.equal(
      (await request(host, path(id, '/phase'), 'PUT', { currentPhase: 'peer_discussion' })).status,
      403
    );
    assert.equal(
      (await request(peer, path(id, '/phase'), 'PUT', { currentPhase: 'peer_discussion' })).status,
      200
    );
  });
  await t.test('left host cannot read, list, or change the room', async () => {
    const id = await create();
    await join(id);
    assert.equal((await request(host, path(id, '/leave'), 'POST')).status, 200);
    assert.equal((await request(host, path(id))).status, 403);
    assert.equal(
      (await request(host, path(id, '/phase'), 'PUT', { currentPhase: 'peer_discussion' })).status,
      403
    );
    const list = await request(host, '/api/v1/study/rooms');
    assert.ok(!list.body.rooms.some((r) => r.roomId === id));
  });
  await t.test('completed ingestion is not a course enrollment grant', async () => {
    const courseId = newId();
    courseIds.push(courseId);
    await Course.create({
      id: courseId,
      userId: host.id,
      title: 'Private',
      subjectId: 'synthetic',
      status: 'completed'
    });
    const response = await request(outsider, '/api/v1/study/rooms', 'POST', { courseId });
    assert.equal(response.status, 403);
    assert.equal(await StudyRoom.countDocuments({ courseId }), 0);
  });
  await t.test('no cross-room history disclosure through notification HTTP', async () => {
    const id = await create();
    await SessionChat.create({
      sessionId: id,
      userId: host.id,
      messageType: 'query',
      content: 'room-only text'
    });
    assert.equal((await request(outsider, `/api/v1/session-chat/${id}/history`)).status, 403);
  });
  await t.test(
    'revoked connected recipient gets no later broadcast and cannot reconnect',
    async () => {
      const id = await create();
      await join(id);
      const { socket, received } = await connect(id, peer);
      await waitFor(() => received.some((m) => m.type === 'ROOM_STATE_SYNC'));
      await request(peer, path(id, '/leave'), 'POST');
      received.length = 0;
      assert.equal(
        (await request(host, path(id, '/phase'), 'PUT', { currentPhase: 'peer_discussion' }))
          .status,
        200
      );
      await waitFor(() => socket.readyState === WebSocket.CLOSED);
      assert.ok(!received.some((m) => m.type === 'ROOM_STATE_SYNC'));
      const retry = await connect(id, peer);
      await waitFor(() => retry.socket.readyState === WebSocket.CLOSED);
      assert.equal(retry.received.length, 0);
    }
  );
  await t.test('session credentials in URL alone cannot authenticate a socket', async () => {
    const id = await create();
    const { socket, received } = await connect(id, host, true);
    await waitFor(() => socket.readyState === WebSocket.CLOSED);
    assert.equal(received.length, 0);
  });
  await t.test(
    'same phase retry is a no-op and arbitrary activity cannot be published',
    async () => {
      const id = await create();
      const first = await request(host, path(id, '/phase'), 'PUT', {
        currentPhase: 'peer_discussion'
      });
      assert.equal(first.status, 200);
      const retry = await request(host, path(id, '/phase'), 'PUT', {
        currentPhase: 'peer_discussion'
      });
      assert.equal(retry.status, 200);
      assert.equal(retry.body.seq, first.body.seq);
      assert.equal(
        (
          await request(host, path(id, '/phase'), 'PUT', {
            currentPhase: 'individual_attempt',
            activeActivityId: 'forged'
          })
        ).status,
        404
      );
      assert.equal((await snapshot(id))!.seq, first.body.seq);
      assert.equal((await request(host, path(id, '/submit-flag'), 'POST')).status, 503);
      assert.equal((await snapshot(id))!.participants[0].hasSubmitted, false);
    }
  );
  await t.test(
    'source-free rooms reject revision pins without an authorized published course context',
    async () => {
      const countBefore = await StudyRoom.countDocuments({});
      const response = await request(host, '/api/v1/study/rooms', 'POST', {
        revisionId: 'forged_revision'
      });
      assert.equal(response.status, 403);
      assert.equal(await StudyRoom.countDocuments({}), countBefore);
      const id = await create();
      await StudyRoom.updateOne({ roomId: id }, { revisionId: 'unverifiable' });
      assert.equal((await request(host, path(id))).status, 403);
      assert.equal(
        (await request(peer, '/api/v1/study/rooms/join', 'POST', { roomId: id })).status,
        403
      );
    }
  );
  await t.test(
    'course authorization is rechecked before HTTP reads and socket delivery',
    async () => {
      const id = await create();
      const courseId = newId();
      courseIds.push(courseId);
      await Course.create({
        id: courseId,
        userId: host.id,
        title: 'Private',
        subjectId: 'synthetic',
        status: 'completed'
      });
      await StudyRoom.updateOne({ roomId: id }, { courseId });
      assert.equal((await request(host, path(id))).status, 200);
      const { socket, received } = await connect(id, host);
      await waitFor(() => received.some((m) => m.type === 'ROOM_STATE_SYNC'));
      await Course.updateOne({ _id: courseId }, { userId: outsider.id });
      assert.equal((await request(host, path(id))).status, 403);
      received.length = 0;
      const { broadcastToSession } = await import('../../modules/notification/src/realtime.js');
      await broadcastToSession(id, { type: 'test_protected_payload', secret: 'must not arrive' });
      await waitFor(() => socket.readyState === WebSocket.CLOSED);
      assert.equal(received.length, 0);
    }
  );
  await t.test('reconnect receives an authoritative snapshot of missed phase changes', async () => {
    const id = await create();
    await join(id);
    const first = await connect(id, peer);
    await waitFor(() => first.received.some((m) => m.type === 'ROOM_STATE_SYNC'));
    first.socket.close();
    await waitFor(() => first.socket.readyState === WebSocket.CLOSED);
    const change = await request(host, path(id, '/phase'), 'PUT', {
      currentPhase: 'peer_discussion'
    });
    assert.equal(change.status, 200);
    const second = await connect(id, peer);
    await waitFor(() =>
      second.received.some((m) => m.type === 'ROOM_STATE_SYNC' && m.seq === change.body.seq)
    );
    const recovered = second.received.find(
      (m) => m.type === 'ROOM_STATE_SYNC' && m.seq === change.body.seq
    );
    assert.ok(recovered);
    assert.equal(recovered.currentPhase, 'peer_discussion');
    assert.equal(recovered.participants.length, 2);
    assert.ok(recovered.participants.every((p) => !('answers' in p) && !('score' in p)));
  });
});
