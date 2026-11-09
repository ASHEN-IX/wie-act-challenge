import type { Prisma, RankBadge as RankBadgeRow } from '../../../../src/generated/prisma/client';
import { prisma, toDocument } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';

export type IRankBadge = RankBadgeRow & { id: string };

function hydrate(row: RankBadgeRow): IRankBadge {
  return toDocument(row) as unknown as IRankBadge;
}

export const RankBadge = {
  async findMany(
    where: Prisma.RankBadgeWhereInput = {},
    options: { orderBy?: Prisma.RankBadgeOrderByWithRelationInput } = {}
  ): Promise<IRankBadge[]> {
    const rows = await prisma.rankBadge.findMany({ where, ...options });
    return rows.map(hydrate);
  },

  async findOne(where: Prisma.RankBadgeWhereInput): Promise<IRankBadge | null> {
    const row = await prisma.rankBadge.findFirst({ where });
    return row ? hydrate(row) : null;
  },

  async countDocuments(where: Prisma.RankBadgeWhereInput = {}): Promise<number> {
    return prisma.rankBadge.count({ where });
  },

  async upsertByRankIndex(
    data: Prisma.RankBadgeUncheckedCreateInput & { rankIndex: number }
  ): Promise<IRankBadge> {
    const row = await prisma.rankBadge.upsert({
      where: { rankIndex: data.rankIndex },
      update: data,
      create: { ...data, id: data.id ?? newId() }
    });
    return hydrate(row);
  },

  async deleteMany(where: Prisma.RankBadgeWhereInput = {}) {
    const result = await prisma.rankBadge.deleteMany({ where });
    return { deletedCount: result.count };
  }
};

export default RankBadge;
