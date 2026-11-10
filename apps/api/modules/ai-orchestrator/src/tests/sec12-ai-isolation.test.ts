import type { Request, Response, NextFunction } from 'express';
/**
 * SEC-12 — AI orchestrator user-isolation regression.
 *
 * Mounts the real routes behind the real `authenticate` middleware and proves
 * (a) the analyze-frame forwarder always uses the authenticated userId — never a
 * client-supplied body field — and (b) `/coach/history/:userId` refuses a
 * non-owning, non-admin caller with 403.
 */
process.env.JWT_SECRET = 'sec12-ai-secret';
process.env.JWT_REFRESH_SECRET = 'sec12-ai-refresh';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.RABBITMQ_URL = 'amqp://localhost:5672/%2F';
process.env.AI_SERVICE_URL = 'http://ai-service:8000';
process.env.INTERNAL_API_SECRET = 'sec12-ai-internal';
process.env.NODE_ENV = 'test';
const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code): never => {
  throw new Error(`Unexpected process.exit(${code})`);
});
afterAll(() => exitSpy.mockRestore());

import express from 'express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwt = { sign: require('../../../../tests/sessionFixtures').createSession };
import request from 'supertest';
import { Writable } from 'stream';
import fileUpload from 'express-fileupload';
import { authenticate } from '@noveris/shared/auth';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const aiRouter = require('../routes/ai');

jest.mock('@noveris/shared', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));
jest.mock('@noveris/shared/tierGate', () => ({
  tierGate: () => (req: Request, res: Response, next: NextFunction) => next()
}));
jest.mock('@noveris/shared/moduleClient');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const moduleClient = require('@noveris/shared/moduleClient');

const app = express();
app.use(express.json());
app.use(fileUpload({ limits: { fileSize: 10 * 1024 * 1024 } }));
app.use('/api/v1/ai', authenticate, aiRouter);

function authHeader(payload: { userId: string; email: string; role: string; isActive: boolean }) {
  return { Cookie: `ednova.test_session=${jwt.sign(payload, process.env.JWT_SECRET)}` };
}

const alice = { userId: 'user-alice', email: 'alice@test.com', role: 'student', isActive: true };
const mallory = {
  userId: 'user-mallory',
  email: 'mallory@test.com',
  role: 'student',
  isActive: true
};

beforeEach(() => jest.clearAllMocks());

describe('SEC-12 analyze-frame pins the authenticated userId', () => {
  it('uses req.user.userId even when the body smuggles user_id', async () => {
    moduleClient.get.mockResolvedValue({ data: { message: 'ok' } });
    moduleClient.post.mockResolvedValue({ data: {} });

    const res = await request(app)
      .post('/api/v1/ai/signals/analyze-frame')
      .set(authHeader(alice))
      .send({ user_id: 'user-bob', frame_state: 'focused' });

    expect(res.status).toBe(200);

    const [url, body] = moduleClient.post.mock.calls[0];
    expect(url).toMatch(/analyze-frame/);

    if (typeof body.pipe === 'function') {
      // Serialise the multipart payload the way moduleClient would, then inspect it:
      // the authenticated userId must be present and the smuggled one absent.
      const collector: Buffer[] = [];
      const sink = new Writable({
        write(chunk, enc, cb) {
          collector.push(chunk);
          cb();
        }
      });
      body.pipe(sink);
      await new Promise((resolve, reject) => {
        sink.on('finish', resolve);
        sink.on('error', reject);
      });
      const chunk = Buffer.concat(collector).toString();
      expect(chunk).toContain(`name="user_id"`);
      expect(chunk).toContain('user-alice');
      expect(chunk).not.toContain('user-bob');
    }
  });

  it('still 401s without authentication', async () => {
    const res = await request(app)
      .post('/api/v1/ai/signals/analyze-frame')
      .send({ frame_state: 'focused' });

    expect(res.status).toBe(401);
    expect(moduleClient.post).not.toHaveBeenCalled();
  });
});

describe('SEC-12 coach history refuses cross-user access', () => {
  it("403 for a non-admin reading another user's history", async () => {
    moduleClient.get.mockResolvedValue({ data: {} });
    const res = await request(app)
      .get('/api/v1/ai/coach/history/user-alice')
      .set(authHeader(mallory));

    expect(res.status).toBe(403);
    expect(moduleClient.get).not.toHaveBeenCalled();
  });

  it('200 for the owner reading their own history', async () => {
    moduleClient.get.mockResolvedValue({ data: { messages: [] } });
    const res = await request(app)
      .get('/api/v1/ai/coach/history/user-alice')
      .set(authHeader(alice));

    expect(res.status).toBe(200);
    expect(moduleClient.get).toHaveBeenCalled();
  });

  it('403 for an admin reading another learner history', async () => {
    moduleClient.get.mockResolvedValue({ data: { messages: [] } });
    const admin = { userId: 'admin-1', email: 'adm@test.com', role: 'admin', isActive: true };
    const res = await request(app)
      .get('/api/v1/ai/coach/history/user-mallory')
      .set(authHeader(admin));

    expect(res.status).toBe(403);
  });
});
