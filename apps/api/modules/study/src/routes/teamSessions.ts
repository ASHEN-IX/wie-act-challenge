import { canReadCourse } from '../services/resourceAccess';
import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response } from 'express';
import type { ITaskProgressEntry } from '../models';
import { errorDetails } from '@study-partner/shared/errors';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createContracts } = require('@study-partner/shared/domainContracts');
import crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const moduleClient = require('@study-partner/shared/moduleClient');
import { StudySession, Course } from '../models';
import {
  DEFAULT_TASK_ESTIMATED_MINUTES,
  toSafeInteger,
  getAxiosErrorDetails,
  buildInternalHeaders,
  isTeamSessionMember
} from '../utils/sessionHelpers';
import {
  BASE_TEAM_SESSION_XP,
  BASE_TEAM_HOST_XP,
  trackAnalyticsEvent
} from '../utils/gamificationService';

const router = createContracts();
const USER_PROFILE_URL = 'module://users';
const NOTIFICATION_URL = 'module://notifications';

// POST /team — Create team session
router.post('/team', async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { taskId, topicId, courseId, studyPlanId, mode, maxParticipants } = req.body;
    const inviteCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    // Build task list from course if provided
    const tasks: Array<ITaskProgressEntry & { estimatedMinutes: number }> = [];
    if (courseId) {
      const course = await Course.findOne({
        _id: courseId,
        userId
      });
      if (!course) return res.status(404).json({ error: 'Course not found' });
      if (course.topics) {
        course.topics.forEach((topic, tIdx) => {
          if (topic.subtopics && topic.subtopics.length > 0) {
            topic.subtopics.forEach((sub, sIdx) => {
              tasks.push({
                taskId: sub.id || `t${tIdx}-s${sIdx}`,
                title: sub.title || `${topic.title} - Part ${sIdx + 1}`,
                description: sub.summary || '',
                estimatedMinutes: DEFAULT_TASK_ESTIMATED_MINUTES,
                status: 'pending',
                xpEarned: 0
              });
            });
          } else {
            tasks.push({
              taskId: `topic-${tIdx}`,
              title: topic.title,
              description: '',
              estimatedMinutes: DEFAULT_TASK_ESTIMATED_MINUTES,
              status: 'pending',
              xpEarned: 0
            });
          }
        });
      }
    }
    if (tasks.length > 0) {
      tasks[0].status = 'in-progress';
      tasks[0].startedAt = new Date();
    }
    const session = await StudySession.create({
      userId,
      taskId,
      topicId,
      courseId,
      studyPlanId,
      mode: mode || 'focus',
      type: 'team',
      status: 'active',
      inviteCode,
      maxParticipants: Math.min(maxParticipants || 4, 4),
      participants: [
        {
          userId,
          name: req.user!.name || 'Host',
          role: 'host',
          joinedAt: new Date()
        }
      ],
      startTime: new Date(),
      taskProgress:
        tasks.length > 0
          ? {
              currentTaskIndex: 0,
              tasks,
              totalTasks: tasks.length,
              completedTasks: 0
            }
          : undefined,
      xpMultiplier: 1.0 // Will be updated when session starts based on team size
    });
    res.status(201).json({
      message: 'Team session created',
      session,
      inviteCode
    });
  } catch (error) {
    console.error('Error creating team session:', error);
    res.status(500).json({
      error: 'Failed to create team session'
    });
  }
});

