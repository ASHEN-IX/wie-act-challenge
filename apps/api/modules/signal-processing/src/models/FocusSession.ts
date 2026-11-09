import type {
  FocusSession as FocusSessionRow,
  Prisma
} from '../../../../src/generated/prisma/client';
import { prisma, toDocument } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';

export interface IFocusDataPoint {
  timestamp?: Date | string;
  focusLevel?: number;
  isDistracted?: boolean;
  gazeData?: { x?: number; y?: number };
}

export interface IFocusSummary {
  totalFocusTime?: number;
  totalDistractedTime?: number;
  avgFocusLevel?: number;
  breakCount?: number;
}

export type IFocusSession = FocusSessionRow & {
  _id: string;
  dataPoints: IFocusDataPoint[];
  summary: IFocusSummary | null;
};

function hydrate(row: FocusSessionRow): IFocusSession {
  return toDocument(row) as IFocusSession;
}

export const FocusSession = {
  async create(
    data: Omit<Prisma.FocusSessionUncheckedCreateInput, 'id'> & { id?: string }
  ): Promise<IFocusSession> {
    const row = await prisma.focusSession.create({
      data: { ...(data as Prisma.FocusSessionUncheckedCreateInput), id: data.id ?? newId() }
    });
    return hydrate(row);
  },

  async findById(id: string): Promise<IFocusSession | null> {
    const row = await prisma.focusSession.findUnique({ where: { id } });
    return row ? hydrate(row) : null;
  },

  async findOne(where: Prisma.FocusSessionWhereInput): Promise<IFocusSession | null> {
    const row = await prisma.focusSession.findFirst({ where });
    return row ? hydrate(row) : null;
  },

  async findMany(
    where: Prisma.FocusSessionWhereInput = {},
    order: Prisma.FocusSessionOrderByWithRelationInput = { startTime: 'desc' },
    take?: number
  ): Promise<IFocusSession[]> {
    const rows = await prisma.focusSession.findMany({ where, orderBy: order, take });
    return rows.map(hydrate);
  },

  /** Persist mutable fields of an in-memory document, like `doc.save()`. */
  async save(session: IFocusSession): Promise<IFocusSession> {
    const row = await prisma.focusSession.update({
      where: { id: session.id },
      data: {
        studySessionId: session.studySessionId,
        startTime: session.startTime,
        endTime: session.endTime,
        focusScore: session.focusScore,
        dataPoints: session.dataPoints as unknown as Prisma.InputJsonValue,
        summary: (session.summary ?? undefined) as Prisma.InputJsonValue | undefined
      }
    });
    return hydrate(row);
  }
};

export default FocusSession;
