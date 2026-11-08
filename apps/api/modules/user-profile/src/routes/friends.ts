import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response } from 'express';
import type { IUserProfile } from '../models/UserProfile';
import type { FriendshipStatus } from '../models/Friendship';
import { errorDetails } from '@ednova/shared/errors';

interface FriendProfileProjection {
  userId: string;
  name: string;
  avatar: string;
  level: number;
  bio?: string;
  friendCode: string;
  onlineStatus: IUserProfile['onlineStatus'] | 'hidden';
  isFriend: boolean;
  stats?: IUserProfile['stats'];
}
import { createContracts } from '@ednova/shared/domainContracts';
import Friendship from '../models/Friendship';
import UserProfile from '../models/UserProfile';
import Gamification from '../models/Gamification';
import moduleClient from '@ednova/shared/moduleClient';
import { buildInternalHeaders } from '@ednova/shared/auth';

const router = createContracts();

const NOTIFICATION_URL = 'module://notifications';
const STUDY_URL = 'module://study';
const MAX_PENDING_REQUESTS = 20;
const INVITE_WINDOW_MS = 10 * 60 * 1000;
const MAX_INVITES_PER_WINDOW = 10;
const inviteLog = new Map<string, number[]>();

/** Per-inviter sliding window. In-memory is acceptable: the API runs as a single instance. */
function allowInvite(inviterId: string, now = Date.now()): boolean {
  const recent = (inviteLog.get(inviterId) || []).filter((t) => now - t < INVITE_WINDOW_MS);
  if (recent.length >= MAX_INVITES_PER_WINDOW) {
    inviteLog.set(inviterId, recent);
    return false;
  }
  recent.push(now);
  inviteLog.set(inviterId, recent);
  return true;
}

// Helper: send notification
async function notify(
  userId: string,
  type: string,
  title: string,
  message: string,
  metadata: Record<string, unknown>,
  authHeader?: string
) {
  try {
    await moduleClient.post(
      `${NOTIFICATION_URL}/api/v1/notifications`,
      {
        userId,
        type,
        title,
        message,
        metadata
      },
      { headers: buildInternalHeaders(authHeader) }
    );
  } catch (err) {
    console.warn('Notification send failed:', errorDetails(err).message);
  }
}

