const express = require('express');
const request = require('supertest');
const axios = require('@study-partner/shared/moduleClient');
jest.mock('@study-partner/shared/moduleClient');
jest.mock('../../modules/study/src/models', () => ({
  StudySession: {
    findOne: jest.fn()
  }
}));
const sessionsRouter = require('../../modules/study/src/routes/sessions');
const { StudySession } = require('../../modules/study/src/models');
function buildApp(authUserId = 'host-1') {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = {
      userId: authUserId
    };
    next();
  });
  app.use('/api/v1/study/sessions', sessionsRouter);
  return app;
}
function makeActiveTeamSession() {
  const now = Date.now();
  return {
    _id: 'session-1',
    type: 'team',
    status: 'active',
    userId: 'host-1',
    startTime: new Date(now - 60 * 60 * 1000),
    participants: [
      {
        userId: 'host-1',
        role: 'host',
        joinedAt: new Date(now - 60 * 60 * 1000),
        leftAt: null
      },
      {
        userId: 'member-2',
        role: 'member',
        joinedAt: new Date(now - 45 * 60 * 1000),
        leftAt: null
      }
    ],
    save: jest.fn().mockResolvedValue(undefined)
  };
}
describe('Team Session Rewards Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.post.mockImplementation(async (url) => {
      if (String(url).includes('/api/v1/users/gamification/award-xp')) {
        return {
          data: {
            rank_name: 'Scholar III',
            rank_index: 6,
            total_knowledge_points: 1200
          }
        };
      }
      if (String(url).includes('/api/v1/users/quests/progress')) {
        return {
          data: {
            status: 'success'
          }
        };
      }
      return {
        data: {}
      };
    });
    axios.get.mockImplementation(async (url) => {
      if (String(url).includes('/api/v1/users/gamification')) {
        return {
          data: {
            total_xp: 5000,
            stats: {
              challengesCompleted: 2,
              groupSessions: 7
            },
            xp_history: []
          }
        };
      }
      return {
        data: {}
      };
    });
  });
  test('PUT /team/:sessionId/end returns teamRewards with participant-specific awards', async () => {
    const session = makeActiveTeamSession();
    StudySession.findOne.mockResolvedValue(session);
    const response = await request(buildApp('host-1'))
      .put('/api/v1/study/sessions/team/session-1/end')
      .set('Cookie', 'mindflow.test_session=host-auth-token');
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Team session ended');
    expect(Array.isArray(response.body.teamRewards)).toBe(true);
    expect(response.body.teamRewards).toHaveLength(2);
    const hostReward = response.body.teamRewards.find((reward) => reward.userId === 'host-1');
    const memberReward = response.body.teamRewards.find((reward) => reward.userId === 'member-2');
    expect(hostReward).toEqual(
      expect.objectContaining({
        action: 'team_session_host',
        baseXP: 30,
        awardedXP: 30
      })
    );
    expect(memberReward).toEqual(
      expect.objectContaining({
        action: 'team_session',
        baseXP: 20,
        awardedXP: 20
      })
    );
    expect(session.save).toHaveBeenCalledTimes(1);
    expect(
      session.participants.every(
        (participant) => participant.leftAt instanceof Date && participant.leftAt.getTime() > 0
      )
    ).toBe(true);
    const awardedActions = axios.post.mock.calls.map((call) => call[1]?.action).sort();
    expect(awardedActions).toEqual(['team_session', 'team_session_host']);
    const awardCalls = axios.post.mock.calls.filter(([url]) =>
      String(url).includes('/users/gamification/award-xp')
    );
    expect(awardCalls.map(([, payload]) => payload.userId).sort()).toEqual(['host-1', 'member-2']);
    expect(axios.get).not.toHaveBeenCalled();
  });
  test('PUT /team/:sessionId/end blocks non-host users', async () => {
    const session = makeActiveTeamSession();
    StudySession.findOne.mockResolvedValue(session);
    const response = await request(buildApp('member-2'))
      .put('/api/v1/study/sessions/team/session-1/end')
      .set('Cookie', 'mindflow.test_session=member-auth-token');
    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/only the host/i);
    expect(session.save).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });
  test('PUT /:sessionId emits challenge action and challenge XP rewards for exam-mode sessions', async () => {
    const now = Date.now();
    const challengeSession = {
      _id: 'challenge-session-1',
      userId: 'host-1',
      status: 'active',
      type: 'solo',
      mode: 'exam',
      taskId: 'challenge-task-1',
      challengeDifficulty: 'hard',
      courseId: 'course-1',
      duration: 45,
      startTime: new Date(now - 45 * 60 * 1000),
      save: jest.fn().mockResolvedValue(undefined)
    };
    StudySession.findOne.mockResolvedValueOnce(challengeSession).mockResolvedValueOnce(null);
    const response = await request(buildApp('host-1'))
      .put('/api/v1/study/sessions/challenge-session-1')
      .set('Cookie', 'mindflow.test_session=host-auth-token')
      .send({
        status: 'completed'
      });
    expect(response.status).toBe(200);
    expect(response.body.completionRewards).toEqual(
      expect.objectContaining({
        action: 'challenge_complete',
        baseXP: 30,
        awardedXP: 60
      })
    );
    const awardCall = axios.post.mock.calls.find((call) =>
      String(call[0] || '').includes('/gamification/award-xp')
    );
    expect(awardCall).toBeTruthy();
    expect(awardCall[1]).toEqual(
      expect.objectContaining({
        action: 'challenge_complete',
        xp_amount: 60,
        metadata: expect.objectContaining({
          sessionType: 'challenge',
          challengeId: 'challenge-task-1',
          challengeDifficulty: 'hard'
        })
      })
    );
  });
});