// POST /team/:sessionId/join — Join team session
router.post('/team/:sessionId/join', async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { inviteCode } = req.body;
    const { sessionId } = req.params;
    const session = await StudySession.findOne({
      _id: sessionId,
      type: 'team',
      status: 'active'
    });
    if (!session)
      return res.status(404).json({
        error: 'Team session not found'
      });
    if (session.inviteCode !== inviteCode)
      return res.status(403).json({
        error: 'Invalid invite code'
      });
    if (session.participants.some((p) => p.userId === userId && !p.leftAt)) {
      return res.status(409).json({
        error: 'Already in this session'
      });
    }
    if (session.participants.filter((p) => !p.leftAt).length >= session.maxParticipants) {
      return res.status(400).json({
        error: 'Session is full'
      });
    }
    session.participants.push({
      userId,
      name: req.user!.name || 'Member',
      role: 'member',
      joinedAt: new Date()
    });

    // Update XP multiplier based on team size
    const activeCount = session.participants.filter((p) => !p.leftAt).length;
    const multipliers: Record<number, number> = {
      1: 1.0,
      2: 1.15,
      3: 1.2,
      4: 1.25
    };
    session.xpMultiplier = multipliers[Math.min(activeCount, 4)] || 1.25;
    await session.save();

    // Notify host
    try {
      await moduleClient.post(
        `${NOTIFICATION_URL}/api/v1/notifications`,
        {
          userId: session.userId,
          type: 'team_join',
          title: 'Someone joined your session',
          message: `A study partner joined your team session!`,
          metadata: {
            sessionId: session._id.toString()
          }
        },
        {
          headers: buildInternalHeaders(req.headers.cookie)
        }
      );
    } catch (err) {
      console.warn('Team join notification failed:', errorDetails(err).message);
    }
    res.json({
      message: 'Joined team session',
      session
    });
  } catch {
    res.status(500).json({
      error: 'Failed to join session'
    });
  }
});

// POST /team/join-by-code — Join session using invite code only (no sessionId needed)
router.post('/team/join-by-code', async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { inviteCode } = req.body;
    if (!inviteCode)
      return res.status(400).json({
        error: 'inviteCode is required'
      });
    const session = await StudySession.findOne({
      inviteCode: inviteCode.toUpperCase(),
      type: 'team',
      status: 'active'
    });
    if (!session)
      return res.status(404).json({
        error: 'No active session found with that invite code'
      });
    if (session.participants.some((p) => p.userId === userId && !p.leftAt)) {
      return res.status(409).json({
        error: 'Already in this session'
      });
    }
    if (session.participants.filter((p) => !p.leftAt).length >= session.maxParticipants) {
      return res.status(400).json({
        error: 'Session is full'
      });
    }
    session.participants.push({
      userId,
      name: req.user!.name || 'Member',
      role: 'member',
      joinedAt: new Date()
    });
    const activeCount = session.participants.filter((p) => !p.leftAt).length;
    const multipliers: Record<number, number> = {
      1: 1.0,
      2: 1.15,
      3: 1.2,
      4: 1.25
    };
    session.xpMultiplier = multipliers[Math.min(activeCount, 4)] || 1.25;
    await session.save();

    // Notify host
    try {
      await moduleClient.post(
        `${NOTIFICATION_URL}/api/v1/notifications`,
        {
          userId: session.userId,
          type: 'team_join',
          title: 'Someone joined your session',
          message: `A study partner joined your team session!`,
          metadata: {
            sessionId: session._id.toString()
          }
        },
        {
          headers: buildInternalHeaders(req.headers.cookie)
        }
      );
    } catch (err) {
      console.warn('Team join notification failed:', errorDetails(err).message);
    }
    res.json({
      message: 'Joined team session',
      session,
      sessionId: session._id.toString(),
      inviteCode: session.inviteCode
    });
  } catch (error) {
    console.error('Error joining by code:', error);
    res.status(500).json({
      error: 'Failed to join session'
    });
  }
});

// POST /team/:sessionId/leave — Leave team session
router.post('/team/:sessionId/leave', async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const session = await StudySession.findOne({
      _id: req.params.sessionId,
      type: 'team',
      status: 'active'
    });
    if (!session)
      return res.status(404).json({
        error: 'Session not found'
      });
    const participant = session.participants.find((p) => p.userId === userId && !p.leftAt);
    if (!participant)
      return res.status(404).json({
        error: 'Not in this session'
      });
    participant.leftAt = new Date();
    await session.save();
    res.json({
      message: 'Left team session'
    });
  } catch {
    res.status(500).json({
      error: 'Failed to leave session'
    });
  }
});

