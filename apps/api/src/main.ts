// eslint-disable-next-line @typescript-eslint/no-require-imports
require('tsx/cjs');
import path from 'path';
import dotenv from 'dotenv';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { productionApiInstance } from './framework/single-instance';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
process.env.DATABASE_URL ||=
  process.env.DOCKER_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ednova';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { connectDatabase, disconnectDatabase, logger, requireEnv } = require('@ednova/shared');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  closeAiMessaging,
  ensureTopologyForType,
  AI_JOB_TYPES
} = require('@ednova/shared/ai-messaging');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { registerProcessHandlers } = require('@ednova/shared/processHandlers');

export interface StartOptions {
  port?: number;
  workers?: boolean;
}

export interface StartedApplication {
  app: INestApplication;
  server: Server;
  stop: () => Promise<void>;
}

export async function start({
  port = Number(process.env.PORT || 3001),
  workers = true
}: StartOptions = {}): Promise<StartedApplication> {
  requireEnv(['DATABASE_URL', 'BETTER_AUTH_SECRET', 'INTERNAL_API_SECRET', 'RABBITMQ_URL'], {
    serviceName: 'ednova-api'
  });
  registerProcessHandlers('ednova-api');
  await connectDatabase();
  let stopLostInstance = () => {};
  const instanceLease = await productionApiInstance(() => stopLostInstance());
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  await require('../shared/betterAuth').getAuth();

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createNestApp } = require('./framework/bootstrap');
  const nest: INestApplication = await createNestApp();
  const server: Server = nest.getHttpServer();
  const cleanups: Array<() => unknown> = [];
  if (instanceLease) cleanups.push(() => instanceLease.close());

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { attachRealtime } = require('@ednova/notification-service');
  cleanups.push(attachRealtime(server));

  if (workers) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const study = require('@ednova/study-service');
    cleanups.push(study.startPoller());
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const initializeConsumers = async (): Promise<void> => {
      try {
        await Promise.all([
          study.startConsumers(),
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('@ednova/ai-orchestrator-service').startConsumers(),
          ...AI_JOB_TYPES.map((type: string) => ensureTopologyForType(type))
        ]);
      } catch (error: unknown) {
        const errMessage = error instanceof Error ? error.message : String(error);
        logger.warn('AI message bus unavailable; initialization will retry', {
          message: errMessage
        });
        if (!cancelled) {
          retryTimer = setTimeout(initializeConsumers, 5000);
          retryTimer.unref();
        }
      }
    };

    cleanups.push(() => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    });
    await initializeConsumers();
  }

  instanceLease?.assertActive();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => resolve());
  });

  const address = server.address();
  const boundPort = address && typeof address === 'object' ? address.port : port;
  logger.info(`EdNova API listening on port ${boundPort}`);

  let stopping: Promise<void> | null = null;
  const stop = (): Promise<void> => {
    if (stopping) return stopping;
    stopping = (async () => {
      const drained = new Promise((resolve) => server.close(resolve));
      for (const cleanup of cleanups.reverse()) {
        await Promise.resolve(cleanup()).catch((error: unknown) => {
          const errMessage = error instanceof Error ? error.message : String(error);
          logger.warn(errMessage);
        });
      }
      await closeAiMessaging().catch(() => {});
      await drained;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      await require('../shared/betterAuth').closeAuth();
      await nest.close();
      await disconnectDatabase();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      await require('@ednova/shared/cache').closeCache();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      await require('@ednova/shared/middleware').closeRateLimits();
    })();
    return stopping;
  };

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => stop().then(() => process.exit(0)));
  }

  stopLostInstance = () => {
    void stop();
  };
  instanceLease?.assertActive();
  return { app: nest, server, stop };
}

if (require.main === module) {
  start().catch((error: unknown) => {
    const errMessage = error instanceof Error ? error.message : String(error);
    logger.error('API startup failed', { message: errMessage });
    process.exit(1);
  });
}
