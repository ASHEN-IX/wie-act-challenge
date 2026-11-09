import { Prisma, type StudyRoom as StudyRoomRow } from '../../../../src/generated/prisma/client';
import { prisma, toDocument } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';
import type { BinarySearchState } from '../../../../shared/visualization';
import { table, translateWhere, isDuplicateKey } from './_table';

export type RoomPhase = 'idle' | 'peer_discussion' | 'individual_attempt' | 'debrief';
export type ModeratorMode = 'guided' | 'on_demand' | 'muted';

export interface IStudyRoomParticipant {
  userId: string;
  name: string;
  avatar?: string;
  role: 'host' | 'participant';
  hasVoiceConsent: boolean;
  isOnline: boolean;
  isSpeaking?: boolean;
  hasSubmitted: boolean;
  joinedAt: Date;
  leftAt?: Date;
}

export interface IRoomCommandReceipt {
  actorId: string;
  commandId: string;
  payloadHash: string;
  status: number;
  response: Record<string, string | number | boolean | null>;
}

/**
 * A live study room. `seq` is the optimistic-concurrency token: every accepted
 * mutation increments it, and a write only lands when the caller still holds
 * the sequence it read.
 *
 * The model has `timestamps: false`: there is `createdAt` but no `updatedAt`.
 */
export type IStudyRoom = Omit<
  StudyRoomRow,
  'participants' | 'commandReceipts' | 'activePin' | 'visualizationState'
> & {
  id: string;
  participants: IStudyRoomParticipant[];
  commandReceipts: IRoomCommandReceipt[];
  activePin: {
    courseId: string;
    revisionId: string;
    contentHash: string;
    activityId: string;
    activityRevision: string;
    activityType: string;
  } | null;
  visualizationState?: BinarySearchState | null;
};

/**
 * `participants` is a JSONB array, so Prisma can only match it as an opaque
 * value. The routes need "an active participant with this userId" (and the
 * reverse, "not this user"), which the old `$elemMatch` expressed natively.
 *
 * These predicates are evaluated in the same process that owns the room row;
 * every call site already reads the whole row, so the filter is applied after
 * hydration. `matchesRoom` is the single translation point.
 */
export interface RoomParticipantPredicate {
  roomId?: string;
  id?: string;
  seq?: number;
  status?: string;
  presenterUserId?: string;
  userFilter: ParticipantFilter;
}

export type ParticipantFilter = {
  userId: string;
  active?: boolean;
  notActive?: boolean;
  hasSubmitted?: boolean;
  hasVoiceConsent?: boolean;
  notHasVoiceConsent?: boolean;
  notPresent?: boolean;
};

function participantMatches(
  participants: IStudyRoomParticipant[],
  filter: ParticipantFilter
): boolean {
  if (filter.notPresent) return !participants.some((p) => p.userId === filter.userId);
  const found = participants.find((p) => p.userId === filter.userId);
  if (filter.active !== undefined) {
    const isActive = Boolean(found && !found.leftAt);
    if (isActive !== filter.active) return false;
  }
  if (filter.notActive !== undefined && Boolean(found && found.leftAt) !== filter.notActive)
    return false;
  if (filter.hasSubmitted !== undefined && Boolean(found?.hasSubmitted) !== filter.hasSubmitted)
    return false;
  if (
    filter.hasVoiceConsent !== undefined &&
    Boolean(found?.hasVoiceConsent) !== filter.hasVoiceConsent
  )
    return false;
  if (
    filter.notHasVoiceConsent !== undefined &&
    Boolean(found?.hasVoiceConsent) === filter.notHasVoiceConsent
  )
    return false;
  return true;
}

/** A Prisma-friendly where for the scalar parts of a room query. */
function roomScalarWhere(where: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(where)) {
    if (key === 'participants' || key === '$expr' || key === 'commandReceipts') continue;
    if (key === '$or') {
      out.OR = (value as Record<string, unknown>[]).map((item) => roomScalarWhere(item));
      continue;
    }
    out[key] = value;
  }
  return out;
}

