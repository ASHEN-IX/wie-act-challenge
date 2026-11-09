import {
  Prisma,
  type AnalyticsEvent as AnalyticsEventRow
} from '../../../../src/generated/prisma/client';
import { prisma, toDocument } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';

export type AnalyticsEventType =
  | 'study_session_started'
  | 'study_session_completed'
  | 'task_created'
  | 'task_completed'
  | 'course_ingested'
  | 'plan_generated'
  | 'focus_tracked'
  | 'login'
  | 'profile_updated';

export type IAnalyticsEvent = AnalyticsEventRow & {
  _id: string;
  metadata: (Record<string, unknown> & { duration?: number }) | null;
};

function hydrate(row: AnalyticsEventRow): IAnalyticsEvent {
  return toDocument(row) as IAnalyticsEvent;
}

export const AnalyticsEvent = {
  async create(data: {
    userId: string;
    eventType: AnalyticsEventType | string;
    metadata?: Record<string, unknown>;
  }): Promise<IAnalyticsEvent> {
    const row = await prisma.analyticsEvent.create({
      data: {
        id: newId(),
        userId: data.userId,
        eventType: data.eventType,
        metadata: (data.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue
      }
    });
    return hydrate(row);
  },

  async findMany(
    where: Prisma.AnalyticsEventWhereInput = {},
    order: Prisma.AnalyticsEventOrderByWithRelationInput = { timestamp: 'desc' },
    take?: number
  ): Promise<IAnalyticsEvent[]> {
    const rows = await prisma.analyticsEvent.findMany({ where, orderBy: order, take });
    return rows.map(hydrate);
  },

  /**
   * Daily event counts per event type.
   *
   * The Mongo pipeline was `$match` → `$group` on (type, `$dateToString` day).
   * Grouping in UTC keeps the same calendar days for a UTC server.
   */
  async countByTypeAndDay(
    where: Prisma.AnalyticsEventWhereInput
  ): Promise<Array<{ type: string; day: string; count: number }>> {
    const rows = await prisma.analyticsEvent.groupBy({
      by: ['eventType', 'timestamp'],
      where,
      _count: { _all: true }
    });
    const totals = new Map<string, { type: string; day: string; count: number }>();
    for (const row of rows) {
      const day = row.timestamp.toISOString().slice(0, 10);
      const key = `${row.eventType}:${day}`;
      const entry = totals.get(key) ?? { type: row.eventType, day, count: 0 };
      entry.count += row._count._all;
      totals.set(key, entry);
    }
    return [...totals.values()];
  },

  /** Daily event counts for one event type, ordered by day. */
  async countByDay(
    where: Prisma.AnalyticsEventWhereInput
  ): Promise<Array<{ day: string; count: number }>> {
    const rows = await prisma.analyticsEvent.groupBy({
      by: ['timestamp'],
      where,
      _count: { _all: true }
    });
    const totals = new Map<string, number>();
    for (const row of rows) {
      const day = row.timestamp.toISOString().slice(0, 10);
      totals.set(day, (totals.get(day) ?? 0) + row._count._all);
    }
    return [...totals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, count]) => ({ day, count }));
  }
};

export default AnalyticsEvent;
