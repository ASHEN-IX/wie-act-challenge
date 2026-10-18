import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import express from 'express';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './exception.filter';
import { recordRequest } from './metrics';

export async function createNestApp() {
  const nest = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: ['error', 'warn']
  });
  nest.getHttpAdapter().getInstance().set('trust proxy', 1);
  const shared = require('../../shared');
  nest.use(
    shared.securityMiddleware(),
    shared.corsMiddleware(),
    shared.loggingMiddleware,
    recordRequest
  );
  nest.use((req: Request, res: Response, next: NextFunction) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const allowed = (
        process.env.AUTH_TRUSTED_ORIGINS ||
        process.env.APP_URL ||
        'http://localhost:5173'
      )
        .split(',')
        .map((value) => new URL(value.trim()).origin);
      if (
        (req.headers.origin && !allowed.includes(req.headers.origin)) ||
        (!req.headers.origin && req.headers['sec-fetch-site'] === 'cross-site')
      ) {
        res.status(403).json({ error: 'Untrusted request origin' });
        return;
      }
    }
    next();
  });
  // The payment signature is verified against exactly the original bytes.
  nest.use('/api/v1/auth/stripe/webhook', express.raw({ type: 'application/json' }));
  nest.use(
    express.json({ limit: '10mb' }),
    express.urlencoded({ extended: true, limit: '10mb' }),
    require('cookie-parser')()
  );
  nest.use(shared.rateLimiter());
  for (const directory of ['user-profile', 'study']) {
    nest.use(
      '/uploads',
      express.static(path.resolve(__dirname, '../../modules', directory, 'uploads'), {
        dotfiles: 'deny',
        index: false,
        setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff')
      })
    );
  }
  const uploadLimiter = shared.rateLimiter(5, 60000);
  nest.use((req: Request, res: Response, next: NextFunction) => {
    if (
      req.method === 'POST' &&
      (req.path === '/api/v1/study/subjects' ||
        /^\/api\/v1\/study\/courses\/[^/]+\/files$/.test(req.path))
    )
      return uploadLimiter(req, res, next);
    next();
  });
  nest.use((req: Request, res: Response, next: NextFunction) => {
    if (
      req.method === 'POST' &&
      (req.path === '/api/v1/study/courses' ||
        /^\/api\/v1\/study\/courses\/[^/]+\/files$/.test(req.path))
    )
      return shared.requireMultipart(req, res, next);
    next();
  });
  const aiLimiter = shared.rateLimiter(10, 60000);
  const expensive = [
    '/api/v1/ai/ingest',
    '/api/v1/ai/plan',
    '/api/v1/ai/coach',
    '/api/v1/ai/signals',
    '/api/v1/eval/step',
    '/api/v1/search/query',
    '/api/v1/ai/jobs',
    '/api/v1/coach/nudge'
  ];
  nest.use((req: Request, res: Response, next: NextFunction) => {
    if (expensive.some((prefix) => req.path === prefix || req.path.startsWith(prefix + '/')))
      return aiLimiter(req, res, next);
    next();
  });
  nest.use(
    '/api/v1/ai',
    require('../../modules/ai-orchestrator/node_modules/express-fileupload')({
      limits: { fileSize: 10 * 1024 * 1024 }
    })
  );
  nest.use('/api/v1/notifications/internal', shared.requireInternal);
  nest.useGlobalFilters(new ApiExceptionFilter());
  require('../../shared/moduleClient').registerDomainContracts(
    require('../domain-definitions').loadDefinitions()
  );
  await nest.init();
  return nest;
}
