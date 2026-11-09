/**
 * PostgreSQL access for the whole API.
 *
 * `prisma` is the single generated Prisma client. `connectDatabase` /
 * `disconnectDatabase` keep their previous signatures because the Nest entry
 * point, the health checks and the test harnesses all call them.
 *
 * ── The `_id` contract ───────────────────────────────────────────────────────
 * Every document used to be a MongoDB document and its identifier leaked into
 * HTTP responses as `_id`. The React app and the e2e suites still read `_id`.
 * Rather than touch every call site, `query()` exposes the primary key under
 * both names: `id` (the column, as Prisma returns it) and `_id` (the wire name).
 * The value is the same 24-character hex string in both cases.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const logger = require('./logger');

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
 * A lazy proxy keeps `import { prisma } from '@ednova/shared/database'` working
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
 * Translate one Prisma row (or relation payload) into the shape the API used to
 * return: `id` is mirrored onto `_id`, and a 24-hex `id` becomes the string the
 * client already knows.
 *
 * Rows may carry JSONB columns that already contain `_id` keys; those are
 * returned untouched because they were stored that way.
 */
export function toDocument<T>(row: T): T & { _id: unknown } {
  if (row === null || typeof row !== 'object') return row as T & { _id: unknown };
  const record = row as Record<string, unknown>;
  if (!('id' in record)) return record as T & { _id: unknown };
  if (record._id !== undefined) return record as T & { _id: unknown };
  return { ...record, _id: record.id } as T & { _id: unknown };
}

/**
 * `toDocument` over a list. `null`/`undefined` pass through so optional
 * relations keep their meaning.
 */
export function toDocuments<T>(rows: T[] | null | undefined): Array<T & { _id: unknown }> | null {
  if (rows === null || rows === undefined) return rows as null;
  return rows.map((row) => toDocument(row));
}

/**
 * `toDocument` that maps a single optional row (`findFirst`) and leaves `null`
 * as `null`.
 */
export function toDocumentOrNull<T>(row: T | null | undefined): (T & { _id: unknown }) | null {
  if (row === null || row === undefined) return null;
  return toDocument(row);
}

module.exports = {
  prisma,
  prismaClient,
  connectDatabase,
  disconnectDatabase,
  isConnectedToDatabase,
  hasDatabaseClient,
  toDocument,
  toDocuments,
  toDocumentOrNull
};
