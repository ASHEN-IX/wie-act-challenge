import type { Prisma, Quest as QuestRow } from '../../../../src/generated/prisma/client';
import { prisma, toDocument } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';

export type IQuest = QuestRow & { id: string };

function hydrate(row: QuestRow): IQuest {
  return toDocument(row) as unknown as IQuest;
}

export const Quest = {
  async findOne(where: Prisma.QuestWhereInput): Promise<IQuest | null> {
    const row = await prisma.quest.findFirst({ where });
    return row ? hydrate(row) : null;
  },

  async findMany(
    where: Prisma.QuestWhereInput = {},
    options: { take?: number; orderBy?: Prisma.QuestOrderByWithRelationInput } = {}
  ): Promise<IQuest[]> {
    const rows = await prisma.quest.findMany({ where, ...options });
    return rows.map(hydrate);
  },

  async countDocuments(where: Prisma.QuestWhereInput = {}): Promise<number> {
    return prisma.quest.count({ where });
  },

  async create(
    data: Omit<Prisma.QuestUncheckedCreateInput, 'id'> & { id?: string }
  ): Promise<IQuest> {
    return hydrate(await prisma.quest.create({ data: { ...data, id: data.id ?? newId() } }));
  },

  async updateOne(where: Prisma.QuestWhereInput, data: Prisma.QuestUpdateInput) {
    const result = await prisma.quest.updateMany({ where, data });
    return { matchedCount: result.count };
  },

  async updateMany(where: Prisma.QuestWhereInput, data: Prisma.QuestUpdateInput) {
    const result = await prisma.quest.updateMany({ where, data });
    return { matchedCount: result.count };
  },

  async findOneAndUpdate(
    where: Prisma.QuestWhereInput,
    data: Prisma.QuestUpdateInput
  ): Promise<IQuest | null> {
    const existing = await prisma.quest.findFirst({ where, select: { id: true } });
    if (!existing) return null;
    return hydrate(await prisma.quest.update({ where: { id: existing.id }, data }));
  },

  /**
   * Advance an active quest, completing it at the target.
   * The conditional update keeps the Mongo `status: 'active'` guard.
   */
  async incrementProgress(
    quest: IQuest,
    amount = 1
  ): Promise<{ changed: boolean; completed?: boolean; xpReward?: number }> {
    if (quest.status !== 'active') return { changed: false };
    const currentCount = Math.min(quest.currentCount + amount, quest.targetCount);
    const completed = currentCount >= quest.targetCount;
    const result = await prisma.quest.updateMany({
      where: { id: quest.id, status: 'active' },
      data: {
        currentCount,
        ...(completed ? { status: 'completed' as const, completedAt: new Date() } : {})
      }
    });
    if (result.count === 0) return { changed: false };
    return completed
      ? { changed: true, completed: true, xpReward: quest.xpReward }
      : { changed: true, completed: false };
  }
};

export default Quest;
