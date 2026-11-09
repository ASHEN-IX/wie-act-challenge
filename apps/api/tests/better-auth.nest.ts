import { listeningPort } from './listening-port';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import WebSocket from 'ws';
import { migrateAuth } from '../scripts/migrate-auth';

async function registerTests() {
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27018/auth_nest_test_' + process.pid;
  process.env.BETTER_AUTH_SECRET = 'isolated-auth-test-secret-at-least-32-characters';
  process.env.AUTH_TRUSTED_ORIGINS = 'http://localhost:5173';
  process.env.BETTER_AUTH_URL = 'http://localhost:5173';
  process.env.INTERNAL_API_SECRET = 'test-internal-secret';
  process.env.RABBITMQ_URL = 'amqp://localhost:5672';
  process.env.REDIS_URL = '';
  process.env.NODE_ENV = 'test';

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();
  const id = new ObjectId();
  await db.collection('users').insertOne({
    id: id,
    email: 'nest@example.test',
    name: 'Nest',
    password: await bcrypt.hash('LegacyPass!123', 12),
    isVerified: true,
    isActive: true,
    role: 'student',
    tier: 'vip'
  });
  await migrateAuth(db, { apply: true });

  const { getAuth } = await import('../shared/betterAuth.js');
  const auth = await getAuth();
  const result = await auth.api.signInEmail({
    body: { email: 'nest@example.test', password: 'LegacyPass!123' },
    asResponse: true
  });
  const cookie = result.headers
    .getSetCookie()
    .map((value: string) => value.split(';')[0])
    .join('; ');

  const { start } = await import('../src/main.js');
  const runtime = await start({ port: 0, workers: false });
  const url = 'http://127.0.0.1:' + listeningPort(runtime.server);

  after(async () => {
    await runtime.stop();
    await db.dropDatabase();
    await client.close();
  });

  test('public health stays public and protected API rejects missing/legacy credentials', async () => {
    assert.equal((await fetch(url + '/api/v1/health')).status, 200);
    assert.equal((await fetch(url + '/api/v1/study/sessions')).status, 401);
    assert.equal(
      (await fetch(url + '/api/v1/auth/me', { headers: { cookie: 'accessToken=legacy.jwt' } }))
        .status,
      401
    );
  });

  test('Nest session guard supplies preserved identity and fresh role authorization', async () => {
    const me = await fetch(url + '/api/v1/auth/me', { headers: { cookie } });
    assert.equal(me.status, 200, await me.clone().text());
    assert.equal((await me.json()).user.id, String(id));
    assert.equal(
      (await fetch(url + '/api/v1/monitoring/metrics', { headers: { cookie } })).status,
      403
    );
    const study = await fetch(url + '/api/v1/study/sessions', { headers: { cookie } });
    assert.equal(study.status, 200, await study.clone().text());
    assert.equal(
      (await fetch(url + '/api/v1/auth/admin/stats', { headers: { cookie } })).status,
      403
    );
    await db.collection('users').updateOne({ id: id }, { $set: { role: 'admin', isAdmin: true } });
    assert.equal(
      (await fetch(url + '/api/v1/auth/admin/stats', { headers: { cookie } })).status,
      200
    );
    assert.equal(
      (await fetch(url + '/api/v1/monitoring/metrics', { headers: { cookie } })).status,
      200
    );
  });

  test('Nest keeps owner resources private and WebSocket cookie identities bound to their user', async () => {
    const task = await fetch(url + '/api/v1/study/tasks', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Private task' })
    });
    assert.equal(task.status, 201);
    const taskId = (await task.json()).task.id;
    const other = new ObjectId();
    await db.collection('users').insertOne({
      id: other,
      email: 'other@example.test',
      name: 'Other',
      password: await bcrypt.hash('OtherPass!123', 12),
      isVerified: true,
      isActive: true,
      role: 'student'
    });
    await migrateAuth(db, { apply: true });
    const login = await auth.api.signInEmail({
      body: { email: 'other@example.test', password: 'OtherPass!123' },
      asResponse: true
    });
    const otherCookie = login.headers
      .getSetCookie()
      .map((value: string) => value.split(';')[0])
      .join('; ');
    assert.equal(
      (await fetch(url + '/api/v1/study/tasks/' + taskId, { headers: { cookie: otherCookie } }))
        .status,
      404
    );
    const wsUrl = url.replace('http:', 'ws:') + '/ws/notifications?userId=';
    const mismatch = new WebSocket(wsUrl + other, { headers: { cookie } });
    assert.equal(
      await new Promise((resolve, reject) => {
        mismatch.on('close', resolve);
        mismatch.on('error', reject);
      }),
      4401
    );
    const socket = new WebSocket(wsUrl + id, {
      headers: { cookie, origin: 'http://localhost:5173' }
    });
    await new Promise((resolve, reject) => {
      socket.on('open', resolve);
      socket.on('error', reject);
    });
    // Socket open precedes async authentication; wait for a valid status update before closing.
    await new Promise((resolve) => setTimeout(resolve, 30));
    const closed = new Promise((resolve) => socket.once('close', resolve));
    socket.close();
    await closed;
  });

  test('Nest rejects untrusted mutation origin and session reuse after logout', async () => {
    assert.equal(
      (
        await fetch(url + '/api/v1/auth/tier', {
          method: 'PUT',
          headers: { cookie, origin: 'https://attacker.test', 'content-type': 'application/json' },
          body: JSON.stringify({ tier: 'vip' })
        })
      ).status,
      403
    );
    const socket = new WebSocket(url.replace('http:', 'ws:') + '/ws/notifications?userId=' + id, {
      headers: { cookie }
    });
    await new Promise((resolve, reject) => {
      socket.on('open', resolve);
      socket.on('error', reject);
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    await auth.api.signOut({ headers: new Headers({ cookie }) });
    const closed = new Promise((resolve) => socket.once('close', resolve));
    socket.send(JSON.stringify({ type: 'status_update', status: 'online' }));
    assert.equal(await closed, 4401);
    assert.equal(
      (await fetch(url + '/api/v1/study/sessions', { headers: { cookie } })).status,
      401
    );
  });
}
registerTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
