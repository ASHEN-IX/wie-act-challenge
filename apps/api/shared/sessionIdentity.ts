export async function resolveIdentity(headers: Record<string, any> | Headers): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('./betterAuth');
  return mod.resolveIdentity(headers);
}
module.exports = { resolveIdentity };
