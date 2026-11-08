import type { DomainRequest } from '../../../../src/framework/contracts';
import express from 'express';
import request from 'supertest';

process.env.JWT_SECRET = 'test-secret-key';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test_ednova';
process.env.NODE_ENV = 'test';

jest.mock('../models/StudyGroup', () => ({
  __esModule: true,
  MAX_GROUP_MEMBERS: 10,
  MAX_GROUP_INVITES: 10,
  MAX_OWNED_GROUPS: 10,
  default: {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
    exists: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn()
  }
}));
jest.mock('../models/Friendship', () => ({ __esModule: true, default: { findOne: jest.fn() } }));
jest.mock('../models/UserProfile', () => ({ __esModule: true, default: { find: jest.fn() } }));
jest.mock('@ednova/shared/moduleClient', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn().mockResolvedValue({}) }
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const StudyGroup = require('../models/StudyGroup').default;
const Friendship = require('../models/Friendship').default;
const UserProfile = require('../models/UserProfile').default;
const moduleClient = require('@ednova/shared/moduleClient').default;
const groupRoutes = require('../routes/groups');
/* eslint-enable @typescript-eslint/no-require-imports */

let me = 'alice';
const app = express();
app.use(express.json());
app.use(
  '/api/v1/users/groups',
  (req: DomainRequest, _res, next) => {
    req.user = { userId: me, role: 'student' };
    next();
  },
  groupRoutes
);
const lean = (value: unknown) => ({ lean: () => Promise.resolve(value) });
const sortLimitLean = (value: unknown) => ({ sort: () => ({ limit: () => lean(value) }) });
const selectLean = (value: unknown) => ({ select: () => lean(value) });

describe('study groups', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    me = 'alice';
    UserProfile.find.mockReturnValue(selectLean([]));
  });

  it('creates a group owned by the caller', async () => {
    StudyGroup.countDocuments.mockResolvedValue(0);
    StudyGroup.create.mockResolvedValue({ groupId: 'g1' });
    const res = await request(app)
      .post('/api/v1/users/groups')
      .send({ name: '  Calc   study ', subject: 'Math' });
    expect(res.status).toBe(201);
    const doc = StudyGroup.create.mock.calls[0][0];
    expect(doc.name).toBe('Calc study');
    expect(doc.ownerId).toBe('alice');
    expect(doc.members).toEqual([{ userId: 'alice' }]);
  });

  it('rejects a missing name and enforces the owned-group limit', async () => {
    expect((await request(app).post('/api/v1/users/groups').send({ name: 'x' })).status).toBe(400);
    StudyGroup.countDocuments.mockResolvedValue(10);
    expect((await request(app).post('/api/v1/users/groups').send({ name: 'Valid' })).status).toBe(
      429
    );
  });

  it('only the owner can invite, and only accepted connections', async () => {
    StudyGroup.findOne.mockResolvedValue(null);
    expect(
      (await request(app).post('/api/v1/users/groups/g1/invite').send({ friendId: 'bob' })).status
    ).toBe(404);

    StudyGroup.findOne.mockResolvedValue({
      groupId: 'g1',
      name: 'G',
      members: [{ userId: 'alice' }],
      invites: []
    });
    Friendship.findOne.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/v1/users/groups/g1/invite')
      .send({ friendId: 'stranger' });
    expect(res.status).toBe(403);
    expect(StudyGroup.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('invites a connection once and notifies them', async () => {
    StudyGroup.findOne.mockResolvedValue({
      groupId: 'g1',
      name: 'G',
      members: [{ userId: 'alice' }],
      invites: []
    });
    Friendship.findOne.mockResolvedValueOnce({ status: 'accepted' }).mockResolvedValueOnce(null);
    StudyGroup.findOneAndUpdate.mockResolvedValue({});
    const res = await request(app).post('/api/v1/users/groups/g1/invite').send({ friendId: 'bob' });
    expect(res.status).toBe(200);
    expect(moduleClient.post.mock.calls[0][1].userId).toBe('bob');
  });

  it('accept is idempotent for an existing member', async () => {
    me = 'bob';
    StudyGroup.exists.mockResolvedValue({ _id: 1 });
    const res = await request(app).post('/api/v1/users/groups/g1/accept');
    expect(res.status).toBe(200);
    expect(StudyGroup.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('accept fails without an invitation (or when the group is full)', async () => {
    me = 'mallory';
    StudyGroup.exists.mockResolvedValue(null);
    StudyGroup.findOneAndUpdate.mockResolvedValue(null);
    expect((await request(app).post('/api/v1/users/groups/g1/accept')).status).toBe(404);
    const filter = StudyGroup.findOneAndUpdate.mock.calls[0][0];
    expect(filter['invites.userId']).toBe('mallory');
    expect(JSON.stringify(filter.$expr)).toContain('$size');
  });

  it('non-members cannot read a group', async () => {
    me = 'mallory';
    StudyGroup.findOne.mockReturnValue(lean(null));
    expect((await request(app).get('/api/v1/users/groups/g1')).status).toBe(404);
    expect(JSON.stringify(StudyGroup.findOne.mock.calls[0][0])).toContain('mallory');
  });

  it('a member list shows invitees only that they were invited', async () => {
    me = 'bob';
    StudyGroup.find.mockReturnValue(
      sortLimitLean([
        {
          groupId: 'g1',
          name: 'G',
          subject: '',
          ownerId: 'alice',
          members: [{ userId: 'alice' }],
          invites: [{ userId: 'bob' }]
        }
      ])
    );
    const res = await request(app).get('/api/v1/users/groups');
    expect(res.body.groups[0].role).toBe('invited');
    expect(res.body.groups[0].activeSession).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain('"alice"');
  });

  it('members, not the owner, can leave; the owner cannot be removed', async () => {
    me = 'bob';
    StudyGroup.findOne.mockReturnValue(
      lean({ groupId: 'g1', ownerId: 'alice', members: [{ userId: 'bob' }] })
    );
    expect((await request(app).delete('/api/v1/users/groups/g1/members/bob')).status).toBe(200);
    expect((await request(app).delete('/api/v1/users/groups/g1/members/alice')).status).toBe(409);
    expect((await request(app).delete('/api/v1/users/groups/g1/members/carol')).status).toBe(403);
  });

  it('attaches a session only when the caller can read the room, and uses the server invite code', async () => {
    StudyGroup.findOne.mockReturnValue(
      lean({ groupId: 'g1', name: 'G', members: [{ userId: 'alice' }, { userId: 'bob' }] })
    );
    moduleClient.get.mockRejectedValueOnce(new Error('403'));
    expect(
      (await request(app).post('/api/v1/users/groups/g1/session').send({ roomId: 'room_1' })).status
    ).toBe(403);

    moduleClient.get.mockResolvedValueOnce({
      data: { room: { roomId: 'room_1', title: 'T', inviteCode: 'ABC123', status: 'active' } }
    });
    StudyGroup.updateOne.mockResolvedValue({});
    const res = await request(app)
      .post('/api/v1/users/groups/g1/session')
      .send({ roomId: 'room_1', inviteCode: 'HACK' });
    expect(res.status).toBe(200);
    expect(StudyGroup.updateOne.mock.calls[0][1].$set.activeSession.inviteCode).toBe('ABC123');
    expect(
      moduleClient.post.mock.calls.every(
        (c: unknown[]) => (c[1] as { userId: string }).userId === 'bob'
      )
    ).toBe(true);
  });
});
