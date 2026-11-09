import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';

/**
 * Identifiers are UUID v4 strings, so PostgreSQL stores them as native `uuid`
 * columns and never has to coerce text.
 *
 * They replaced the previous 24-character hex ObjectId shape. Nothing depends
 * on that shape any more: every id is opaque to the API and the client, and
 * validation goes through `isId` below rather than a hand-written pattern.
 */
export function newId(): string {
  return randomUUID();
}

/** Deterministic UUID-shaped id from a natural key, for rows the migration must keep stable. */
export function deterministicId(seed: string): string {
  const hex = createHash('sha256').update(seed).digest('hex').slice(0, 32);
  // Version 5 (name-based) and variant bits, so the value is a well-formed UUID.
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}`,
    hex.slice(20, 32)
  ].join('-');
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True for a well-formed UUID: the only id shape this application issues. */
export function isId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/** Compare two ids that may be UUID strings, or anything stringifiable. */
export function sameId(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return a === b;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

module.exports = { newId, deterministicId, isId, sameId };
