import { randomUUID } from 'node:crypto';
import Joi from 'joi';
import SessionChat, { type IPeerMessage } from '../models/SessionChat';

export const MAX_PEER_MESSAGES = 1000;
const writeConcern = { w: 'majority' as const, j: true };
const journalFilter = (sessionId: string) => ({ sessionId, messageType: 'peer_stream' });
interface Journal {
  peerSeq: number;
  peerMessages: IPeerMessage[];
}
export class PeerTextError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
const sendSchema = Joi.object({
  submissionId: Joi.string().guid({ version: 'uuidv4' }).lowercase().required(),
  text: Joi.string().trim().min(1).max(2000).required()
})
  .unknown(false)
  .required();
const historySchema = Joi.object({
  kind: Joi.string().valid('peer').required(),
  afterSeq: Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  limit: Joi.number().integer().min(1).max(100).default(50)
})
  .unknown(false)
  .required();

export function validatePeerInput(input: unknown): { submissionId: string; text: string } {
  const result = sendSchema.validate(input, { convert: true });
  if (result.error) throw new PeerTextError(400, result.error.details[0].message);
  const value = result.value as { submissionId: string; text: string };
  // Reject lone surrogates and non-text control characters; allow line breaks and tabs.
  const invalidUnicode = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;
  if (
    Buffer.byteLength(value.text, 'utf8') > 8000 ||
    invalidUnicode.test(value.text) ||
    Array.from(value.text).some((char) => {
      const code = char.charCodeAt(0);
      return (code < 32 && ![9, 10, 13].includes(code)) || code === 127;
    })
  ) {
    throw new PeerTextError(400, 'Message must contain valid bounded plain text');
  }
  return value;
}
export function publicPeerMessage(message: IPeerMessage): IPeerMessage {
  return {
    roomId: message.roomId,
    messageId: message.messageId,
    submissionId: message.submissionId,
    senderUserId: message.senderUserId,
    senderName: message.senderName,
    text: message.text,
    seq: message.seq,
    createdAt: message.createdAt
  };
}

let indexReady: Promise<string> | undefined;
async function ensureJournalIndex() {
  indexReady ??= SessionChat.collection
    .createIndex(
      { sessionId: 1, messageType: 1 },
      {
        unique: true,
        name: 'peer_room_journal',
        partialFilterExpression: { messageType: 'peer_stream' }
      }
    )
    .catch((error: unknown) => {
      indexReady = undefined;
      throw error;
    });
  await indexReady;
}

/** Authentication/current room-source authorization belongs to the enclosing route.
 * No AI call, room sequence write, presence write or separate idempotency claim.
 */
export async function acceptPeerText(
  roomId: string,
  actor: { userId: string; name: string },
  input: unknown
) {
  const { submissionId, text } = validatePeerInput(input);
  try {
    await ensureJournalIndex();
    const filter = journalFilter(roomId);
    try {
      await SessionChat.collection.updateOne(
        filter,
        {
          $setOnInsert: {
            ...filter,
            userId: '__peer_journal__',
            content: 'Public peer message journal',
            peerSeq: 0,
            peerMessages: [],
            createdAt: new Date(),
            updatedAt: new Date()
          }
        },
        { upsert: true, writeConcern }
      );
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 11000))
        throw error;
    }
    const journal = (await SessionChat.collection.findOne(filter)) as unknown as Journal;
    const existing = journal.peerMessages.find(
      (m) => m.senderUserId === actor.userId && m.submissionId === submissionId
    );
    if (existing) {
      if (existing.text !== text)
        throw new PeerTextError(409, 'Submission ID already accepted with different text');
      return { message: publicPeerMessage(existing), changed: false };
    }
    const base = {
      roomId,
      messageId: randomUUID(),
      submissionId,
      senderUserId: actor.userId,
      senderName: actor.name.slice(0, 80),
      text,
      createdAt: new Date().toISOString()
    };
    const updated = (await SessionChat.collection.findOneAndUpdate(
      {
        ...filter,
        peerSeq: { $lt: MAX_PEER_MESSAGES },
        peerMessages: { $not: { $elemMatch: { senderUserId: actor.userId, submissionId } } }
      },
      [
        { $set: { peerSeq: { $add: ['$peerSeq', 1] }, updatedAt: '$$NOW' } },
        {
          $set: {
            peerMessages: {
              $concatArrays: [
                '$peerMessages',
                [{ $mergeObjects: [{ $literal: base }, { seq: '$peerSeq' }] }]
              ]
            }
          }
        }
      ],
      { returnDocument: 'after', writeConcern }
    )) as unknown as Journal | null;
    if (updated) return { message: publicPeerMessage(updated.peerMessages.at(-1)!), changed: true };
    // A concurrent duplicate won, or the bounded journal filled. Read the accepted result.
    const winner = (await SessionChat.collection.findOne(filter)) as unknown as Journal;
    const accepted = winner.peerMessages.find(
      (m) => m.senderUserId === actor.userId && m.submissionId === submissionId
    );
    if (accepted) {
      if (accepted.text !== text)
        throw new PeerTextError(409, 'Submission ID already accepted with different text');
      return { message: publicPeerMessage(accepted), changed: false };
    }
    throw new PeerTextError(
      409,
      'Room message capacity reached (1000); accepted history remains available'
    );
  } catch (error) {
    if (error instanceof PeerTextError) throw error;
    // A failed acknowledgement may follow a committed write. Retry the same ID/text.
    throw new PeerTextError(503, 'Message acceptance is uncertain. Retry the same submission.');
  }
}

export async function peerHistory(roomId: string, query: unknown) {
  const parsed = historySchema.validate(query);
  if (parsed.error) throw new PeerTextError(400, parsed.error.details[0].message);
  const { afterSeq, limit } = parsed.value as { afterSeq: number; limit: number };
  try {
    const journal = (await SessionChat.collection.findOne(journalFilter(roomId), {
      projection: { peerSeq: 1, peerMessages: { $slice: [afterSeq, limit] } }
    })) as unknown as Journal | null;
    const lastSeq = journal?.peerSeq ?? 0;
    if (afterSeq > lastSeq)
      throw new PeerTextError(
        409,
        'History cursor is ahead of the accepted stream; recover from zero'
      );
    const items = (journal?.peerMessages ?? []).map(publicPeerMessage);
    const nextAfterSeq = afterSeq + items.length;
    return {
      roomId,
      items,
      lastSeq,
      nextAfterSeq,
      hasMore: nextAfterSeq < lastSeq,
      retention: { maxMessages: MAX_PEER_MESSAGES, pruned: false }
    };
  } catch (error) {
    if (error instanceof PeerTextError) throw error;
    throw new PeerTextError(503, 'Message history is unavailable. Try recovery again.');
  }
}