// POST /team/:sessionId/invite — Invite friend
router.post('/team/:sessionId/invite', async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const session = await StudySession.findOne({
      _id: req.params.sessionId,
      type: 'team',
      status: 'active'
    });
    if (!session) {
      console.warn(`[Team Invite] Session not found: ${req.params.sessionId}`);
      return res.status(404).json({
        error: 'Session not found'
      });
    }
    if (!isTeamSessionMember(session, userId)) {
      return res.status(403).json({
        error: 'Only session members can invite others'
      });
    }
    const { friendId } = req.body;
    if (!friendId) {
      console.warn('[Team Invite] friendId not provided in request body');
      return res.status(400).json({
        error: 'friendId required'
      });
    }
    console.log(`[Team Invite] Inviting ${friendId} to session ${session._id}`);

    // Lookup inviter nickname and course title for a personalised notification
    let inviterName = 'A friend';
    let courseName = null;
    try {
      const profileRes = await moduleClient.get(`${USER_PROFILE_URL}/api/v1/users/profile`, {
        headers: {
          Cookie: req.headers.cookie
        }
      });
      inviterName = profileRes.data?.nickname || profileRes.data?.profile?.nickname || inviterName;
    } catch {
      /* best-effort */
    }
    if (session.courseId && (await canReadCourse(friendId, session.courseId))) {
      try {
        const course = await Course.findOne({ _id: session.courseId, userId: friendId })
          .select('title')
          .lean();
        if (course) courseName = course.title;
      } catch {
        /* best-effort */
      }
    }

    // Send team invite notification
    try {
      const notificationPayload = {
        userId: friendId,
        type: 'team_invite',
        title: 'Game Room Invite',
        message: `${inviterName} invited you to join a Game Room!`,
        metadata: {
          sessionId: session._id.toString(),
          inviteCode: session.inviteCode,
          inviterName,
          ...(courseName && {
            courseName
          })
        }
      };
      console.log('[Team Invite] Sending notification:', notificationPayload);
      await moduleClient.post(`${NOTIFICATION_URL}/api/v1/notifications`, notificationPayload, {
        headers: buildInternalHeaders(req.headers.cookie)
      });
      console.log(`[Team Invite] Notification sent successfully to ${friendId}`);
    } catch (err) {
      console.warn(
        'Team invite notification failed:',
        errorDetails(err).message,
        errorDetails(err).data
      );
    }
    res.json({
      message: 'Invite sent'
    });
  } catch (error) {
    console.error('[Team Invite] Error:', error);
    res.status(500).json({
      error: 'Failed to send invite'
    });
  }
});

// PUT /team/:sessionId/start — Leader starts the session for everyone
router.put('/team/:sessionId/start', async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const session = await StudySession.findOne({
      _id: req.params.sessionId,
      type: 'team',
      status: 'active'
    });
    if (!session)
      return res.status(404).json({
        error: 'Session not found'
      });
    if (session.userId !== userId)
      return res.status(403).json({
        error: 'Only the session leader can start'
      });

    // Broadcast session_start to all active participants (including leader)
    const activeUserIds = [];
    for (const participant of session.participants.filter((p) => !p.leftAt)) {
      if (!session.courseId || (await canReadCourse(participant.userId, session.courseId)))
        activeUserIds.push(participant.userId);
    }

    // Also include the host if not already in participants list
    if (!activeUserIds.includes(userId)) activeUserIds.push(userId);
    try {
      await moduleClient.post(
        `${NOTIFICATION_URL}/api/v1/notifications/broadcast`,
        {
          userIds: activeUserIds,
          payload: {
            type: 'session_start',
            sessionId: session._id.toString(),
            inviteCode: session.inviteCode
          }
        },
        {
          headers: buildInternalHeaders(req.headers.cookie)
        }
      );
    } catch (err) {
      console.warn('[Team Start] Broadcast failed:', errorDetails(err).message);
    }
    res.json({
      message: 'Session started',
      sessionId: session._id.toString()
    });
  } catch (error) {
    console.error('[Team Start] Error:', error);
    res.status(500).json({
      error: 'Failed to start session'
    });
  }
});

