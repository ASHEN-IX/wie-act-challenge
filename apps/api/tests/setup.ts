import 'tsx/cjs';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.INTERNAL_API_SECRET = 'test-internal-secret';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://ednova:ednova@127.0.0.1:5433/ednova_test';
process.env.RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
delete process.env.REDIS_URL;
