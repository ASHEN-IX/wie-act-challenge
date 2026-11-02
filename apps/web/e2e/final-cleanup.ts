import { MongoClient } from 'mongodb';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

// Cleanup runs in the test runner after app subprocess shutdown, so a killed
// server cannot strand a QA database, broker vhost or copied embedding cache.
export default async function cleanup() {
  const name = process.env.FINAL_QA_DB || '';
  if (!/^test_formula_final_\d+$/.test(name)) throw Error('Isolated QA name required');
  const docker = (args: string[]) => execFileSync('docker', args, { stdio: 'pipe' });
  try { docker(['stop', '-t', '2', 'ednova-final-qa-' + name.split('_').at(-1)]); } catch {}
  const client = new MongoClient('mongodb://127.0.0.1:27017/' + name);
  try { await client.connect(); await client.db().dropDatabase(); } finally { await client.close(); }
  try { docker(['exec', 'rabbitmq', 'rabbitmqctl', 'delete_vhost', name]); } catch {}
  const root = path.resolve('../../var/final-qa');
  for (const entry of await fs.readdir(root).catch(() => [])) {
    if (entry.startsWith(name) && /^[A-Za-z0-9_]+$/.test(entry))
      await fs.rm(path.join(root, entry), { recursive: true, force: true });
  }
}
