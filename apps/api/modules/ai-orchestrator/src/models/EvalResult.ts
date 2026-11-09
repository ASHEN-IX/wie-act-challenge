/**
 * EvalResult — per-step evaluation result record (F04 / EVAL-08).
 *
 * Persisted by the AI orchestrator when it consumes ai.results for completed
 * study.eval.step jobs. Each row is ONE step of ONE session. The record is
 * keyed by `correlationId` (unique, upserted) so a replayed result event is
 * idempotent — a step is never double-written or double-counted. This is the
 * raw per-step feed BLOOM-08 consumes (`demonstratedBloomLevel`) and the
 * step-history store the backend can read to resume a session.
 *
 * Write path: the Python agents ONLY publish ai.results events; they never
 * touch the database. This model is where writes happen (Node side only).
 */

import { Prisma, type EvalResult as EvalResultRow } from '../../../../src/generated/prisma/client';
import { prisma, toDocument } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';

export type EvalStatus = 'MASTERY_CONFIRMED' | 'FAILED' | 'CONTINUE';

export const EVAL_STATUSES: EvalStatus[] = ['MASTERY_CONFIRMED', 'FAILED', 'CONTINUE'];

export interface IEvalResult extends Omit<EvalResultRow, 'scores'> {
  id: string;
  scores: Record<string, number>;
}

function hydrate(row: EvalResultRow): IEvalResult {
  return {
    ...toDocument(row),
    scores: (row.scores ?? {}) as Record<string, number>
  } as unknown as IEvalResult;
}

export const EvalResult = {
  async create(
    data: Omit<Prisma.EvalResultUncheckedCreateInput, 'id'> & { id?: string }
  ): Promise<IEvalResult> {
    const row = await prisma.evalResult.create({
      data: { ...(data as Prisma.EvalResultUncheckedCreateInput), id: data.id ?? newId() }
    });
    return hydrate(row);
  },

  async findOne(where: Prisma.EvalResultWhereInput = {}): Promise<IEvalResult | null> {
    const row = await prisma.evalResult.findFirst({ where });
    return row ? hydrate(row) : null;
  },

  async findMany(
    where: Prisma.EvalResultWhereInput = {},
    order: Prisma.EvalResultOrderByWithRelationInput = { step: 'asc' },
    take?: number
  ): Promise<IEvalResult[]> {
    const rows = await prisma.evalResult.findMany({ where, orderBy: order, take });
    return rows.map(hydrate);
  },

  async countDocuments(where: Prisma.EvalResultWhereInput = {}): Promise<number> {
    return prisma.evalResult.count({ where });
  },

  /**
   * Idempotent insert keyed by the unique `correlationId`. The first accepted
   * record wins; a replayed event never overwrites it.
   */
  /**
   * Idempotent write keyed by `correlationId`.
   *
   * A plain upsert races: two concurrent callers both miss the row, both
   * INSERT, and the loser gets a unique violation. Mongo's `$setOnInsert`
   * upsert serialized them on the unique index, so this retries the losing
   * insert as a read instead of surfacing P2002.
   */
  async upsertByCorrelation(
    data: Omit<Prisma.EvalResultUncheckedCreateInput, 'id'> & { id?: string }
  ): Promise<IEvalResult> {
    try {
      const row = await prisma.evalResult.upsert({
        where: { correlationId: data.correlationId },
        update: {},
        create: { ...(data as Prisma.EvalResultUncheckedCreateInput), id: data.id ?? newId() }
      });
      return hydrate(row);
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      // The other writer won; its row is the durable one.
      const existing = await prisma.evalResult.findUnique({
        where: { correlationId: data.correlationId }
      });
      if (!existing) throw error;
      return hydrate(existing);
    }
  }
};

export default EvalResult;
module.exports = EvalResult;
