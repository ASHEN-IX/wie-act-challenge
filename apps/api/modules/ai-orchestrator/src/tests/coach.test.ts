import type { Request, Response, NextFunction } from 'express';
/**
 * Integration tests for the Coach route in AI Orchestrator service.
 *
 * Tests verify:
 * - Authentication enforcement
 * - Request forwarding to Python AI service
 * - Error handling
 * - Response structure
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test_study_partner';
process.env.RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672/%2F';
process.env.NODE_ENV = 'test';
process.env.AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const startupAiUrl = process.env.AI_SERVICE_URL;

// Prevent fail-fast app checks from terminating the Jest worker.
const exitSpy = jest.spyOn(process, 'exit').mockImplementation((code): never => {
  throw new Error(`Unexpected process.exit(${code})`);
});
afterAll(() => exitSpy.mockRestore());

import request from 'supertest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const moduleClient = require('@study-partner/shared/moduleClient');

jest.mock('@study-partner/shared/auth', () => ({
  authenticate: jest.fn((req, res, next) => {
    req.user = { userId: 'test-user-123' };
    next();
  })
}));

jest.mock('@study-partner/shared/tierGate', () => ({
  tierGate: jest.fn(() => (req: Request, res: Response, next: NextFunction) => next())
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const app = require('../app');

// Mock moduleClient to prevent actual HTTP calls
jest.mock('@study-partner/shared/moduleClient');

describe('POST /api/v1/ai/coach', () => {
  afterEach(() => {
    process.env.AI_SERVICE_URL = startupAiUrl;
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should forward request to Python AI service and return coach decision', async () => {
    // Mock Python service response
    const mockPythonResponse = {
      data: {
        coach_action: {
          action_type: 'silence',
          message: null,
          reasoning:
            'User is deeply focused (ML confidence: 0.92). Never interrupt productive flow state.'
        },
        schedule_update: null,
        timestamp: '2026-02-11T10:30:00'
      }
    };

    moduleClient.post.mockResolvedValue(mockPythonResponse);

    // Make request
    const response = await request(app).post('/api/v1/ai/coach').send({
      ignored_count: 0,
      do_not_disturb: false
    });

    expect([200, 201]).toContain(response.status);
    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('action_type');
    expect(response.body).toHaveProperty('reasoning');
    expect(response.body.action_type).toBe('silence');

    // Verify moduleClient was called correctly
    expect(moduleClient.post).toHaveBeenCalledTimes(1);
    expect(moduleClient.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/ai/coach/decision'),
      expect.objectContaining({
        user_id: 'test-user-123',
        ignored_count: 0,
        do_not_disturb: false
      }),
      expect.objectContaining({ timeout: 30000 })
    );
  });

  it('should handle do_not_disturb flag correctly', async () => {
    const mockPythonResponse = {
      data: {
        coach_action: {
          action_type: 'silence',
          message: null,
          reasoning: 'Do not disturb is enabled.'
        },
        schedule_update: null,
        timestamp: '2026-02-11T10:30:00'
      }
    };

    moduleClient.post.mockResolvedValue(mockPythonResponse);

    const response = await request(app)
      .post('/api/v1/ai/coach')
      .send({
        do_not_disturb: true
      })
      .expect(200);

    expect(response.body.action_type).toBe('silence');
    expect(response.body.reasoning).toContain('Do not disturb');

    // Verify correct parameters were forwarded
    expect(moduleClient.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        do_not_disturb: true
      }),
      expect.objectContaining({ timeout: 30000 })
    );
  });

  it('should handle ignored_count parameter correctly', async () => {
    const mockPythonResponse = {
      data: {
        coach_action: {
          action_type: 'silence',
          message: null,
          reasoning: 'Coach was ignored several times. Respecting user preference for autonomy.'
        },
        schedule_update: null,
        timestamp: '2026-02-11T10:30:00'
      }
    };

    moduleClient.post.mockResolvedValue(mockPythonResponse);

    const response = await request(app)
      .post('/api/v1/ai/coach')
      .send({
        ignored_count: 3
      })
      .expect(200);

    expect(response.body.action_type).toBe('silence');

    // Verify correct parameters were forwarded
    expect(moduleClient.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        ignored_count: 3
      }),
      expect.objectContaining({ timeout: 30000 })
    );
  });

  it('should return 503 when Python AI service is unreachable', async () => {
    // Mock network error
    moduleClient.post.mockRejectedValue({
      request: {},
      message: 'ECONNREFUSED'
    });

    const response = await request(app)
      .post('/api/v1/ai/coach')
      .send({
        ignored_count: 0
      })
      .expect(503);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('AI service unavailable');
  });

  it('should handle Python service errors gracefully', async () => {
    // Mock Python service error response
    moduleClient.post.mockRejectedValue({
      response: {
        status: 500,
        data: {
          detail: 'Database connection failed'
        }
      }
    });

    const response = await request(app)
      .post('/api/v1/ai/coach')
      .send({
        ignored_count: 0
      })
      .expect(502);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Upstream service error');
  });

  it('should reject invalid request with missing required fields', async () => {
    await request(app)
      .post('/api/v1/ai/coach')
      .send({
        invalid_field: 'test'
      })
      .expect(400); // Joi validation rejects unknown fields

    // Should not forward to Python
    expect(moduleClient.post).not.toHaveBeenCalled();
  });

  it('should reject invalid ignored_count (negative number)', async () => {
    const response = await request(app)
      .post('/api/v1/ai/coach')
      .send({
        ignored_count: -5
      })
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(moduleClient.post).not.toHaveBeenCalled();
  });

  it('should handle coach action with message', async () => {
    // Mock Python service response with a message
    const mockPythonResponse = {
      data: {
        coach_action: {
          action_type: 'suggest_break',
          message: 'You seem quite tired. How about taking a 10-minute break to recharge?',
          reasoning: 'High fatigue levels combined with lost focus indicate need for rest.'
        },
        schedule_update: null,
        timestamp: '2026-02-11T10:30:00'
      }
    };

    moduleClient.post.mockResolvedValue(mockPythonResponse);

    const response = await request(app)
      .post('/api/v1/ai/coach')
      .send({
        ignored_count: 0
      })
      .expect(200);

    expect(response.body.action_type).toBe('suggest_break');
    expect(response.body.coach_message).toContain('break');
    expect(response.body.reasoning).toContain('fatigue');
  });

  it('uses the AI endpoint resolved when the module starts', async () => {
    process.env.AI_SERVICE_URL = 'http://custom-ai-service:9000';

    const mockPythonResponse = {
      data: {
        coach_action: {
          action_type: 'silence',
          message: null,
          reasoning: 'User is focused'
        },
        schedule_update: null,
        timestamp: '2026-02-11T10:30:00'
      }
    };

    moduleClient.post.mockResolvedValue(mockPythonResponse);

    await request(app).post('/api/v1/ai/coach').send({}).expect(200);

    // Changing process.env after import does not change the resolved endpoint.
    expect(moduleClient.post).toHaveBeenCalledWith(
      `${startupAiUrl}/api/ai/coach/decision`,
      expect.any(Object),
      expect.objectContaining({ timeout: 30000 })
    );
  });

  it('retains the resolved endpoint if the environment variable is removed after startup', async () => {
    delete process.env.AI_SERVICE_URL;

    const mockPythonResponse = {
      data: {
        coach_action: {
          action_type: 'silence',
          message: null,
          reasoning: 'User is focused'
        },
        schedule_update: null,
        timestamp: '2026-02-11T10:30:00'
      }
    };

    moduleClient.post.mockResolvedValue(mockPythonResponse);

    await request(app).post('/api/v1/ai/coach').send({}).expect(200);

    expect(moduleClient.post).toHaveBeenCalledWith(
      `${startupAiUrl}/api/ai/coach/decision`,
      expect.any(Object),
      expect.objectContaining({ timeout: 30000 })
    );
  });
});

describe('GET /api/v1/ai/status', () => {
  it('should return AI service status', async () => {
    const response = await request(app).get('/api/v1/ai/status').expect(200);

    expect(response.body).toHaveProperty('agents');
    expect(response.body.agents).toHaveProperty('coach');
    expect(response.body.agents.coach).toBe('available');
  });
});
