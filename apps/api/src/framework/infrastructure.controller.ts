import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { DomainRequest } from './contracts';
import { SessionGuard } from './auth.guard';
@Controller('api/v1')
export class InfrastructureController {
  @Get('health')
  health(@Req() req: DomainRequest, @Res() res: Response): void {
    require('../../shared').healthCheck('ednova-api')(req, res);
  }
  @Get('docs/openapi.json')
  specification(): unknown {
    return require('../openapi');
  }
  @Get('docs')
  docs(@Res() res: Response): void {
    res
      .type('html')
      .send('<h1>Noveris API</h1><a href="/api/v1/docs/openapi.json">OpenAPI specification</a>');
  }
  @Get('monitoring/metrics')
  @UseGuards(SessionGuard)
  metrics(@Req() req: DomainRequest, @Res() res: Response): void {
    require('../../shared/auth').requireInternal(req, res, () =>
      res.json(require('./metrics').metricsSnapshot())
    );
  }
  @Get('monitoring/health')
  async monitoring(@Res() res: Response): Promise<void> {
    const connected = await require('../../shared/database').isConnectedToDatabase();
    const names = ['auth', 'users', 'study', 'ai', 'signals', 'analytics', 'notifications'];
    const services: Record<string, unknown> = Object.fromEntries(
      names.map((name) => [name, { status: connected ? 'healthy' : 'degraded', latency: 0 }])
    );
    let aiHealthy = false;
    try {
      await require('../../shared/aiClient').get('/health', { timeout: 2000 });
      aiHealthy = true;
    } catch {
      /* Independent AI availability. */
    }
    services['ai-service-python'] = { status: aiHealthy ? 'healthy' : 'unhealthy' };
    res.status(connected && aiHealthy ? 200 : 207).json({
      status: connected && aiHealthy ? 'healthy' : 'degraded',
      services,
      timestamp: new Date().toISOString()
    });
  }
  @Get('system/ai-status')
  async aiStatus(@Res() res: Response): Promise<void> {
    try {
      const aiClient = require('../../shared/aiClient');
      const report = await aiClient.getProviderStatus({ timeout: 3000 });
      res.status(200).json(report);
    } catch (error) {
      res.status(503).json({
        status: 'unavailable',
        execution_mode: 'UNAVAILABLE',
        error: error instanceof Error ? error.message : 'AI service unreachable',
        timestamp: new Date().toISOString()
      });
    }
  }
}
