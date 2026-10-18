import express from 'express';
import { authenticate } from '@study-partner/shared/auth';
import { createSession as generateToken } from '../sessionFixtures';
import client from '@study-partner/shared/moduleClient';
import { requireInternal } from '@study-partner/shared';

const app = express();
app.use(express.json());
app.post('/rewards', authenticate as any, (req: any, res: any) => {
  if (!Number.isInteger(req.body.xp) || req.body.xp < 0)
    return res.status(400).json({ error: 'Invalid XP' });
  res.status(201).json({ userId: req.user.userId, xp: req.body.xp, query: req.query.source });
});
app.post('/broadcast', requireInternal as any, (_req: any, res: any) =>
  res.json({ delivered: true })
);
client.registerModule('contract-test', app);

describe('In-process contracts preserve route boundaries without listening', () => {
  test('rejects unauthenticated delegated calls', async () => {
    await expect(client.post('module://contract-test/rewards', { xp: 10 })).rejects.toMatchObject({
      response: { status: 401 }
    });
  });
  test('forwards identity, body and query through authentication and validation', async () => {
    const headers = {
      Cookie: `mindflow.test_session=${generateToken({ userId: 'reward-owner', email: 'owner@test.com', role: 'student' })}`
    };
    await expect(
      client.post(
        'module://contract-test/rewards',
        { xp: 10 },
        { headers, params: { source: 'session' } }
      )
    ).resolves.toMatchObject({
      status: 201,
      data: { userId: 'reward-owner', xp: 10, query: 'session' }
    });
    await expect(
      client.post('module://contract-test/rewards', { xp: -1 }, { headers })
    ).rejects.toMatchObject({ response: { status: 400 } });
  });
  test('checks the internal secret on delegated operations', async () => {
    await expect(client.post('module://contract-test/broadcast', {})).rejects.toMatchObject({
      response: { status: 403 }
    });
    await expect(
      client.post(
        'module://contract-test/broadcast',
        {},
        { headers: { 'x-internal-secret': process.env.INTERNAL_API_SECRET } }
      )
    ).resolves.toMatchObject({ data: { delivered: true } });
  });
  test('unknown contracts return 404 instead of falling back to network', async () => {
    await expect(client.get('module://contract-test/unknown')).rejects.toMatchObject({
      response: { status: 404 }
    });
  });
});
