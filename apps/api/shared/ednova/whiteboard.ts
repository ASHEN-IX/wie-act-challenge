/**
 * Shared whiteboard document rules (used by the API and by tests).
 *
 * A board is a set of elements keyed by id. Concurrent edits never overwrite
 * the whole board: each element is merged on its own, the higher `version`
 * wins and a tie goes to the lower `versionNonce` (the same rule Excalidraw
 * applies on the client), so every participant converges on the same board.
 *
 * The server validates untrusted client elements: allowed types only (no
 * images, embeds or iframes, which would pull external content into a room),
 * bounded counts and sizes, and the author is stamped from the authenticated
 * user, never taken from the client.
 */

export const ALLOWED_ELEMENT_TYPES = [
  'rectangle',
  'diamond',
  'ellipse',
  'arrow',
  'line',
  'freedraw',
  'text',
  'frame'
] as const;

export const MAX_ELEMENTS = 3000;
export const MAX_ELEMENT_BYTES = 200_000;
export const MAX_BOARD_BYTES = 4_000_000;
export const MAX_UPDATE_ELEMENTS = 500;

export interface BoardElement {
  id: string;
  type: (typeof ALLOWED_ELEMENT_TYPES)[number];
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  customData: { authorId: string };
  [key: string]: unknown;
}

export class WhiteboardError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

const isInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

/** Validate one untrusted element and stamp its author. */
export function sanitizeElement(value: unknown, authorId: string): BoardElement {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new WhiteboardError(400, 'Invalid whiteboard element');
  }
  const element = value as Record<string, unknown>;
  if (typeof element.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(element.id)) {
    throw new WhiteboardError(400, 'Invalid element id');
  }
  if (!(ALLOWED_ELEMENT_TYPES as readonly string[]).includes(element.type as string)) {
    throw new WhiteboardError(400, 'Element type is not allowed on shared boards');
  }
  if (!isInt(element.version) || element.version < 0 || !isInt(element.versionNonce)) {
    throw new WhiteboardError(400, 'Invalid element version');
  }
  if (JSON.stringify(element).length > MAX_ELEMENT_BYTES) {
    throw new WhiteboardError(413, 'Element is too large');
  }
  const existingData =
    element.customData && typeof element.customData === 'object'
      ? (element.customData as Record<string, unknown>)
      : {};
  return {
    ...element,
    id: element.id,
    type: element.type as BoardElement['type'],
    version: element.version,
    versionNonce: element.versionNonce,
    isDeleted: element.isDeleted === true,
    // Never trust a client-supplied author.
    customData: { ...existingData, authorId }
  };
}

/** True when `incoming` should replace `current`. */
export function wins(incoming: BoardElement, current: BoardElement): boolean {
  if (incoming.version !== current.version) return incoming.version > current.version;
  return incoming.versionNonce < current.versionNonce;
}

/**
 * Merge changed elements into the board.
 *
 * An element that already exists keeps its original author, so a participant
 * cannot re-attribute someone else's drawing by editing it. If the board would
 * exceed its cap, deleted elements are dropped first.
 */
export function mergeElements(
  board: readonly BoardElement[],
  incoming: readonly BoardElement[]
): { elements: BoardElement[]; changed: boolean } {
  const byId = new Map(board.map((element) => [element.id, element] as const));
  let changed = false;
  for (const next of incoming) {
    const current = byId.get(next.id);
    if (!current) {
      byId.set(next.id, next);
      changed = true;
    } else if (wins(next, current)) {
      byId.set(next.id, {
        ...next,
        customData: { ...next.customData, authorId: current.customData.authorId }
      });
      changed = true;
    }
  }
  let elements = [...byId.values()];
  if (elements.length > MAX_ELEMENTS) {
    elements = elements.filter((element) => !element.isDeleted);
  }
  if (elements.length > MAX_ELEMENTS) {
    throw new WhiteboardError(413, 'The board is full');
  }
  if (changed && JSON.stringify(elements).length > MAX_BOARD_BYTES) {
    throw new WhiteboardError(413, 'The board is too large');
  }
  return { elements, changed };
}

export function sanitizeUpdate(elements: unknown, authorId: string): BoardElement[] {
  if (!Array.isArray(elements)) throw new WhiteboardError(400, 'elements must be an array');
  if (elements.length > MAX_UPDATE_ELEMENTS)
    throw new WhiteboardError(413, 'Too many elements in one update');
  return elements.map((element) => sanitizeElement(element, authorId));
}
