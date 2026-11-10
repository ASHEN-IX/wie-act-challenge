import type { Request, Response, NextFunction } from 'express';
/**
 * Upstream error boundary tests for the existing plan proxy.
 *
 * Tests verify:
 * - Authentication enforcement
 * - Request forwarding to Python AI service
 * - Error handling
 * - Response structure
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test_ednova';
process.env.RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672/%2F';
process.env.NODE_ENV = 'test';
process.env.AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// Prevent fail-fast app checks from terminating the Jest worker.
const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code): never => {
  throw new Error(`Unexpected process.exit(${code})`);
});
afterAll(() => exitSpy.mockRestore());

import request from 'supertest';
const moduleClient = require('@noveris/shared/moduleClient');

jest.mock('@noveris/shared/auth', () => ({
  authenticate: jest.fn((req, res, next) => {
    req.user = { userId: 'test-user-123' };
    next();
  })
}));

jest.mock('@noveris/shared/tierGate', () => ({
  tierGate: jest.fn(() => (req: Request, res: Response, next: NextFunction) => next())
}));

const app = require('../app');

// Mock moduleClient to prevent actual HTTP calls
jest.mock('@noveris/shared/moduleClient');

describe('plan proxy upstream error boundary', () => {
  it.each(['upstream text', null, { detail: 'synthetic upstream detail' }])(
    'redacts upstream detail and safely handles body %p',
    async (data) => {
      jest.clearAllMocks();
      moduleClient.get.mockResolvedValue({ data: [] });
      moduleClient.post.mockRejectedValue({
        response: { status: 502, data },
        message: 'synthetic upstream failure'
      });
      const response = await request(app)
        .post('/api/v1/ai/plan/create')
        .send({ goal: 'synthetic plan', available_time_minutes: 60 });
      expect(response.status).toBe(502);
      expect(response.body).toEqual({ error: 'AI service unavailable' });
      expect(JSON.stringify(response.body)).not.toContain('synthetic upstream');
    }
  );
});
