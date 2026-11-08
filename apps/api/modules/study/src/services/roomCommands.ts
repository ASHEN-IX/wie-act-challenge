import { parseBinarySearchState } from '../../../../shared/visualization';
import { resolveRoomActivity, resolveRoomSourceRevision, validateRoomRevision } from './roomActivity';
import { createHash, randomUUID, randomInt } from 'node:crypto';
import Joi from 'joi';
import { StudyRoom, type IStudyRoom, type IRoomCommandReceipt } from '../models/StudyRoom';

export const MAX_ROOM_COMMANDS = 512;
type Kind = 'create' | 'join' | 'leave' | 'phase' | 'presenter' | 'visualization';
type ResponseBody = IRoomCommandReceipt['response'];
type Room = Pick<
  IStudyRoom,
  | 'roomId'
  | 'inviteCode'
  | 'courseId'
  | 'revisionId'
  | 'title'
  | 'hostUserId'
  | 'presenterUserId'
  | 'moderatorMode'
  | 'participants'
  | 'maxParticipants'
  | 'seq'
  | 'status'
  | 'currentPhase'
  | 'activeActivityId'
  | 'activePin'
  | 'activityRound'
  | 'visualizationState'
  | 'createdAt'
  | 'closedAt'
  | 'createCommandId'
  | 'commandReceipts'
>;
export interface CommandActor {
  userId: string;
  name?: string;
}
export interface CommandResult {
  status: number;
  body: ResponseBody;
  // Internal only: never serialize this document or command receipts.
  changedRoom?: IStudyRoom;
}
class CommandError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
const id = Joi.string().lowercase().guid({ version: 'uuidv4' }).required();
const seq = Joi.number().integer().min(1).max(Number.MAX_SAFE_INTEGER).required();
const schemas = {
  create: Joi.object({
    commandId: id,
    title: Joi.string().max(200).allow('', null),
    courseId: Joi.string().max(64).allow('', null),
    revisionId: Joi.string().max(64).allow('', null),
    maxParticipants: Joi.number().integer().min(2).max(10).default(6),
    moderatorMode: Joi.string().valid('guided', 'on_demand', 'muted').default('guided'),
    enableVoice: Joi.boolean().default(true)
  }),
  join: Joi.object({
    commandId: id,
    inviteCode: Joi.string().trim().uppercase().max(12),
    roomId: Joi.string().max(64),
    hasVoiceConsent: Joi.boolean().default(false)
  }).or('inviteCode', 'roomId'),
  phase: Joi.object({
    commandId: id,
    expectedSeq: seq,
    currentPhase: Joi.string()
      .valid('idle', 'peer_discussion', 'individual_attempt', 'debrief')
      .required(),
    activeActivityId: Joi.string().max(64).allow('', null)
  }),
  presenter: Joi.object({
    commandId: id,
    expectedSeq: seq,
    presenterUserId: Joi.string().max(128).required()
  }),
  visualization: Joi.object({
    commandId: id,
    expectedSeq: seq,
    exampleId: Joi.string().valid('binary-search-v1').required(),
    values: Joi.array().items(Joi.number().integer().min(-999).max(999)).min(1).max(12).required(),
    target: Joi.number().integer().min(-999).max(999).required(),
    step: Joi.number().integer().min(0).max(12).required()
  }),
  leave: Joi.object({ commandId: id, expectedSeq: seq })
};
const writeConcern = { w: 'majority' as const, j: true };

