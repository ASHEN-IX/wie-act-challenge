/**
 * PostgreSQL access for the whole API.
 *
 * `prisma` is the single generated Prisma client. `connectDatabase` /
 * `disconnectDatabase` keep their previous signatures because the Nest entry
 * point, the health checks and the test harnesses all call them.
 *
 * ── Identifier shape ────────────────────────────────────────────────────────
 * Primary keys are PostgreSQL `uuid` values and reach clients as `id`. The
 * short-lived MongoDB compatibility layer that also exposed them as `id` is
 * gone; nothing in the API, the web app or the tests reads `id` any more.
 *
 * `toDocument` therefore just normalises a row for the wire: it is a plain
 * identity function kept so the call sites that already use it stay readable.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import logger from './logger';

let client: PrismaClient | undefined;

function connectionString(): string {
  return process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ednova';
}

function createClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: connectionString(),
    max: Number(process.env.DATABASE_POOL_MAX || 10),
    connectionTimeoutMillis: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS || 10000),
    idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS || 30000)
  });
  return new PrismaClient({ adapter });
}

/** The process-wide Prisma client. Created on first use so tests can point DATABASE_URL first. */
export function prismaClient(): PrismaClient {
  if (!client) client = createClient();
  return client;
}

/**
 * Prisma client for modules that import `prisma` directly.
 *
 * A lazy proxy keeps `import { prisma } from '@noveris/shared/database'` working
 * at module-evaluation time, before DATABASE_URL is necessarily set.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const instance = prismaClient() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(instance, property, receiver);
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

export async function connectDatabase(): Promise<void> {
  const instance = prismaClient();
  try {
    await instance.$queryRaw`SELECT 1`;
    logger.info('Connected to PostgreSQL successfully');
  } catch (error) {
    logger.error('Failed to connect to PostgreSQL:', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (!client) return;
  try {
    await client.$disconnect();
    logger.info('Disconnected from PostgreSQL');
  } catch (error) {
    logger.error('Error disconnecting from PostgreSQL:', error);
    throw error;
  } finally {
    client = undefined;
  }
}

export async function isConnectedToDatabase(): Promise<boolean> {
  if (!client) return false;
  try {
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/** Same question, synchronously, for health endpoints: has a client been created and not closed. */
export function hasDatabaseClient(): boolean {
  return client !== undefined;
}

/**
 * Normalise a Prisma row for the API response.
 *
 * Rows already carry their UUID as `id`, which is the wire field, so this is an
 * identity function. It exists so the model layer and routes share one obvious
 * seam if a projection is ever needed again.
 */
export function toDocument<T>(row: T): T {
  return row;
}

/** `toDocument` over a list; `null`/`undefined` pass through. */
export function toDocuments<T>(rows: T[] | null | undefined): T[] | null {
  return rows as T[] | null;
}

/** `toDocument` for a single optional row. */
export function toDocumentOrNull<T>(row: T | null | undefined): T | null {
  return row ?? null;
}
