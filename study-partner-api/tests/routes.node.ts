import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NotFoundException } from '@nestjs/common';
import { publicRoutePath } from '../src/framework/route-path';
import { ContractParameterPipe } from '../src/framework/parameter.pipe';
import type { DomainOperation, DomainRequest } from '../src/framework/contracts';

const path = '/api/v1/study/plans/:planId([0-9a-fA-F]{24})';
const operation: DomainOperation = { method: 'get', path, handlers: [] };
const pipe = new ContractParameterPipe(operation);

describe('Nest public routes retain domain parameter constraints', () => {
  it('normalizes the Nest path without changing the dispatch contract', () => {
    assert.equal(publicRoutePath(path), '/api/v1/study/plans/:planId');
    assert.equal(operation.path, path);
    assert.equal(publicRoutePath('/api/v1/study/plans/current'), '/api/v1/study/plans/current');
  });
  it('accepts valid object IDs', () => {
    const req = { params: { planId: '0123456789abcdefABCDEF01' } } as unknown as DomainRequest;
    assert.equal(pipe.transform(req), req);
  });
  for (const planId of ['current', 'not-an-id', '0123456789abcdefABCDEF0', 'z'.repeat(24)]) {
    it(`rejects invalid ID ${planId}`, () => {
      assert.throws(
        () => pipe.transform({ params: { planId } } as unknown as DomainRequest),
        NotFoundException
      );
    });
  }
});
