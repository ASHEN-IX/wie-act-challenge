export interface OperationObject {
  summary?: string;
  security?: Array<Record<string, string[]>>;
  servers?: Array<{ url: string }>;
  responses?: Record<string | number, { description: string }>;
  [key: string]: unknown;
}

export type PathItem = Record<string, OperationObject>;

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string }>;
  security: Array<Record<string, string[]>>;
  components: {
    securitySchemes: Record<string, unknown>;
  };
  paths: Record<string, PathItem>;
}

const spec: OpenAPISpec = {
  openapi: '3.0.3',
  info: {
    title: 'EdNova API',
    version: '1.0.0',
    description:
      'NestJS domain API protected by Better Auth cookie sessions. Authentication is hosted by Next.js.'
  },
  servers: [{ url: '/' }],
  security: [{ sessionCookie: [] }],
  components: {
    securitySchemes: {
      sessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: (process.env.BETTER_AUTH_URL || '').startsWith('https:')
          ? '__Secure-better-auth.session_token'
          : 'better-auth.session_token'
      }
    }
  },
  paths: {
    '/api/v1/health': { get: { summary: 'API readiness check', security: [] } },
    '/api/v1/auth/me': { get: { summary: 'Current domain account and subscription' } },
    '/api/v1/study/tasks': { get: { summary: 'List tasks' }, post: { summary: 'Create task' } },
    '/api/v1/ai/plan/create': { post: { summary: 'Create AI-powered study plan' } },
    '/api/v1/ai/coach': { post: { summary: 'Get coach decision' } },
    '/api/v1/coach/nudge': { post: { summary: 'Trigger async coach nudge (202 + jobId)' } },
    '/api/v1/coach/jobs/{jobId}': { get: { summary: 'Get coach nudge job status + result' } },
    '/api/v1/ai/evaluator/session': { post: { summary: 'Evaluate completed session' } },
    '/api/v1/analytics/summary': { get: { summary: 'Get analytics summary' } },
    '/api/v1/notifications': {
      get: { summary: 'List notifications' },
      post: { summary: 'Create notification' }
    }
  }
};

const authOrigin = process.env.BETTER_AUTH_URL || 'http://localhost:3000';
for (const [method, path, summary] of [
  ['post', 'sign-up/email', 'Register with Better Auth'],
  ['post', 'sign-in/email', 'Sign in with email/password'],
  ['post', 'sign-out', 'Invalidate current session'],
  ['get', 'get-session', 'Retrieve or renew current session'],
  ['get', 'verify-email', 'Verify email link'],
  ['post', 'email-otp/send-verification-otp', 'Send verification OTP'],
  ['post', 'email-otp/verify-email', 'Verify email OTP'],
  ['post', 'request-password-reset', 'Request password reset link'],
  ['post', 'reset-password', 'Reset password and invalidate sessions']
]) {
  spec.paths['/api/auth/' + path] = {
    [method]: { summary, security: [], servers: [{ url: authOrigin }] }
  };
}

for (const operations of Object.values(spec.paths)) {
  for (const operation of Object.values(operations)) {
    operation.responses = {
      200: { description: 'Successful request' },
      400: { description: 'Invalid request' },
      401: { description: 'Authentication required or invalid credentials' },
      403: { description: 'Permission denied' }
    };
  }
}

export default spec;
module.exports = spec;