function hashPayload(kind: Kind, value: Record<string, unknown>): string {
  // Joi rejects unknown fields. Sort keys so JSON property order cannot change identity.
  const fields = Object.keys(value)
    .filter((key) => key !== 'commandId')
    .sort();
  return createHash('sha256')
    .update(JSON.stringify([kind, fields.map((key) => [key, value[key]])]))
    .digest('hex');
}
function membership(room: Room, actorId: string): boolean {
  return (
    room.status === 'active' && room.participants.some((p) => p.userId === actorId && !p.leftAt)
  );
}
function receipt(
  room: Room,
  actorId: string,
  commandId: string,
  hash: string
): IRoomCommandReceipt | undefined {
  const found = room.commandReceipts?.find(
    (r) => r.actorId === actorId && r.commandId === commandId
  );
  if (found && found.payloadHash !== hash)
    throw new CommandError(409, 'Command ID was already used with a different payload');
  return found;
}
function lifecycleResponse(room: Room): ResponseBody {
  return {
    roomId: room.roomId,
    inviteCode: room.inviteCode,
    ...(room.courseId ? { courseId: room.courseId } : {}),
    ...(room.revisionId ? { revisionId: room.revisionId } : {}),
    title: room.title,
    presenterUserId: room.presenterUserId,
    moderatorMode: room.moderatorMode,
    participantsCount: room.participants.filter((p) => !p.leftAt).length,
    currentPhase: room.currentPhase,
    createdAt: room.createdAt.toISOString()
  };
}

