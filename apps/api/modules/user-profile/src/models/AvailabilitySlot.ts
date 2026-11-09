import type { AvailabilitySlot as SlotRow, Prisma } from '../../../../src/generated/prisma/client';
import { prisma, toDocument } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';

export type IAvailabilitySlot = SlotRow & { _id: string };

function hydrate(row: SlotRow): IAvailabilitySlot {
  return toDocument(row) as unknown as IAvailabilitySlot;
}

export const AvailabilitySlot = {
  async findMany(
    where: Prisma.AvailabilitySlotWhereInput = {},
    options: { orderBy?: Prisma.AvailabilitySlotOrderByWithRelationInput } = {}
  ): Promise<IAvailabilitySlot[]> {
    const rows = await prisma.availabilitySlot.findMany({ where, ...options });
    return rows.map(hydrate);
  },

  async findOne(where: Prisma.AvailabilitySlotWhereInput): Promise<IAvailabilitySlot | null> {
    const row = await prisma.availabilitySlot.findFirst({ where });
    return row ? hydrate(row) : null;
  },

  async create(data: Prisma.AvailabilitySlotUncheckedCreateInput): Promise<IAvailabilitySlot> {
    return hydrate(
      await prisma.availabilitySlot.create({ data: { ...data, id: data.id ?? newId() } })
    );
  },

  async deleteOne(where: Prisma.AvailabilitySlotWhereInput) {
    const result = await prisma.availabilitySlot.deleteMany({ where });
    return { deletedCount: result.count };
  },

  async deleteMany(where: Prisma.AvailabilitySlotWhereInput = {}) {
    const result = await prisma.availabilitySlot.deleteMany({ where });
    return { deletedCount: result.count };
  },

  async updateOne(
    where: Prisma.AvailabilitySlotWhereInput,
    data: Prisma.AvailabilitySlotUpdateInput
  ) {
    const result = await prisma.availabilitySlot.updateMany({ where, data });
    return { matchedCount: result.count };
  }
};

export default AvailabilitySlot;
