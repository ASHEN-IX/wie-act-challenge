/**
 * SEC-12 — chat (notification service) authentication regression.
 *
 * Mounts the chat router behind the real `authenticate` middleware and proves
 * unauthenticated and expired tokens are rejected and that the delete-message
 * path honours the ownership check (403 for forbidden deletes).
 */
process.env.JWT_SECRET = 'sec12-chat-secret';
process.env.JWT_REFRESH_SECRET = 'sec12-chat-refresh';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.INTERNAL_API_SECRET = 'sec12-chat-internal';
process.env.RABBITMQ_URL = 'amqp://localhost:5672/%2F';
process.env.NODE_ENV = 'test';
const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code): never => {
  throw new Error(`Unexpected process.exit(${code})`);
});
afterAll(() => exitSpy.mockRestore());

import express from 'express';
import { createSession } from '../../../../tests/sessionFixtures';
import { verifySessionMembership } from '../utils/session-access';
const jwt = { sign: createSession };
jest.mock('../utils/session-access', () => ({ verifySessionMembership: jest.fn() }));
import request from 'supertest';
import { authenticate } from '@noveris/shared/auth';
import { errorHandler } from '@noveris/shared/middleware';

import chatRouter from '../routes/chat';

jest.mock('../services/chatService', () => ({
  processSearchQuery: jest.fn().mockResolvedValue({ answer: 'ok', message: undefined }),
  getHistory: jest.fn().mockResolvedValue([{ messageId: 'm-1', sender: 'user-alice', text: 'hi' }]),
  deleteMessage: jest.fn()
}));
jest.mock('@noveris/shared', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

const chatService = require('../services/chatService');

const app = express();
app.use(express.json());
app.use('/api/v1/session-chat', authenticate, chatRouter);
app.use(errorHandler);

const alice = { userId: 'user-alice', email: 'alice@test.com', role: 'student', isActive: true };

function authHeader(
  payload: Parameters<typeof createSession>[0] = alice,
  secret = process.env.JWT_SECRET
) {
  return { Cookie: `ednova.test_session=${jwt.sign(payload, secret)}` };
}

function expiredToken() {
  return jwt.sign({ ...alice, exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(verifySessionMembership).mockResolvedValue(true);
});

describe('SEC-12 chat endpoints require valid authentication', () => {
  it('401 without a token', async () => {
    const res = await request(app).get('/api/v1/session-chat/session-1/history');
    expect(res.status).toBe(401);
  });

  it('401 with a valid-looking but wrong-secret token', async () => {
    const res = await request(app)
      .get('/api/v1/session-chat/session-1/history')
      .set(authHeader(alice, 'sec12-wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('401 with an expired token', async () => {
    const res = await request(app)
      .get('/api/v1/session-chat/session-1/history')
      .set('Cookie', `ednova.test_session=${expiredToken()}`);
    expect(res.status).toBe(401);
  });

  it('403 when a message delete is forbidden (not the message owner)', async () => {
    chatService.deleteMessage.mockResolvedValueOnce({ deleted: false, reason: 'forbidden' });

    const res = await request(app)
      .delete('/api/v1/session-chat/session-1/message-id-9')
      .set(authHeader());

    expect(res.status).toBe(403);
    expect(chatService.deleteMessage).toHaveBeenCalledWith({
      sessionId: 'session-1',
      messageId: 'message-id-9',
      userId: 'user-alice'
    });
  });

  it('403 for an authenticated nonmember before history or deletion', async () => {
    jest.mocked(verifySessionMembership).mockResolvedValue(false);
    const history = await request(app)
      .get('/api/v1/session-chat/session-1/history')
      .set(authHeader());
    const deletion = await request(app)
      .delete('/api/v1/session-chat/session-1/message-id-9')
      .set(authHeader());
    expect(history.status).toBe(403);
    expect(deletion.status).toBe(403);
    expect(chatService.getHistory).not.toHaveBeenCalled();
    expect(chatService.deleteMessage).not.toHaveBeenCalled();
    expect(verifySessionMembership).toHaveBeenCalledWith(
      expect.stringContaining('ednova.test_session='),
      alice.userId,
      'session-1'
    );
  });

  it('200 for an authenticated valid-history read', async () => {
    const res = await request(app).get('/api/v1/session-chat/session-1/history').set(authHeader());

    expect(res.status).toBe(200);
    expect(chatService.getHistory).toHaveBeenCalledWith({
      sessionId: 'session-1',
      limit: 50,
      offset: 0
    });
  });
});
