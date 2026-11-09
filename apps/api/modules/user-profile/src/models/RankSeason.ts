import type { Prisma, RankSeason as RankSeasonRow } from '../../../../src/generated/prisma/client';
import { prisma, toDocument } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';

export type RankSeasonStatus = 'upcoming' | 'active' | 'closed' | 'archived';

export type IRankSeason = Omit<RankSeasonRow, 'resetPolicy'> & {
  _id: string;
  resetPolicy: { lowBracketDrop: number; highBracketDrop: number; seasonFloorIndex: number };
};

function hydrate(row: RankSeasonRow): IRankSeason {
  return toDocument(row) as unknown as IRankSeason;
}

export const RankSeason = {
  async findOne(where: Prisma.RankSeasonWhereInput): Promise<IRankSeason | null> {
    const row = await prisma.rankSeason.findFirst({ where });
    return row ? hydrate(row) : null;
  },

  async findMany(
    where: Prisma.RankSeasonWhereInput = {},
    options: { orderBy?: Prisma.RankSeasonOrderByWithRelationInput; take?: number } = {}
  ): Promise<IRankSeason[]> {
    const rows = await prisma.rankSeason.findMany({ where, ...options });
    return rows.map(hydrate);
  },

  async create(data: Prisma.RankSeasonUncheckedCreateInput): Promise<IRankSeason> {
    return hydrate(await prisma.rankSeason.create({ data: { ...data, id: data.id ?? newId() } }));
  },

  async updateOne(where: Prisma.RankSeasonWhereInput, data: Prisma.RankSeasonUpdateInput) {
    const result = await prisma.rankSeason.updateMany({ where, data });
    return { matchedCount: result.count };
  },

  /** Active season covering `at`, newest first — the previous static helper. */
  async getActiveSeason(at: Date = new Date()): Promise<IRankSeason | null> {
    const row = await prisma.rankSeason.findFirst({
      where: {
        status: 'active',
        startAt: { lte: at },
        OR: [{ endAt: null }, { endAt: { gt: at } }]
      },
      orderBy: { startAt: 'desc' }
    });
    return row ? hydrate(row) : null;
  }
};

export default RankSeason;
