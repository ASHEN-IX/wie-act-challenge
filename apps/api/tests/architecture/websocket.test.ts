import http from 'http';
import WebSocket from 'ws';
import { createSession as generateToken } from '../sessionFixtures';

jest.mock('@ednova/shared/moduleClient', () => ({
  put: jest.fn().mockResolvedValue({ data: {} })
}));

import client from '@ednova/shared/moduleClient';
import { attachRealtime } from '@ednova/notification-service';

let server: http.Server;
let closeRealtime: () => Promise<void>;
let base: string;

beforeAll(async () => {
  server = http.createServer((_req, res) => res.end('ok'));
  closeRealtime = attachRealtime(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  base = `ws://127.0.0.1:${port}/ws/notifications`;
});

afterAll(async () => {
  await closeRealtime();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test.each(['', '&token=invalid', `&token=${generateToken({ userId: 'other-user' })}`])(
  'rejects unauthorized WebSocket identity %s',
  async (suffix) => {
    const ws = new WebSocket(`${base}?userId=owner${suffix}`);
    const code = await new Promise((resolve, reject) => {
      ws.on('close', resolve);
      ws.on('error', reject);
    });
    expect(code).toBe(4401);
  }
);

test('accepts cookie-authenticated connections on the main listener and forwards identity', async () => {
  const token = generateToken({ userId: 'owner', email: 'owner@test.com', role: 'student' });
  const ws = new WebSocket(`${base}?userId=owner`, {
    headers: { Cookie: `ednova.test_session=${token}` }
  });
  await new Promise<void>((resolve, reject) => {
    ws.on('open', () => resolve());
    ws.on('error', reject);
  });
  // Session lookup is asynchronous; wait for identity before asserting the domain call.
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(client.put).toHaveBeenCalledWith(
    expect.stringContaining('module://users/'),
    expect.any(Object),
    expect.objectContaining({
      headers: expect.objectContaining({ Cookie: `ednova.test_session=${token}` })
    })
  );
  const closed = new Promise((resolve) => ws.once('close', resolve));
  ws.close();
  await closed;
});
