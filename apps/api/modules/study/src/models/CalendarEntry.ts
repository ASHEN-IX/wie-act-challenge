import type {
  CalendarEntry as CalendarEntryRow,
  Prisma
} from '../../../../src/generated/prisma/client';
import { prisma } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';

/**
 * A scheduled calendar row.
 *
 * The table has typed columns for the fields the scheduler always produces and
 * a `payload` JSON column for the rest (`description`, `estimatedMinutes`,
 * `source`). Rows are flattened on read so the HTTP responses carry the same
 * keys the Mongo documents had.
 */
export interface ICalendarEntry extends Omit<CalendarEntryRow, 'payload'> {
  id: string;
  description?: string | null;
  estimatedMinutes?: number | null;
  source?: string | null;
  [key: string]: unknown;
}

const PAYLOAD_KEYS = ['description', 'estimatedMinutes', 'source'] as const;

function hydrate(row: CalendarEntryRow): ICalendarEntry {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  return { ...row, ...payload, id: row.id } as ICalendarEntry;
}

function split(data: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};
  for (const key of PAYLOAD_KEYS) {
    if (data[key] !== undefined) payload[key] = data[key];
  }
  return {
    payload: payload as Prisma.InputJsonValue,
    columns: {
      userId: data.userId as string,
      taskId: (data.taskId as string | null) ?? null,
      planId: (data.planId as string | null) ?? null,
      title: (data.title as string) ?? '',
      startTime: (data.startTime as Date | null) ?? null,
      endTime: (data.endTime as Date | null) ?? null,
      status: (data.status as string | null) ?? null
    }
  };
}

export const CalendarEntry = {
  async findMany(where: {
    userId: string;
    startTime?: { gte?: Date; lte?: Date };
    taskId?: { in: string[] };
    source?: string;
  }): Promise<ICalendarEntry[]> {
    const startTime =
      where.startTime && (where.startTime.gte || where.startTime.lte)
        ? { gte: where.startTime.gte, lte: where.startTime.lte }
        : undefined;
    const rows = await prisma.calendarEntry.findMany({
      where: {
        userId: where.userId,
        startTime,
        ...(where.taskId?.in ? { taskId: { in: where.taskId.in } } : {})
      },
      orderBy: { startTime: 'asc' }
    });
    const entries = rows.map(hydrate);
    return where.source ? entries.filter((entry) => entry.source === where.source) : entries;
  },

  async insertMany(entries: Array<Record<string, unknown>>): Promise<number> {
    if (!entries.length) return 0;
    const result = await prisma.calendarEntry.createMany({
      data: entries.map((entry) => {
        const { payload, columns } = split(entry);
        return { ...columns, payload, id: newId() };
      })
    });
    return result.count;
  }
};

export default CalendarEntry;
