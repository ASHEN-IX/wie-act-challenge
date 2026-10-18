import { createContracts } from '@study-partner/shared/domainContracts';
import Joi from 'joi';
import type { Request, Response, NextFunction } from 'express';
import {
  startVoiceSession,
  endVoiceSession,
  getVoiceStatus,
  joinParticipant,
  leaveParticipant,
  updateMute
} from '../services/voiceService';

const router = createContracts();

const participantSchema = Joi.object({
  peerId: Joi.string().allow('').optional()
});

const muteSchema = Joi.object({
  isMuted: Joi.boolean().required()
});

router.post(
  '/:sessionId/start',
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const session = await startVoiceSession(req.params.sessionId as string);
      return res.status(201).json({ sessionId: session.sessionId, isActive: session.isActive });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/:sessionId/end',
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const session = await endVoiceSession(req.params.sessionId as string);
      if (!session) return res.status(404).json({ error: 'Voice session not found' });
      return res.json({ sessionId: session.sessionId, isActive: session.isActive });
    } catch (err) {
      return next(err);
    }
  }
);

router.get(
  '/:sessionId/status',
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const status = await getVoiceStatus(req.params.sessionId as string);
      if (!status) return res.status(404).json({ error: 'Voice session not found' });
      return res.json(status);
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/:sessionId/participant',
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { error, value } = participantSchema.validate(req.body || {});
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const session = await joinParticipant({
        sessionId: req.params.sessionId as string,
        userId: (req as any).user.userId,
        peerId: value.peerId || ''
      });

      return res
        .status(201)
        .json({ sessionId: session.sessionId, participants: session.participants });
    } catch (err) {
      return next(err);
    }
  }
);

router.delete(
  '/:sessionId/participant',
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const session = await leaveParticipant({
        sessionId: req.params.sessionId as string,
        userId: (req as any).user.userId
      });

      if (!session) return res.status(404).json({ error: 'Voice session not found' });
      return res.json({ sessionId: session.sessionId, left: true });
    } catch (err) {
      return next(err);
    }
  }
);

router.patch(
  '/:sessionId/mute',
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const { error, value } = muteSchema.validate(req.body || {});
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const session = await updateMute({
        sessionId: req.params.sessionId as string,
        userId: (req as any).user.userId,
        isMuted: value.isMuted
      });

      if (!session) return res.status(404).json({ error: 'Voice session not found' });
      return res.json({ sessionId: session.sessionId, isMuted: value.isMuted });
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
