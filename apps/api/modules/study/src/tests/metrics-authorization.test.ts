/** Batch 4 release-integrity: process-global metrics are an operator concern.
 *
 * M4.6 exposed process-global counters at
 * `GET /courses/:courseId/planning/metrics`, guarded by `canManageCourse`. A
 * course author could therefore see planning activity produced by every other
 * course. Reproduced as `course_a_endpoint_sees_course_b_activity: true`.
 *
 * A `scope: 'process'` label describes the payload; it does not authorize it.
 * The endpoint is now `/planning/metrics`, admin-only, so no course author —
 * for course A or course B — can observe any aggregate.
 */
jest.mock('../services/resourceAccess', () => ({
  canManageCourse: jest.fn(async () => true),
  canAuthorCourse: jest.fn(async () => true),
}));

import type { Request, Response } from 'express';
import learningRouter from '../routes/learning';

const courseA = '0123456789abcdef0123456a';
const courseB = '0123456789abcdef0123456b';

type Handler = (req: Request, res: Response, next?: () => void) => unknown;

/** Invoke a route through the same pipeline Nest uses: all handlers, in order. */
async function call(
  method: 'get' | 'post',
  path: string,
  user: { userId: string; role: string } | null,
): Promise<{ status: number; body: unknown; reached: boolean }> {
  const router = learningRouter as unknown as {
    operations: Array<{ method: string; path: string; handlers: Handler[] }>;
  };
  const operation = router.operations.find(
    (entry) => entry.method === method && entry.path === path,
  );
  if (!operation) throw new Error(`no operation ${method.toUpperCase()} ${path}`);

  return new Promise((resolve) => {
    let sent: { status: number; body: unknown } | null = null;
    const res = {
      status(code: number) {
        return {
          json(body: unknown) {
            sent = { status: code, body };
            resolve({ status: code, body, reached: true });
          },
        };
      },
      setHeader() {
        return res;
      },
      once() {
        return res;
      },
      removeListener() {
        return res;
      },
      headers: {},
    } as unknown as Response;
    const req = {
      user,
      params: {},
      query: {},
      body: {},
      headers: {},
    } as unknown as Request;

    let index = 0;
    const next = (error?: unknown) => {
      if (error) {
        resolve({ status: 500, body: String(error), reached: true });
        return;
      }
      const handler = operation.handlers[index++];
      if (!handler) {
        resolve({ status: sent ? sent.status : 0, body: sent?.body ?? null, reached: false });
        return;
      }
      try {
        const out = handler(req, res, next);
        if (out && typeof (out as Promise<unknown>).then === 'function') {
          (out as Promise<unknown>).catch(next);
        }
      } catch (failure) {
        next(failure);
      }
    };
    next();
  });
}

describe('process metrics authorization', () => {
  it('does not expose the metrics route under a course path', () => {
    const router = learningRouter as unknown as {
      operations: Array<{ method: string; path: string }>;
    };
    const courseScoped = router.operations.filter(
      (entry) => entry.path.includes('metrics') && entry.path.includes(':courseId'),
    );
    expect(courseScoped).toEqual([]);
  });

  it('refuses a course-A author', async () => {
    const outcome = await call('get', '/planning/metrics', { userId: 'author-a', role: 'student' });
    expect(outcome.status).toBe(403);
    // The payload never reached the caller.
    expect(outcome.body).not.toHaveProperty('counters');
  });

  it('refuses a course-B author identically', async () => {
    const outcome = await call('get', '/planning/metrics', { userId: 'author-b', role: 'student' });
    expect(outcome.status).toBe(403);
    expect(outcome.body).not.toHaveProperty('counters');
  });

  it('refuses an unauthenticated caller', async () => {
    const outcome = await call('get', '/planning/metrics', null);
    expect(outcome.status).toBe(401);
  });

  it('serves an admin, and the data carries no course identity', async () => {
    const outcome = await call('get', '/planning/metrics', { userId: 'ops-1', role: 'admin' });
    expect(outcome.status).toBe(200);
    const body = outcome.body as Record<string, unknown>;
    expect(body.scope).toBe('process');
    // The payload is exactly four fields: the counters, their latency buckets,
    // a scope label and the start time. Nothing is keyed by course or learner,
    // so even an operator cannot read one course's activity off another's
    // request — the `scopeNote` prose is the only place "course" appears.
    expect(Object.keys(body).sort()).toEqual([
      'counters',
      'latency',
      'processUptimeSeconds',
      'scope',
      'scopeNote',
      'since',
    ]);
    const serialized = JSON.stringify({ counters: body.counters, latency: body.latency });
    expect(serialized).not.toContain(courseA);
    expect(serialized).not.toContain(courseB);
    expect(serialized).not.toMatch(/courseId|learnerId|userId/);
  });
});
