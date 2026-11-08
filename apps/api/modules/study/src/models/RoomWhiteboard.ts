import { Document, Model, Schema, model, models } from 'mongoose';
import type { BoardElement } from '../../../../shared/ednova/whiteboard';

/**
 * The shared board of one study room.
 *
 * Owned by the room: it has no owner of its own, no public URL and no
 * independent permissions. Access is "active participant of the room" and is
 * checked by the room routes on every read and write. `version` counts accepted
 * writes and is the optimistic-concurrency token.
 *
 * Retention: boards are purged 7 days after their last edit (TTL index on
 * `updatedAt`). Nobody can open a board once its room has closed, so the TTL
 * only bounds how long the data lingers.
 */
export interface IRoomWhiteboard extends Document {
  roomId: string;
  version: number;
  /** When true only the room host may edit; everyone can still view. */
  locked: boolean;
  elements: BoardElement[];
  updatedAt: Date;
}

export const WHITEBOARD_RETENTION_SECONDS = 7 * 24 * 60 * 60;

const schema = new Schema<IRoomWhiteboard>(
  {
    roomId: { type: String, required: true, unique: true },
    version: { type: Number, required: true, default: 0 },
    locked: { type: Boolean, required: true, default: false },
    elements: { type: [{ type: Schema.Types.Mixed }], default: [] }
  },
  { collection: 'room_whiteboards', timestamps: true }
);
schema.index({ updatedAt: 1 }, { expireAfterSeconds: WHITEBOARD_RETENTION_SECONDS });

export const RoomWhiteboard: Model<IRoomWhiteboard> =
  models.RoomWhiteboard || model<IRoomWhiteboard>('RoomWhiteboard', schema);