// GET /team/:sessionId/participants — List participants
router.get('/team/:sessionId/participants', async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const session = await StudySession.findOne({
      _id: req.params.sessionId,
      type: 'team',
      status: 'active'
    });
    if (!session)
      return res.status(404).json({
        error: 'Session not found'
      });
    if (!isTeamSessionMember(session, userId)) {
      return res.status(403).json({
        error: 'Not a member of this session'
      });
    }
    const participants = session.participants.map((p) => ({
      userId: p.userId,
      name: p.name,
      avatar: p.avatar,
      role: p.role,
      joinedAt: p.joinedAt,
      leftAt: p.leftAt,
      durationMinutes: p.leftAt
        ? Math.round((new Date(p.leftAt).getTime() - new Date(p.joinedAt ?? NaN).getTime()) / 60000)
        : Math.round((new Date().getTime() - new Date(p.joinedAt ?? NaN).getTime()) / 60000)
    }));
    res.json({
      participants
    });
  } catch {
    res.status(500).json({
      error: 'Failed to get participants'
    });
  }
});

// PUT /team/:sessionId/end — End team session (host only)
router.put('/team/:sessionId/end', async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const session = await StudySession.findOne({
      _id: req.params.sessionId,
      type: 'team',
      status: 'active'
    });
    if (!session)
      return res.status(404).json({
        error: 'Session not found'
      });

    // Only host can end
    if (session.userId !== userId)
      return res.status(403).json({
        error: 'Only the host can end the session'
      });
    const now = new Date();
    session.status = 'completed';
    session.endTime = now;
    session.duration = Math.round((now.getTime() - new Date(session.startTime).getTime()) / 60000);

    // Set leftAt for all active participants
    session.participants.forEach((p) => {
      if (!p.leftAt) p.leftAt = now;
    });
    await session.save();

    // Award XP to each participant with participant-specific auth context.
    const participantMap = new Map();
    for (const participant of session.participants) {
      if (!participant?.userId) continue;
      participantMap.set(String(participant.userId), participant);
    }
    if (!participantMap.has(String(session.userId))) {
      participantMap.set(String(session.userId), {
        userId: String(session.userId),
        role: 'host'
      });
    }
    const teamRewards = [];
    for (const participant of participantMap.values()) {
      const participantUserId = String(participant.userId);
      try {
        const action = participant.role === 'host' ? 'team_session_host' : 'team_session';
        const baseXP = action === 'team_session_host' ? BASE_TEAM_HOST_XP : BASE_TEAM_SESSION_XP;
        const computedAwardedXP = toSafeInteger(baseXP, 0);
        const awardResponse = await moduleClient.post(
          `${USER_PROFILE_URL}/api/v1/users/gamification/award-xp`,
          {
            action,
            xp_amount: computedAwardedXP,
            userId: participantUserId,
            metadata: {
              sessionId: session._id.toString(),
              participantUserId,
              participantRole: participant.role || 'member',
              teamSize: participantMap.size
            }
          },
          {
            headers: buildInternalHeaders(req.headers.cookie)
          }
        );
        const awardData = awardResponse?.data || {};
        teamRewards.push({
          userId: participantUserId,
          action,
          baseXP,
          awardedXP: computedAwardedXP,
          rank: {
            name: awardData.rank_name || null,
            index: Number.isFinite(Number(awardData.rank_index))
              ? Number(awardData.rank_index)
              : null,
            totalKnowledgePoints: Number.isFinite(Number(awardData.total_knowledge_points))
              ? Number(awardData.total_knowledge_points)
              : null,
            knowledgePointsAwarded: Number.isFinite(Number(awardData.knowledge_points_awarded))
              ? Number(awardData.knowledge_points_awarded)
              : null,
            kpToNextRank: Number.isFinite(Number(awardData.kp_to_next_rank))
              ? Number(awardData.kp_to_next_rank)
              : null
          }
        });
      } catch (err) {
        console.warn('Team XP award failed for', participantUserId, getAxiosErrorDetails(err));
      }
      await trackAnalyticsEvent({
        authorization: req.headers.cookie,
        eventType: 'study_session_completed',
        metadata: {
          sessionId: session._id.toString(),
          duration: session.duration || 0,
          sessionType: 'team',
          participantRole: participant.role || 'member',
          teamSize: participantMap.size,
          completedTasks: session.taskProgress?.completedTasks || 0,
          totalTasks: session.taskProgress?.totalTasks || 0
        }
      });
    }
    res.json({
      message: 'Team session ended',
      session,
      teamRewards
    });
  } catch {
    res.status(500).json({
      error: 'Failed to end session'
    });
  }
});

export default router;
module.exports = router;
