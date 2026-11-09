import type { Prisma, RankEventLedger as LedgerRow } from '../../../../src/generated/prisma/client';
import { prisma, toDocument } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';
import { json } from './_helpers';

export type IRankEventLedger = Omit<LedgerRow, 'multipliers' | 'metadata' | 'reasonBreakdown'> & {
  id: string;
  multipliers: {
    difficulty: number;
    performance: number;
    consistency: number;
    comeback: number;
    antiGrind: number;
    total: number;
  };
  metadata: Record<string, unknown> & {
    sessionId?: string;
    focusSessionId?: string;
    eventId?: string;
  };
  reasonBreakdown: Record<string, unknown>;
};

function hydrate(row: LedgerRow): IRankEventLedger {
  return toDocument(row) as unknown as IRankEventLedger;
}

export const RankEventLedger = {
  async create(data: Prisma.RankEventLedgerUncheckedCreateInput): Promise<IRankEventLedger> {
    const payload: Prisma.RankEventLedgerUncheckedCreateInput = {
      ...data,
      id: data.id ?? newId(),
      // Preserve the two compatibility rules the schema's pre-save hook applied.
      deltaKp: Number.isFinite(data.deltaKp as number) ? data.deltaKp : (data.finalKP ?? 0),
      finalKP: Number.isFinite(data.finalKP as number)
        ? data.finalKP
        : Number.isFinite(data.deltaKp as number)
          ? data.deltaKp
          : 0,
      afterKp: Number.isFinite(data.afterKp as number)
        ? data.afterKp
        : (data.beforeKp ?? 0) + (data.deltaKp ?? 0)
    };
    if (!payload.contextSessionId) {
      const metadata = (data.metadata ?? {}) as Record<string, unknown>;
      payload.contextSessionId =
        (metadata.sessionId as string) ??
        (metadata.focusSessionId as string) ??
        (metadata.eventId as string) ??
        null;
    }
    return hydrate(await prisma.rankEventLedger.create({ data: payload }));
  },

  async findMany(
    where: Prisma.RankEventLedgerWhereInput = {},
    options: { take?: number; orderBy?: Prisma.RankEventLedgerOrderByWithRelationInput } = {}
  ): Promise<IRankEventLedger[]> {
    const rows = await prisma.rankEventLedger.findMany({ where, ...options });
    return rows.map(hydrate);
  },

  async findOne(where: Prisma.RankEventLedgerWhereInput): Promise<IRankEventLedger | null> {
    const row = await prisma.rankEventLedger.findFirst({ where });
    return row ? hydrate(row) : null;
  },

  async countDocuments(where: Prisma.RankEventLedgerWhereInput = {}): Promise<number> {
    return prisma.rankEventLedger.count({ where });
  },

  async updateMany(
    where: Prisma.RankEventLedgerWhereInput,
    data: Prisma.RankEventLedgerUpdateInput
  ) {
    const result = await prisma.rankEventLedger.updateMany({ where, data });
    return { matchedCount: result.count };
  },

  json
};

export default RankEventLedger;
