/** Process-local realtime fanout requires one fenced API owner per application DB.
 * PostgreSQL server time decides lease ownership (`now()` plus a server-side
 * interval); monotonic local time fences delivery before expiry, including after
 * a stalled event loop resumes.
 */
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
// Reached through the package export like every other file under `src/`, so the
// build's rootDir stays `src`.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { prismaClient } = require('@noveris/shared/database');

export interface ApiInstanceLease {
  assertActive(): void;
  close(): Promise<void>;
}

// Source-loaded domain modules and compiled Nest entrypoint share this process
// registry, so a mixed TS/dist runtime cannot acquire two independent guards.
const registry = globalThis as typeof globalThis & { __ednovaApiInstance?: ApiInstanceLease };

const LEASE_ID = 'single-realtime-api-v1';

export function assertApiInstance() {
  if (process.env.NODE_ENV === 'production' && !registry.__ednovaApiInstance)
    throw new Error('Single-instance API lease unavailable');
  registry.__ednovaApiInstance?.assertActive();
}

interface LeaseRow {
  owner: string;
  expiresAt: Date;
}

/**
 * Acquire or renew the single-writer lease.
 *
 * Two conditional statements replace the two atomic Mongo document writes:
 * `takeLease` only wins when the stored lease is free or already expired, and
 * `renewLease` only wins when the caller still owns a live lease. Both compare
 * against `now()` on the server, so clock skew between processes cannot grant
 * two owners.
 */
export async function acquireApiInstance(
  options: { leaseMs?: number; heartbeatMs?: number; onLost?: () => void; install?: boolean } = {}
): Promise<ApiInstanceLease> {
  const duration = options.leaseMs ?? 30000;
  const heartbeat = options.heartbeatMs ?? 5000;
  const owner = randomUUID();
  const client = prismaClient();

  await client.$executeRaw`
    INSERT INTO "api_instance_leases" ("id", "owner", "expiresAt")
    VALUES (${LEASE_ID}, '', to_timestamp(0))
    ON CONFLICT ("id") DO NOTHING
  `;

  const acquisitionStarted = performance.now();
  const acquired = await client.$queryRaw<LeaseRow[]>`
    UPDATE "api_instance_leases"
    SET "owner" = ${owner},
        "expiresAt" = now() + (${duration} * interval '1 millisecond')
    WHERE "id" = ${LEASE_ID} AND "expiresAt" <= now()
    RETURNING "owner", "expiresAt"
  `;
  if (acquired.length === 0)
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
      const renewed = await client.$queryRaw<LeaseRow[]>`
        UPDATE "api_instance_leases"
        SET "expiresAt" = now() + (${duration} * interval '1 millisecond')
        WHERE "id" = ${LEASE_ID} AND "owner" = ${owner} AND "expiresAt" > now()
        RETURNING "owner", "expiresAt"
      `;
      if (renewed.length === 0 || performance.now() >= deadline) lose();
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
      await client.$executeRaw`
        UPDATE "api_instance_leases"
        SET "expiresAt" = to_timestamp(0)
        WHERE "id" = ${LEASE_ID} AND "owner" = ${owner}
      `;
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
  return acquireApiInstance({ onLost, install: true });
}
