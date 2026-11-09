import type { Payment as PaymentRow, Prisma } from '../../../../src/generated/prisma/client';
import { prisma, toDocument } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';

export type IPayment = PaymentRow & { _id: string };

function hydrate(row: PaymentRow): IPayment {
  return toDocument(row) as IPayment;
}

export const Payment = {
  async findById(id: string): Promise<IPayment | null> {
    const row = await prisma.payment.findUnique({ where: { id } });
    return row ? hydrate(row) : null;
  },

  async findOne(where: Prisma.PaymentWhereInput): Promise<IPayment | null> {
    const row = await prisma.payment.findFirst({ where });
    return row ? hydrate(row) : null;
  },

  async findMany(
    where: Prisma.PaymentWhereInput = {},
    order: Prisma.PaymentOrderByWithRelationInput = { createdAt: 'desc' }
  ): Promise<IPayment[]> {
    const rows = await prisma.payment.findMany({ where, orderBy: order });
    return rows.map(hydrate);
  },

  async countDocuments(where: Prisma.PaymentWhereInput = {}): Promise<number> {
    return prisma.payment.count({ where });
  },

  async create(data: Prisma.PaymentUncheckedCreateInput): Promise<IPayment> {
    return hydrate(await prisma.payment.create({ data: { ...data, id: data.id ?? newId() } }));
  },

  async findOneAndUpdate(
    where: Prisma.PaymentWhereInput,
    data: Prisma.PaymentUpdateInput,
    { new: returnNew = false }: { new?: boolean } = {}
  ): Promise<IPayment | null> {
    const existing = await prisma.payment.findFirst({ where, select: { id: true } });
    if (!existing) return null;
    const row = await prisma.payment.update({ where: { id: existing.id }, data });
    return returnNew ? hydrate(row) : hydrate(row);
  },

  async updateOne(where: Prisma.PaymentWhereInput, data: Prisma.PaymentUpdateInput) {
    const result = await prisma.payment.updateMany({ where, data });
    return { matchedCount: result.count };
  }
};

export default Payment;
