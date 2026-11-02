// eslint-disable-next-line @typescript-eslint/no-require-imports
const logger = require('./logger');

export function registerProcessHandlers(serviceName: string = 'ednova-service'): void {
  const tag = `[${serviceName}] `;

  process.on('uncaughtException', (err: Error) => {
    logger.error(`${tag}Uncaught Exception: ${err.message}`, {
      stack: err.stack,
      errorName: err.name
    });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    const errorDetails =
      reason instanceof Error
        ? { message: reason.message, stack: reason.stack, name: reason.name }
        : { reason: String(reason) };

    logger.error(`${tag}Unhandled Promise Rejection`, {
      ...errorDetails,
      promise: String(promise)
    });
  });

  process.on('warning', (warning: Error) => {
    logger.warn(`${tag}Process Warning: ${warning.name} - ${warning.message}`, {
      stack: warning.stack
    });
  });
}

module.exports = { registerProcessHandlers };