function roomMatches(room: IStudyRoom, where: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(where)) {
    if (key === 'participants') {
      const filter = value as ParticipantFilter;
      if (!participantMatches(room.participants, filter)) return false;
      continue;
    }
    if (key === '$or') {
      const items = value as Record<string, unknown>[];
      if (!items.some((item) => roomMatches(room, item))) return false;
      continue;
    }
    if (key === 'commandReceipts') continue;
    if (key === '$expr') continue;
    const field = key === 'id' ? 'id' : key;
    const actual = (room as unknown as Record<string, unknown>)[field];
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      const ops = value as Record<string, unknown>;
      if ('$in' in ops && !(ops.$in as unknown[]).includes(actual)) return false;
      if ('$ne' in ops && actual === ops.$ne) return false;
      if ('$exists' in ops && (actual !== undefined && actual !== null) !== Boolean(ops.$exists))
        return false;
      continue;
    }
    if (actual !== value) return false;
  }
  return true;
}

export function activeParticipantWhere(roomId: string, userId: string): Record<string, unknown> {
  // `participants` is a JSONB array, so the "contains an element like this"
  // predicate is spelled `$elemMatch` — a plain object would be read as a
  // JSON *object* path filter, which does not apply to an array.
  return {
    roomId,
    status: 'active',
    // Membership is "joined and not left", which is what participants carry;
    // there is no separate `active` flag on a participant.
    participants: { $elemMatch: { userId, leftAt: { $exists: false } } }
  };
}

const ROOM_COLUMNS = [
  'currentPhase',
  'activeActivityId',
  'activePin',
  'revisionId',
  'activityRound',
  'visualizationState',
  'presenterUserId',
  'participants',
  'status',
  'closedAt',
  'commandReceipts'
] as const;

export const StudyRoom = table<IStudyRoom>({
  delegate: () => prisma.studyRoom,
  jsonColumns: ['participants', 'commandReceipts', 'activePin', 'visualizationState'],
  defaults: () => ({
    participants: [],
    commandReceipts: [],
    activePin: null,
    currentPhase: 'idle',
    status: 'active',
    seq: 1,
    maxParticipants: 6,
    moderatorMode: 'guided',
    facilitatorActive: false
  }),
  columns: (room) => {
    const data: Record<string, unknown> = {};
    for (const key of ROOM_COLUMNS) data[key] = room[key];
    return data;
  }
});

// `participants` is JSON: match it in-process against the hydrated row, while
// the scalar predicate runs in SQL. Reads that need it use these helpers.
async function findRooms(where: Record<string, unknown>, take?: number) {
  const rows = (await prisma.studyRoom.findMany({
    where: roomScalarWhere(where),
    orderBy: { createdAt: 'desc' },
    take
  })) as unknown[];
  return rows.map((row) => StudyRoom.hydrateRow(row)).filter((room) => roomMatches(room, where));
}

/** Room lookup where a `participants` predicate must be honoured. */
export async function findRoomByParticipants(
  where: Record<string, unknown>
): Promise<IStudyRoom | null> {
  const rows = await findRooms(where, 1);
  return rows[0] ?? null;
}

export type RoomIdentity = Record<string, unknown> & {
  id?: string;
  roomId?: string;
  status?: string;
  seq?: number;
  presenterUserId?: string;
};

/**
 * Apply one already-validated mutation against the room state it was computed
 * from.
 *
 * Writes land only while the row still has the same `seq` and the same
 * `commandReceipts` and `participants` the caller read. Any concurrent change
 * makes the guarded update match zero rows, and the caller re-reads and
 * recomputes — the same guarantee Mongo's conditional `$push`/`$set` gave.
 * Returns the authoritative row after the write, or `null` when it lost.
 */
