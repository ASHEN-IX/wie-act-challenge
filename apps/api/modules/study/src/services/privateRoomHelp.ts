/** Durable requester-only room tutoring. No public-room or recap projection. */
import crypto from 'node:crypto';
import mongoose, { Schema, type Model } from 'mongoose';
import { activeLearningRoom } from './roomLearning';
import { askGroundedTutor } from './tutorGrounding';
import { broadcastToUser } from '../../../notification/src/realtime';
import { ActivityBoundaryError } from './activityResolution';
interface HelpRow {
  userId: string;
  roomId: string;
  requestId: string;
  question: string;
  pinHash: string;
  pin: unknown;
  state: string;
  result?: unknown;
  claim?: string;
  leaseUntil?: Date;
  createdAt?: Date;
}
const schema = new Schema<HelpRow>(
  {
    userId: { type: String, required: true },
    roomId: { type: String, required: true },
    requestId: { type: String, required: true },
    question: { type: String, required: true },
    pinHash: { type: String, required: true },
    pin: Schema.Types.Mixed,
    state: { type: String, enum: ['pending', 'completed', 'unavailable'], required: true },
    result: Schema.Types.Mixed,
    claim: String,
    leaseUntil: Date
  },
  { timestamps: true, collection: 'private_room_help' }
);
schema.index({ userId: 1, roomId: 1, requestId: 1 }, { unique: true });
const Help: Model<HelpRow> =
  mongoose.models.PrivateRoomHelp || mongoose.model<HelpRow>('PrivateRoomHelp', schema);
const digest = (v: unknown) => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fail = (status: number, code: string, text: string): never => {
  throw new ActivityBoundaryError(status, code, text);
};
async function context(actor: string, roomId: string) {
  const room = await activeLearningRoom(actor, roomId);
  return {
    room,
    pin:
      room.courseId && room.revisionId
        ? { courseId: String(room.courseId), revisionId: room.revisionId }
        : null
  };
}
function project(row: {
  requestId: string;
  question: string;
  state: string;
  result?: unknown;
  createdAt?: unknown;
}) {
  return {
    requestId: row.requestId,
    question: row.question,
    status: row.state,
    response: row.state === 'completed' ? row.result : null,
    createdAt: row.createdAt,
    visibility: 'recipient_only'
  };
}
export async function privateHelpHistory(actor: string, roomId: string) {
  const before = await context(actor, roomId);
  const rows = await Help.find({ userId: actor, roomId }).sort({ createdAt: -1 }).limit(30).lean();
  const after = await context(actor, roomId);
  if (digest(before.pin) !== digest(after.pin)) fail(409, 'STALE_ROOM', 'Room source changed');
  return {
    visibility: 'recipient_only',
    userId: actor,
    history: rows.filter((r) => r.pinHash === digest(after.pin)).map((r) => project(r))
  };
}
export async function askPrivateRoomHelp(
  actor: string,
  roomId: string,
  input: Record<string, unknown>
) {
  if (
    Object.keys(input).some((k) => !['requestId', 'question'].includes(k)) ||
    typeof input.requestId !== 'string' ||
    !/^[a-zA-Z0-9_-]{8,100}$/.test(input.requestId) ||
    typeof input.question !== 'string' ||
    !input.question.trim() ||
    input.question.length > 2000
  )
    fail(400, 'INVALID_INPUT', 'A stable request ID and bounded question are required');
  const requestId = String(input.requestId),
    question = String(input.question).trim();
  const before = await context(actor, roomId);
  if (!before.pin)
    return {
      requestId,
      status: 'unavailable',
      response: null,
      visibility: 'recipient_only',
      reason: 'Private source help requires a published course context.'
    };
  const pin = before.pin,
    pinHash = digest(pin),
    key = { userId: actor, roomId, requestId };
  await Help.collection.createIndex({ userId: 1, roomId: 1, requestId: 1 }, { unique: true });
  try {
    await Help.updateOne(
      key,
      { $setOnInsert: { ...key, question, pin, pinHash, state: 'pending' } },
      { upsert: true }
    );
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  let stored = await Help.findOne(key).lean();
  if (!stored || stored.question !== question || stored.pinHash !== pinHash)
    fail(409, 'REQUEST_CONFLICT', 'Request identity already has a different question or source');
  if (stored!.state !== 'completed') {
    const claim = crypto.randomUUID();
    const claimed = await Help.findOneAndUpdate(
      {
        ...key,
        state: { $ne: 'completed' },
        $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: new Date() } }]
      },
      { $set: { claim, state: 'pending', leaseUntil: new Date(Date.now() + 60000) } },
      { new: true }
    );
    if (claimed) {
      try {
        const result = await askGroundedTutor(actor, pin.courseId, {
          revisionId: pin.revisionId,
          question
        });
        const after = await context(actor, roomId);
        if (digest(after.pin) !== pinHash)
          fail(409, 'STALE_ROOM', 'Room source changed during help');
        if (result.status !== 'verified') {
          await Help.updateOne(
            { ...key, claim },
            { $set: { state: 'unavailable' }, $unset: { claim: 1, leaseUntil: 1, result: 1 } }
          );
        } else {
          await Help.updateOne(
            { ...key, claim },
            { $set: { state: 'completed', result }, $unset: { claim: 1, leaseUntil: 1 } }
          );
        }
      } catch (error) {
        await Help.updateOne(
          { ...key, claim },
          { $set: { state: 'unavailable' }, $unset: { claim: 1, leaseUntil: 1, result: 1 } }
        );
        if (
          (error as { status?: number }).status === 403 ||
          (error as { status?: number }).status === 409
        )
          throw error;
      }
      stored = await Help.findOne(key).lean();
    }
  }
  const after = await context(actor, roomId);
  if (digest(after.pin) !== pinHash) fail(409, 'STALE_ROOM', 'Room source changed');
  const response = project(stored!);
  // Requester-only availability signal contains no question, source text or tutor answer.
  await broadcastToUser(actor, {
    type: 'PRIVATE_ROOM_HELP_READY',
    roomId,
    requestId,
    status: response.status
  });
  return response;
}
