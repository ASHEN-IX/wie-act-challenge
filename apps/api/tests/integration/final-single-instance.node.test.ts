import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { connectDatabase, disconnectDatabase, prisma } from '../../shared/database';
import { acquireApiInstance, productionApiInstance } from '../../src/framework/single-instance';
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
test('Single-instance realtime ownership uses real PostgreSQL leases and conservative delivery fencing', async (t) => {
  await connectDatabase();
  t.after(async () => {
    await prisma.apiInstanceLease.deleteMany({});
    await disconnectDatabase();
  });
  await t.test('second API owner refused; intentional release enables replacement', async () => {
    const first = await acquireApiInstance();
    try {
      first.assertActive();
      await assert.rejects(() => acquireApiInstance(), /Another API instance/);
    } finally {
      await first.close();
    }
    const replacement = await acquireApiInstance();
    replacement.assertActive();
    await replacement.close();
  });
  await t.test('healthy heartbeats retain exclusive ownership beyond initial expiry', async () => {
    const lease = await acquireApiInstance({ leaseMs: 1000, heartbeatMs: 100 });
    try {
      await delay(1300);
      lease.assertActive();
      await assert.rejects(() => acquireApiInstance(), /Another API instance/);
    } finally {
      await lease.close();
    }
  });
  await t.test(
    'stalled owner is fenced before server expiry; new owner cannot revive old delivery',
    async () => {
      let lost = 0;
      const first = await acquireApiInstance({
        leaseMs: 800,
        heartbeatMs: 10000,
        onLost: () => lost++
      });
      try {
        await delay(520);
        assert.throws(() => first.assertActive(), /expired/);
        assert.equal(lost, 1);
        await assert.rejects(() => acquireApiInstance(), /Another API instance/);
        await delay(330);
        const next = await acquireApiInstance();
        try {
          next.assertActive();
          assert.throws(() => first.assertActive(), /expired/);
          await first.close();
          await assert.rejects(() => acquireApiInstance(), /Another API instance/);
        } finally {
          await next.close();
        }
      } finally {
        await first.close();
      }
    }
  );
  await t.test(
    'killed API process retains lease until expiry, then a fresh owner takes over',
    async () => {
      const child = spawn(
        process.execPath,
        [
          path.resolve('node_modules/tsx/dist/cli.mjs'),
          '--tsconfig',
          'tsconfig.json',
          'tests/helpers/hold-api-instance-lease.ts',
          process.env.DATABASE_URL as string
        ],
        { stdio: ['ignore', 'pipe', 'pipe'], detached: true }
      );
      try {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Child lease startup timeout')), 10000);
          child.once('exit', (code) => {
            clearTimeout(timer);
            reject(new Error('Child exited before lease: ' + code));
          });
          child.stdout.on('data', (data) => {
            if (String(data).includes('LEASE_ACQUIRED')) {
              clearTimeout(timer);
              resolve();
            }
          });
        });
        await assert.rejects(() => acquireApiInstance(), /Another API instance/);
        try {
          process.kill(-child.pid!, 'SIGKILL');
        } catch {
          /* Already reaped. */
        }
        await new Promise((resolve) => child.once('exit', resolve));
        await delay(1300);
        const next = await acquireApiInstance();
        next.assertActive();
        await next.close();
      } finally {
        try {
          process.kill(-child.pid!, 'SIGKILL');
        } catch {
          /* Already reaped. */
        }
      }
    }
  );
  await t.test(
    'production multi-worker or claimed distributed mode fails closed before DB ownership',
    async () => {
      const original = {
        NODE_ENV: process.env.NODE_ENV,
        WEB_CONCURRENCY: process.env.WEB_CONCURRENCY,
        EDNOVA_REALTIME_MODE: process.env.EDNOVA_REALTIME_MODE
      };
      try {
        process.env.NODE_ENV = 'production';
        process.env.WEB_CONCURRENCY = '2';
        await assert.rejects(() => productionApiInstance(() => {}), /Only one API process/);
        process.env.WEB_CONCURRENCY = '1';
        process.env.EDNOVA_REALTIME_MODE = 'distributed';
        await assert.rejects(() => productionApiInstance(() => {}), /Only one API process/);
      } finally {
        for (const [key, value] of Object.entries(original)) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }
    }
  );
});