/** The callback reuses the existing course-owner authorization boundary. */
export async function runRoomCommand(
  kind: Kind,
  actor: CommandActor,
  input: unknown,
  roomId: string | undefined,
  authorizeCourse: (courseId: string) => Promise<{ authorized: boolean; title?: string }>
): Promise<CommandResult> {
  try {
    const parsed = schemas[kind].validate(input, { abortEarly: true });
    if (parsed.error) throw new CommandError(400, parsed.error.details[0].message);
    const value = parsed.value;
    const commandId: string = value.commandId;
    const payloadHash = hashPayload(kind, value);

    if (kind === 'create') {
      let title: string = value.title || 'Study Together Room';
      if (value.courseId) {
        const access = await authorizeCourse(value.courseId);
        if (!access.authorized) throw new CommandError(403, 'Course access is unavailable');
        if (!value.title && access.title) title = `${access.title} Study Group`;
      }
      // Ensure the required unique index exists even when autoIndex is disabled.
      // This creates no new collection and never removes existing indexes.
      await StudyRoom.collection.createIndex(
        { hostUserId: 1, createCommandId: 1 },
        {
          unique: true,
          partialFilterExpression: { createCommandId: { $type: 'string' } },
          name: 'room_creation_command'
        }
      );
      const previous = await StudyRoom.findOne({
        hostUserId: actor.userId,
        createCommandId: commandId
      }).select('+commandReceipts');
      if (previous) {
        if (!membership(previous, actor.userId))
          throw new CommandError(403, 'Not an active participant in this room');
        await validateRoomRevision(actor.userId, previous);
        const saved = receipt(previous, actor.userId, commandId, payloadHash);
        if (!saved) throw new CommandError(503, 'Creation receipt unavailable');
        return { status: saved.status, body: saved.response };
      }
      const revisionId = await resolveRoomSourceRevision(actor.userId, value);
      const now = new Date();
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const created = {
        roomId: `room_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
        inviteCode: Array.from({ length: 6 }, () => chars[randomInt(chars.length)]).join(''),
        createCommandId: commandId,
        ...(value.courseId ? { courseId: value.courseId } : {}),
        ...(revisionId ? { revisionId } : {}),
        title,
        hostUserId: actor.userId,
        presenterUserId: actor.userId,
        maxParticipants: value.maxParticipants,
        moderatorMode: value.moderatorMode,
        currentPhase: 'idle' as const,
        activeActivityId: null,
        status: 'active' as const,
        seq: 1,
        createdAt: now,
        commandReceipts: [],
        participants: [
          {
            userId: actor.userId,
            name: actor.name || 'Host',
            role: 'host' as const,
            hasVoiceConsent: value.enableVoice,
            isOnline: true,
            hasSubmitted: false,
            joinedAt: now
          }
        ]
      };
      const saved: IRoomCommandReceipt = {
        actorId: actor.userId,
        commandId,
        payloadHash,
        status: 201,
        response: lifecycleResponse(created)
      };
      try {
        const [room] = await StudyRoom.create([{ ...created, commandReceipts: [saved] }], {
          writeConcern
        });
        return { status: 201, body: saved.response, changedRoom: room };
      } catch {
        // Duplicate key, response loss or uncertain acknowledgement: no second insert.
        const committed = await StudyRoom.findOne({
          hostUserId: actor.userId,
          createCommandId: commandId
        }).select('+commandReceipts');
        if (committed && membership(committed, actor.userId)) {
          await validateRoomRevision(actor.userId, committed);
          const recorded = receipt(committed, actor.userId, commandId, payloadHash);
          if (recorded) return { status: recorded.status, body: recorded.response };
        }
        throw new CommandError(503, 'Creation outcome uncertain; retry the same command ID');
      }
    }

    // Atomic receipt append + state update: no claim/apply crash window and no
    // standalone Mongo multi-document transaction dependency.
    for (let attempt = 0; attempt < 8; attempt++) {
      const selector =
        kind === 'join'
          ? value.inviteCode
            ? { inviteCode: value.inviteCode }
            : { roomId: value.roomId }
          : { roomId };
      const document = await StudyRoom.findOne(selector).select('+commandReceipts');
      if (!document) throw new CommandError(404, 'Room not found');
      const room = document.toObject() as Room;
      if (room.courseId && !(await authorizeCourse(room.courseId)).authorized)
        throw new CommandError(403, 'Course access is unavailable');
      await validateRoomRevision(actor.userId, room);
      const saved = receipt(room, actor.userId, commandId, payloadHash);
      // Leaving removes membership itself. Only its own minimal, already completed
      // acknowledgement may be replayed; this grants no room read/mutation access.
      if (kind === 'leave' && saved) return { status: saved.status, body: saved.response };
      const member = membership(room, actor.userId);
      if (kind !== 'join' && !member)
        throw new CommandError(403, 'Not an active participant in this room');
      if (
        (kind === 'phase' || kind === 'presenter' || kind === 'visualization') &&
        room.presenterUserId !== actor.userId
      )
        throw new CommandError(403, 'Only the active presenter may issue this command');
      if (kind === 'join' && saved && !member)
        throw new CommandError(403, 'Completed join cannot restore revoked membership');
      if (saved) return { status: saved.status, body: saved.response };
      if (room.status !== 'active') throw new CommandError(404, 'Room not found or closed');
      if (kind !== 'join' && value.expectedSeq !== room.seq)
        throw new CommandError(409, 'Stale room sequence; reload and issue a new command');
      // Reserve bounded exit receipts so a full history never traps current
      // participants. New joins/other commands stop at the ordinary limit.
      const receiptLimit = MAX_ROOM_COMMANDS + (kind === 'leave' ? room.maxParticipants : 0);
      if ((room.commandReceipts?.length || 0) >= receiptLimit)
        throw new CommandError(
          409,
          'Room command history is full; existing receipts remain replayable'
        );
      let changed = false;
      let body: ResponseBody;
      if (kind === 'phase') {
        if (value.activeActivityId) {
          const resolved = await resolveRoomActivity(actor.userId, room, value.activeActivityId);
          room.activePin = resolved.pin;
          room.revisionId = resolved.pin.revisionId;
        }
        changed =
          room.currentPhase !== value.currentPhase ||
          (value.activeActivityId !== undefined &&
            room.activeActivityId !== value.activeActivityId);
        room.currentPhase = value.currentPhase;
        if (value.activeActivityId !== undefined) {
          room.activeActivityId = value.activeActivityId;
          if (!value.activeActivityId) room.activePin = null;
          if (changed) room.activityRound = commandId;
          if (changed)
            room.participants.forEach((p) => {
              p.hasSubmitted = false;
            });
        }
        room.seq += changed ? 1 : 0;
        body = {
          success: true,
          roomId: room.roomId,
          seq: room.seq,
          currentPhase: room.currentPhase,
          activeActivityId: room.activeActivityId ?? null
        };
      } else if (kind === 'visualization') {
        let state;
        try {
          state = parseBinarySearchState({
            exampleId: value.exampleId,
            values: value.values,
            target: value.target,
            step: value.step
          });
        } catch {
          throw new CommandError(400, 'Unsupported or out-of-range visualization state');
        }
        changed = JSON.stringify(room.visualizationState) !== JSON.stringify(state);
        room.visualizationState = state;
        room.seq += changed ? 1 : 0;
        body = { success: true, roomId: room.roomId, seq: room.seq };
      } else if (kind === 'presenter') {
        if (!room.participants.some((p) => p.userId === value.presenterUserId && !p.leftAt))
          throw new CommandError(400, 'Target is not an active participant');
        changed = room.presenterUserId !== value.presenterUserId;
        room.presenterUserId = value.presenterUserId;
        room.seq += changed ? 1 : 0;
        body = {
          success: true,
          roomId: room.roomId,
          seq: room.seq,
          presenterUserId: room.presenterUserId
        };
      } else if (kind === 'leave') {
        const participant = room.participants.find((p) => p.userId === actor.userId && !p.leftAt)!;
        participant.leftAt = new Date();
        participant.isOnline = false;
        const remaining = room.participants.filter((p) => !p.leftAt);
        if (!remaining.length) {
          room.status = 'closed';
          room.closedAt = new Date();
        } else if (room.presenterUserId === actor.userId)
          room.presenterUserId = (remaining.find((p) => p.role === 'host') || remaining[0]).userId;
        changed = true;
        room.seq++;
        body = { success: true, roomId: room.roomId };
      } else {
        const participant = room.participants.find((p) => p.userId === actor.userId);
        if (!participant && !value.inviteCode)
          throw new CommandError(403, 'An invite code is required');
        if (!member) {
          if (room.participants.filter((p) => !p.leftAt).length >= room.maxParticipants)
            throw new CommandError(409, 'Room has reached maximum capacity');
          if (participant) {
            delete participant.leftAt;
            participant.isOnline = true;
            participant.hasVoiceConsent = value.hasVoiceConsent;
          } else
            room.participants.push({
              userId: actor.userId,
              name: actor.name || 'Participant',
              role: 'participant',
              hasVoiceConsent: value.hasVoiceConsent,
              isOnline: true,
              hasSubmitted: false,
              joinedAt: new Date()
            });
          changed = true;
          room.seq++;
        }
        body = lifecycleResponse(room);
      }
      const recorded: IRoomCommandReceipt = {
        actorId: actor.userId,
        commandId,
        payloadHash,
        status: 200,
        response: body
      };
      if (kind === 'visualization' && room.courseId) {
        if (!(await authorizeCourse(room.courseId)).authorized)
          throw new CommandError(403, 'Course access is unavailable');
        await validateRoomRevision(actor.userId, room);
      }
      try {
        const updated = await StudyRoom.findOneAndUpdate(
          {
            _id: document._id,
            seq: document.seq,
            status: 'active',
            commandReceipts: { $not: { $elemMatch: { actorId: actor.userId, commandId } } },
            ...(kind !== 'join'
              ? {
                  participants: { $elemMatch: { userId: actor.userId, leftAt: { $exists: false } } }
                }
              : {}),
            ...(kind === 'phase' || kind === 'presenter' || kind === 'visualization'
              ? { presenterUserId: actor.userId }
              : {}),
            [`commandReceipts.${receiptLimit - 1}`]: { $exists: false }
          },
          {
            $set: {
              currentPhase: room.currentPhase,
              activeActivityId: room.activeActivityId,
              activePin: room.activePin,
              revisionId: room.revisionId,
              activityRound: room.activityRound,
              ...(room.visualizationState ? { visualizationState: room.visualizationState } : {}),
              presenterUserId: room.presenterUserId,
              participants: room.participants,
              status: room.status,
              seq: room.seq,
              ...(room.closedAt ? { closedAt: room.closedAt } : {})
            },
            $push: { commandReceipts: recorded }
          },
          { new: true, writeConcern }
        );
        if (updated) return { status: 200, body, ...(changed ? { changedRoom: updated } : {}) };
      } catch {
        // Do not guess whether the server committed; retry through receipt lookup.
        // A caller may safely repeat the exact command after a connection failure.
        throw new CommandError(503, 'Command outcome uncertain; retry the same command ID');
      }
    }
    throw new CommandError(409, 'Room changed repeatedly; retry the same command');
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number')
      return {
        status: error.status,
        body: { error: error instanceof Error ? error.message : 'Unavailable' }
      };
    if (error instanceof CommandError)
      return { status: error.status, body: { error: error.message } };
    return {
      status: 503,
      body: { error: 'Room persistence unavailable; retry the same command ID' }
    };
  }
}
