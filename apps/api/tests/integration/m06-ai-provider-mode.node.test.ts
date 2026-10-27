import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { getProviderStatus, ProviderStatusReport } from '../../shared/aiClient';
import { InfrastructureController } from '../../src/framework/infrastructure.controller';

test('M06 / ED-03: AI Provider Execution Mode & Status Integration', async (t) => {
  let mockServer: http.Server;
  let mockPort: number;

  const syntheticReport: ProviderStatusReport = {
    status: 'ok',
    execution_mode: 'REAL_APPROVED',
    agents: {
      coach: { tier: 'compact', model: 'gemini/gemini-2.0-flash', available: true },
      course_ingestion: {
        tier: 'compact',
        model: 'groq/llama-3.1-8b-instant',
        available: true
      },
      planner: {
        tier: 'capable',
        model: 'nvidia_nim/deepseek-ai/deepseek-r1',
        available: true
      },
      evaluator: { tier: 'capable', model: 'gemini/gemini-2.0-flash', available: true },
      search: {
        tier: 'capable',
        model: 'openrouter/meta-llama/llama-3.3-70b-instruct',
        available: true
      },
      reflection: {
        tier: 'capable',
        model: 'nvidia_nim/meta/llama-3.3-70b-instruct',
        available: true
      }
    },
    timestamp: new Date().toISOString()
  };

  await t.test('aiClient.getProviderStatus parses provider report correctly', async () => {
    mockServer = http.createServer((req, res) => {
      if (req.url === '/provider/status' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(syntheticReport));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => {
      mockServer.listen(0, '127.0.0.1', () => {
        const address = mockServer.address() as AddressInfo;
        mockPort = address.port;
        resolve();
      });
    });

    const originalUrl = process.env.AI_SERVICE_URL;
    process.env.AI_SERVICE_URL = `http://127.0.0.1:${mockPort}`;

    try {
      const report = await getProviderStatus();
      assert.equal(report.status, 'ok');
      assert.equal(report.execution_mode, 'REAL_APPROVED');
      assert.equal(report.agents.coach.tier, 'compact');
      assert.equal(report.agents.planner.tier, 'capable');
      assert.equal(report.agents.evaluator.tier, 'capable');
      assert.equal(report.agents.coach.available, true);
    } finally {
      process.env.AI_SERVICE_URL = originalUrl;
      await new Promise<void>((resolve) => mockServer.close(() => resolve()));
    }
  });

  await t.test('InfrastructureController returns ai-status snapshot', async () => {
    mockServer = http.createServer((req, res) => {
      if (req.url === '/provider/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(syntheticReport));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => {
      mockServer.listen(0, '127.0.0.1', () => {
        const address = mockServer.address() as AddressInfo;
        mockPort = address.port;
        resolve();
      });
    });

    const originalUrl = process.env.AI_SERVICE_URL;
    process.env.AI_SERVICE_URL = `http://127.0.0.1:${mockPort}`;

    const controller = new InfrastructureController();
    let statusCode = 0;
    let responseBody: unknown = null;

    const fakeRes = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: unknown) {
        responseBody = body;
        return this;
      }
    };

    try {
      await controller.aiStatus(fakeRes as never);
      assert.equal(statusCode, 200);
      const parsed = responseBody as ProviderStatusReport;
      assert.equal(parsed.execution_mode, 'REAL_APPROVED');
      assert.equal(parsed.agents.coach.tier, 'compact');
      assert.equal(parsed.agents.planner.tier, 'capable');
    } finally {
      process.env.AI_SERVICE_URL = originalUrl;
      await new Promise<void>((resolve) => mockServer.close(() => resolve()));
    }
  });

  await t.test('InfrastructureController returns 503 when AI service is unavailable', async () => {
    const originalUrl = process.env.AI_SERVICE_URL;
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:59999'; // unreachable port

    const controller = new InfrastructureController();
    let statusCode = 0;
    let responseBody: unknown = null;

    const fakeRes = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: unknown) {
        responseBody = body;
        return this;
      }
    };

    try {
      await controller.aiStatus(fakeRes as never);
      assert.equal(statusCode, 503);
      const parsed = responseBody as { status: string; execution_mode: string };
      assert.equal(parsed.status, 'unavailable');
      assert.equal(parsed.execution_mode, 'UNAVAILABLE');
    } finally {
      process.env.AI_SERVICE_URL = originalUrl;
    }
  });
});
