/** Process-local realtime fanout requires one fenced API owner per application DB.
 * Mongo server time decides lease ownership; monotonic local time fences delivery
 * before expiry, including after a stalled event loop resumes.
 */
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import mongoose from 'mongoose';
import type { Db } from 'mongodb';
interface LeaseRow {
  _id: string;
  owner: string;
  expiresAt: Date;
}
export interface ApiInstanceLease {
  assertActive(): void;
  close(): Promise<void>;
}
// Source-loaded domain modules and compiled Nest entrypoint share this process
// registry, so a mixed TS/dist runtime cannot acquire two independent guards.
const registry = globalThis as typeof globalThis & { __ednovaApiInstance?: ApiInstanceLease };
export function assertApiInstance() {
  if (process.env.NODE_ENV === 'production' && !registry.__ednovaApiInstance)
    throw new Error('Single-instance API lease unavailable');
  registry.__ednovaApiInstance?.assertActive();
}
export async function acquireApiInstance(
  db: Db,
  options: { leaseMs?: number; heartbeatMs?: number; onLost?: () => void; install?: boolean } = {}
): Promise<ApiInstanceLease> {
  const duration = options.leaseMs ?? 30000;
  const heartbeat = options.heartbeatMs ?? 5000;
  const owner = randomUUID();
  const rows = db.collection<LeaseRow>('api_instance_leases');
  const id = 'single-realtime-api-v1';
  try {
    await rows.updateOne(
      { _id: id },
      { $setOnInsert: { owner: '', expiresAt: new Date(0) } },
      { upsert: true }
    );
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  const acquisitionStarted = performance.now();
  const acquired = await rows.findOneAndUpdate(
    { _id: id, $expr: { $lte: ['$expiresAt', '$$NOW'] } },
    [
      {
        $set: {
          owner: { $literal: owner },
          expiresAt: { $dateAdd: { startDate: '$$NOW', unit: 'millisecond', amount: duration } }
        }
      }
    ],
    { returnDocument: 'after', writeConcern: { w: 'majority', j: true } }
  );
  if (!acquired)
    throw new Error('Another API instance owns realtime; multi-replica deployment is unsupported');
  let active = true;
  let deadline = acquisitionStarted + duration * 0.6;
  let renewing = false;
  const lose = () => {
    if (active) {
      active = false;
      options.onLost?.();
    }
  };
  const timer = setInterval(async () => {
    if (renewing || !active) return;
    if (performance.now() >= deadline) {
      lose();
      return;
    }
    renewing = true;
    const started = performance.now();
    try {
      const result = await rows.findOneAndUpdate(
        { _id: id, owner, $expr: { $gt: ['$expiresAt', '$$NOW'] } },
        [
          {
            $set: {
              expiresAt: { $dateAdd: { startDate: '$$NOW', unit: 'millisecond', amount: duration } }
            }
          }
        ],
        { returnDocument: 'after', writeConcern: { w: 'majority', j: true } }
      );
      if (!result || performance.now() >= deadline) lose();
      else deadline = started + duration * 0.6;
    } catch {
      lose();
    } finally {
      renewing = false;
    }
  }, heartbeat);
  timer.unref();
  const lease: ApiInstanceLease = {
    assertActive() {
      if (!active || performance.now() >= deadline) {
        lose();
        throw new Error('Single-instance API lease expired; service fenced');
      }
    },
    async close() {
      active = false;
      clearInterval(timer);
      if (registry.__ednovaApiInstance === lease) registry.__ednovaApiInstance = undefined;
      await rows.updateOne({ _id: id, owner }, { $set: { expiresAt: new Date(0) } });
    }
  };
  if (options.install) registry.__ednovaApiInstance = lease;
  return lease;
}
export async function productionApiInstance(onLost: () => void) {
  if (process.env.NODE_ENV !== 'production') return undefined;
  if (
    (process.env.EDNOVA_REALTIME_MODE || 'single') !== 'single' ||
    Number(process.env.WEB_CONCURRENCY || 1) !== 1 ||
    (process.env.NODE_APP_INSTANCE !== undefined && process.env.NODE_APP_INSTANCE !== '0')
  )
    throw new Error('Only one API process is supported by the current realtime implementation');
  const db = mongoose.connection.db;
  if (!db) throw new Error('API lease database unavailable');
  return acquireApiInstance(db as unknown as Db, { onLost, install: true });
}
