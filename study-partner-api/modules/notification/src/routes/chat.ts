import { createContracts } from '@study-partner/shared/domainContracts';
import Joi from 'joi';
import type { Request, Response, NextFunction } from 'express';
import { processSearchQuery, getHistory, deleteMessage } from '../services/chatService';

const router = createContracts();

const querySchema = Joi.object({
  query: Joi.string().trim().min(2).max(1000).required()
});

router.get(
  '/:sessionId/history',
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const sessionId = req.params.sessionId as string;
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
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { error, value } = querySchema.validate(req.body || {});
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const result = await processSearchQuery({
        sessionId: req.params.sessionId as string,
        userId: (req as any).user.userId,
        query: value.query
      });

      return res.status(201).json(result);
    } catch (err) {
      return next(err);
    }
  }
);

router.delete(
  '/:sessionId/:messageId',
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const result = await deleteMessage({
        sessionId: req.params.sessionId as string,
        messageId: req.params.messageId as string,
        userId: (req as any).user.userId
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
