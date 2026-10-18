import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '@study-partner/shared/betterAuth';

export const runtime = 'nodejs';

async function handle(method: 'GET' | 'POST', request: Request): Promise<Response> {
  const handler = toNextJsHandler(await getAuth());
  const response = await handler[method](request);
  // Retire ignored legacy cookies without maintaining a second authentication system.
  if (/\b(?:accessToken|refreshToken)=/.test(request.headers.get('cookie') || '')) {
    for (const name of ['accessToken', 'refreshToken']) {
      response.headers.append('Set-Cookie', `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
    }
  }
  return response;
}

export async function GET(request: Request): Promise<Response> {
  return handle('GET', request);
}

export async function POST(request: Request): Promise<Response> {
  return handle('POST', request);
}
