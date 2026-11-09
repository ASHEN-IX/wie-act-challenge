import type {
  Prisma,
  RoomWhiteboard as RoomWhiteboardRow
} from '../../../../src/generated/prisma/client';
import { prisma } from '../../../../shared/database';
import { table } from './_table';
import type { BoardElement } from '../../../../shared/ednova/whiteboard';

/**
 * The shared board of one study room.
 *
 * Owned by the room: it has no owner of its own, no public URL and no
 * independent permissions. Access is "active participant of the room" and is
 * checked by the room routes on every read and write. `version` counts accepted
 * writes and is the optimistic-concurrency token.
 *
 * Retention: boards are purged 7 days after their last edit. MongoDB used a TTL
 * index on `updatedAt`; PostgreSQL sweeps in `ednova_sweep_expired_rows`.
 */
export type IRoomWhiteboard = Omit<RoomWhiteboardRow, 'elements'> & {
  id: string;
  elements: BoardElement[];
};

export const WHITEBOARD_RETENTION_SECONDS = 7 * 24 * 60 * 60;

export const RoomWhiteboard = table<IRoomWhiteboard>({
  delegate: () => prisma.roomWhiteboard,
  jsonColumns: ['elements'],
  defaults: () => ({ version: 0, locked: false, elements: [] }),
  columns: (row) => ({
    roomId: row.roomId,
    version: row.version,
    locked: row.locked,
    elements: row.elements as unknown as Prisma.InputJsonValue
  })
});

export default RoomWhiteboard;
