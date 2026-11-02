import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response } from 'express';
import { createContracts } from '@ednova/shared/domainContracts';
import Gamification from '../models/Gamification';
import Friendship from '../models/Friendship';
import { requireInternal, isInternalRequest } from '@ednova/shared/auth';

const router = createContracts();

// Get gamification profile
router.get('/', async (req: DomainRequest, res: Response) => {
  try {
    const userId = isInternalRequest(req) ? req.query.userId || req.user!.userId : req.user!.userId;
    let profile = await Gamification.findOne({ userId });

    if (!profile) {
      profile = await Gamification.create({ userId });
    }

    res.json({
      user_id: profile.userId,
      total_xp: profile.totalXp,
      level: profile.level,
      achievements: profile.achievements,
      xp_history: profile.xpHistory,
      stats: profile.stats,
      created_at: profile.createdAt,
      updated_at: profile.updatedAt
    });
  } catch (error) {
    console.error('Error fetching gamification profile:', error);
    res.status(500).json({ error: 'Failed to fetch gamification profile' });
  }
});

// Legacy balances/catalog remain readable. New motivational XP is exclusively
// derived from server-owned accepted learning evidence; privileged callers may
// not manufacture it through an action name or custom amount.
router.post('/award-xp', requireInternal, async (_req: DomainRequest, res: Response) => {
  return res.status(409).json({
    error: 'Verified personal learning evidence is required for new XP awards',
    code: 'LEARNING_EVIDENCE_REQUIRED'
  });
});

// Get leaderboard
router.get('/leaderboard', async (req: DomainRequest, res: Response) => {
  try {
    const limit = require('@ednova/shared/pagination').boundedInteger(
      req.query.limit,
      10,
      100
    );
    const type = req.query.type || 'friends'; // 'all' or 'friends' (default friends)
    const userId = req.user!.userId;

    let query = Gamification.find();

    if (type === 'friends') {
      // Get friends' userIds
      const friendships = await Friendship.find({
        $or: [
          { requester: userId, status: 'accepted' },
          { recipient: userId, status: 'accepted' }
        ]
      });

      const friendIds = friendships.map((f) =>
        f.requester === userId ? f.recipient : f.requester
      );
      friendIds.push(userId); // include self?

      query = query.where('userId').in(friendIds);
    }

    const leaderboard = await query
      .sort({ totalXp: -1 })
      .limit(limit)
      .select('userId totalXp level stats.coursesUploaded stats.tasksCompleted');

    // Attach nicknames from UserProfile
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const UserProfile: typeof import('../models/UserProfile').default = require('../models/UserProfile');
    const userIds = leaderboard.map((e) => e.userId);
    const profiles = await UserProfile.find({ userId: { $in: userIds } })
      .select('userId nickname')
      .lean();
    const nicknameMap: Record<string, string | undefined> = {};
    profiles.forEach((p) => {
      nicknameMap[p.userId] = p.nickname;
    });

    const enriched = leaderboard.map((e) => {
      const obj = e.toObject ? e.toObject() : e;
      return { ...obj, nickname: nicknameMap[obj.userId] || null };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;
module.exports = router;
