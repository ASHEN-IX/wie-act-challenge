/**
 * A configured but unreachable Redis must not turn every request — readiness
 * probes and API calls alike — into a 500. The limiter stays authoritative while
 * Redis answers and degrades to per-process counters when it does not.
 */
process.env.NODE_ENV = 'test';
process.env.REDIS_URL = 'redis://127.0.0.1:1';
process.env.INTERNAL_API_SECRET = 'test-internal-secret';
process.env.BETTER_AUTH_SECRET = 'x'.repeat(40);

import express from 'express';
import request from 'supertest';
import { rateLimiter } from '../../shared/middleware';

describe('rate limiter resilience', () => {
  it('serves requests when the configured Redis endpoint is unreachable', async () => {
    const app = express();
    app.use(rateLimiter(100, 60000));
    app.get('/ping', (_req, res) => {
      res.json({ ok: true });
    });

    const res = await request(app).get('/ping');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  }, 30000);

  it('still enforces the configured ceiling while degraded', async () => {
    // The suite runs with NODE_ENV=test, which deliberately inflates limits 100x,
    // so the ceiling is exercised under production semantics.
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const app = express();
      app.use(rateLimiter(2, 60000));
      app.get('/ping', (_req, res) => {
        res.json({ ok: true });
      });

      const statuses: number[] = [];
      for (let i = 0; i < 3; i += 1) {
        statuses.push((await request(app).get('/ping')).status);
      }
      expect(statuses.slice(0, 2)).toEqual([200, 200]);
      expect(statuses[2]).toBe(429);
    } finally {
      process.env.NODE_ENV = previous;
    }
  }, 30000);
});
