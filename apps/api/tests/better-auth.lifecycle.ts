import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient, ObjectId, Db } from 'mongodb';
import bcrypt from 'bcryptjs';
import { createAuth, resolveIdentity } from '../shared/betterAuth';
import { migrateAuth } from '../scripts/migrate-auth';

async function registerTests() {
  process.env.BETTER_AUTH_SECRET = 'isolated-auth-test-secret-at-least-32-characters';
  process.env.AUTH_TRUSTED_ORIGINS = 'http://localhost:5173';
  const client = new MongoClient('mongodb://127.0.0.1:27018');
  await client.connect();
  const db: Db = client.db('auth_migration_test_' + process.pid);
  const emails: Array<{ text: string }> = [];
  const latestEmail = () => {
    const email = emails.at(-1);
    assert.ok(email, 'Expected an authentication email');
    return email;
  };
  const auth = await createAuth(db, {
    sendMail: async (message) => {
      assert.ok(typeof message.text === 'string', 'Authentication email must contain text');
      emails.push({ text: message.text });
    }
  });

  after(async () => {
    await db.dropDatabase();
    await client.close();
  });

  beforeEach(async () => {
    await db.collection('auth_rate_limits').deleteMany({});
  });

  const password = 'LegacyPass!123';
  let cookie: string, userId: ObjectId;

  const call = async (path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const result = await auth.handler(
      new Request('http://localhost:5173/api/auth/' + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:5173',
          ...headers
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      })
    );
    const data = await result.text().then((text: string) => {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    });
    return {
      status: result.status,
      data,
      cookie: result.headers
        .getSetCookie()
        .map((value: string) => value.split(';')[0])
        .join('; '),
      headers: result.headers
    };
  };

  test('legacy migration is idempotent and bcrypt sign-in preserves identity', async () => {
    userId = new ObjectId();
    await db.collection('users').insertOne({
      _id: userId,
      email: 'legacy@example.test',
      name: 'Legacy',
      password: await bcrypt.hash(password, 12),
      isVerified: true,
      isActive: true,
      role: 'student',
      tier: 'vip'
    });
    assert.equal((await migrateAuth(db)).inspected, 1);
    await migrateAuth(db, { apply: true });
    await migrateAuth(db, { apply: true });
    assert.equal(await db.collection('auth_accounts').countDocuments(), 1);
    const response = await call('sign-in/email', { email: 'legacy@example.test', password });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    assert.equal(response.data.user.id, String(userId));
    assert.match(response.headers.get('set-cookie') || '', /HttpOnly/i);
    cookie = response.cookie;
    assert.equal((await resolveIdentity({ cookie }, auth, db))?.identity.tier, 'vip');
  });

  test('old valid sessions renew their database expiration and HTTP-only cookie', async () => {
    const expires = new Date(Date.now() + 2 * 86400000);
    await db
      .collection('auth_sessions')
      .updateMany(
        { userId },
        { $set: { updatedAt: new Date(Date.now() - 2 * 86400000), expiresAt: expires } }
      );
    const response = await call('get-session', undefined, { cookie });
    assert.equal(response.status, 200);
    assert.ok(new Date(response.data.session.expiresAt) > expires);
    assert.match(response.headers.get('set-cookie') || '', /HttpOnly/i);
  });

  test('invalid credentials, disabled users and legacy JWT cookies are rejected', async () => {
    assert.equal(
      (await call('sign-in/email', { email: 'legacy@example.test', password: 'wrong' })).status,
      401
    );
    assert.equal(await resolveIdentity({ cookie: 'accessToken=old.jwt.token' }, auth, db), null);
    await db.collection('users').updateOne({ _id: userId }, { $set: { isActive: false } });
    assert.equal(await resolveIdentity({ cookie }, auth, db), null);
    assert.equal(
      (await call('sign-in/email', { email: 'legacy@example.test', password })).status,
      403
    );
    await db.collection('users').updateOne({ _id: userId }, { $set: { isActive: true } });
  });

  test('fresh database roles and session expiration are authoritative', async () => {
    await db.collection('users').updateOne({ _id: userId }, { $set: { role: 'admin' } });
    assert.equal((await resolveIdentity({ cookie }, auth, db))?.identity.role, 'admin');
    await db.collection('auth_sessions').updateMany({}, { $set: { expiresAt: new Date(0) } });
    assert.equal(await resolveIdentity({ cookie }, auth, db), null);
  });

  test('registration preserves password policy, ignores elevated role, verifies by OTP', async () => {
    assert.equal(
      (
        await call('sign-up/email', {
          email: 'new@example.test',
          name: 'New',
          password: 'weakpass'
        })
      ).status,
      400
    );
    const response = await call('sign-up/email', {
      email: 'new@example.test',
      name: 'New',
      password,
      role: 'admin',
      onboarding: { studyGoals: ['Learn math'], weeklyHours: 12 }
    });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    assert.equal(
      (await db.collection('users').findOne({ email: 'new@example.test' }))?.onboardingDraft
        ?.weeklyHours,
      12
    );
    assert.equal(
      (await db.collection('users').findOne({ email: 'new@example.test' }))?.role,
      'student'
    );
    assert.equal(
      (await call('sign-in/email', { email: 'new@example.test', password })).status,
      403
    );
    assert.equal(
      (
        await call('email-otp/send-verification-otp', {
          email: 'new@example.test',
          type: 'email-verification'
        })
      ).status,
      200
    );
    const lastEmail = latestEmail();
    const otp = lastEmail.text.match(/\b\d{6}\b/)?.[0];
    assert.equal(
      (await call('email-otp/verify-email', { email: 'new@example.test', otp: '000000' })).status,
      400
    );
    assert.equal(
      (await call('email-otp/verify-email', { email: 'new@example.test', otp })).status,
      200
    );
    assert.equal(
      (await db.collection('users').findOne({ email: 'new@example.test' }))?.isVerified,
      true
    );
  });

  test('logout invalidates previously authenticated session', async () => {
    const login = await call('sign-in/email', { email: 'new@example.test', password });
    assert.equal(login.status, 200);
    cookie = login.cookie;
    assert.ok(await resolveIdentity({ cookie }, auth, db));
    assert.equal((await call('sign-out', {}, { cookie })).status, 200);
    assert.equal(await resolveIdentity({ cookie }, auth, db), null);
  });

  test('reset is non-enumerating, revokes sessions, rejects replay and uses native scrypt', async () => {
    const login = await call('sign-in/email', { email: 'new@example.test', password });
    cookie = login.cookie;
    const unknown = await call('request-password-reset', {
      email: 'unknown@example.test',
      redirectTo: '/reset-password'
    });
    const known = await call('request-password-reset', {
      email: 'new@example.test',
      redirectTo: '/reset-password'
    });
    assert.deepEqual(known.data, unknown.data);
    const url = new URL(latestEmail().text.split('Reset your password: ')[1]);
    const token = url.pathname.split('/').at(-1);
    assert.equal(
      (await call('reset-password', { token: 'invalid', newPassword: 'ChangedPass!456' })).status,
      400
    );
    assert.equal(
      (await call('reset-password', { token, newPassword: 'ChangedPass!456' })).status,
      200
    );
    assert.equal(await resolveIdentity({ cookie }, auth, db), null);
    assert.equal(
      (await call('reset-password', { token, newPassword: 'ChangedPass!456' })).status,
      400
    );
    assert.equal(
      (await call('sign-in/email', { email: 'new@example.test', password })).status,
      401
    );
    assert.equal(
      (await call('sign-in/email', { email: 'new@example.test', password: 'ChangedPass!456' }))
        .status,
      200
    );
    const account = await db
      .collection('auth_accounts')
      .findOne({ userId: new ObjectId(login.data.user.id) });
    assert.ok(!account?.password.startsWith('$2'));
  });

  test('untrusted origin cannot mutate authentication and passwordless signup stays disabled', async () => {
    assert.equal(
      (await call('sign-in/email-otp', { email: 'new@example.test', otp: '000000' })).status,
      404
    );
    assert.equal(
      (
        await call(
          'sign-in/email',
          { email: 'new@example.test', password },
          { origin: 'https://attacker.test' }
        )
      ).status,
      403
    );
  });

  test('OTP expires and locks out after five invalid attempts', async () => {
    await call('sign-up/email', { email: 'otp-lock@example.test', name: 'OTP', password });
    await call('email-otp/send-verification-otp', {
      email: 'otp-lock@example.test',
      type: 'email-verification'
    });
    const otp = latestEmail().text.match(/\b\d{6}\b/)?.[0];
    for (let attempt = 0; attempt < 5; attempt++)
      assert.ok(
        (await call('email-otp/verify-email', { email: 'otp-lock@example.test', otp: 'invalid' }))
          .status >= 400
      );
    assert.ok(
      (await call('email-otp/verify-email', { email: 'otp-lock@example.test', otp })).status >= 400
    );
    await db.collection('auth_verifications').deleteMany({});
    await call('email-otp/send-verification-otp', {
      email: 'otp-lock@example.test',
      type: 'email-verification'
    });
    const expiredOtp = latestEmail().text.match(/\b\d{6}\b/)?.[0];
    await db.collection('auth_verifications').updateMany({}, { $set: { expiresAt: new Date(0) } });
    assert.ok(
      (await call('email-otp/verify-email', { email: 'otp-lock@example.test', otp: expiredOtp }))
        .status >= 400
    );
  });

  test('expired reset token and invalid email verification link cannot activate or change credentials', async () => {
    await call('request-password-reset', {
      email: 'new@example.test',
      redirectTo: '/reset-password'
    });
    const token = new URL(latestEmail().text.split('Reset your password: ')[1]).pathname
      .split('/')
      .at(-1);
    await db.collection('auth_verifications').updateMany({}, { $set: { expiresAt: new Date(0) } });
    assert.equal(
      (await call('reset-password', { token, newPassword: 'ExpiredPass!123' })).status,
      400
    );
    const response = await auth.handler(
      new Request('http://localhost:5173/api/auth/verify-email?token=invalid')
    );
    assert.ok(response.status >= 400);
  });

  test('rate limit throttles repeated invalid login attempts', async () => {
    for (let attempt = 0; attempt < 5; attempt++)
      assert.equal(
        (await call('sign-in/email', { email: 'new@example.test', password: 'wrong' })).status,
        401
      );
    assert.equal(
      (await call('sign-in/email', { email: 'new@example.test', password: 'wrong' })).status,
      429
    );
  });

  test('migration refuses normalized email conflicts before creating identities and never overwrites reset hashes', async () => {
    await migrateAuth(db, { apply: true });
    const authUser = await db.collection('auth_users').findOne({ email: 'new@example.test' });
    const account = await db.collection('auth_accounts').findOne({
      providerId: 'credential',
      userId: new ObjectId(authUser?._id)
    });
    assert.ok(!account?.password.startsWith('$2'));
    const count = await db.collection('auth_users').countDocuments();
    const duplicate = new ObjectId();
    await db.collection('users').insertOne({
      _id: duplicate,
      email: ' LEGACY@example.test ',
      name: 'Duplicate',
      password: await bcrypt.hash(password, 12)
    });
    await assert.rejects(migrateAuth(db, { apply: true }), /duplicate legacy identity/);
    assert.equal(await db.collection('auth_users').countDocuments(), count);
    await db.collection('users').deleteOne({ _id: duplicate });
  });

  test('HTTPS sessions use secure HTTP-only SameSite cookies and fresh random sessions', async () => {
    process.env.AUTH_TRUSTED_ORIGINS = 'http://localhost:5173,https://mindflow.example';
    const secure = await createAuth(db, {
      baseURL: 'https://mindflow.example',
      sendMail: async () => {}
    });
    const login = () =>
      secure.handler(
        new Request('https://mindflow.example/api/auth/sign-in/email', {
          method: 'POST',
          headers: { origin: 'https://mindflow.example', 'content-type': 'application/json' },
          body: JSON.stringify({ email: 'new@example.test', password: 'ChangedPass!456' })
        })
      );
    const first = await login(),
      second = await login();
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.match(first.headers.get('set-cookie') || '', /Secure/);
    assert.match(first.headers.get('set-cookie') || '', /HttpOnly/);
    assert.match(first.headers.get('set-cookie') || '', /SameSite=Lax/i);
    assert.notEqual((await first.json()).token, (await second.json()).token);
  });
}
registerTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
