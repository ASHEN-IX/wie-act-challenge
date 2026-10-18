import 'tsx/cjs';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.INTERNAL_API_SECRET = 'test-internal-secret';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27018/study_partner_test';
process.env.RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
delete process.env.REDIS_URL;
