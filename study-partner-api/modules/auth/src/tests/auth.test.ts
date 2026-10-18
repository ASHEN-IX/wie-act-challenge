import request from 'supertest';
import app from '../app';

test.each([
  'register',
  'login',
  'refresh',
  'logout',
  'verify-email',
  'verify-otp',
  'forgot-password',
  'reset-password'
])('legacy custom authentication endpoint %s is retired', async (path) => {
  expect(
    (
      await request(app)
        .post('/api/v1/auth/' + path)
        .send({})
    ).status
  ).toBe(404);
});
