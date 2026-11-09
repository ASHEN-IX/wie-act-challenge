import {
  type SessionChat as SessionChatRow,
  type Prisma
} from '../../../../src/generated/prisma/client';
import { prisma, toDocument } from '../../../../shared/database';
import { deterministicId, newId } from '../../../../shared/ids';

export interface ISearchResult {
  title?: string;
  snippet?: string;
  source?: string;
  url?: string;
  relevanceScore?: number;
}

export interface IPeerMessage {
  roomId: string;
  messageId: string;
  submissionId: string;
  senderUserId: string;
  senderName: string;
  text: string;
  seq: number;
  createdAt: string;
}

export type SessionChatMessageType = 'query' | 'result' | 'coach_suggestion' | 'peer_stream';

/** The bounded peer journal of one room: one row per `sessionId`. */
export interface IPeerJournal {
  id: string;
  peerSeq: number;
  peerMessages: IPeerMessage[];
}

export type ISessionChat = Omit<
  SessionChatRow,
  'messageType' | 'peerMessages' | 'searchResults'
> & {
  _id: string;
  messageType: SessionChatMessageType;
  peerMessages: IPeerMessage[];
  searchResults: ISearchResult[];
};

/**
 * A chat row as list queries returned it. `peerSeq` and `peerMessages` were
 * `select: false` in the Mongo schema, so conversation reads never carried the
 * peer journal; the projection is kept so `/history` responses are unchanged.
 */
export type ISessionChatView = Omit<ISessionChat, 'peerSeq' | 'peerMessages'>;

/**
 * Domain session chat. The Mongo collection `sessionchats` is now the
 * `sessionchats` table; the embedded peer journal and search results are JSONB
 * columns with the same field names.
 *
 * Mongo enforced "one peer journal per room" with a partial unique index
 * (`sessionId + messageType` where `messageType = 'peer_stream'`). PostgreSQL
 * has no such constraint in the schema, so the journal row's id is derived
 * deterministically from the room: the primary key then makes a second journal
 * for the same room impossible, and `ensurePeerJournal` treats the resulting
 * unique violation as "already created".
 */
function jsonColumn(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function hydrate(row: SessionChatRow): ISessionChat {
  return {
    ...toDocument(row),
    peerMessages: (row.peerMessages as unknown as IPeerMessage[]) ?? [],
    searchResults: (row.searchResults as unknown as ISearchResult[]) ?? []
  } as ISessionChat;
}

/** Hydrate a conversation row without the journal columns (`select: false` before). */
function hydrateView(row: SessionChatRow): ISessionChatView {
  const doc = hydrate(row);
  delete (doc as Partial<ISessionChat>).peerSeq;
  delete (doc as Partial<ISessionChat>).peerMessages;
  return doc as ISessionChatView;
}

export interface CreateSessionChatInput {
  id?: string;
  sessionId: string;
  userId: string;
  messageType: SessionChatMessageType;
  content: string;
  peerSeq?: number;
  peerMessages?: IPeerMessage[];
  searchQuery?: string;
  searchResults?: ISearchResult[];
}

export function peerJournalId(roomId: string): string {
  return deterministicId(`peer_journal:${roomId}`);
}

export const SessionChat = {
  async create(data: CreateSessionChatInput): Promise<ISessionChat> {
    const row = await prisma.sessionChat.create({
      data: {
        id: data.id ?? newId(),
        sessionId: data.sessionId,
        userId: data.userId,
        messageType: data.messageType,
        content: data.content,
        peerSeq: data.peerSeq ?? 0,
        peerMessages: jsonColumn(data.peerMessages ?? []),
        searchQuery: data.searchQuery ?? '',
        searchResults: jsonColumn(data.searchResults ?? [])
      }
    });
    return hydrate(row);
  },

  async findOne(where: Prisma.SessionChatWhereInput): Promise<ISessionChatView | null> {
    const row = await prisma.sessionChat.findFirst({ where });
    return row ? hydrateView(row) : null;
  },

  async findMany(
    where: Prisma.SessionChatWhereInput = {},
    order: Prisma.SessionChatOrderByWithRelationInput = { createdAt: 'desc' },
    { skip, take }: { skip?: number; take?: number } = {}
  ): Promise<ISessionChatView[]> {
    const rows = await prisma.sessionChat.findMany({ where, orderBy: order, skip, take });
    return rows.map(hydrateView);
  },

  async deleteOne(where: Prisma.SessionChatWhereInput): Promise<{ deletedCount: number }> {
    const result = await prisma.sessionChat.deleteMany({ where });
    return { deletedCount: result.count };
  },

  /**
   * Create the room's peer journal if the room has never had one. The
   * deterministic id is the application-level replacement for the partial
   * unique index: concurrent callers race on the same primary key and the
   * losers observe a unique violation instead of inserting a duplicate.
   */
  async ensurePeerJournal(roomId: string): Promise<void> {
    const existing = await prisma.sessionChat.findFirst({
      where: { sessionId: roomId, messageType: 'peer_stream' },
      select: { id: true }
    });
    if (existing) return;
    try {
      await prisma.sessionChat.create({
        data: {
          id: peerJournalId(roomId),
          sessionId: roomId,
          messageType: 'peer_stream',
          userId: '__peer_journal__',
          content: 'Public peer message journal',
          peerSeq: 0,
          peerMessages: jsonColumn([]),
          searchQuery: '',
          searchResults: jsonColumn([])
        }
      });
    } catch (error) {
      // A concurrent send created it first; the journal exists, which is all we need.
      if (!isUniqueViolation(error)) throw error;
    }
  },

  /** Read the room's peer journal (bounded at the journal's message cap). */
  async readPeerJournal(roomId: string): Promise<IPeerJournal | null> {
    const row = await prisma.sessionChat.findFirst({
      where: { sessionId: roomId, messageType: 'peer_stream' },
      select: { id: true, peerSeq: true, peerMessages: true }
    });
    if (!row) return null;
    return {
      id: row.id,
      peerSeq: row.peerSeq,
      peerMessages: (row.peerMessages as unknown as IPeerMessage[]) ?? []
    };
  },

  /**
   * Append to the journal under a compare-and-swap guard on `peerSeq`. Returns
   * `false` when another writer advanced the journal first, in which case the
   * caller re-reads and decides (duplicate, capacity, or retry) — the same
   * single-write serialization Mongo gave the document update.
   */
  async appendPeerMessage(
    roomId: string,
    expectedSeq: number,
    peerMessages: IPeerMessage[]
  ): Promise<boolean> {
    const result = await prisma.sessionChat.updateMany({
      where: { sessionId: roomId, messageType: 'peer_stream', peerSeq: expectedSeq },
      data: {
        peerSeq: { increment: 1 },
        peerMessages: jsonColumn(peerMessages)
      }
    });
    return result.count > 0;
  },

  /** Persist mutable fields of an in-memory document, like `doc.save()`. */
  async save(doc: ISessionChat): Promise<ISessionChat> {
    const row = await prisma.sessionChat.update({
      where: { id: doc.id },
      data: {
        content: doc.content,
        peerSeq: doc.peerSeq,
        peerMessages: jsonColumn(doc.peerMessages),
        searchQuery: doc.searchQuery,
        searchResults: jsonColumn(doc.searchResults)
      }
    });
    return hydrate(row);
  }
};

/** Prisma reports a unique constraint violation as `P2002`. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

export default SessionChat;
