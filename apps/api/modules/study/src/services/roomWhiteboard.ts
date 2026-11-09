import { RoomWhiteboard } from '../models/RoomWhiteboard';
import { isDuplicateKey } from '../models/_table';
import {
  WhiteboardError,
  mergeElements,
  sanitizeUpdate,
  type BoardElement
} from '../../../../shared/ednova/whiteboard';

export interface WhiteboardView {
  roomId: string;
  version: number;
  locked: boolean;
  elements: BoardElement[];
}

const EMPTY = (roomId: string): WhiteboardView => ({
  roomId,
  version: 0,
  locked: false,
  elements: []
});

export async function readWhiteboard(roomId: string): Promise<WhiteboardView> {
  const doc = await RoomWhiteboard.findOne({ roomId });
  if (!doc) return EMPTY(roomId);
  return { roomId, version: doc.version, locked: doc.locked, elements: doc.elements };
}

/**
 * Merge a participant's changed elements into the board.
 *
 * Writes are compare-and-set on `version`, so two simultaneous saves cannot
 * silently drop each other: the loser re-reads, re-merges and tries again.
 * The merged board is returned so the caller can reconcile immediately.
 */
export async function writeWhiteboardElements(
  roomId: string,
  actorId: string,
  hostUserId: string,
  rawElements: unknown
): Promise<{ board: WhiteboardView; changed: boolean }> {
  const incoming = sanitizeUpdate(rawElements, actorId);
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await readWhiteboard(roomId);
    if (current.locked && actorId !== hostUserId) {
      throw new WhiteboardError(403, 'The host has locked this board');
    }
    const { elements, changed } = mergeElements(current.elements, incoming);
    if (!changed) return { board: current, changed: false };
    try {
      // Compare-and-set on `version`: the guarded update only matches the board
      // this writer read, so a concurrent save cannot silently drop elements.
      const updated =
        current.version === 0
          ? await RoomWhiteboard.findOneAndUpdate(
              { roomId, version: 0 },
              { $set: { elements }, $inc: { version: 1 } },
              { upsert: true, new: true }
            )
          : await RoomWhiteboard.findOneAndUpdate(
              { roomId, version: current.version },
              { $set: { elements }, $inc: { version: 1 } },
              { new: true }
            );
      if (updated) {
        return {
          board: {
            roomId,
            version: updated.version,
            locked: updated.locked,
            elements: updated.elements
          },
          changed: true
        };
      }
    } catch (error) {
      // A concurrent first write hits the unique index: retry against the new row.
      if (!isDuplicateKey(error)) throw error;
    }
  }
  throw new WhiteboardError(409, 'The board changed while saving; try again');
}

export async function setWhiteboardLocked(
  roomId: string,
  locked: boolean
): Promise<WhiteboardView> {
  const updated = await RoomWhiteboard.findOneAndUpdate(
    { roomId },
    { $set: { locked }, $setOnInsert: { roomId } },
    { upsert: true, new: true }
  );
  return {
    roomId,
    version: updated!.version,
    locked: updated!.locked,
    elements: updated!.elements
  };
}
