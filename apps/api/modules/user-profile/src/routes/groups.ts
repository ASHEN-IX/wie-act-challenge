import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response } from 'express';
import crypto from 'crypto';
import { errorDetails } from '@ednova/shared/errors';
import moduleClient from '@ednova/shared/moduleClient';
import { buildInternalHeaders } from '@ednova/shared/auth';
import StudyGroup, {
  MAX_GROUP_INVITES,
  MAX_GROUP_MEMBERS,
  MAX_OWNED_GROUPS
} from '../models/StudyGroup';
import Friendship from '../models/Friendship';
import UserProfile from '../models/UserProfile';

interface GroupRequest extends DomainRequest {
  params: Record<string, string>;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createContracts } = require('@ednova/shared/domainContracts');
const router = createContracts();
const NOTIFICATION_URL = 'module://notifications';
const STUDY_URL = 'module://study';
const SESSION_FRESH_MS = 12 * 60 * 60 * 1000;

const ID = /^[a-zA-Z0-9_-]{1,100}$/;
const clean = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

async function notify(
  userId: string,
  title: string,
  message: string,
  metadata: Record<string, unknown>,
  cookie?: string
) {
  try {
    await moduleClient.post(
      `${NOTIFICATION_URL}/api/v1/notifications`,
      { userId, type: 'team_invite', title, message, metadata },
      { headers: buildInternalHeaders(cookie) }
    );
  } catch (err) {
    console.warn('Group notification failed:', errorDetails(err).message);
  }
}

async function areConnected(a: string, b: string): Promise<boolean> {
  return Boolean(
    await Friendship.findOne({
      $or: [
        { requester: a, recipient: b, status: 'accepted' },
        { requester: b, recipient: a, status: 'accepted' }
      ]
    })
  );
}

async function isBlocked(a: string, b: string): Promise<boolean> {
  return Boolean(
    await Friendship.findOne({
      $or: [
        { requester: a, recipient: b, status: 'blocked' },
        { requester: b, recipient: a, status: 'blocked' }
      ]
    })
  );
}

async function names(ids: string[]): Promise<Record<string, string>> {
  const profiles = await UserProfile.find({ userId: { $in: ids } })
    .select('userId nickname')
    .lean();
  return Object.fromEntries(profiles.map((p) => [p.userId, p.nickname || 'Learner']));
}

// GET / — groups I belong to, plus invitations waiting for my answer.
router.get('/', async (req: GroupRequest, res: Response) => {
  res.setHeader('Cache-Control', 'private, no-store');
  const userId = req.user!.userId;
  const groups = await StudyGroup.find({
    $or: [{ 'members.userId': userId }, { 'invites.userId': userId }]
  })
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean();
  res.json({
    groups: groups.map((g) => {
      const member = g.members.some((m) => m.userId === userId);
      return {
        groupId: g.groupId,
        name: g.name,
        subject: g.subject,
        memberCount: g.members.length,
        role: member ? (g.ownerId === userId ? 'owner' : 'member') : 'invited',
        // Invitees see only that they were invited, never who else is in the group.
        activeSession:
          member &&
          g.activeSession &&
          Date.now() - new Date(g.activeSession.startedAt).getTime() < SESSION_FRESH_MS
            ? { roomId: g.activeSession.roomId, title: g.activeSession.title }
            : null
      };
    })
  });
});

// POST / — create a group. The creator is the owner and first member.
router.post('/', async (req: GroupRequest, res: Response) => {
  const userId = req.user!.userId;
  const name = clean(req.body?.name, 60);
  const subject = clean(req.body?.subject, 60);
  if (name.length < 2)
    return res.status(400).json({ error: 'Give the group a name (at least 2 characters)' });
  if ((await StudyGroup.countDocuments({ ownerId: userId })) >= MAX_OWNED_GROUPS) {
    return res
      .status(429)
      .json({ error: 'You have reached the limit of study groups you can own' });
  }
  const group = await StudyGroup.create({
    groupId: crypto.randomUUID(),
    name,
    subject,
    ownerId: userId,
    members: [{ userId }]
  });
  res.status(201).json({ group: { groupId: group.groupId, name, subject } });
});

