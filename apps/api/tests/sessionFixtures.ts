import { randomUUID } from 'node:crypto';

interface TestIdentity {
  userId?: string;
  exp?: number;
  isActive?: boolean;
  [key: string]: unknown;
}

interface SessionRecord {
  identity: TestIdentity;
  invalid: boolean;
}

const sessions = new Map<string, SessionRecord>();

export function createSession(
  identity: TestIdentity,
  secret = 'test-secret-key',
  options: { expiresIn?: string } = {}
): string {
  const token = randomUUID();
  const expired = identity.exp && identity.exp * 1000 <= Date.now();
  sessions.set(token, {
    identity,
    invalid: Boolean(expired || /wrong|invalid/.test(secret) || options.expiresIn === '-1s')
  });
  return token;
}

export async function resolveIdentity(
  headers: Record<string, unknown> = {}
): Promise<{ identity: TestIdentity; domain: TestIdentity } | null> {
  const cookie = headers.cookie || headers.Cookie || '';
  if (typeof cookie !== 'string') return null;
  const token = cookie.match(/ednova\.test_session=([^;]+)/)?.[1];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.invalid || session.identity.isActive === false) return null;
  return { identity: session.identity, domain: session.identity };
}

export default { createSession, resolveIdentity };
module.exports = { createSession, resolveIdentity };
