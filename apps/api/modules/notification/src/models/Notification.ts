import type {
  Notification as NotificationRow,
  Prisma
} from '../../../../src/generated/prisma/client';
import { prisma, toDocument } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';

export type NotificationType =
  | 'study_reminder'
  | 'break_suggestion'
  | 'plan_generated'
  | 'task_due'
  | 'session_suspended'
  | 'fatigue_alert'
  | 'focus_drop'
  | 'achievement'
  | 'level_up'
  | 'quest_complete'
  | 'schedule_change'
  | 'system'
  | 'friend_request'
  | 'friend_accepted'
  | 'team_invite'
  | 'team_join'
  | 'friend_studying'
  | 'session_start';

export type NotificationStatus = 'unread' | 'read' | 'dismissed';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Domain notification. The Mongo collection `notifications` is now the
 * `notifications` table; the column names and defaults are unchanged, and
 * `toDocument` keeps `_id` on the wire.
 *
 * The old schema also carried a TTL index (`updatedAt` + 30 days where
 * `status = 'dismissed'`). PostgreSQL has no TTL indexes, so the field
 * semantics are unchanged but sweeping dismissed rows is now a maintenance
 * concern rather than a database guarantee.
 */
export type INotification = Omit<NotificationRow, 'type' | 'status' | 'priority' | 'metadata'> & {
  _id: string;
  type: NotificationType;
  status: NotificationStatus;
  priority: NotificationPriority;
  metadata: Record<string, unknown>;
};

function hydrate(row: NotificationRow): INotification {
  return toDocument(row) as unknown as INotification;
}

export const Notification = {
  async create(
    data: Omit<Prisma.NotificationUncheckedCreateInput, 'id'> & { id?: string }
  ): Promise<INotification> {
    const row = await prisma.notification.create({
      data: { ...data, id: data.id ?? newId() }
    });
    return hydrate(row);
  },

  async findMany(
    where: Prisma.NotificationWhereInput = {},
    order: Prisma.NotificationOrderByWithRelationInput = { createdAt: 'desc' },
    { take, skip }: { take?: number; skip?: number } = {}
  ): Promise<INotification[]> {
    const rows = await prisma.notification.findMany({ where, orderBy: order, take, skip });
    return rows.map(hydrate);
  },

  async countDocuments(where: Prisma.NotificationWhereInput = {}): Promise<number> {
    return prisma.notification.count({ where });
  },

  /**
   * One page of a user's notifications plus the totals the list endpoint
   * returns. The Mongo call sites passed `maxTimeMS`; Prisma has no per-query
   * deadline, so the three reads share one transaction with an equivalent
   * server-side timeout.
   */
  async listPage(
    where: Prisma.NotificationWhereInput,
    {
      userId,
      skip,
      take,
      timeoutMs
    }: { userId: string; skip: number; take: number; timeoutMs: number }
  ): Promise<{ notifications: INotification[]; total: number; unreadCount: number }> {
    return prisma.$transaction(
      async (tx) => {
        const rows = await tx.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take
        });
        const total = await tx.notification.count({ where });
        const unreadCount = await tx.notification.count({ where: { userId, status: 'unread' } });
        return { notifications: rows.map(hydrate), total, unreadCount };
      },
      { timeout: timeoutMs, maxWait: timeoutMs }
    );
  },

  async findByIdAndUpdate(
    where: Prisma.NotificationWhereInput,
    data: Prisma.NotificationUpdateManyMutationInput,
    { new: returnNew = false }: { new?: boolean } = {}
  ): Promise<INotification | null> {
    const existing = await prisma.notification.findFirst({ where });
    if (!existing) return null;
    if (!returnNew) {
      const result = await prisma.notification.updateMany({ where, data });
      return result.count > 0 ? hydrate(existing) : null;
    }
    const row = await prisma.notification.update({ where: { id: existing.id }, data });
    return hydrate(row);
  },

  async updateMany(
    where: Prisma.NotificationWhereInput,
    data: Prisma.NotificationUpdateManyMutationInput
  ): Promise<{ modifiedCount: number }> {
    const result = await prisma.notification.updateMany({ where, data });
    return { modifiedCount: result.count };
  }
};

export default Notification;