// GET /:groupId — members only.
router.get('/:groupId', async (req: GroupRequest, res: Response) => {
  res.setHeader('Cache-Control', 'private, no-store');
  const userId = req.user!.userId;
  if (!ID.test(req.params.groupId)) return res.status(400).json({ error: 'Invalid group' });
  const group = await StudyGroup.findOne({
    groupId: req.params.groupId,
    'members.userId': userId
  }).lean();
  if (!group) return res.status(404).json({ error: 'Group not found' });
  const labels = await names([
    ...group.members.map((m) => m.userId),
    ...group.invites.map((i) => i.userId)
  ]);
  const fresh =
    group.activeSession &&
    Date.now() - new Date(group.activeSession.startedAt).getTime() < SESSION_FRESH_MS;
  res.json({
    group: {
      groupId: group.groupId,
      name: group.name,
      subject: group.subject,
      role: group.ownerId === userId ? 'owner' : 'member',
      members: group.members.map((m) => ({
        userId: m.userId,
        name: labels[m.userId] || 'Learner',
        isOwner: m.userId === group.ownerId
      })),
      // Only the owner manages invitations.
      invites:
        group.ownerId === userId
          ? group.invites.map((i) => ({ userId: i.userId, name: labels[i.userId] || 'Learner' }))
          : [],
      activeSession: fresh
        ? { roomId: group.activeSession!.roomId, title: group.activeSession!.title }
        : null
    }
  });
});

// POST /:groupId/invite — owner invites an accepted connection.
router.post('/:groupId/invite', async (req: GroupRequest, res: Response) => {
  const userId = req.user!.userId;
  const friendId = req.body?.friendId;
  if (!ID.test(req.params.groupId) || typeof friendId !== 'string' || !ID.test(friendId)) {
    return res.status(400).json({ error: 'groupId and friendId required' });
  }
  const group = await StudyGroup.findOne({ groupId: req.params.groupId, ownerId: userId });
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (friendId === userId) return res.status(400).json({ error: 'You are already in this group' });
  if (!(await areConnected(userId, friendId)) || (await isBlocked(userId, friendId))) {
    return res.status(403).json({ error: 'You can only invite your connections' });
  }
  if (group.members.some((m) => m.userId === friendId))
    return res.json({ message: 'Already a member' });
  if (group.invites.some((i) => i.userId === friendId))
    return res.json({ message: 'Already invited' });
  if (group.invites.length >= MAX_GROUP_INVITES) {
    return res.status(429).json({ error: 'Too many pending invitations for this group' });
  }
  if (group.members.length + group.invites.length >= MAX_GROUP_MEMBERS) {
    return res.status(409).json({ error: 'This group is full' });
  }
  const updated = await StudyGroup.findOneAndUpdate(
    {
      groupId: group.groupId,
      'invites.userId': { $ne: friendId },
      'members.userId': { $ne: friendId }
    },
    { $push: { invites: { userId: friendId, invitedBy: userId, createdAt: new Date() } } },
    { new: true }
  );
  if (updated) {
    await notify(
      friendId,
      'Study group invitation',
      `You were invited to join the study group "${group.name}"`,
      { kind: 'study_group', groupId: group.groupId },
      req.headers.cookie
    );
  }
  res.json({ message: 'Invitation sent' });
});

// POST /:groupId/accept — idempotent; capacity is enforced inside the update.
router.post('/:groupId/accept', async (req: GroupRequest, res: Response) => {
  const userId = req.user!.userId;
  if (!ID.test(req.params.groupId)) return res.status(400).json({ error: 'Invalid group' });
  const already = await StudyGroup.exists({
    groupId: req.params.groupId,
    'members.userId': userId
  });
  if (already) return res.json({ message: 'Already a member' });
  const group = await StudyGroup.findOneAndUpdate(
    {
      groupId: req.params.groupId,
      'invites.userId': userId,
      $expr: { $lt: [{ $size: '$members' }, MAX_GROUP_MEMBERS] }
    },
    { $pull: { invites: { userId } }, $push: { members: { userId, joinedAt: new Date() } } },
    { new: true }
  );
  if (!group) return res.status(404).json({ error: 'Invitation not found or the group is full' });
  res.json({ message: 'Joined', groupId: group.groupId });
});

