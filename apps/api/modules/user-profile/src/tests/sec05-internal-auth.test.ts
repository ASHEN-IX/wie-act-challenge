import express from 'express';
import type { DomainRequest, DomainIdentity } from '../../../../src/framework/contracts';
import type { Response } from 'express';
import type { IncomingHttpHeaders } from 'node:http';

function requestFixture(input: {
  headers?: IncomingHttpHeaders;
  user?: Partial<DomainIdentity>;
}): DomainRequest {
  const req: DomainRequest = Object.create(express.request);
  req.headers = input.headers || {};
  if (input.user) req.user = { userId: 'fixture-user', role: 'student', ...input.user };
  return req;
}
import {
  requireInternal,
  buildInternalHeaders,
  isInternalRequest
} from '@ednova/shared/auth';

const ORIG_SECRET = process.env.INTERNAL_API_SECRET;

afterEach(() => {
  delete process.env.INTERNAL_API_SECRET;
});

afterAll(() => {
  if (ORIG_SECRET !== undefined) process.env.INTERNAL_API_SECRET = ORIG_SECRET;
});

describe('SEC-05 requireInternal middleware (single shared implementation)', () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnThis();
  const res: Response = Object.assign(Object.create(express.response), { status, json });
  const next = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    status.mockClear();
    json.mockClear();
    next.mockClear();
  });

  it('allows an authenticated admin JWT', () => {
    requireInternal(requestFixture({ user: { role: 'admin' } }), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows a user flagged isAdmin', () => {
    requireInternal(requestFixture({ user: { isAdmin: true } }), res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-admin user JWT', () => {
    requireInternal(requestFixture({ user: { role: 'student' }, headers: {} }), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows a matching x-internal-secret', () => {
    process.env.INTERNAL_API_SECRET = 's3cret';
    requireInternal(requestFixture({ headers: { 'x-internal-secret': 's3cret' } }), res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects a wrong x-internal-secret', () => {
    process.env.INTERNAL_API_SECRET = 's3cret';
    requireInternal(requestFixture({ headers: { 'x-internal-secret': 'nope' } }), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('fails closed when no secret is configured (non-admin request)', () => {
    delete process.env.INTERNAL_API_SECRET;
    requireInternal(requestFixture({ headers: { 'x-internal-secret': 'anything' } }), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('SEC-05 buildInternalHeaders + isInternalRequest', () => {
  it('sets the shared secret and optional propagated Authorization', () => {
    process.env.INTERNAL_API_SECRET = 's3cret';
    expect(buildInternalHeaders('ednova.test_session=x')).toEqual({
      Cookie: 'ednova.test_session=x',
      'x-internal-secret': 's3cret'
    });
    expect(buildInternalHeaders()).toEqual({ 'x-internal-secret': 's3cret' });
  });

  it('omits the secret header when none is configured', () => {
    delete process.env.INTERNAL_API_SECRET;
    expect(buildInternalHeaders('ednova.test_session=x')).toEqual({
      Cookie: 'ednova.test_session=x'
    });
  });

  it('isInternalRequest only matches a configured secret', () => {
    process.env.INTERNAL_API_SECRET = 's3cret';
    expect(isInternalRequest(requestFixture({ headers: { 'x-internal-secret': 's3cret' } }))).toBe(
      true
    );
    expect(isInternalRequest(requestFixture({ headers: {} }))).toBe(false);
    delete process.env.INTERNAL_API_SECRET;
    expect(isInternalRequest(requestFixture({ headers: { 'x-internal-secret': 's3cret' } }))).toBe(
      false
    );
  });
});

describe('SEC-05 static: single canonical implementation', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path');
  const root = path.resolve(__dirname, '../../../..');

  const repoFiles = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', 'dist', '.git', '.cache'].includes(entry.name)) continue;
        out.push(...repoFiles(p));
      } else if (/\.[jt]s$/.test(entry.name)) {
        out.push(p);
      }
    }
    return out;
  };

  it('defines requireInternal exactly once, inside shared/auth.js or shared/auth.ts', () => {
    const defs = repoFiles(root).filter((f) =>
      /function requireInternal\(/.test(fs.readFileSync(f, 'utf8'))
    );
    expect(defs).toHaveLength(1);
    expect(defs[0]).toMatch(/[\\/]shared[\\/]auth\.[jt]s$/);
  });

  it('never re-implements buildInternalHeaders in a service', () => {
    const defPattern = new RegExp('const build' + 'InternalHeaders = ');
    const defs = repoFiles(root).filter((f) => defPattern.test(fs.readFileSync(f, 'utf8')));
    expect(defs).toHaveLength(0);
  });
});
