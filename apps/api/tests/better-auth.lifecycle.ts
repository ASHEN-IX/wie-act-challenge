import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createAuth, resolveIdentity } from '../shared/betterAuth';
import { connectDatabase, disconnectDatabase, prisma } from '../shared/database';
import { newId } from '../shared/ids';

async function registerTests() {
  process.env.BETTER_AUTH_SECRET = 'isolated-auth-test-secret-at-least-32-characters';
  process.env.AUTH_TRUSTED_ORIGINS = 'http://localhost:5173';
  await connectDatabase();
  const emails: Array<{ text: string }> = [];
  const latestEmail = () => {
    const email = emails.at(-1);
    assert.ok(email, 'Expected an authentication email');
    return email;
  };
  const auth = await createAuth({
    sendMail: async (message) => {
      assert.ok(typeof message.text === 'string', 'Authentication email must contain text');
      emails.push({ text: String(message.text) });
    }
  });

  after(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: '@example.test' } } });
    await prisma.authUser.deleteMany({ where: { email: { endsWith: '@example.test' } } });
    await prisma.authRateLimit.deleteMany({});
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await prisma.authRateLimit.deleteMany({});
  });

  const password = 'LegacyPass!123';
  let cookie: string, userId: string;

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

  test('a bcrypt password from the migrated user signs in with the same identity', async () => {
    userId = newId();
    await prisma.user.create({
      data: {
        id: userId,
        email: 'legacy@example.test',
        name: 'Legacy',
        isVerified: true,
        isActive: true,
        role: 'student',
        tier: 'vip',
        notificationPreferences: {},
        onboardingDraft: {}
      }
    });
    await prisma.authUser.create({
      data: { id: userId, email: 'legacy@example.test', name: 'Legacy', emailVerified: true }
    });
    await prisma.authAccount.create({
      data: {
        id: newId(),
        accountId: userId,
        providerId: 'credential',
        userId,
        password: await bcrypt.hash(password, 12)
      }
    });
    const response = await call('sign-in/email', { email: 'legacy@example.test', password });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    assert.equal(response.data.user.id, String(userId));
    assert.match(response.headers.get('set-cookie') || '', /HttpOnly/i);
    cookie = response.cookie;
    assert.equal((await resolveIdentity({ cookie }, auth))?.identity.tier, 'vip');
  });

  test('old valid sessions renew their database expiration and HTTP-only cookie', async () => {
    const expires = new Date(Date.now() + 2 * 86400000);
    await prisma.authSession.updateMany({
      where: { userId },
      data: { updatedAt: new Date(Date.now() - 2 * 86400000), expiresAt: expires }
    });
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
    assert.equal(await resolveIdentity({ cookie: 'accessToken=old.jwt.token' }, auth), null);
    await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
    assert.equal(await resolveIdentity({ cookie }, auth), null);
    assert.equal(
      (await call('sign-in/email', { email: 'legacy@example.test', password })).status,
      403
    );
    await prisma.user.update({ where: { id: userId }, data: { isActive: true } });
  });

  test('fresh database roles and session expiration are authoritative', async () => {
    await prisma.user.update({ where: { id: userId }, data: { role: 'admin' } });
    assert.equal((await resolveIdentity({ cookie }, auth))?.identity.role, 'admin');
    await prisma.authSession.updateMany({ data: { expiresAt: new Date(0) } });
    assert.equal(await resolveIdentity({ cookie }, auth), null);
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
      (
        (await prisma.user.findUnique({ where: { email: 'new@example.test' } }))
          ?.onboardingDraft as { weeklyHours?: number } | undefined
      )?.weeklyHours,
      12
    );
    assert.equal(
      (await prisma.user.findUnique({ where: { email: 'new@example.test' } }))?.role,
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
      (await prisma.user.findUnique({ where: { email: 'new@example.test' } }))?.isVerified,
      true
    );
  });

  test('logout invalidates previously authenticated session', async () => {
    const login = await call('sign-in/email', { email: 'new@example.test', password });
    assert.equal(login.status, 200);
    cookie = login.cookie;
    assert.ok(await resolveIdentity({ cookie }, auth));
    assert.equal((await call('sign-out', {}, { cookie })).status, 200);
    assert.equal(await resolveIdentity({ cookie }, auth), null);
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
    assert.equal(await resolveIdentity({ cookie }, auth), null);
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
    const account = await prisma.authAccount.findFirst({ where: { userId: login.data.user.id } });
    assert.equal(account?.password?.startsWith('$2'), false);
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
    await prisma.authVerification.deleteMany({});
    await call('email-otp/send-verification-otp', {
      email: 'otp-lock@example.test',
      type: 'email-verification'
    });
    const expiredOtp = latestEmail().text.match(/\b\d{6}\b/)?.[0];
    await prisma.authVerification.updateMany({ data: { expiresAt: new Date(0) } });
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
    await prisma.authVerification.updateMany({ data: { expiresAt: new Date(0) } });
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

  test('a reset password is stored natively and never as a bcrypt hash', async () => {
    const authUser = await prisma.authUser.findUnique({ where: { email: 'new@example.test' } });
    const account = await prisma.authAccount.findFirst({
      where: { providerId: 'credential', userId: authUser?.id }
    });
    assert.equal(account?.password?.startsWith('$2'), false);
  });

  test('HTTPS sessions use secure HTTP-only SameSite cookies and fresh random sessions', async () => {
    process.env.AUTH_TRUSTED_ORIGINS = 'http://localhost:5173,https://ednova.example';
    const secure = await createAuth({
      baseURL: 'https://ednova.example',
      sendMail: async () => {}
    });
    const login = () =>
      secure.handler(
        new Request('https://ednova.example/api/auth/sign-in/email', {
          method: 'POST',
          headers: { origin: 'https://ednova.example', 'content-type': 'application/json' },
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
