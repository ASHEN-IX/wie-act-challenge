import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import WebSocket from 'ws';
import { migrateAuth } from '../../scripts/migrate-auth';

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
  onlineUserIds?: string[];
  presenceVersion?: number;
  currentPhase: string;
  participants: Array<Record<string, unknown>>;
}

test('ED-07 real Nest/Mongo presence lifecycle', { timeout: 90000 }, async (t) => {
  // Always create and delete only this run's synthetic database.
  const name = `ed07_presence_test_${process.pid}_${Date.now()}`;
  process.env.MONGODB_URI = `mongodb://127.0.0.1:27018/${name}`;
  process.env.BETTER_AUTH_SECRET = 'isolated-ed07-security-secret-at-least-32-characters';
  process.env.AUTH_TRUSTED_ORIGINS = 'http://localhost:5173';
  process.env.BETTER_AUTH_URL = 'http://localhost:5173';
  process.env.INTERNAL_API_SECRET = 'isolated-ed07-security-internal';
  process.env.RABBITMQ_URL = 'amqp://localhost:5672';
  process.env.REDIS_URL = '';
  process.env.NODE_ENV = 'test';
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db();
  const cleanups: Array<() => Promise<void>> = [];
  const sockets: WebSocket[] = [];
  t.after(async () => {
    for (const socket of sockets) socket.terminate();
    for (const cleanup of cleanups) await cleanup();
    await db.dropDatabase();
    await client.close();
  });
  const password = await bcrypt.hash('Synthetic!123', 12);
  const actors = ['Host', 'Peer', 'Outsider'].map((name) => ({
    id: new ObjectId(),
    name,
    email: `${name.toLowerCase()}@ed07.test`,
    cookie: ''
  }));
  for (const actor of actors)
    await db.collection('users').insertOne({
      _id: actor.id,
      email: actor.email,
      name: actor.name,
      password,
      isVerified: true,
      isActive: true,
      role: 'student',
      tier: 'standard'
    });
  await migrateAuth(db, { apply: true });
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
    return db.collection('study_rooms').findOne({ roomId: id });
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
  const hostId = host.id.toString();
  const peerId = peer.id.toString();
  const before = await snapshot(id);
  let observer: Awaited<ReturnType<typeof connect>>;
  let first: Awaited<ReturnType<typeof connect>>;
  let second: Awaited<ReturnType<typeof connect>>;
  const online = (connection: Awaited<ReturnType<typeof connect>>, userId: string) =>
    connection.received
      .filter((e) => e.onlineUserIds)
      .at(-1)
      ?.onlineUserIds?.includes(userId);

  await t.test(
    'one authorized connection receives current authorized presence and snapshot',
    async () => {
      observer = await connect(id, peer);
      await waitFor(() => observer.received.some((e) => e.type === 'ROOM_STATE_SYNC'));
      assert.equal(online(observer, peerId), true);
      assert.equal(online(observer, hostId), false, 'persisted online flags must be ignored');
      first = await connect(id, host);
      await waitFor(() => online(observer, hostId) === true);
    }
  );
  await t.test(
    'two sockets share one logical member and closing one keeps the user online',
    async () => {
      second = await connect(id, host);
      await waitFor(() => second.received.some((e) => e.type === 'ROOM_STATE_SYNC'));
      const event = second.received.find((e) => e.type === 'ROOM_STATE_SYNC')!;
      assert.equal(event.participants.filter((p) => p.userId === hostId).length, 1);
      first.socket.close();
      await waitFor(() => first.socket.readyState === WebSocket.CLOSED);
      await new Promise((r) => setTimeout(r, 100));
      assert.equal(online(observer, hostId), true);
    }
  );
  await t.test(
    'final closure changes presence without membership, presenter, sequence or receipt mutation',
    async () => {
      second.socket.close();
      await waitFor(() => online(observer, hostId) === false);
      const after = await snapshot(id);
      assert.deepEqual(after, before);
      assert.equal(after!.presenterUserId, hostId);
    }
  );
  await t.test('reconnect snapshot restores presence at the same durable sequence', async () => {
    first = await connect(id, host);
    await waitFor(() => first.received.some((e) => e.type === 'ROOM_STATE_SYNC'));
    assert.equal(first.received.find((e) => e.type === 'ROOM_STATE_SYNC')!.seq, before!.seq);
    await waitFor(() => online(observer, hostId) === true);
  });
  await t.test(
    'old closure after new registration cannot delete the replacement connection',
    async () => {
      second = await connect(id, host);
      await waitFor(() => second.received.some((e) => e.type === 'ROOM_STATE_SYNC'));
      first.socket.terminate();
      await waitFor(() => first.socket.readyState === WebSocket.CLOSED);
      await new Promise((r) => setTimeout(r, 100));
      assert.equal(online(observer, hostId), true);
    }
  );
  await t.test('concurrent tab openings and closures converge to one online member', async () => {
    const tabs = await Promise.all(Array.from({ length: 4 }, () => connect(id, host)));
    await waitFor(() =>
      tabs.every((tab) => tab.received.some((e) => e.type === 'ROOM_STATE_SYNC'))
    );
    tabs.forEach((tab) => tab.socket.terminate());
    await waitFor(() => tabs.every((tab) => tab.socket.readyState === WebSocket.CLOSED));
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(online(observer, hostId), true);
    assert.deepEqual(await snapshot(id), before);
  });
  await t.test('unauthorized and query-cookie sockets cannot subscribe', async () => {
    for (const [actor, queryOnly] of [
      [outsider, false],
      [host, true]
    ] as const) {
      const denied = await connect(id, actor, queryOnly);
      await waitFor(() => denied.socket.readyState === WebSocket.CLOSED);
      assert.equal(denied.received.length, 0);
    }
  });
  await t.test(
    'presenter handoff survives connection changes and keeps restricted authority',
    async () => {
      assert.equal(
        (await request(host, path(id, '/presenter'), 'PUT', { presenterUserId: peerId })).status,
        200
      );
      await waitFor(() =>
        observer.received.some((e) => e.type === 'ROOM_STATE_SYNC' && e.seq > before!.seq)
      );
      second.socket.close();
      await waitFor(() => online(observer, hostId) === false);
      assert.equal((await snapshot(id))!.presenterUserId, peerId);
      assert.equal(
        (await request(host, path(id, '/phase'), 'PUT', { currentPhase: 'debrief' })).status,
        403
      );
      first = await connect(id, host);
      await waitFor(() => online(observer, hostId) === true);
    }
  );
  await t.test(
    'explicit durable leave removes membership and ejects all stale sockets before delivery',
    async () => {
      const commandId = crypto.randomUUID();
      const current = await snapshot(id);
      const body = { commandId, expectedSeq: current!.seq };
      assert.equal((await request(host, path(id, '/leave'), 'POST', body)).status, 200);
      await waitFor(() => first.socket.readyState === WebSocket.CLOSED);
      await waitFor(() => online(observer, hostId) === false);
      assert.ok(
        (await snapshot(id))!.participants.find(
          (p: { userId: string; leftAt?: unknown }) => p.userId === hostId
        ).leftAt
      );
      const accepted = await snapshot(id);
      assert.equal((await request(host, path(id, '/leave'), 'POST', body)).status, 200);
      assert.deepEqual(await snapshot(id), accepted);
      const denied = await connect(id, host);
      await waitFor(() => denied.socket.readyState === WebSocket.CLOSED);
      assert.equal(denied.received.length, 0);
    }
  );
  await t.test('rapid authorized rejoin creates fresh presence without stale cleanup', async () => {
    assert.equal(
      (await request(host, '/api/v1/study/rooms/join', 'POST', { inviteCode: before!.inviteCode }))
        .status,
      200
    );
    first = await connect(id, host);
    await waitFor(() => online(observer, hostId) === true);
  });
  await t.test(
    'disconnect during initial authorization cannot register a ghost connection',
    async () => {
      const fresh = await create();
      await join(fresh);
      const watcher = await connect(fresh, peer);
      await waitFor(() => watcher.received.some((e) => e.type === 'ROOM_STATE_SYNC'));
      const moduleClient = (await import('../../shared/moduleClient.js')).default as unknown as {
        get: (url: string, options?: unknown) => Promise<unknown>;
      };
      const original = moduleClient.get;
      let release!: () => void;
      let reached = false;
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      moduleClient.get = async function (...args: Parameters<typeof original>) {
        const response = await original.apply(this, args);
        if (String(args[0]).endsWith(`/rooms/${fresh}/participants`) && !reached) {
          reached = true;
          await barrier;
        }
        return response;
      };
      try {
        const abandoned = await connect(fresh, host);
        await waitFor(() => reached);
        abandoned.socket.terminate();
        await waitFor(() => abandoned.socket.readyState === WebSocket.CLOSED);
        release();
        await new Promise((r) => setTimeout(r, 100));
        const { broadcastToSession } = await import('../../modules/notification/src/realtime.js');
        await broadcastToSession(fresh, { type: 'ROOM_PRESENCE_SYNC' });
        await waitFor(() => online(watcher, hostId) === false);
        assert.equal(abandoned.received.length, 0);
      } finally {
        release();
        moduleClient.get = original;
      }
    }
  );
  await t.test('session revocation prevents later data and removes presence', async () => {
    await auth.api.signOut({ headers: new Headers({ cookie: host.cookie }) });
    const marker = 'presence-revocation-marker';
    const { broadcastToSession } = await import('../../modules/notification/src/realtime.js');
    await broadcastToSession(id, { type: marker });
    await waitFor(() => first.socket.readyState === WebSocket.CLOSED);
    await waitFor(() => online(observer, hostId) === false);
    assert.equal(
      first.received.some((e) => e.type === marker),
      false
    );
    const denied = await connect(id, host);
    await waitFor(() => denied.socket.readyState === WebSocket.CLOSED);
    assert.equal(denied.received.length, 0);
  });
  await t.test(
    'missed pong terminates transport; repeated cleanup is safe and leaves durable data intact',
    async () => {
      const { createServer } = await import('node:http');
      const { attachRealtime } = await import('../../modules/notification/src/realtime.js');
      const server = createServer();
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const stop = attachRealtime(server, { heartbeatMs: 100 });
      const address = server.address();
      assert.ok(address && typeof address === 'object');
      const created = await request(peer, '/api/v1/study/rooms', 'POST', { enableVoice: false });
      assert.equal(created.status, 201);
      const timeoutId = created.body.roomId;
      const room = await snapshot(timeoutId);
      assert.equal(
        (
          await request(outsider, '/api/v1/study/rooms/join', 'POST', {
            inviteCode: room!.inviteCode
          })
        ).status,
        200
      );
      const watcher = await connect(timeoutId, outsider);
      await waitFor(() => watcher.received.some((event) => event.type === 'ROOM_STATE_SYNC'));
      const stable = await snapshot(timeoutId);
      const unresponsive = new WebSocket(
        `ws://127.0.0.1:${address.port}/ws/realtime?roomId=${timeoutId}&userId=${peerId}`,
        {
          autoPong: false,
          headers: { cookie: peer.cookie, origin: 'http://localhost:5173' }
        }
      );
      sockets.push(unresponsive);
      let closeCode = 0;
      unresponsive.on('close', (code) => {
        closeCode = code;
      });
      try {
        await waitFor(() => online(watcher, peerId) === true);
        await waitFor(() => unresponsive.readyState === WebSocket.CLOSED);
        await waitFor(() => online(watcher, peerId) === false);
        assert.equal(closeCode, 1006);
        assert.equal(online(watcher, outsider.id.toString()), true);
        assert.deepEqual(await snapshot(timeoutId), stable);
      } finally {
        await stop();
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        );
      }
    }
  );
});
