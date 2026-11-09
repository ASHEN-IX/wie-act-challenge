import type {
  LearningRewardLedger as LedgerRow,
  Prisma
} from '../../../../src/generated/prisma/client';
import { prisma, toDocument } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';

export type ILearningRewardLedger = LedgerRow & { _id: string };

function hydrate(row: LedgerRow): ILearningRewardLedger {
  return toDocument(row) as unknown as ILearningRewardLedger;
}

export const LearningRewardLedger = {
  async findOne(
    where: Prisma.LearningRewardLedgerWhereInput
  ): Promise<ILearningRewardLedger | null> {
    const row = await prisma.learningRewardLedger.findFirst({ where });
    return row ? hydrate(row) : null;
  },

  async countDocuments(where: Prisma.LearningRewardLedgerWhereInput = {}): Promise<number> {
    return prisma.learningRewardLedger.count({ where });
  },

  async findMany(
    where: Prisma.LearningRewardLedgerWhereInput = {}
  ): Promise<ILearningRewardLedger[]> {
    const rows = await prisma.learningRewardLedger.findMany({ where });
    return rows.map(hydrate);
  },

  async create(
    data: Prisma.LearningRewardLedgerUncheckedCreateInput
  ): Promise<ILearningRewardLedger> {
    return hydrate(
      await prisma.learningRewardLedger.create({ data: { ...data, id: data.id ?? newId() } })
    );
  },

  async updateOne(
    where: Prisma.LearningRewardLedgerWhereInput,
    data: Prisma.LearningRewardLedgerUpdateInput
  ) {
    const result = await prisma.learningRewardLedger.updateMany({ where, data });
    return { matchedCount: result.count };
  },

  async findOneAndUpdate(
    where: Prisma.LearningRewardLedgerWhereInput,
    data: Prisma.LearningRewardLedgerUpdateInput
  ): Promise<ILearningRewardLedger | null> {
    const existing = await prisma.learningRewardLedger.findFirst({ where, select: { id: true } });
    if (!existing) return null;
    return hydrate(await prisma.learningRewardLedger.update({ where: { id: existing.id }, data }));
  }
};

export default LearningRewardLedger;
