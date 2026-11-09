import test from 'node:test';
import { randomUUID } from 'node:crypto';
import SessionChat, { type IPeerMessage } from '../../modules/notification/src/models/SessionChat';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import WebSocket from 'ws';
import { connectDatabase, disconnectDatabase, prisma } from '../../shared/database';
import { newId } from '../../shared/ids';
import { Course, StudyRoom } from '../../modules/study/src/models';

interface RoomResponse {
  message: IPeerMessage;
  items: IPeerMessage[];
  lastSeq: number;
  hasMore: boolean;
  nextAfterSeq: number;
  error?: string;
  roomId: string;
  seq: number;
  rooms: Array<{ roomId: string }>;
  room?: unknown;
  participants?: unknown;
}
interface RoomEvent {
  message?: IPeerMessage;
  type: string;
  seq: number;
  currentPhase: string;
  participants: Array<Record<string, unknown>>;
}

test('ED-07 public peer text real Nest/PostgreSQL', { timeout: 90000 }, async (t) => {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || 'postgresql://ednova:ednova@127.0.0.1:5433/ednova_test';
  process.env.BETTER_AUTH_SECRET = 'isolated-ed07-security-secret-at-least-32-characters';
  process.env.AUTH_TRUSTED_ORIGINS = 'http://localhost:5173';
  process.env.BETTER_AUTH_URL = 'http://localhost:5173';
  process.env.INTERNAL_API_SECRET = 'isolated-ed07-security-internal';
  process.env.RABBITMQ_URL = 'amqp://localhost:5672';
  process.env.REDIS_URL = '';
  process.env.AI_SERVICE_URL = 'http://127.0.0.1:1';
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
  const roomIds: string[] = [];
  t.after(async () => {
    for (const socket of sockets) socket.terminate();
    for (const cleanup of cleanups) await cleanup();
    await StudyRoom.deleteMany({ hostUserId: { $in: actors.map((actor) => actor.id) } });
    if (roomIds.length)
      await prisma.sessionChat.deleteMany({ where: { sessionId: { in: roomIds } } });
    if (courseIds.length) await Course.deleteMany({ id: { $in: courseIds } });
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
    const response = await request(host, '/api/v1/study/rooms', 'POST', { enableVoice: false });
    assert.equal(response.status, 201);
    roomIds.push(response.body.roomId as string);
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

  const id = await create();
  await join(id);
  const chatPath = (roomId = id) => `/api/v1/session-chat/${roomId}`;
  const send = (actor: typeof host | null, body: unknown, roomId = id) =>
    request(actor, chatPath(roomId) + '/messages', 'POST', body);
  const history = (actor: typeof host | null, query = '', roomId = id) =>
    request(actor, chatPath(roomId) + '/history?kind=peer' + query);
  // The peer journal is one deterministic row per room; read it through the model.
  const journal = async (roomId = id) => {
    const row = await prisma.sessionChat.findFirst({
      where: { sessionId: roomId, messageType: 'peer_stream' }
    });
    if (!row) return null;
    return {
      ...row,
      id: row.id,
      peerMessages: row.peerMessages as unknown as IPeerMessage[]
    };
  };
  const baselineRoom = await snapshot(id);
  const submission = { submissionId: randomUUID(), text: 'First public contribution' };
  let accepted: Awaited<ReturnType<typeof send>>;
  const observer = await connect(id, peer);
  await waitFor(() => observer.received.some((e) => e.type === 'ROOM_STATE_SYNC'));

  await t.test(
    'authorized send is durable, actor-derived, public and delivered without AI',
    async () => {
      accepted = await send(host, submission);
      assert.equal(accepted.status, 201);
      assert.equal(accepted.body.message.senderUserId, host.id);
      assert.equal(accepted.body.message.senderName, host.name);
      assert.equal(accepted.body.message.seq, 1);
      assert.equal((await journal())!.peerMessages.length, 1);
      assert.deepEqual(
        Object.keys(accepted.body.message).sort(),
        [
          'roomId',
          'messageId',
          'submissionId',
          'senderUserId',
          'senderName',
          'text',
          'seq',
          'createdAt'
        ].sort()
      );
      await waitFor(() =>
        observer.received.some(
          (e) =>
            e.type === 'ROOM_PEER_MESSAGE' &&
            e.message?.messageId === accepted.body.message.messageId
        )
      );
      assert.deepEqual(
        await snapshot(id),
        baselineRoom,
        'peer writes cannot mutate durable room or presence'
      );
    }
  );
  await t.test('ordinary participant may send; presenter authority is not required', async () => {
    assert.equal(
      (await send(peer, { submissionId: randomUUID(), text: 'Peer reply' })).status,
      201
    );
  });
  await t.test('unauthenticated and non-members cannot send or read history', async () => {
    for (const actor of [null, outsider]) {
      assert.equal(
        (await send(actor, { submissionId: randomUUID(), text: 'Denied' })).status,
        actor ? 403 : 401
      );
      assert.equal((await history(actor)).status, actor ? 403 : 401);
    }
  });
  await t.test(
    'strict validation rejects identity spoof, objects, oversize, whitespace and malformed Unicode',
    async () => {
      for (const body of [
        undefined,
        null,
        [],
        {},
        { ...submission, senderUserId: outsider.id },
        { ...submission, attachment: { url: 'javascript:alert(1)' } },
        { submissionId: 'bad', text: 'text' },
        { ...submission, text: '' },
        { ...submission, text: '   ' },
        { ...submission, text: { html: '<script>bad</script>' } },
        { ...submission, text: 'x'.repeat(2001) },
        { ...submission, text: '\uD800' },
        { ...submission, text: 'nul\u0000' },
        { ...submission, text: 'x', extra: 'x'.repeat(13000) }
      ])
        assert.equal((await send(host, body)).status, 400);
      assert.equal((await journal())!.peerSeq, 2);
    }
  );
  await t.test(
    'identical replay returns the original DTO without a new sequence or broadcast',
    async () => {
      const count = observer.received.filter((e) => e.type === 'ROOM_PEER_MESSAGE').length;
      assert.deepEqual(await send(host, submission), accepted);
      assert.equal((await journal())!.peerSeq, 2);
      await new Promise((r) => setTimeout(r, 50));
      assert.equal(observer.received.filter((e) => e.type === 'ROOM_PEER_MESSAGE').length, count);
    }
  );
  await t.test(
    'conflicting reuse is rejected and IDs are scoped by authenticated actor',
    async () => {
      assert.equal((await send(host, { ...submission, text: 'Conflict' })).status, 409);
      const own = await send(peer, { ...submission, text: 'Independent participant key' });
      assert.equal(own.status, 201);
      assert.notEqual(own.body.message.messageId, accepted.body.message.messageId);
    }
  );
  await t.test('concurrent identical submissions persist exactly one logical message', async () => {
    const body = { submissionId: randomUUID(), text: 'Concurrent duplicate' };
    const results = await Promise.all(Array.from({ length: 6 }, () => send(host, body)));
    assert.ok(results.every((r) => r.status === 201));
    assert.equal(new Set(results.map((r) => r.body.message.messageId)).size, 1);
    assert.equal(
      (await journal())!.peerMessages.filter(
        (m: IPeerMessage) => m.submissionId === body.submissionId
      ).length,
      1
    );
  });
  await t.test('concurrent distinct messages have contiguous atomic acceptance order', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, n) =>
        send(n % 2 ? peer : host, { submissionId: randomUUID(), text: `Concurrent ${n}` })
      )
    );
    assert.ok(results.every((r) => r.status === 201));
    const seqs = results.map((r) => r.body.message.seq).sort((a, b) => a - b);
    assert.deepEqual(
      seqs,
      Array.from({ length: 8 }, (_, i) => 5 + i)
    );
    const all = await history(host);
    assert.equal(all.status, 200);
    assert.deepEqual(
      all.body.items.map((m) => m.seq),
      Array.from({ length: 12 }, (_, i) => i + 1)
    );
  });
  await t.test(
    'bounded history pages overlap safely and reject invalid or future cursors',
    async () => {
      const first = await history(host, '&limit=5');
      assert.equal(first.body.items.length, 5);
      assert.equal(first.body.hasMore, true);
      assert.equal(first.body.nextAfterSeq, 5);
      const next = await history(peer, '&afterSeq=5&limit=5');
      assert.deepEqual(
        next.body.items.map((m) => m.seq),
        [6, 7, 8, 9, 10]
      );
      for (const query of ['&limit=-1', '&limit=101', '&afterSeq=-1', '&afterSeq=0.5', '&extra=1'])
        assert.equal((await history(host, query)).status, 400);
      assert.equal((await history(host, '&afterSeq=999')).status, 409);
    }
  );
  await t.test(
    'plain text preserves HTML and unsafe URLs as inert content, never structured markup',
    async () => {
      const text = '<img src=x onerror="alert(1)"> [run](javascript:alert(1)) $peerSeq 👋 مرحبا';
      const result = await send(host, { submissionId: randomUUID(), text });
      assert.equal(result.status, 201);
      assert.equal(result.body.message.text, text);
    }
  );
  await t.test(
    'pre-write failure returns uncertainty without accepting a logical message',
    async () => {
      const original = SessionChat.appendPeerMessage;
      SessionChat.appendPeerMessage = async () => {
        throw new Error('Synthetic before write');
      };
      const body = { submissionId: randomUUID(), text: 'Persistence retry' };
      const before = await journal();
      try {
        assert.equal((await send(host, body)).status, 503);
      } finally {
        SessionChat.appendPeerMessage = original;
      }
      assert.deepEqual(await journal(), before);
      assert.equal((await send(host, body)).status, 201);
    }
  );
  await t.test(
    'actual commit with lost acknowledgement recovers on retry and through history',
    async () => {
      const original = SessionChat.appendPeerMessage;
      SessionChat.appendPeerMessage = async (...args: Parameters<typeof original>) => {
        await original.apply(SessionChat, args);
        throw new Error('Synthetic acknowledgement lost after real commit');
      };
      const body = { submissionId: randomUUID(), text: 'Committed acknowledgement lost' };
      try {
        assert.equal((await send(host, body)).status, 503);
      } finally {
        SessionChat.appendPeerMessage = original;
      }
      const stored = (await journal())!.peerMessages.find(
        (m: IPeerMessage) => m.submissionId === body.submissionId
      );
      assert.ok(stored);
      assert.deepEqual((await send(host, body)).body.message, stored);
      assert.equal(
        (await journal())!.peerMessages.filter(
          (m: IPeerMessage) => m.submissionId === body.submissionId
        ).length,
        1
      );
      assert.ok((await history(peer)).body.items.some((m) => m.messageId === stored.messageId));
    }
  );
  await t.test('legacy history/delete cannot expose or remove the peer journal', async () => {
    const legacy = await request(host, chatPath() + '/history');
    assert.equal(legacy.status, 200);
    assert.equal(legacy.body.items.length, 0);
    const raw = await journal();
    assert.equal((await request(host, chatPath() + '/' + raw!.id, 'DELETE')).status, 403);
  });
  await t.test(
    'concurrent conflicting reuse accepts one message and rejects the other',
    async () => {
      const submissionId = randomUUID();
      const results = await Promise.all(
        ['One candidate', 'Other candidate'].map((text) => send(host, { submissionId, text }))
      );
      assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
      assert.equal(
        (await journal())!.peerMessages.filter((m: IPeerMessage) => m.submissionId === submissionId)
          .length,
        1
      );
    }
  );
  await t.test('empty history is explicit and submission keys are scoped by room', async () => {
    const fresh = await create();
    const empty = await history(host, '', fresh);
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body.items, []);
    assert.equal(empty.body.lastSeq, 0);
    const scoped = await send(host, submission, fresh);
    assert.equal(scoped.status, 201);
    assert.equal(scoped.body.message.seq, 1);
    assert.notEqual(scoped.body.message.messageId, accepted.body.message.messageId);
  });
  await t.test(
    'a real WS publication failure after persistence retains acceptance and recoverable history',
    async () => {
      const originalSend = WebSocket.prototype.send;
      const marker = 'Persisted despite failed publication';
      let injected = false;
      WebSocket.prototype.send = function (
        this: WebSocket,
        ...args: Parameters<typeof originalSend>
      ) {
        if (!injected && typeof args[0] === 'string' && args[0].includes(marker)) {
          injected = true;
          throw new Error('Synthetic WebSocket send failure after commit');
        }
        return originalSend.apply(this, args);
      } as typeof originalSend;
      const body = { submissionId: randomUUID(), text: marker };
      try {
        const result = await send(host, body);
        assert.equal(result.status, 201);
        assert.equal(injected, true);
        assert.ok(
          (await history(host)).body.items.some(
            (m) => m.messageId === result.body.message.messageId
          )
        );
        assert.deepEqual(await send(host, body), result);
      } finally {
        WebSocket.prototype.send = originalSend;
      }
    }
  );
  await t.test(
    'source revocation rejects send, replay, history and subscribed delivery',
    async () => {
      const courseId = newId();
      courseIds.push(courseId);
      await Course.create({
        id: courseId,
        userId: host.id,
        title: 'Synthetic source',
        subjectId: 'synthetic',
        status: 'completed'
      });
      const created = await request(host, '/api/v1/study/rooms', 'POST', {
        courseId,
        enableVoice: false
      });
      assert.equal(created.status, 201);
      const roomId = created.body.roomId;
      roomIds.push(roomId);
      const body = { submissionId: randomUUID(), text: 'Allowed before source revocation' };
      assert.equal((await send(host, body, roomId)).status, 201);
      const connection = await connect(roomId, host);
      await waitFor(() => connection.received.some((e) => e.type === 'ROOM_STATE_SYNC'));
      await Course.updateOne({ id: courseId }, { userId: outsider.id });
      assert.equal((await send(host, body, roomId)).status, 403);
      assert.equal((await history(host, '', roomId)).status, 403);
      const { broadcastToSession } = await import('../../modules/notification/src/realtime.js');
      await broadcastToSession(roomId, {
        type: 'ROOM_PEER_MESSAGE',
        roomId,
        message: { secretMarker: true }
      });
      await waitFor(() => connection.socket.readyState === WebSocket.CLOSED);
      assert.equal(
        connection.received.some((e) => e.type === 'ROOM_PEER_MESSAGE'),
        false
      );
    }
  );
  await t.test(
    'membership revocation rejects replay/history and removes recipient before subsequent messages',
    async () => {
      assert.equal((await request(peer, path(id, '/leave'), 'POST')).status, 200);
      await waitFor(() => observer.socket.readyState === WebSocket.CLOSED);
      assert.equal(
        (await send(peer, { ...submission, text: 'Independent participant key' })).status,
        403
      );
      assert.equal((await history(peer)).status, 403);
      assert.equal(
        (await send(host, { submissionId: randomUUID(), text: 'After peer left' })).status,
        201
      );
      assert.equal(
        observer.received.some((e) => e.message?.text === 'After peer left'),
        false
      );
    }
  );
  await t.test(
    'message persistence and identical replay survive an actual Nest stop/start',
    async () => {
      await runtime.stop();
      runtime = await start({ port: 0, workers: false });
      const nextAddress = runtime.server.address();
      assert.ok(nextAddress && typeof nextAddress === 'object');
      base = `http://127.0.0.1:${nextAddress.port}`;
      assert.deepEqual(await send(host, submission), accepted);
      const recovered = await history(host);
      assert.equal(recovered.status, 200);
      assert.ok(recovered.body.items.some((m) => m.messageId === accepted.body.message.messageId));
    }
  );
  await t.test(
    'full bounded journal preserves replay and all paginated accepted history',
    async () => {
      const fullId = await create();
      const initialBody = { submissionId: randomUUID(), text: 'Journal retention fixture' };
      const initial = await send(host, initialBody, fullId);
      assert.equal(initial.status, 201);
      const first = initial.body.message;
      const fixture = Array.from({ length: 1000 }, (_, index) => ({
        ...first,
        messageId: index ? randomUUID() : first.messageId,
        submissionId: index ? randomUUID() : first.submissionId,
        seq: index + 1
      }));
      await prisma.sessionChat.updateMany({
        where: { sessionId: fullId, messageType: 'peer_stream' },
        data: { peerSeq: 1000, peerMessages: fixture as unknown as object[] }
      });
      assert.equal(
        (await send(host, { submissionId: randomUUID(), text: 'Capacity denied' }, fullId)).status,
        409
      );
      assert.deepEqual(await send(host, initialBody, fullId), initial);
      const result = await history(host, '&afterSeq=900&limit=100', fullId);
      assert.equal(result.body.items.length, 100);
      assert.equal(result.body.hasMore, false);
      assert.equal(result.body.nextAfterSeq, 1000);
      assert.equal((await journal(fullId))!.peerSeq, 1000);
    }
  );
});
