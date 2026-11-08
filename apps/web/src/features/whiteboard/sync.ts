/**
 * Client-side change tracking for the shared board.
 *
 * `known` remembers the last version of each element that the server has (sent
 * by us or received from others). Only elements that differ are sent, so remote
 * edits are never echoed back and a local edit is sent exactly once.
 */
export interface SyncElement {
  id: string;
  version: number;
  versionNonce: number;
}

export type KnownElements = Map<string, string>;

const stamp = (element: SyncElement) => `${element.version}:${element.versionNonce}`;

export function changedSince<T extends SyncElement>(known: KnownElements, elements: readonly T[]): T[] {
  return elements.filter((element) => known.get(element.id) !== stamp(element));
}

export function remember(known: KnownElements, elements: readonly SyncElement[]): void {
  for (const element of elements) known.set(element.id, stamp(element));
}

/** Upper bound for one save, matching the server's per-update limit. */
export const MAX_ELEMENTS_PER_SAVE = 500;

export function inBatches<T>(items: readonly T[], size = MAX_ELEMENTS_PER_SAVE): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

/** Marks every element deleted with a bumped version, so a clear propagates to everyone. */
export function tombstoneAll<T extends SyncElement & { isDeleted?: boolean }>(
  elements: readonly T[],
  nonce: () => number,
): T[] {
  return elements
    .filter((element) => !element.isDeleted)
    .map((element) => ({ ...element, isDeleted: true, version: element.version + 1, versionNonce: nonce() }));
}
