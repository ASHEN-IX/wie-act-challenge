/**
 * Boot-time environment validation.
 *
 * Call as early as possible in each service's app.js so the process exits
 * immediately with a clear [FATAL] message when required configuration is
 * missing or insecure defaults are detected in production.
 *
 * Usage:
 *   const { requireEnv } = require('@ednova/shared');
 *   requireEnv(['BETTER_AUTH_SECRET', 'MONGODB_URI']);
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const logger = require('./logger');

const INSECURE_DEFAULTS: string[] = [
  'your-super-secret-jwt-key-change-in-production',
  'your-secret-key',
  'change-me',
  'change-this-refresh-secret',
  'replace_with_a_strong_secret'
];

export interface RequireEnvOptions {
  serviceName?: string;
  insecureDefaults?: string[];
}

export function requireEnv(
  keys: string[],
  { serviceName, insecureDefaults = INSECURE_DEFAULTS }: RequireEnvOptions = {}
): void {
  const tag = serviceName ? `[${serviceName}] ` : '';

  for (const key of keys) {
    if (!process.env[key]) {
      logger.error(`${tag}[FATAL] Missing required environment variable: ${key}`);
      process.exit(1);
    }
  }

  if (process.env.NODE_ENV === 'production') {
    for (const key of keys) {
      const val = process.env[key];
      if (val && insecureDefaults.includes(val)) {
        logger.error(
          `${tag}[FATAL] ${key} is set to an insecure default. Set a real secret before running in production.`
        );
        process.exit(1);
      }
    }
  }
}

module.exports = { requireEnv };
