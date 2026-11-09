/**
 * Calendar rows for availability blocks.
 *
 * The `calendar` collection had no schema and was written with the raw Mongo
 * driver from three routes. It is now the `calendar` table with a JSON body for
 * the fields that differ per caller (`description`, `estimatedMinutes`,
 * `source`), so every writer keeps working through one seam.
 */
import { prisma, toDocument } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';

export interface CalendarEntryInput {
  userId: string;
  planId?: string | null;
  taskId?: string | null;
  title: string;
  description?: string | null;
  startTime?: Date | null;
  endTime?: Date | null;
  estimatedMinutes?: number | null;
  status?: string | null;
  source?: string | null;
}

export async function insertCalendarEntries(entries: CalendarEntryInput[]): Promise<void> {
  if (entries.length === 0) return;
  await prisma.calendarEntry.createMany({
    data: entries.map((entry) => ({
      id: newId(),
      userId: entry.userId,
      planId: entry.planId ?? null,
      taskId: entry.taskId ?? null,
      title: entry.title,
      startTime: entry.startTime ?? null,
      endTime: entry.endTime ?? null,
      status: entry.status ?? null,
      payload: {
        description: entry.description ?? null,
        estimatedMinutes: entry.estimatedMinutes ?? null,
        source: entry.source ?? null
      }
    }))
  });
}

export async function deleteCalendarEntries(where: {
  userId: string;
  taskId?: string | null;
  planId?: string | null;
  source?: string;
}): Promise<number> {
  const rows = await prisma.calendarEntry.findMany({
    where: {
      userId: where.userId,
      ...(where.taskId ? { taskId: where.taskId } : {}),
      ...(where.planId ? { planId: where.planId } : {})
    },
    select: { id: true, payload: true }
  });
  const ids = where.source
    ? rows
        .filter((row) => (row.payload as { source?: string } | null)?.source === where.source)
        .map((row) => row.id)
    : rows.map((row) => row.id);
  if (ids.length === 0) return 0;
  const result = await prisma.calendarEntry.deleteMany({ where: { id: { in: ids } } });
  return result.count;
}

export async function findCalendarEntries(where: {
  userId: string;
  taskId?: string | null;
  planId?: string | null;
  from?: Date;
  to?: Date;
}) {
  const rows = await prisma.calendarEntry.findMany({
    where: {
      userId: where.userId,
      ...(where.taskId ? { taskId: where.taskId } : {}),
      ...(where.planId ? { planId: where.planId } : {}),
      ...(where.from || where.to
        ? {
            startTime: {
              ...(where.from ? { gte: where.from } : {}),
              ...(where.to ? { lte: where.to } : {})
            }
          }
        : {})
    },
    orderBy: { startTime: 'asc' }
  });
  return rows.map((row) => ({
    ...toDocument(row),
    ...((row.payload as Record<string, unknown> | null) ?? {})
  }));
}