export async function applyRoomMutation(
  snapshot: IStudyRoom,
  room: IStudyRoom
): Promise<IStudyRoom | null> {
  const result = await prisma.studyRoom.updateMany({
    where: {
      id: snapshot.id,
      seq: snapshot.seq,
      commandReceipts: {
        equals: snapshot.commandReceipts as unknown as Prisma.InputJsonValue
      },
      participants: { equals: snapshot.participants as unknown as Prisma.InputJsonValue }
    },
    data: {
      seq: room.seq,
      currentPhase: room.currentPhase,
      activeActivityId: room.activeActivityId,
      activePin: (room.activePin ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
      revisionId: room.revisionId,
      activityRound: room.activityRound,
      visualizationState: (room.visualizationState ??
        Prisma.DbNull) as unknown as Prisma.InputJsonValue,
      presenterUserId: room.presenterUserId,
      participants: room.participants as unknown as Prisma.InputJsonValue,
      status: room.status,
      closedAt: room.closedAt,
      commandReceipts: room.commandReceipts as unknown as Prisma.InputJsonValue
    }
  });
  if (result.count !== 1) return null;
  return StudyRoom.findById(room.id);
}

/**
 * Compare-and-set mutation of one room, replacing Mongo's atomic
 * `findOneAndUpdate` with an explicit sequence guard.
 *
 * `mutate` runs against a private copy of the row. Returning `false` aborts
 * without writing. The update only lands while `seq` still equals the value
 * read, so two concurrent writers cannot both apply: the loser observes
 * `count === 0`, re-reads the fresh row and runs `mutate` again. That is the
 * same guarantee the old guarded `$push`/`$set` gave, including the participant
 * capacity check that must be evaluated against the latest row.
 */
export async function mutateRoom(
  where: RoomIdentity,
  mutate: (room: IStudyRoom) => boolean | void,
  options: { attempts?: number } = {}
): Promise<IStudyRoom | null> {
  const attempts = options.attempts ?? 8;
  const selector = translateWhere({ ...where } as Record<string, unknown>, [
    'participants',
    'commandReceipts',
    'activePin',
    'visualizationState'
  ]);
  for (let attempt = 0; attempt < attempts; attempt++) {
    const current = (await StudyRoom.findOne(where)) as IStudyRoom | null;
    if (!current) return null;
    const snapshotSeq = current.seq;
    const room = structuredClone(current) as IStudyRoom;
    if (mutate(room) === false) return null;
    const changed =
      room.seq !== snapshotSeq ||
      ROOM_COLUMNS.some((key) => JSON.stringify(room[key]) !== JSON.stringify(current[key]));
    if (!changed) return current;
    const data: Record<string, unknown> = {
      seq: room.seq,
      currentPhase: room.currentPhase,
      activeActivityId: room.activeActivityId,
      activePin: room.activePin,
      revisionId: room.revisionId,
      activityRound: room.activityRound,
      visualizationState: room.visualizationState,
      presenterUserId: room.presenterUserId,
      participants: room.participants,
      status: room.status,
      closedAt: room.closedAt,
      commandReceipts: room.commandReceipts
    };
    const result = await prisma.studyRoom.updateMany({
      where: { ...selector, id: current.id, seq: snapshotSeq },
      data: data as Prisma.StudyRoomUpdateManyMutationInput
    });
    if (result.count === 1) {
      const fresh = await StudyRoom.findById(current.id);
      return fresh ?? { ...room };
    }
  }
  return null;
}

/**
 * Insert a room, returning the existing row when the creation command was
 * already applied.
 *
 * `createCommandId` is unique per host in the database (partial unique index),
 * so a retried create is a no-op instead of a second room. The caller re-reads
 * after a duplicate-key failure and replays the stored receipt.
 */
export async function createRoomOnce(
  room: Record<string, unknown>
): Promise<{ room: IStudyRoom; created: boolean }> {
  try {
    return { room: await StudyRoom.create(room), created: true };
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    const existing = (await StudyRoom.findOne({
      hostUserId: room.hostUserId,
      createCommandId: room.createCommandId
    })) as IStudyRoom | null;
    if (!existing) throw error;
    return { room: existing, created: false };
  }
}

export type StudyRoomUpdate = Prisma.StudyRoomUpdateInput;

// Re-export the row shape and helper for call sites that only need identity.
export { newId, toDocument };
export default StudyRoom;
