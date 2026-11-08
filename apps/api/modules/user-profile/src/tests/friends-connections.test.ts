import type { DomainRequest } from '../../../../src/framework/contracts';
import express from 'express';
import request from 'supertest';

process.env.JWT_SECRET = 'test-secret-key';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test_ednova';
process.env.NODE_ENV = 'test';

jest.mock('../models/Friendship', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
    deleteMany: jest.fn(),
    findOneAndDelete: jest.fn()
  }
}));
jest.mock('../models/UserProfile', () => ({
  __esModule: true,
  default: { findOne: jest.fn(), find: jest.fn() }
}));
jest.mock('../models/Gamification', () => ({
  __esModule: true,
  default: { find: jest.fn(), findOne: jest.fn() }
}));
jest.mock('@ednova/shared/moduleClient', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn().mockResolvedValue({}) }
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const Friendship = require('../models/Friendship').default;
const UserProfile = require('../models/UserProfile').default;
const moduleClient = require('@ednova/shared/moduleClient').default;
const friendsRoutes = require('../routes/friends');
/* eslint-enable @typescript-eslint/no-require-imports */

let currentUser = 'alice';
const app = express();
app.use(express.json());
app.use(
  '/api/v1/users/friends',
  (req: DomainRequest, _res, next) => {
    req.user = { userId: currentUser, role: 'student' };
    next();
  },
  friendsRoutes
);

const accepted = { status: 'accepted' };
const selectLean = (value: unknown) => ({ select: () => ({ lean: () => Promise.resolve(value) }) });

describe('connections: invite to a study room', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = 'alice';
    UserProfile.findOne.mockReturnValue(selectLean({ nickname: 'Alice' }));
  });

  it('refuses to invite someone who is not an accepted connection', async () => {
    Friendship.findOne.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/v1/users/friends/invite-to-room')
      .send({ friendId: 'bob', roomId: 'r1' });
    expect(res.status).toBe(403);
    expect(moduleClient.post).not.toHaveBeenCalled();
  });

  it('refuses when the caller cannot read the room (not a participant)', async () => {
    Friendship.findOne.mockResolvedValue(accepted);
    moduleClient.get.mockRejectedValue(new Error('403'));
    currentUser = 'carol';
    const res = await request(app)
      .post('/api/v1/users/friends/invite-to-room')
      .send({ friendId: 'bob', roomId: 'r1' });
    expect(res.status).toBe(403);
    expect(moduleClient.post).not.toHaveBeenCalled();
  });

  it('notifies the friend using the server-side invite code, ignoring client input', async () => {
    currentUser = 'dave';
    Friendship.findOne.mockResolvedValue(accepted);
    moduleClient.get.mockResolvedValue({
      data: { room: { roomId: 'r1', title: 'Calc', inviteCode: 'ABC123', status: 'active' } }
    });
    const res = await request(app)
      .post('/api/v1/users/friends/invite-to-room')
      .send({ friendId: 'bob', roomId: 'r1', inviteCode: 'HACKED' });
    expect(res.status).toBe(200);
    const body = moduleClient.post.mock.calls[0][1];
    expect(body.userId).toBe('bob');
    expect(body.type).toBe('team_invite');
    expect(body.metadata.inviteCode).toBe('ABC123');
  });

  it('rate-limits invitations per sender', async () => {
    currentUser = 'erin';
    Friendship.findOne.mockResolvedValue(accepted);
    moduleClient.get.mockResolvedValue({
      data: { room: { roomId: 'r1', title: 'T', inviteCode: 'ZZZ999', status: 'active' } }
    });
    let last = 0;
    for (let i = 0; i < 11; i++) {
      last = (
        await request(app)
          .post('/api/v1/users/friends/invite-to-room')
          .send({ friendId: 'bob', roomId: 'r1' })
      ).status;
    }
    expect(last).toBe(429);
  });

  it('rejects malformed ids', async () => {
    const res = await request(app)
      .post('/api/v1/users/friends/invite-to-room')
      .send({ friendId: 'bob', roomId: '../x' });
    expect(res.status).toBe(400);
  });
});

describe('connections: requests, blocking, search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = 'alice';
  });

  it('caps unanswered outgoing requests', async () => {
    Friendship.countDocuments.mockResolvedValue(20);
    const res = await request(app).post('/api/v1/users/friends/request').send({ userId: 'bob' });
    expect(res.status).toBe(429);
    expect(Friendship.create).not.toHaveBeenCalled();
  });

  it('refuses a request to a user who blocked the sender', async () => {
    Friendship.countDocuments.mockResolvedValue(0);
    Friendship.findOne.mockResolvedValue({ status: 'blocked' });
    const res = await request(app).post('/api/v1/users/friends/request').send({ userId: 'bob' });
    expect(res.status).toBe(403);
  });

  it('blocking never deletes a block the other user placed', async () => {
    Friendship.deleteMany.mockResolvedValue({});
    Friendship.create.mockResolvedValue({});
    const res = await request(app).post('/api/v1/users/friends/block/bob');
    expect(res.status).toBe(200);
    const filter = Friendship.deleteMany.mock.calls[0][0];
    expect(JSON.stringify(filter)).toContain('"$ne":"blocked"');
  });

  it('does not search for very short or oversized queries', async () => {
    const short = await request(app).get('/api/v1/users/friends/search?q=ab');
    expect(short.body.results).toEqual([]);
    expect(UserProfile.find).not.toHaveBeenCalled();
  });

  it('excludes people who accept no requests from name search', async () => {
    Friendship.find.mockReturnValue({ lean: () => Promise.resolve([]) });
    UserProfile.find.mockReturnValue({ limit: () => ({ lean: () => Promise.resolve([]) }) });
    await request(app).get('/api/v1/users/friends/search?q=sam');
    expect(JSON.stringify(UserProfile.find.mock.calls[0][0])).toContain(
      '"allowRequests":{"$ne":"nobody"}'.replace('allowRequests', 'privacy.allowRequests')
    );
  });
});
