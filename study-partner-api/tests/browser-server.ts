// Isolated browser-test runtime. Never used by the application's production entrypoint.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27018/auth_browser_test';
process.env.BETTER_AUTH_SECRET = 'isolated-browser-test-secret-at-least-32-characters';
process.env.BETTER_AUTH_URL = 'http://localhost:5173';
process.env.AUTH_TRUSTED_ORIGINS = 'http://localhost:5173';
process.env.INTERNAL_API_SECRET = 'isolated-browser-test-internal-secret';
process.env.RABBITMQ_URL = 'amqp://localhost';
process.env.REDIS_URL = '';

require('../dist/main')
  .start({ port: 3001, workers: false })
  .catch(() => process.exit(1));
