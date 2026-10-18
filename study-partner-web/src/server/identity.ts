import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveIdentity } from '@study-partner/shared/betterAuth';

export type Identity = NonNullable<Awaited<ReturnType<typeof resolveIdentity>>>['identity'];

export async function requireIdentity(access: 'user' | 'admin' | 'student' = 'user'): Promise<Identity> {
  const auth = await resolveIdentity(await headers());
  if (!auth) redirect('/login');
  if (access === 'admin' && auth.identity.role !== 'admin') redirect('/dashboard');
  if (access === 'student' && auth.identity.role === 'admin') redirect('/admin/dashboard');
  return auth.identity;
}
