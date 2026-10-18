import request from 'supertest';

process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh';
process.env.INTERNAL_API_SECRET = 'test-internal';
process.env.MONGODB_URI = 'mongodb://localhost/test';
process.env.RABBITMQ_URL = 'amqp://localhost';
process.env.NODE_ENV = 'test';

import { createApp } from '../../src/app';

const app = createApp();

describe('Single API module routes', () => {
  test.each([
    '/api/v1/users/profile',
    '/api/v1/study/sessions',
    '/api/v1/analytics/summary',
    '/api/v1/notifications',
    '/api/v1/ai/jobs',
    '/api/v1/signals/focus'
  ])('%s retains authentication', async (path) => {
    expect((await request(app).get(path)).status).toBe(401);
  });
  test('character routes stay removed', async () => {
    expect((await request(app).get('/api/v1/characters/base')).status).toBe(404);
  });
  test('OpenAPI endpoint stays public', async () => {
    expect((await request(app).get('/api/v1/docs/openapi.json')).body.openapi).toBe('3.0.3');
  });
});
