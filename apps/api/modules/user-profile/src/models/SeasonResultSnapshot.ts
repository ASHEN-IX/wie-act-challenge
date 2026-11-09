import type {
  Prisma,
  SeasonResultSnapshot as SnapshotRow
} from '../../../../src/generated/prisma/client';
import { prisma, toDocument } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';
import { json } from './_helpers';

export type ISeasonResultSnapshot = Omit<SnapshotRow, 'resetApplied'> & {
  id: string;
  resetApplied: {
    demotedBy: number;
    newRankIndex: number;
    newRankName: string | null;
    seasonFloorIndex: number;
  };
};

function hydrate(row: SnapshotRow): ISeasonResultSnapshot {
  return toDocument(row) as unknown as ISeasonResultSnapshot;
}

export const SeasonResultSnapshot = {
  async findOne(
    where: Prisma.SeasonResultSnapshotWhereInput
  ): Promise<ISeasonResultSnapshot | null> {
    const row = await prisma.seasonResultSnapshot.findFirst({ where });
    return row ? hydrate(row) : null;
  },

  async findMany(
    where: Prisma.SeasonResultSnapshotWhereInput = {}
  ): Promise<ISeasonResultSnapshot[]> {
    const rows = await prisma.seasonResultSnapshot.findMany({ where });
    return rows.map(hydrate);
  },

  async create(
    data: Prisma.SeasonResultSnapshotUncheckedCreateInput
  ): Promise<ISeasonResultSnapshot> {
    return hydrate(
      await prisma.seasonResultSnapshot.create({ data: { ...data, id: data.id ?? newId() } })
    );
  },

  async findOneAndUpdate(
    where: Prisma.SeasonResultSnapshotWhereInput,
    data: Prisma.SeasonResultSnapshotUpdateInput
  ): Promise<ISeasonResultSnapshot | null> {
    const existing = await prisma.seasonResultSnapshot.findFirst({ where, select: { id: true } });
    if (!existing) return null;
    return hydrate(await prisma.seasonResultSnapshot.update({ where: { id: existing.id }, data }));
  },

  async upsert(
    seasonId: string,
    userId: string,
    data: Omit<Prisma.SeasonResultSnapshotUncheckedCreateInput, 'id' | 'seasonId' | 'userId'>
  ): Promise<ISeasonResultSnapshot> {
    const row = await prisma.seasonResultSnapshot.upsert({
      where: { seasonId_userId: { seasonId, userId } },
      update: { ...data, resetApplied: json(data.resetApplied) as Prisma.InputJsonValue },
      create: {
        ...data,
        id: newId(),
        seasonId,
        userId,
        resetApplied: json(data.resetApplied) as Prisma.InputJsonValue
      }
    });
    return hydrate(row);
  }
};

export default SeasonResultSnapshot;
