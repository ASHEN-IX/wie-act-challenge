import { connectDatabase } from '../../shared/database';
import { acquireApiInstance } from '../../src/framework/single-instance';

/**
 * Child process used by the fencing test: takes the lease and holds it until it
 * is killed, proving a crashed owner keeps ownership until expiry.
 */
async function main() {
  const url = process.argv[2];
  if (!/^postgres(ql)?:\/\/[^\s]+$/.test(url || ''))
    throw new Error('Synthetic fencing database required');
  process.env.DATABASE_URL = url;
  await connectDatabase();
  await acquireApiInstance({ leaseMs: 1200, heartbeatMs: 100 });
  console.log('LEASE_ACQUIRED');
  setInterval(() => {}, 1000);
}
void main().catch(() => process.exit(1));