router.post('/:groupId/decline', async (req: GroupRequest, res: Response) => {
  if (!ID.test(req.params.groupId)) return res.status(400).json({ error: 'Invalid group' });
  await StudyGroup.updateOne(
    { groupId: req.params.groupId },
    { $pull: { invites: { userId: req.user!.userId } } }
  );
  res.json({ message: 'Declined' });
});

// DELETE /:groupId/members/:userId — the owner removes someone, or anyone leaves.
router.delete('/:groupId/members/:memberId', async (req: GroupRequest, res: Response) => {
  const userId = req.user!.userId;
  const { groupId, memberId } = req.params;
  if (!ID.test(groupId) || !ID.test(memberId))
    return res.status(400).json({ error: 'Invalid request' });
  const group = await StudyGroup.findOne({ groupId, 'members.userId': userId }).lean();
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (memberId === group.ownerId) {
    return res.status(409).json({ error: 'The owner cannot leave; delete the group instead' });
  }
  if (memberId !== userId && group.ownerId !== userId) {
    return res.status(403).json({ error: 'Only the owner can remove other members' });
  }
  await StudyGroup.updateOne(
    { groupId },
    { $pull: { members: { userId: memberId }, invites: { userId: memberId } } }
  );
  res.json({ message: memberId === userId ? 'Left group' : 'Member removed' });
});

router.delete('/:groupId', async (req: GroupRequest, res: Response) => {
  if (!ID.test(req.params.groupId)) return res.status(400).json({ error: 'Invalid group' });
  const result = await StudyGroup.deleteOne({
    groupId: req.params.groupId,
    ownerId: req.user!.userId
  });
  if (!result.deletedCount) return res.status(404).json({ error: 'Group not found' });
  res.json({ message: 'Group deleted' });
});

// POST /:groupId/session — record the group's study room and tell the other
// members. The room is read as the caller, so only a participant can attach
// it, and the invite code comes from the server. Course-bound rooms still
// enforce enrollment when members join.
router.post('/:groupId/session', async (req: GroupRequest, res: Response) => {
  const userId = req.user!.userId;
  const roomId = req.body?.roomId;
  if (
    !ID.test(req.params.groupId) ||
    typeof roomId !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(roomId)
  ) {
    return res.status(400).json({ error: 'groupId and roomId required' });
  }
  const group = await StudyGroup.findOne({
    groupId: req.params.groupId,
    'members.userId': userId
  }).lean();
  if (!group) return res.status(404).json({ error: 'Group not found' });
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
  await StudyGroup.updateOne(
    { groupId: group.groupId },
    {
      $set: {
        activeSession: {
          roomId: room.roomId,
          title: room.title,
          inviteCode: room.inviteCode,
          startedBy: userId,
          startedAt: new Date()
        }
      }
    }
  );
  const labels = await names([userId]);
  await Promise.all(
    group.members
      .filter((m) => m.userId !== userId)
      .map((m) =>
        notify(
          m.userId,
          'Study group session',
          `${labels[userId] || 'A member'} started a session for "${group.name}"`,
          {
            kind: 'study_room',
            inviteCode: room.inviteCode,
            roomTitle: room.title,
            groupId: group.groupId,
            fromUserId: userId
          },
          req.headers.cookie
        )
      )
  );
  res.json({ message: 'Session shared with the group' });
});

// GET /:groupId/session — members get the join code for the group's fresh session.
router.get('/:groupId/session', async (req: GroupRequest, res: Response) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!ID.test(req.params.groupId)) return res.status(400).json({ error: 'Invalid group' });
  const group = await StudyGroup.findOne({
    groupId: req.params.groupId,
    'members.userId': req.user!.userId
  }).lean();
  if (!group) return res.status(404).json({ error: 'Group not found' });
  const s = group.activeSession;
  if (!s || Date.now() - new Date(s.startedAt).getTime() >= SESSION_FRESH_MS)
    return res.json({ session: null });
  res.json({ session: { roomId: s.roomId, title: s.title, inviteCode: s.inviteCode } });
});

module.exports = router;
export default router;
