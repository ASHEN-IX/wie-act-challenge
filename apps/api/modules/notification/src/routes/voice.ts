import { verifySessionMembership, verifyVoiceConsent } from '../utils/session-access';
import type { DomainRequest } from '../../../../src/framework/contracts';
import { createContracts } from '@ednova/shared/domainContracts';
import Joi from 'joi';
import type { Response, NextFunction } from 'express';
import {
  startVoiceSession,
  endVoiceSession,
  getVoiceStatus,
  joinParticipant,
  leaveParticipant,
  updateMute
} from '../services/voiceService';

const router = createContracts();
router.use(async (req: DomainRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (
      !(await verifySessionMembership(
        req.headers.cookie,
        req.user.userId,
        String(req.params.sessionId)
      ))
    ) {
      return res.status(403).json({ error: 'Not an active participant in this session' });
    }
    if (
      !(await verifyVoiceConsent(req.headers.cookie, req.user.userId, String(req.params.sessionId)))
    ) {
      return res.status(403).json({ error: 'Explicit current microphone consent required' });
    }
    return next();
  } catch (error) {
    return next(error);
  }
});

const participantSchema = Joi.object({
  peerId: Joi.string().allow('').optional()
});

const muteSchema = Joi.object({
  isMuted: Joi.boolean().required()
});

router.post('/:sessionId/start', async (req: DomainRequest, res: Response, next: NextFunction) => {
  try {
    const session = await startVoiceSession(req.params.sessionId as string);
    return res.status(201).json({ sessionId: session.sessionId, isActive: session.isActive });
  } catch (err) {
    return next(err);
  }
});

router.post('/:sessionId/end', async (req: DomainRequest, res: Response, next: NextFunction) => {
  try {
    const session = await endVoiceSession(req.params.sessionId as string);
    if (!session) return res.status(404).json({ error: 'Voice session not found' });
    return res.json({ sessionId: session.sessionId, isActive: session.isActive });
  } catch (err) {
    return next(err);
  }
});

router.get('/:sessionId/status', async (req: DomainRequest, res: Response, next: NextFunction) => {
  try {
    const status = await getVoiceStatus(req.params.sessionId as string);
    if (!status) return res.status(404).json({ error: 'Voice session not found' });
    return res.json(status);
  } catch (err) {
    return next(err);
  }
});

router.post(
  '/:sessionId/participant',
  async (req: DomainRequest, res: Response, next: NextFunction) => {
    try {
      const { error, value } = participantSchema.validate(req.body || {});
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const session = await joinParticipant({
        sessionId: req.params.sessionId as string,
        userId: req.user!.userId,
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
  async (req: DomainRequest, res: Response, next: NextFunction) => {
    try {
      const session = await leaveParticipant({
        sessionId: req.params.sessionId as string,
        userId: req.user!.userId
      });

      if (!session) return res.status(404).json({ error: 'Voice session not found' });
      return res.json({ sessionId: session.sessionId, left: true });
    } catch (err) {
      return next(err);
    }
  }
);

router.patch('/:sessionId/mute', async (req: DomainRequest, res: Response, next: NextFunction) => {
  try {
    const { error, value } = muteSchema.validate(req.body || {});
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const session = await updateMute({
      sessionId: req.params.sessionId as string,
      userId: req.user!.userId,
      isMuted: value.isMuted
    });

    if (!session) return res.status(404).json({ error: 'Voice session not found' });
    return res.json({ sessionId: session.sessionId, isMuted: value.isMuted });
  } catch (err) {
    return next(err);
  }
});

export default router;
