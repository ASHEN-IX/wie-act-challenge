jest.mock('@study-partner/shared/moduleClient', () => ({ post: jest.fn(), get: jest.fn() }));
jest.mock('../models', () => ({ StudySession: { findOne: jest.fn() } }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const moduleClient = require('@study-partner/shared/moduleClient');
import { awardSessionCompletion, calculateChallengeXP } from '../utils/gamificationService';

describe('Completion rewards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    moduleClient.post.mockResolvedValue({
      data: { rank_name: 'Novice III', knowledge_points_awarded: 5 }
    });
  });

  it('awards study XP directly and preserves rank progress', async () => {
    const reward = await awardSessionCompletion({
      session: { _id: 'session-1', mode: 'focus', duration: 25 },
      authorization: 'mindflow.test_session=test'
    });
    expect(moduleClient.post).toHaveBeenCalledTimes(1);
    expect(moduleClient.post).toHaveBeenCalledWith(
      expect.stringContaining('/users/gamification/award-xp'),
      expect.objectContaining({ action: 'study_session', xp_amount: 10 }),
      expect.any(Object)
    );
    expect(moduleClient.get).not.toHaveBeenCalled();
    expect(reward).toMatchObject({
      awardedXP: 10,
      rank: { name: 'Novice III', knowledgePointsAwarded: 5 }
    });
    expect(reward).not.toHaveProperty('abilityBonuses');
  });

  it('preserves challenge difficulty scaling without an ability service', async () => {
    expect(calculateChallengeXP({ difficulty: 'expert', baseXP: 30 })).toBe(75);
    const reward = await awardSessionCompletion({
      session: { _id: 'session-2', mode: 'exam', challengeDifficulty: 'hard' },
      authorization: 'mindflow.test_session=test'
    });
    expect(reward.awardedXP).toBe(60);
    expect(moduleClient.post).toHaveBeenCalledTimes(1);
    expect(moduleClient.get).not.toHaveBeenCalled();
  });
});
