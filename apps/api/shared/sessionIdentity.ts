import type { IncomingHttpHeaders } from 'node:http';

export async function resolveIdentity(headers: IncomingHttpHeaders | Headers) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod: typeof import('./betterAuth') = require('./betterAuth');
  return mod.resolveIdentity(headers);
}
module.exports = { resolveIdentity };
