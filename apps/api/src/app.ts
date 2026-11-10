// eslint-disable-next-line @typescript-eslint/no-require-imports
require('tsx/cjs');
import express, { Request, Response, NextFunction, Application } from 'express';

const {
  healthCheck,
  requireMultipart,
  requireInternal,
  corsMiddleware,
  securityMiddleware,
  loggingMiddleware,
  errorHandler
} = require('@noveris/shared');
const { registerModule } = require('@noveris/shared/moduleClient');

export const moduleDefinitions: Array<[name: string, packageName: string, prefixes: string[]]> = [
  ['auth', '@noveris/auth-service', ['/api/v1/auth']],
  ['users', '@noveris/user-profile-service', ['/api/v1/users', '/uploads']],
  [
    'study',
    '@noveris/study-service',
    ['/api/v1/study', '/api/v1/competencies', '/api/v1/coach', '/uploads']
  ],
  ['ai', '@noveris/ai-orchestrator-service', ['/api/v1/ai', '/api/v1/eval', '/api/v1/search']],
  ['signals', '@noveris/signal-processing-service', ['/api/v1/signals']],
  ['analytics', '@noveris/analytics-service', ['/api/v1/analytics']],
  [
    'notifications',
    '@noveris/notification-service',
    ['/api/v1/notifications', '/api/v1/session-chat', '/api/v1/voice']
  ]
];

export function createApp(): Application {
  const app = express();
  app.set('trust proxy', 1);
  app.use(securityMiddleware());
  app.use(corsMiddleware());
  app.use(loggingMiddleware);
  const metrics = { requests: 0, errors: 0, started: Date.now() };
  app.use((req: Request, res: Response, next: NextFunction) => {
    metrics.requests++;
    res.on('finish', () => {
      if (res.statusCode >= 500) metrics.errors++;
    });
    next();
  });
  app.get('/api/v1/monitoring/metrics', requireInternal, (_req: Request, res: Response) =>
    res.json({
      uptime_seconds: Math.floor((Date.now() - metrics.started) / 1000),
      total_requests: metrics.requests,
      total_errors: metrics.errors,
      error_rate: metrics.requests
        ? `${((metrics.errors / metrics.requests) * 100).toFixed(2)}%`
        : '0%',
      timestamp: new Date().toISOString()
    })
  );
  app.get('/api/v1/monitoring/health', async (_req: Request, res: Response) => {
    const connected = await require('@noveris/shared/database').isConnectedToDatabase();
    const services = Object.fromEntries(
      moduleDefinitions.map(([name]) => [
        name,
        { status: connected ? 'healthy' : 'degraded', latency: 0 }
      ])
    );
    let aiHealthy = false;
    try {
      await require('@noveris/shared/aiClient').get('/health', { timeout: 2000 });
      aiHealthy = true;
    } catch {
      /* AI availability does not prevent non-AI workflows. */
    }
    services['ai-service-python'] = { status: aiHealthy ? 'healthy' : 'unhealthy', latency: 0 };
    res.status(connected && aiHealthy ? 200 : 207).json({
      status: connected && aiHealthy ? 'healthy' : 'degraded',
      services,
      timestamp: new Date().toISOString()
    });
  });
  app.get('/api/v1/health', healthCheck('ednova-api'));
  app.get('/api/v1/docs/openapi.json', (_req: Request, res: Response) =>
    res.json(require('./openapi'))
  );
  app.get('/api/v1/docs', (_req: Request, res: Response) =>
    res
      .type('html')
      .send('<h1>Noveris API</h1><a href="/api/v1/docs/openapi.json">OpenAPI specification</a>')
  );
  app.post('/api/v1/study/courses', requireMultipart);
  app.post('/api/v1/study/courses/:courseId/files', requireMultipart);
  app.use('/api/v1/notifications/internal', requireInternal);
  // Register all interfaces before any request or background job can call them.
  for (const [name, packageName, prefixes] of moduleDefinitions) {
    const { app: moduleApp } = require(packageName);
    registerModule(name, moduleApp);
    app.use((req: Request, res: Response, next: NextFunction) => {
      const belongs = prefixes.some(
        (prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`)
      );
      return belongs ? moduleApp(req, res, next) : next();
    });
  }
  app.use((_req: Request, res: Response) => res.status(404).json({ error: 'Not found' }));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp, moduleDefinitions };
