import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Prisma } from '../../../../src/generated/prisma/client';
import { createContracts } from '@ednova/shared/domainContracts';
import Joi from 'joi';
import type { Response, NextFunction } from 'express';
import Notification from '../models/Notification';
import { isEmailEnabled, sendNotificationEmail } from '../services/emailService';
import { requireInternal } from '@ednova/shared/auth';
import {
  broadcastToSession as realtimeBroadcastToSession,
  broadcastToUser as realtimeBroadcastToUser
} from '../realtime';

const router = createContracts();

// ── Validation schemas ──────────────────────────────
const createSchema = Joi.object({
  userId: Joi.string().required(),
  type: Joi.string()
    .valid(
      'study_reminder',
      'break_suggestion',
      'plan_generated',
      'task_due',
      'session_suspended',
      'fatigue_alert',
      'focus_drop',
      'achievement',
      'level_up',
      'quest_complete',
      'schedule_change',
      'system',
      'team_invite',
      'team_join',
      'session_start',
      'friend_request',
      'friend_accepted',
      'friend_studying'
    )
    .required(),
  title: Joi.string().max(200).required(),
  message: Joi.string().max(2000).required(),
  priority: Joi.string().valid('low', 'normal', 'high', 'urgent').default('normal'),
  metadata: Joi.object().default({}),
  data: Joi.object().optional()
});

// ── GET /api/v1/notifications?status=...&limit=... ──
// Scoped to the authenticated user (req.user.userId); the userId query param is ignored.
router.get('/', async (req: DomainRequest, res: Response, next: NextFunction) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const dbTimeoutMs = Number(process.env.NOTIFICATION_DB_TIMEOUT_MS || 8000);
    const userId = req.user!.userId;

    const filter: Prisma.NotificationWhereInput = { userId };
    if (status) filter.status = String(status);

    const { notifications, total, unreadCount } = await Notification.listPage(filter, {
      userId,
      skip: Number(offset),
      take: Number(limit),
      timeoutMs: dbTimeoutMs
    });

    return res.json({ notifications, total, unreadCount });
  } catch (err) {
    return next(err);
  }
});

// ── POST /api/v1/notifications/broadcast — fire WS only, no DB storage ──
// Internal services only (or admins).
router.post(
  '/broadcast',
  requireInternal,
  async (req: DomainRequest, res: Response, next: NextFunction) => {
    try {
      const { userIds, payload } = req.body;
      if (!Array.isArray(userIds) || !payload) {
        return res.status(400).json({ error: 'userIds (array) and payload are required' });
      }
      const broadcastToUser = req.app?.locals?.broadcastToUser || realtimeBroadcastToUser;
      if (broadcastToUser) {
        userIds.forEach((uid: string) => broadcastToUser(uid, payload));
      }
      return res.json({ delivered: userIds.length });
    } catch (err) {
      return next(err);
    }
  }
);

// ── POST /api/v1/notifications/broadcast-session — broadcast to all sockets in a room ──
router.post(
  '/broadcast-session',
  requireInternal,
  async (req: DomainRequest, res: Response, next: NextFunction) => {
    try {
      const { sessionId, roomId, payload } = req.body;
      const targetId = roomId || sessionId;
      if (!targetId || !payload) {
        return res.status(400).json({ error: 'sessionId/roomId and payload are required' });
      }
      const broadcastToSession = req.app?.locals?.broadcastToSession || realtimeBroadcastToSession;
      if (broadcastToSession) {
        await broadcastToSession(targetId, payload);
      }
      return res.json({ delivered: true, targetId });
    } catch (err) {
      return next(err);
    }
  }
);

// ── POST /api/v1/notifications — internal services only (or admins) ──
router.post('/', requireInternal, async (req: DomainRequest, res: Response, next: NextFunction) => {
  try {
    const { error, value } = createSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const normalizedValue = {
      ...value,
      metadata:
        value.metadata && Object.keys(value.metadata).length > 0 ? value.metadata : value.data || {}
    };
    delete normalizedValue.data;

    const notification = await Notification.create(normalizedValue);

    // Push via WebSocket if available
    const broadcastToUser = req.app?.locals?.broadcastToUser || realtimeBroadcastToUser;
    if (broadcastToUser) {
      broadcastToUser(normalizedValue.userId, {
        type: 'new_notification',
        notification
      });
    }

    const shouldEmail =
      isEmailEnabled() &&
      ['achievement', 'level_up', 'study_reminder', 'session_start', 'plan_generated'].includes(
        notification.type
      );

    let emailResult = null;
    if (shouldEmail) {
      emailResult = await sendNotificationEmail({ req, notification });
    }

    return res.status(201).json({ ...notification, email: emailResult });
  } catch (err) {
    return next(err);
  }
});

router.post(
  '/email/test',
  requireInternal,
  async (req: DomainRequest, res: Response, next: NextFunction) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Email test disabled in production' });
      }

      const payload = {
        type: req.body?.type || 'system',
        title: req.body?.title || 'Test Email Notification',
        message: req.body?.message || 'This is a test email from EdNova.',
        metadata: req.body?.metadata || {}
      };

      const result = await sendNotificationEmail({ req, notification: payload });
      return res.json({ ok: true, result });
    } catch (err) {
      return next(err);
    }
  }
);

// ── PATCH /api/v1/notifications/:id/read — owner-only ──
router.patch('/:id/read', async (req: DomainRequest, res: Response, next: NextFunction) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      { id: String(req.params.id), userId: req.user!.userId },
      { status: 'read', readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    return res.json(notification);
  } catch (err) {
    return next(err);
  }
});

// ── PATCH /api/v1/notifications/read-all — scoped to authenticated user ──
router.patch('/read-all', async (req: DomainRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const result = await Notification.updateMany(
      { userId, status: 'unread' },
      { status: 'read', readAt: new Date() }
    );

    return res.json({ modifiedCount: result.modifiedCount });
  } catch (err) {
    return next(err);
  }
});

// ── DELETE /api/v1/notifications/:id — owner-only ──
router.delete('/:id', async (req: DomainRequest, res: Response, next: NextFunction) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      { id: String(req.params.id), userId: req.user!.userId },
      { status: 'dismissed' },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    return res.json({ message: 'Notification dismissed' });
  } catch (err) {
    return next(err);
  }
});

export default router;
