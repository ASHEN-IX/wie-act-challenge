import { randomUUID } from 'node:crypto';
import Joi from 'joi';
import SessionChat, { type IPeerMessage } from '../models/SessionChat';

export const MAX_PEER_MESSAGES = 1000;
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

/** Authentication/current room-source authorization belongs to the enclosing route.
 * No AI call, room sequence write, presence write or separate idempotency claim.
 */
const MAX_APPEND_ATTEMPTS = 64;

export async function acceptPeerText(
  roomId: string,
  actor: { userId: string; name: string },
  input: unknown
) {
  const { submissionId, text } = validatePeerInput(input);
  try {
    await SessionChat.ensurePeerJournal(roomId);
    let journal = await SessionChat.readPeerJournal(roomId);
    if (!journal) throw new Error('Peer journal unavailable');

    // Every writer that loses the compare-and-swap re-reads and retries; the
    // budget only bounds pathological contention, so it scales with the number
    // of live senders rather than a fixed 5 (Mongo's atomic `$push` had none).
    for (let attempt = 0; attempt < MAX_APPEND_ATTEMPTS; attempt += 1) {
      const existing = journal.peerMessages.find(
        (m) => m.senderUserId === actor.userId && m.submissionId === submissionId
      );
      if (existing) {
        if (existing.text !== text)
          throw new PeerTextError(409, 'Submission ID already accepted with different text');
        return { message: publicPeerMessage(existing), changed: false };
      }
      if (journal.peerSeq >= MAX_PEER_MESSAGES) {
        throw new PeerTextError(
          409,
          'Room message capacity reached (1000); accepted history remains available'
        );
      }
      const message: IPeerMessage = {
        roomId,
        messageId: randomUUID(),
        submissionId,
        senderUserId: actor.userId,
        senderName: actor.name.slice(0, 80),
        text,
        seq: journal.peerSeq + 1,
        createdAt: new Date().toISOString()
      };
      // Compare-and-swap on the journal sequence: the first writer to move the
      // sequence from the value we read commits; the rest re-read and retry.
      const appended = await SessionChat.appendPeerMessage(roomId, journal.peerSeq, [
        ...journal.peerMessages,
        message
      ]);
      if (appended) return { message: publicPeerMessage(message), changed: true };
      journal = (await SessionChat.readPeerJournal(roomId)) ?? journal;
    }
    // A failed acknowledgement may follow a committed write. Retry the same ID/text.
    throw new PeerTextError(503, 'Message acceptance is uncertain. Retry the same submission.');
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
    const journal = await SessionChat.readPeerJournal(roomId);
    const lastSeq = journal?.peerSeq ?? 0;
    if (afterSeq > lastSeq)
      throw new PeerTextError(
        409,
        'History cursor is ahead of the accepted stream; recover from zero'
      );
    const items = (journal?.peerMessages ?? [])
      .slice(afterSeq, afterSeq + limit)
      .map(publicPeerMessage);
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
