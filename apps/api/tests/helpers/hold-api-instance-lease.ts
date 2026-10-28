import { MongoClient } from 'mongodb';
import { acquireApiInstance } from '../../src/framework/single-instance';
async function main() {
  const uri = process.argv[2];
  if (!/^mongodb:\/\/127\.0\.0\.1:27018\/ednova_final_fencing_\w+$/.test(uri || ''))
    throw new Error('Synthetic fencing database required');
  const client = await new MongoClient(uri).connect();
  await acquireApiInstance(client.db(), { leaseMs: 1200, heartbeatMs: 100 });
  console.log('LEASE_ACQUIRED');
  setInterval(() => {}, 1000);
}
void main().catch(() => process.exit(1));
