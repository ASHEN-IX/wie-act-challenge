import { createContracts } from '@noveris/shared/domainContracts';
import Joi from 'joi';
import type { Response, NextFunction } from 'express';
import { processSearchQuery, getHistory, deleteMessage } from '../services/chatService';
import { acceptPeerText, peerHistory, PeerTextError } from '../services/peerText';
import { broadcastToSession } from '../realtime';
import type { DomainRequest } from '../../../../src/framework/contracts';
import { logger } from '@noveris/shared';
import { verifySessionMembership } from '../utils/session-access';

const router = createContracts();

const requireSessionMember = async (req: DomainRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (
    !(await verifySessionMembership(req.headers.cookie, userId, req.params.sessionId as string))
  ) {
    return res.status(403).json({ error: 'Not an active participant in this session' });
  }
  return next();
};

const querySchema = Joi.object({
  query: Joi.string().trim().min(2).max(1000).required()
});

router.get(
  '/:sessionId/history',
  requireSessionMember,
  async (req: DomainRequest, res: Response, next: NextFunction) => {
    try {
      const sessionId = req.params.sessionId as string;
      if (req.query.kind === 'peer') {
        if (!/^room_[a-zA-Z0-9_-]{1,100}$/.test(sessionId))
          return res.status(400).json({ error: 'Dedicated room required' });
        try {
          return res.json(await peerHistory(sessionId, req.query));
        } catch (error) {
          if (error instanceof PeerTextError)
            return res.status(error.status).json({ error: error.message });
          throw error;
        }
      }
      const limit = Math.min(Number(req.query.limit || 50), 100);
      const offset = Number(req.query.offset || 0);

      const items = await getHistory({ sessionId, limit, offset });
      return res.json({ sessionId, items, count: items.length });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/:sessionId/query',
  requireSessionMember,
  async (req: DomainRequest, res: Response, next: NextFunction) => {
    try {
      const { error, value } = querySchema.validate(req.body || {});
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const result = await processSearchQuery({
        sessionId: req.params.sessionId as string,
        userId: req.user!.userId,
        query: value.query
      });

      if (
        !(await verifySessionMembership(
          req.headers.cookie,
          req.user!.userId,
          req.params.sessionId as string
        ))
      )
        return res.status(403).json({ error: 'Session access revoked' });
      return res.status(201).json(result);
    } catch (err) {
      return next(err);
    }
  }
);

// Additive public peer operation; legacy /query remains explicitly AI search.
router.post(
  '/:sessionId/messages',
  requireSessionMember,
  async (req: DomainRequest, res: Response, next: NextFunction) => {
    const roomId = req.params.sessionId as string;
    if (!/^room_[a-zA-Z0-9_-]{1,100}$/.test(roomId))
      return res.status(400).json({ error: 'Dedicated room required' });
    if (Buffer.byteLength(JSON.stringify(req.body ?? {}), 'utf8') > 12000)
      return res.status(400).json({ error: 'Message payload too large' });
    try {
      const result = await acceptPeerText(
        roomId,
        {
          userId: req.user!.userId,
          name: typeof req.user!.name === 'string' ? req.user!.name : 'Learner'
        },
        req.body
      );
      if (result.changed) {
        try {
          await broadcastToSession(roomId, {
            type: 'ROOM_PEER_MESSAGE',
            roomId,
            message: result.message
          });
        } catch {
          logger.warn(
            'Accepted peer message realtime delivery unavailable; recover through history'
          );
        }
      }
      return res.status(201).json({ message: result.message });
    } catch (error) {
      if (error instanceof PeerTextError)
        return res.status(error.status).json({ error: error.message });
      return next(error);
    }
  }
);

router.delete(
  '/:sessionId/:messageId',
  requireSessionMember,
  async (req: DomainRequest, res: Response, next: NextFunction) => {
    try {
      const result = await deleteMessage({
        sessionId: req.params.sessionId as string,
        messageId: req.params.messageId as string,
        userId: req.user!.userId
      });

      if (!result.deleted && result.reason === 'forbidden') {
        return res.status(403).json({ error: 'Not allowed to delete this message' });
      }

      if (!result.deleted) {
        return res.status(404).json({ error: 'Message not found' });
      }

      return res.json({ deleted: true, messageId: req.params.messageId });
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
