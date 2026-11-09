// Isolated browser-test runtime. Never used by the application's production entrypoint.
process.env.NODE_ENV = 'test';
const database = process.env.AUTH_E2E_DB_NAME || `ednova_auth_browser_${process.pid}_${Date.now()}`;
if (!/^ednova_auth_browser_\d+_\d+$/.test(database))
  throw new Error('Browser runtime requires a generated isolated test database');
const webOrigin = `http://localhost:${Number(process.env.AUTH_E2E_WEB_PORT || 5173)}`;
// One database per run, created and migrated here. The pg adapter ignores
// `?schema=`, so a shared database would let suites see each other's rows; a
// dedicated database is the isolation that actually holds.
process.env.DATABASE_URL = `postgresql://ednova:ednova@127.0.0.1:5433/${database}`;
const { provision, deprovision } = require('./helpers/provision-test-database');
provision(database).catch(() => process.exit(1));
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void deprovision(database).finally(() => process.exit(0));
  });
process.env.BETTER_AUTH_SECRET = 'isolated-browser-test-secret-at-least-32-characters';
process.env.BETTER_AUTH_URL = webOrigin;
process.env.AUTH_TRUSTED_ORIGINS = webOrigin;
process.env.INTERNAL_API_SECRET = 'isolated-browser-test-internal-secret';
process.env.RABBITMQ_URL = 'amqp://localhost';
process.env.REDIS_URL = '';

require('../dist/main')
  .start({ port: Number(process.env.AUTH_E2E_API_PORT || 3001), workers: false })
  .catch(() => process.exit(1));
