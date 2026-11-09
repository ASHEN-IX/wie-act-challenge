import { canReadCourse } from '../services/resourceAccess';
/** Prisma-shaped filter: a plain object of column predicates. */
type FilterQuery = Record<string, unknown>;
import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response } from 'express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createContracts } = require('@ednova/shared/domainContracts');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { asyncHandler } = require('@ednova/shared/middleware');
import Joi from 'joi';
import { StudySession } from '../models';
import { processSessionCompletionRewards, trackAnalyticsEvent } from '../utils/gamificationService';

const router = createContracts();

// Validation schema
const createSessionSchema = Joi.object({
  taskId: Joi.string().allow('', null).optional(),
  topicId: Joi.string().allow('', null).optional(),
  duration: Joi.number().optional(),
  status: Joi.string().valid('active', 'completed').optional(),
  startTime: Joi.date().optional(),
  endTime: Joi.date().optional(),
  focusScore: Joi.number().min(0).max(100).optional(),
  notes: Joi.string().max(1000).allow('', null).optional(),
  signalHistory: Joi.array()
    .items(
      Joi.object({
        timestamp: Joi.date().optional(),
        focusLevel: Joi.number().optional(),
        fatigueLevel: Joi.number().optional(),
        isDistracted: Joi.boolean().optional()
      })
    )
    .optional(),
  breakStats: Joi.object({
    totalBreaks: Joi.number().optional(),
    totalBreakDuration: Joi.number().optional(),
    avgBreakDuration: Joi.number().optional()
  }).optional()
});

// Update session schema
const updateSessionSchema = Joi.object({
  duration: Joi.number().optional(),
  status: Joi.string().valid('active', 'completed').optional(),
  endTime: Joi.date().optional(),
  notes: Joi.string().optional(),
  focusScore: Joi.number().min(0).max(100).optional(),
  signalHistory: Joi.array()
    .items(
      Joi.object({
        timestamp: Joi.date().optional(),
        focusLevel: Joi.number().optional(),
        fatigueLevel: Joi.number().optional(),
        isDistracted: Joi.boolean().optional()
      })
    )
    .optional(),
  breakStats: Joi.object({
    totalBreaks: Joi.number().optional(),
    totalBreakDuration: Joi.number().optional(),
    avgBreakDuration: Joi.number().optional()
  }).optional()
});

// Get all sessions
router.get(
  '/',
  asyncHandler(async (req: DomainRequest, res: Response) => {
    const userId = req.user!.userId;
    const { topicId, taskId, startDate, endDate } = req.query;

    const filter: FilterQuery = { userId };
    if (topicId) filter.topicId = topicId;
    if (taskId) filter.taskId = taskId;
    if (startDate || endDate) {
      const completedAt: Record<string, Date> = {};
      if (startDate) completedAt.$gte = new Date(String(startDate));
      if (endDate) completedAt.$lte = new Date(String(endDate));
      filter.completedAt = completedAt;
    }

    const sessions = await StudySession.find(filter).sort({ completedAt: -1 });

    const authorized = [];
    for (const session of sessions) {
      if (!session.courseId || (await canReadCourse(userId, session.courseId)))
        authorized.push(session);
    }
    res.json({ sessions: authorized });
  })
);

// Get session by ID
router.get(
  '/:sessionId',
  asyncHandler(async (req: DomainRequest, res: Response) => {
    const userId = req.user!.userId;
    const { sessionId } = req.params;

    const session = await StudySession.findOne({ _id: sessionId, userId });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ session });
  })
);

// Create session
router.post(
  '/',
  asyncHandler(async (req: DomainRequest, res: Response) => {
    const { error, value } = createSessionSchema.validate(req.body, { stripUnknown: true });
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user!.userId;

    const session = await StudySession.create({
      userId,
      status: value.duration ? 'completed' : 'active',
      ...value
    });

    res.status(201).json({
      message: 'Session created',
      session
    });
  })
);

// Update/End session
router.put(
  '/:sessionId',
  asyncHandler(async (req: DomainRequest, res: Response) => {
    const { error, value } = updateSessionSchema.validate(req.body, { stripUnknown: true });
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user!.userId;
    const { sessionId } = req.params;

    const session = await StudySession.findOne({ _id: sessionId, userId });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    Object.assign(session, value);

    // If completing, ensure end time and duration are set
    if (req.body.status === 'completed' && !session.duration && session.startTime) {
      session.endTime = new Date();
      const diffMs = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();
      session.duration = Math.round(diffMs / 60000); // Minutes
    }

    await StudySession.save(session);

    // Award daily streak XP if the user studied yesterday too
    let completionRewards = null;
    if (req.body.status === 'completed') {
      completionRewards = await processSessionCompletionRewards({
        userId,
        session,
        authorization: req.headers.cookie
      });

      await trackAnalyticsEvent({
        authorization: req.headers.cookie,
        eventType: 'study_session_completed',
        metadata: {
          sessionId: session._id.toString(),
          duration: session.duration || 0,
          focusScore: session.focusScore || 0,
          completedTasks: session.taskProgress?.completedTasks || 0,
          totalTasks: session.taskProgress?.totalTasks || 0
        }
      });
    }

    res.json({
      message: 'Session updated',
      session,
      completionRewards
    });
  })
);

// Get session statistics
router.get(
  '/stats/summary',
  asyncHandler(async (req: DomainRequest, res: Response) => {
    const userId = req.user!.userId;
    const { startDate, endDate } = req.query;

    const filter: FilterQuery = { userId };
    if (startDate || endDate) {
      const completedAt: Record<string, Date> = {};
      if (startDate) completedAt.$gte = new Date(String(startDate));
      if (endDate) completedAt.$lte = new Date(String(endDate));
      filter.completedAt = completedAt;
    }

    const sessions = await StudySession.find(filter);

    const totalSessions = sessions.length;
    const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const avgFocusScore =
      sessions.length > 0
        ? sessions.reduce((sum, s) => sum + (s.focusScore || 0), 0) / sessions.length
        : 0;

    res.json({
      totalSessions,
      totalDuration,
      avgFocusScore: Math.round(avgFocusScore * 100) / 100
    });
  })
);

export default router;
module.exports = router;
