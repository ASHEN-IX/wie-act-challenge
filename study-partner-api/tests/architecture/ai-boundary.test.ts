import http from 'http';
import client from '@study-partner/shared/aiClient';

let server: http.Server;
let requests: number;
let originalUrl: string | undefined;

beforeAll(async () => {
  originalUrl = process.env.AI_SERVICE_URL;
  server = http.createServer((req, res) => {
    requests++;
    if (req.url === '/slow')
      return setTimeout(() => {
        res.end('{}');
      }, 60);
    if (req.url === '/disconnected') return req.socket.destroy();
    if (req.url === '/error') res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        path: req.url,
        method: req.method,
        cookie: req.headers.cookie || null,
        authorization: req.headers.authorization || null,
        internal: req.headers['x-internal-secret'] || null
      })
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  process.env.AI_SERVICE_URL = `http://127.0.0.1:${port}`;
});

beforeEach(() => {
  requests = 0;
});

afterAll(async () => {
  if (originalUrl === undefined) delete process.env.AI_SERVICE_URL;
  else process.env.AI_SERVICE_URL = originalUrl;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test('uses the configured independent AI endpoint', async () => {
  await expect(
    client.post('/api/ai/coach/decision', { user_id: 'test-user' })
  ).resolves.toMatchObject({ data: { path: '/api/ai/coach/decision', method: 'POST' } });
});

test('rejects unrelated outbound origins', async () => {
  await expect(client.get('http://127.0.0.1:1/private')).rejects.toThrow('AI_SERVICE_URL');
  expect(requests).toBe(0);
});

test('bounds timeouts and does not retry AI mutations', async () => {
  await expect(client.post('/slow', {}, { timeout: 10 })).rejects.toMatchObject({
    code: 'ECONNABORTED'
  });
  expect(requests).toBe(1);
});

test('retries disconnected safe reads once', async () => {
  await expect(client.get('/disconnected')).rejects.toBeDefined();
  expect(requests).toBe(2);
});

test('propagates AI HTTP failures without replaying them', async () => {
  await expect(client.get('/error')).rejects.toMatchObject({ response: { status: 503 } });
  expect(requests).toBe(1);
});

test('never forwards browser session or internal application credentials to Python', async () => {
  const response = await client.get('/headers', {
    headers: {
      Cookie: 'private-session',
      Authorization: 'private-authorization',
      'X-Internal-Secret': 'private-internal-secret'
    }
  });
  expect(response.data).toMatchObject({ cookie: null, authorization: null, internal: null });
});
