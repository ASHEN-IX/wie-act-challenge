import type { Friendship as FriendshipRow, Prisma } from '../../../../src/generated/prisma/client';
import { prisma, toDocument } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';

export type FriendshipStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';
export type IFriendship = FriendshipRow & { id: string };

function hydrate(row: FriendshipRow): IFriendship {
  return toDocument(row) as IFriendship;
}

export const Friendship = {
  async findById(id: string): Promise<IFriendship | null> {
    const row = await prisma.friendship.findUnique({ where: { id } });
    return row ? hydrate(row) : null;
  },

  async findOne(where: Prisma.FriendshipWhereInput): Promise<IFriendship | null> {
    const row = await prisma.friendship.findFirst({ where });
    return row ? hydrate(row) : null;
  },

  async findMany(
    where: Prisma.FriendshipWhereInput = {},
    options: {
      take?: number;
      skip?: number;
      orderBy?: Prisma.FriendshipOrderByWithRelationInput;
    } = {}
  ): Promise<IFriendship[]> {
    const rows = await prisma.friendship.findMany({
      where,
      take: options.take,
      skip: options.skip,
      orderBy: options.orderBy
    });
    return rows.map(hydrate);
  },

  async countDocuments(where: Prisma.FriendshipWhereInput = {}): Promise<number> {
    return prisma.friendship.count({ where });
  },

  async create(data: {
    requester: string;
    recipient: string;
    status?: FriendshipStatus;
  }): Promise<IFriendship> {
    const row = await prisma.friendship.create({
      data: { id: newId(), status: data.status ?? 'pending', ...data }
    });
    return hydrate(row);
  },

  async findOneAndUpdate(
    where: Prisma.FriendshipWhereInput,
    data: Prisma.FriendshipUpdateInput
  ): Promise<IFriendship | null> {
    const existing = await prisma.friendship.findFirst({ where, select: { id: true } });
    if (!existing) return null;
    const row = await prisma.friendship.update({ where: { id: existing.id }, data });
    return hydrate(row);
  },

  async findOneAndDelete(where: Prisma.FriendshipWhereInput): Promise<IFriendship | null> {
    const existing = await prisma.friendship.findFirst({ where });
    if (!existing) return null;
    await prisma.friendship.delete({ where: { id: existing.id } });
    return hydrate(existing);
  },

  async deleteMany(where: Prisma.FriendshipWhereInput = {}) {
    const result = await prisma.friendship.deleteMany({ where });
    return { deletedCount: result.count };
  },

  async updateOne(where: Prisma.FriendshipWhereInput, data: Prisma.FriendshipUpdateInput) {
    const result = await prisma.friendship.updateMany({ where, data });
    return { matchedCount: result.count };
  },

  async save(friendship: IFriendship): Promise<IFriendship> {
    const row = await prisma.friendship.update({
      where: { id: friendship.id },
      data: {
        requester: friendship.requester,
        recipient: friendship.recipient,
        status: friendship.status
      }
    });
    return hydrate(row);
  }
};

export default Friendship;
