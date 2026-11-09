import type {
  VoiceSession as VoiceSessionRow,
  Prisma
} from '../../../../src/generated/prisma/client';
import { prisma, toDocument } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';

export interface IParticipant {
  userId: string;
  peerId?: string;
  joinedAt: Date;
  leftAt?: Date | null;
  isMuted: boolean;
  speakingStatus: 'silent' | 'speaking' | 'loud';
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'failed';
  speakingTime: number;
  mutedDuration: number;
  lastHeartbeat: Date;
}

export type IVoiceSession = Omit<VoiceSessionRow, 'participants'> & {
  id: string;
  participants: IParticipant[];
};

/**
 * Domain voice session. The Mongo collection `voicesessions` is now the
 * `voicesessions` table; `participants` is a JSONB column with the same field
 * shape, and `sessionId` keeps its unique constraint.
 */
function hydrate(row: VoiceSessionRow): IVoiceSession {
  return {
    ...toDocument(row),
    participants: (row.participants as unknown as IParticipant[]) ?? []
  } as IVoiceSession;
}

export interface CreateVoiceSessionInput {
  id?: string;
  sessionId: string;
  startedAt?: Date;
  isActive?: boolean;
  participants?: IParticipant[];
}

export const VoiceSession = {
  async create(data: CreateVoiceSessionInput): Promise<IVoiceSession> {
    const row = await prisma.voiceSession.create({
      data: {
        id: data.id ?? newId(),
        sessionId: data.sessionId,
        startedAt: data.startedAt ?? new Date(),
        isActive: data.isActive ?? true,
        participants: data.participants as unknown as Prisma.InputJsonValue
      }
    });
    return hydrate(row);
  },

  async findOne(where: Prisma.VoiceSessionWhereInput): Promise<IVoiceSession | null> {
    const row = await prisma.voiceSession.findFirst({ where });
    return row ? hydrate(row) : null;
  },

  async findMany(
    where: Prisma.VoiceSessionWhereInput = {},
    order: Prisma.VoiceSessionOrderByWithRelationInput = { startedAt: 'desc' },
    { skip, take }: { skip?: number; take?: number } = {}
  ): Promise<IVoiceSession[]> {
    const rows = await prisma.voiceSession.findMany({ where, orderBy: order, skip, take });
    return rows.map(hydrate);
  },

  /** Persist mutable fields of an in-memory document, like `doc.save()`. */
  async save(session: IVoiceSession): Promise<IVoiceSession> {
    const row = await prisma.voiceSession.update({
      where: { id: session.id },
      data: {
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        isActive: session.isActive,
        recordingUrl: session.recordingUrl,
        participants: session.participants as unknown as Prisma.InputJsonValue
      }
    });
    return hydrate(row);
  }
};

export default VoiceSession;
