import { errorDetails } from '@ednova/shared/errors';
import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Prisma } from '../../../../src/generated/prisma/client';
import type { IFocusSession } from '../models/FocusSession';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createContracts } = require('@ednova/shared/domainContracts');
import Joi from 'joi';
import type { Response } from 'express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const moduleClient = require('@ednova/shared/moduleClient');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FocusSession: typeof import('../models/FocusSession').default = require('../models/FocusSession');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { tierGate } = require('@ednova/shared/tierGate');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { asyncHandler } = require('@ednova/shared/middleware');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildInternalHeaders } = require('@ednova/shared/auth');

const router = createContracts();

// Validation schemas
const startSessionSchema = Joi.object({
  studySessionId: Joi.string().optional()
});

const updateSessionSchema = Joi.object({
  focusLevel: Joi.number().min(0).max(100).required(),
  isDistracted: Joi.boolean().optional(),
  gazeData: Joi.object({
    x: Joi.number().optional(),
    y: Joi.number().optional()
  }).optional()
});

// Start focus tracking session (VIP+ / Trial only)
router.post(
  '/start',
  tierGate('vip_plus', 'trial'),
  asyncHandler(async (req: DomainRequest, res: Response) => {
    const { error } = startSessionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user!.userId;
    const { studySessionId } = req.body;

    const session = await FocusSession.create({
      userId,
      studySessionId,
      startTime: new Date(),
      dataPoints: []
    });

    res.status(201).json({
      message: 'Focus tracking started',
      sessionId: session._id
    });
  })
);

// Add focus data point
router.post(
  '/:sessionId/data',
  tierGate('vip_plus', 'trial'),
  asyncHandler(async (req: DomainRequest, res: Response) => {
    const { error } = updateSessionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user!.userId;
    const { sessionId } = req.params;
    const { focusLevel, isDistracted, gazeData } = req.body;

    const session = await FocusSession.findOne({ id: String(sessionId), userId });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.endTime) {
      return res.status(400).json({ error: 'Session already ended' });
    }

    session.dataPoints.push({
      timestamp: new Date(),
      focusLevel,
      isDistracted: isDistracted || false,
      gazeData
    });

    await FocusSession.save(session);

    res.json({
      message: 'Data point added',
      currentFocusLevel: focusLevel
    });
  })
);

// End focus tracking session
router.post(
  '/:sessionId/end',
  tierGate('vip_plus', 'trial'),
  asyncHandler(async (req: DomainRequest, res: Response) => {
    const userId = req.user!.userId;
    const { sessionId } = req.params;

    const session = await FocusSession.findOne({ id: String(sessionId), userId });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.endTime) {
      return res.status(400).json({ error: 'Session already ended' });
    }

    session.endTime = new Date();

    // Calculate summary
    const dataPoints = session.dataPoints;
    const totalPoints = dataPoints.length;

    if (totalPoints > 0) {
      const avgFocusLevel =
        dataPoints.reduce(
          (sum: number, dp: IFocusSession['dataPoints'][number]) => sum + (dp.focusLevel || 0),
          0
        ) / totalPoints;
      const focusedPoints = dataPoints.filter((dp) => !dp.isDistracted).length;
      const distractedPoints = totalPoints - focusedPoints;

      const duration =
        (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000; // seconds
      const intervalDuration = duration / totalPoints;

      // Detect breaks: consecutive distracted points for more than 30 seconds
      let breakCount = 0;
      let currentBreakLength = 0;
      const minBreakDuration = 30; // 30 seconds minimum for a break

      for (const point of dataPoints) {
        if (point.isDistracted) {
          currentBreakLength += intervalDuration;
        } else {
          if (currentBreakLength >= minBreakDuration) {
            breakCount++;
          }
          currentBreakLength = 0;
        }
      }

      // Check if there's an ongoing break at the end
      if (currentBreakLength >= minBreakDuration) {
        breakCount++;
      }

      session.focusScore = Math.round(avgFocusLevel);
      session.summary = {
        totalFocusTime: Math.round(focusedPoints * intervalDuration),
        totalDistractedTime: Math.round(distractedPoints * intervalDuration),
        avgFocusLevel: Math.round(avgFocusLevel * 100) / 100,
        breakCount: breakCount
      };
    }

    await FocusSession.save(session);

    // Auto-award XP for perfect focus sessions (score > 80)
    if (session.focusScore && session.focusScore > 80) {
      try {
        const USER_PROFILE_URL = 'module://users';
        await moduleClient.post(
          `${USER_PROFILE_URL}/api/v1/users/gamification/award-xp`,
          {
            action: 'perfect_focus_session',
            metadata: { sessionId: session._id.toString(), focusScore: session.focusScore }
          },
          {
            headers: buildInternalHeaders(req.headers.cookie)
          }
        );
      } catch (xpErr) {
        console.warn('XP award failed for perfect focus session:', errorDetails(xpErr).message);
      }
    }

    // Progress focus_session quests regardless of score
    try {
      const USER_PROFILE_URL_Q = 'module://users';
      await moduleClient.post(
        `${USER_PROFILE_URL_Q}/api/v1/users/quests/progress`,
        {
          action: 'focus_session'
        },
        {
          headers: buildInternalHeaders(req.headers.cookie)
        }
      );
    } catch (questErr) {
      console.warn('Quest progress failed for focus session:', errorDetails(questErr).message);
    }

    res.json({
      message: 'Session ended',
      focusScore: session.focusScore,
      summary: session.summary
    });
  })
);

// Get session details
router.get(
  '/:sessionId',
  tierGate('vip_plus', 'trial'),
  asyncHandler(async (req: DomainRequest, res: Response) => {
    const userId = req.user!.userId;
    const { sessionId } = req.params;

    const session = await FocusSession.findOne({ id: String(sessionId), userId });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ session });
  })
);

// Get user's recent focus sessions
router.get(
  '/',
  tierGate('vip_plus', 'trial'),
  asyncHandler(async (req: DomainRequest, res: Response) => {
    const userId = req.user!.userId;
    const { limit = 10 } = req.query as { limit?: string | number };

    const sessions = await FocusSession.findMany(
      { userId },
      { startTime: 'desc' },
      parseInt(String(limit))
    );

    res.json({ sessions });
  })
);

// Get focus statistics
router.get(
  '/stats/summary',
  tierGate('vip_plus', 'trial'),
  asyncHandler(async (req: DomainRequest, res: Response) => {
    const userId = req.user!.userId;
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

    const filter: Prisma.FocusSessionWhereInput = { userId, endTime: { not: null } };
    if (startDate || endDate) {
      filter.startTime = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {})
      };
    }

    const sessions = await FocusSession.findMany(filter, { startTime: 'desc' });

    const totalSessions = sessions.length;
    const avgFocusScore =
      sessions.length > 0
        ? sessions.reduce((sum: number, s: IFocusSession) => sum + (s.focusScore || 0), 0) /
          sessions.length
        : 0;
    const totalFocusTime = sessions.reduce(
      (sum: number, s: IFocusSession) => sum + (s.summary?.totalFocusTime || 0),
      0
    );

    res.json({
      totalSessions,
      avgFocusScore: Math.round(avgFocusScore * 100) / 100,
      totalFocusTime
    });
  })
);

module.exports = router;
export default router;
