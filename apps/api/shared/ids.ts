import { randomBytes } from 'node:crypto';
import { createHash } from 'node:crypto';

/**
 * Identifiers are 24-character lowercase hex strings — the exact shape MongoDB
 * ObjectIds had — so the public API and every stored reference are unchanged
 * by the move to PostgreSQL.
 */
export function newId(): string {
  return randomBytes(12).toString('hex');
}

/** Deterministic id from a natural key, for rows the migration must keep stable. */
export function deterministicId(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 24);
}

export function isObjectIdLike(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{24}$/i.test(value);
}

/** Compare two ids that may be ObjectId-like strings, or anything stringifiable. */
export function sameId(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return a === b;
  return String(a) === String(b);
}
