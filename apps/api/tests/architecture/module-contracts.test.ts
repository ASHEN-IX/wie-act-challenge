import type { DomainRequest } from '../../src/framework/contracts';
import express from 'express';
import { authenticate } from '@noveris/shared/auth';
import { createSession as generateToken } from '../sessionFixtures';
import client from '@noveris/shared/moduleClient';
import { requireInternal } from '@noveris/shared';

const app = express();
app.use(express.json());
app.post('/rewards', authenticate, (req: DomainRequest, res) => {
  if (!Number.isInteger(req.body.xp) || req.body.xp < 0)
    return res.status(400).json({ error: 'Invalid XP' });
  res.status(201).json({ userId: req.user!.userId, xp: req.body.xp, query: req.query.source });
});
app.post('/broadcast', requireInternal, (_req, res) => res.json({ delivered: true }));
client.registerModule('contract-test', app);

describe('In-process contracts preserve route boundaries without listening', () => {
  test('rejects unauthenticated delegated calls', async () => {
    await expect(client.post('module://contract-test/rewards', { xp: 10 })).rejects.toMatchObject({
      response: { status: 401 }
    });
  });
  test('forwards identity, body and query through authentication and validation', async () => {
    const headers = {
      Cookie: `ednova.test_session=${generateToken({ userId: 'reward-owner', email: 'owner@test.com', role: 'student' })}`
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