// GET / — List accepted friends
router.get('/', async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const friendships = await Friendship.find({
      $or: [{ requester: userId }, { recipient: userId }],
      status: 'accepted'
    })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const friendIds = friendships.map((f) => (f.requester === userId ? f.recipient : f.requester));
    const profiles = await UserProfile.find({ userId: { $in: friendIds } }).lean();
    const profileMap: Record<
      string,
      Partial<Pick<IUserProfile, 'nickname' | 'avatar' | 'privacy' | 'onlineStatus'>>
    > = {};
    profiles.forEach((p) => {
      profileMap[p.userId] = p;
    });

    // Fetch actual levels from Gamification collection
    const gamDocs = await Gamification.find({ userId: { $in: friendIds } })
      .select('userId level')
      .lean();
    const levelMap: Record<string, number> = {};
    gamDocs.forEach((g) => {
      levelMap[g.userId] = g.level;
    });

    const friends = friendships.map((f) => {
      const friendId = f.requester === userId ? f.recipient : f.requester;
      const profile = profileMap[friendId] || {};
      return {
        friendshipId: f._id,
        userId: friendId,
        name: profile.nickname || 'User',
        avatar: profile.avatar,
        level: levelMap[friendId] || 1,
        onlineStatus: profile.privacy?.showOnlineStatus !== false ? profile.onlineStatus : 'hidden',
        friendSince: f.updatedAt
      };
    });

    res.json({ friends, page, limit });
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// GET /requests/incoming — Pending received
router.get('/requests/incoming', async (req: DomainRequest, res: Response) => {
  try {
    const requests = await Friendship.find({ recipient: req.user!.userId, status: 'pending' })
      .sort({ createdAt: -1 })
      .lean();

    const userIds = requests.map((r) => r.requester);
    const profiles = await UserProfile.find({ userId: { $in: userIds } }).lean();
    const profileMap: Record<
      string,
      Partial<Pick<IUserProfile, 'nickname' | 'avatar' | 'privacy' | 'onlineStatus'>>
    > = {};
    profiles.forEach((p) => {
      profileMap[p.userId] = p;
    });

    const gamDocs = await Gamification.find({ userId: { $in: userIds } })
      .select('userId level')
      .lean();
    const levelMap: Record<string, number> = {};
    gamDocs.forEach((g) => {
      levelMap[g.userId] = g.level;
    });

    const result = requests.map((r) => ({
      friendshipId: r._id,
      userId: r.requester,
      name: profileMap[r.requester]?.nickname || 'User',
      avatar: profileMap[r.requester]?.avatar,
      level: levelMap[r.requester] || 1,
      sentAt: r.createdAt
    }));

    res.json({ requests: result });
  } catch {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// GET /requests/outgoing — Pending sent
router.get('/requests/outgoing', async (req: DomainRequest, res: Response) => {
  try {
    const requests = await Friendship.find({ requester: req.user!.userId, status: 'pending' })
      .sort({ createdAt: -1 })
      .lean();

    const userIds = requests.map((r) => r.recipient);
    const profiles = await UserProfile.find({ userId: { $in: userIds } }).lean();
    const profileMap: Record<
      string,
      Partial<Pick<IUserProfile, 'nickname' | 'avatar' | 'privacy' | 'onlineStatus'>>
    > = {};
    profiles.forEach((p) => {
      profileMap[p.userId] = p;
    });

    const gamDocs = await Gamification.find({ userId: { $in: userIds } })
      .select('userId level')
      .lean();
    const levelMap: Record<string, number> = {};
    gamDocs.forEach((g) => {
      levelMap[g.userId] = g.level;
    });

    const result = requests.map((r) => ({
      friendshipId: r._id,
      userId: r.recipient,
      name: profileMap[r.recipient]?.nickname || 'User',
      avatar: profileMap[r.recipient]?.avatar,
      level: levelMap[r.recipient] || 1,
      sentAt: r.createdAt
    }));

    res.json({ requests: result });
  } catch {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// POST /request — Send friend request
router.post('/request', async (req: DomainRequest, res: Response) => {
  try {
    const requesterId = req.user!.userId;
    const { userId: targetUserId, friendCode } = req.body;

    let recipientId = targetUserId;

    // Resolve friend code to userId
    if (!recipientId && friendCode) {
      const profile = await UserProfile.findOne({ friendCode: friendCode.toUpperCase() });
      if (!profile) return res.status(404).json({ error: 'Friend code not found' });
      recipientId = profile.userId;
    }

    if (!recipientId) return res.status(400).json({ error: 'userId or friendCode required' });
    if (recipientId === requesterId)
      return res.status(400).json({ error: 'Cannot friend yourself' });
    if (typeof recipientId !== 'string' || recipientId.length > 100)
      return res.status(400).json({ error: 'Invalid userId' });

    // Spam protection: bound how many requests can sit unanswered at once.
    const pendingOut = await Friendship.countDocuments({
      requester: requesterId,
      status: 'pending'
    });
    if (pendingOut >= MAX_PENDING_REQUESTS) {
      return res
        .status(429)
        .json({ error: 'You have too many pending requests. Wait for replies or cancel some.' });
    }

    // Check if blocked
    const blocked = await Friendship.findOne({
      $or: [
        { requester: recipientId, recipient: requesterId, status: 'blocked' },
        { requester: requesterId, recipient: recipientId, status: 'blocked' }
      ]
    });
    if (blocked) return res.status(403).json({ error: 'Cannot send request to this user' });

    // Check recipient privacy
    const recipientProfile = await UserProfile.findOne({ userId: recipientId });
    if (recipientProfile?.privacy?.allowRequests === 'nobody') {
      return res.status(403).json({ error: 'This user does not accept friend requests' });
    }

    // Check existing relationship
    const existing = await Friendship.findOne({
      $or: [
        { requester: requesterId, recipient: recipientId },
        { requester: recipientId, recipient: requesterId }
      ]
    });

    if (existing) {
      if (existing.status === 'accepted') return res.status(409).json({ error: 'Already friends' });
      if (existing.status === 'pending')
        return res.status(409).json({ error: 'Request already pending' });
      if (existing.status === 'rejected') {
        // 7-day cooldown after rejection
        const cooldownEnd = new Date(existing.updatedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
        if (new Date() < cooldownEnd) {
          return res.status(429).json({ error: 'Please wait before sending another request' });
        }
        // Allow re-request after cooldown
        existing.status = 'pending';
        existing.requester = requesterId;
        existing.recipient = recipientId;
        await existing.save();
        await notify(
          recipientId,
          'friend_request',
          'New Friend Request',
          `Someone wants to be your friend!`,
          { friendshipId: existing._id },
          req.headers.cookie
        );
        return res.json({ message: 'Friend request sent', friendship: existing });
      }
    }

    const friendship = await Friendship.create({ requester: requesterId, recipient: recipientId });

    // Send notification
    await notify(
      recipientId,
      'friend_request',
      'New Friend Request',
      `Someone wants to be your friend!`,
      { friendshipId: friendship._id },
      req.headers.cookie
    );

    res.status(201).json({ message: 'Friend request sent', friendship });
  } catch (error) {
    if (errorDetails(error).code === 11000)
      return res.status(409).json({ error: 'Request already exists' });
    console.error('Error sending request:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// PUT /request/:friendshipId/accept
router.put('/request/:friendshipId/accept', async (req: DomainRequest, res: Response) => {
  try {
    const friendship = await Friendship.findOne({
      _id: req.params.friendshipId,
      recipient: req.user!.userId,
      status: 'pending'
    });

    if (!friendship) return res.status(404).json({ error: 'Request not found' });

    friendship.status = 'accepted';
    await friendship.save();

    // Notify requester
    await notify(
      friendship.requester,
      'friend_accepted',
      'Friend Request Accepted',
      'Your friend request was accepted!',
      { friendshipId: friendship._id },
      req.headers.cookie
    );

    // Award XP
    try {
      const USER_PROFILE_URL = 'module://users';
      // eslint-disable-next-line no-unused-vars
      for (const uid of [friendship.requester, friendship.recipient]) {
        await moduleClient.post(
          `${USER_PROFILE_URL}/api/v1/users/gamification/award-xp`,
          {
            action: 'friend_added',
            userId: String(uid),
            metadata: { friendshipId: friendship._id.toString() }
          },
          { headers: buildInternalHeaders(req.headers.cookie) }
        );
      }
    } catch (xpErr) {
      console.warn('Friend XP award failed:', errorDetails(xpErr).message);
    }

    res.json({ message: 'Friend request accepted', friendship });
  } catch {
    res.status(500).json({ error: 'Failed to accept request' });
  }
});

// PUT /request/:friendshipId/reject
router.put('/request/:friendshipId/reject', async (req: DomainRequest, res: Response) => {
  try {
    const friendship = await Friendship.findOne({
      _id: req.params.friendshipId,
      recipient: req.user!.userId,
      status: 'pending'
    });

    if (!friendship) return res.status(404).json({ error: 'Request not found' });

    friendship.status = 'rejected';
    await friendship.save();

    res.json({ message: 'Friend request rejected' });
  } catch {
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

// DELETE /request/:friendshipId — Cancel outgoing
router.delete('/request/:friendshipId', async (req: DomainRequest, res: Response) => {
  try {
    const result = await Friendship.findOneAndDelete({
      _id: req.params.friendshipId,
      requester: req.user!.userId,
      status: 'pending'
    });

    if (!result) return res.status(404).json({ error: 'Request not found' });
    res.json({ message: 'Request cancelled' });
  } catch {
    res.status(500).json({ error: 'Failed to cancel request' });
  }
});

// DELETE /:friendId — Unfriend
router.delete('/:friendId', async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const friendId = req.params.friendId;

    const result = await Friendship.findOneAndDelete({
      $or: [
        { requester: userId, recipient: friendId, status: 'accepted' },
        { requester: friendId, recipient: userId, status: 'accepted' }
      ]
    });

    if (!result) return res.status(404).json({ error: 'Friendship not found' });
    res.json({ message: 'Friend removed' });
  } catch {
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

// POST /block/:userId
router.post('/block/:userId', async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const blockId = req.params.userId;

    // Remove existing friendship if any
    if (blockId === userId) return res.status(400).json({ error: 'Cannot block yourself' });
    // Never delete a block the other person placed against us.
    await Friendship.deleteMany({
      $or: [
        { requester: userId, recipient: blockId },
        { requester: blockId, recipient: userId, status: { $ne: 'blocked' } }
      ]
    });

    await Friendship.create({ requester: userId, recipient: blockId, status: 'blocked' });
    res.json({ message: 'User blocked' });
  } catch (error) {
    if (errorDetails(error).code === 11000) return res.json({ message: 'Already blocked' });
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// DELETE /block/:userId
router.delete('/block/:userId', async (req: DomainRequest, res: Response) => {
  try {
    await Friendship.findOneAndDelete({
      requester: req.user!.userId,
      recipient: req.params.userId,
      status: 'blocked'
    });
    res.json({ message: 'User unblocked' });
  } catch {
    res.status(500).json({ error: 'Failed to unblock' });
  }
});

// GET /blocked
router.get('/blocked', async (req: DomainRequest, res: Response) => {
  try {
    const blocked = await Friendship.find({
      requester: req.user!.userId,
      status: 'blocked'
    }).lean();
    const userIds = blocked.map((b) => b.recipient);
    const profiles = await UserProfile.find({ userId: { $in: userIds } }).lean();

    res.json({
      blocked: profiles.map((p) => ({
        userId: p.userId,
        name: p.nickname || 'User',
        avatar: p.avatar
      }))
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch blocked users' });
  }
});

// POST /invite-to-room — Invite an accepted connection to a study room the caller is in.
// The room is read *as the caller*, so only a participant can invite, and the
// invite code is taken from the server rather than the request. Course-bound
// rooms still enforce enrollment on join: an invite never grants course access.
router.post('/invite-to-room', async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { friendId, roomId } = req.body || {};
    if (
      typeof friendId !== 'string' ||
      typeof roomId !== 'string' ||
      !friendId ||
      !roomId ||
      friendId.length > 100 ||
      roomId.length > 100 ||
      !/^[a-zA-Z0-9_-]+$/.test(roomId)
    ) {
      return res.status(400).json({ error: 'friendId and roomId required' });
    }
    if (friendId === userId) return res.status(400).json({ error: 'Cannot invite yourself' });

    const friendship = await Friendship.findOne({
      $or: [
        { requester: userId, recipient: friendId, status: 'accepted' },
        { requester: friendId, recipient: userId, status: 'accepted' }
      ]
    });
    if (!friendship) return res.status(403).json({ error: 'You can only invite your connections' });

    if (!allowInvite(userId)) {
      return res.status(429).json({ error: 'Too many invitations. Try again in a few minutes.' });
    }

    let room: { roomId: string; title: string; inviteCode: string; status: string };
    try {
      const response = await moduleClient.get<{ room: typeof room }>(
        `${STUDY_URL}/api/v1/study/rooms/${encodeURIComponent(roomId)}`,
        { headers: buildInternalHeaders(req.headers.cookie) }
      );
      room = response.data.room;
    } catch {
      return res.status(403).json({ error: 'You are not in that room' });
    }
    if (!room || room.status !== 'active')
      return res.status(409).json({ error: 'Room is not active' });

    const inviter = await UserProfile.findOne({ userId }).select('nickname').lean();
    const inviterName = inviter?.nickname || 'A connection';
    await notify(
      friendId,
      'team_invite',
      'Study room invitation',
      `${inviterName} invited you to study together: ${room.title}`,
      {
        kind: 'study_room',
        inviteCode: room.inviteCode,
        roomTitle: room.title,
        fromUserId: userId
      },
      req.headers.cookie
    );
    res.json({ message: 'Invitation sent' });
  } catch (error) {
    console.error('Error inviting to room:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// GET /search — Search users
router.get('/search', async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const q = (req.query.q as string) || '';
    if (q.length < 3 || q.length > 50) return res.json({ results: [] });

    // Get blocked users to exclude
    const blockedDocs = await Friendship.find({
      $or: [
        { requester: userId, status: 'blocked' },
        { recipient: userId, status: 'blocked' }
      ]
    }).lean();
    const blockedIds = blockedDocs.map((b) => (b.requester === userId ? b.recipient : b.requester));
    blockedIds.push(userId); // exclude self

    const query = {
      userId: { $nin: blockedIds },
      $or: [
        {
          nickname: { $regex: '^' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
          'privacy.allowRequests': { $ne: 'nobody' }
        },
        { friendCode: q.toUpperCase() }
      ]
    };

    const profiles = await UserProfile.find(query).limit(20).lean();

    // Check friendship status for each result
    const resultUserIds = profiles.map((p) => p.userId);
    const friendships = await Friendship.find({
      $or: resultUserIds.flatMap((fid) => [
        { requester: userId, recipient: fid },
        { requester: fid, recipient: userId }
      ])
    }).lean();

    const friendshipMap: Record<string, FriendshipStatus> = {};
    friendships.forEach((f) => {
      const otherId = f.requester === userId ? f.recipient : f.requester;
      friendshipMap[otherId] = f.status;
    });

    // Batch-fetch Gamification levels for search results
    const searchGamDocs = await Gamification.find({ userId: { $in: resultUserIds } })
      .select('userId level')
      .lean();
    const searchLevelMap: Record<string, number> = {};
    searchGamDocs.forEach((g) => {
      searchLevelMap[g.userId] = g.level;
    });

    res.json({
      results: profiles.map((p) => ({
        userId: p.userId,
        name: p.nickname || 'User',
        avatar: p.avatar,
        level: searchLevelMap[p.userId] || 1,
        friendCode: p.friendCode,
        friendshipStatus: friendshipMap[p.userId] || null
      }))
    });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// GET /:friendId/profile — View friend profile
router.get('/:friendId/profile', async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const friendId = req.params.friendId;

    // Verify friendship
    const friendship = await Friendship.findOne({
      $or: [
        { requester: userId, recipient: friendId, status: 'accepted' },
        { requester: friendId, recipient: userId, status: 'accepted' }
      ]
    });

    const profile = await UserProfile.findOne({ userId: friendId }).lean();
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    // Get actual level from Gamification
    const gam = await Gamification.findOne({ userId: friendId }).select('level').lean();

    const isFriend = !!friendship;
    const result: FriendProfileProjection = {
      userId: profile.userId,
      name: profile.nickname || 'User',
      avatar: profile.avatar,
      level: gam?.level || 1,
      bio: profile.bio,
      friendCode: profile.friendCode,
      onlineStatus: profile.privacy?.showOnlineStatus !== false ? profile.onlineStatus : 'hidden',
      isFriend
    };

    // Include stats only if friend and privacy allows
    if (isFriend && profile.privacy?.showStats !== false) {
      result.stats = profile.stats;
    }

    res.json({ profile: result });
  } catch {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// GET /online — Online friends
router.get('/online', async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const friendships = await Friendship.find({
      $or: [{ requester: userId }, { recipient: userId }],
      status: 'accepted'
    }).lean();

    const friendIds = friendships.map((f) => (f.requester === userId ? f.recipient : f.requester));
    const onlineProfiles = await UserProfile.find({
      userId: { $in: friendIds },
      onlineStatus: { $ne: 'offline' },
      'privacy.showOnlineStatus': { $ne: false }
    }).lean();

    res.json({
      online: onlineProfiles.map((p) => {
        return {
          userId: p.userId,
          name: p.nickname || 'User',
          avatar: p.avatar,
          level: p.level?.current || 1,
          onlineStatus: p.onlineStatus
        };
      })
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch online friends' });
  }
});

// GET /count — Friend counts
router.get('/count', async (req: DomainRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const total = await Friendship.countDocuments({
      $or: [{ requester: userId }, { recipient: userId }],
      status: 'accepted'
    });
    const pending = await Friendship.countDocuments({
      recipient: userId,
      status: 'pending'
    });

    // Online count
    const friendships = await Friendship.find({
      $or: [{ requester: userId }, { recipient: userId }],
      status: 'accepted'
    }).lean();
    const friendIds = friendships.map((f) => (f.requester === userId ? f.recipient : f.requester));
    const online = await UserProfile.countDocuments({
      userId: { $in: friendIds },
      onlineStatus: { $ne: 'offline' }
    });

    res.json({ total, online, pending });
  } catch {
    res.status(500).json({ error: 'Failed to get count' });
  }
});

export default router;
module.exports = router;
