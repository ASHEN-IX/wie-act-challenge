import fs from 'node:fs';
import path from 'node:path';
import {
  contracts,
  parseContract,
  validateActivityContext,
  validateSubmission,
  parseRecipient,
  compareAttempt,
  validateProposal,
  type ContractName
} from '../../shared/ednova/contracts';
import {
  validateAiJobEnvelope,
  validateAiResultEnvelope
} from '../../shared/ai-messaging/envelope';
import { validateJobPayload } from '../../shared/ai-messaging/payloadSchemas';
interface Fixture {
  name: string;
  contract: ContractName;
  payload: unknown;
  valid: boolean;
  operation?: string;
  previous?: unknown;
  expected?: string;
  context?: unknown;
  definition?: unknown;
  recipient?: string;
}
const fixtures: Fixture[] = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../../docs/contracts/ednova-v1-fixtures.json'),
    'utf8'
  )
).fixtures;
function check(f: Fixture) {
  switch (f.operation) {
    case 'compare':
      expect(compareAttempt(f.previous, f.payload)).toBe(f.expected);
      break;
    case 'activityContext':
      validateActivityContext(f.payload, f.context);
      break;
    case 'submission':
      validateSubmission(f.payload, f.definition);
      break;
    case 'proposal':
      validateProposal(f.payload, f.context);
      break;
    case 'recipient':
      parseRecipient(f.contract as 'AssessmentResult', f.payload, f.recipient!);
      break;
    default:
      return parseContract(f.contract, f.payload);
  }
}
describe('ED-26 canonical shared fixtures', () => {
  test.each(fixtures.map((f) => [f.name, f] as const))('%s', (_name, f) => {
    if (f.valid) {
      check(f);
      const parsed = parseContract(f.contract, f.payload);
      expect(parseContract(f.contract, JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
    } else expect(() => check(f)).toThrow('Unsupported or invalid contract');
  });
  test('H-2 keeps revisionId as a course-scoped revision tag', () => {
    const context = fixtures.find((f) => f.name === 'authorized published context')!
      .payload as Record<string, unknown>;
    const activity = fixtures.find((f) => f.name === 'interactive quiz')!.payload as Record<
      string,
      unknown
    >;
    expect(context.revisionId).toBe('rev_synthetic_1');
    expect(() =>
      validateActivityContext({ ...activity, revisionId: 'rev_other' }, context)
    ).toThrow('Unsupported or invalid contract');
    expect(() =>
      parseContract(
        'SourceResolution',
        fixtures.find((f) => f.name === 'resolution internal persistence id rejected')!.payload
      )
    ).toThrow('Unsupported or invalid contract');
  });
  test('T-1 does not make a global attemptId the receipt identity', () => {
    const submission = fixtures.find((f) => f.name === 'private submission')!.payload;
    const attempt = (userId: string) => ({
      schemaVersion: '1.0.0',
      visibility: 'recipient_only',
      userId,
      submission,
      status: 'submitted',
      submittedAt: '2026-10-23T12:00:00.000Z',
      payloadHash: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    });
    expect(parseRecipient('PrivateAttempt', attempt('learner_a'), 'learner_a')).toBeTruthy();
    expect(parseContract('PrivateAttempt', attempt('learner_b'))).toBeTruthy();
    expect(() => parseRecipient('PrivateAttempt', attempt('learner_b'), 'learner_a')).toThrow(
      'Unsupported or invalid contract'
    );
  });
  test('T-3 accepts max-bounded private guidance and rejects overflow', () => {
    const graded = fixtures.find((f) => f.name === 'private graded result')!.payload as Record<
      string,
      unknown
    >;
    const bounded = {
      ...graded,
      socraticHint: 'a'.repeat(8000),
      recommendedNextStep: {
        type: 'advance',
        nextObjectiveId: 'obj_next',
        title: 't'.repeat(200)
      }
    };
    expect(parseContract('AssessmentResult', bounded)).toBeTruthy();
    expect(() =>
      parseContract('AssessmentResult', { ...bounded, socraticHint: 'a'.repeat(8001) })
    ).toThrow('Unsupported or invalid contract');
  });
  test('timestamps require ascii digits', () => {
    const context = fixtures.find((f) => f.name === 'authorized published context')!
      .payload as Record<string, unknown>;
    expect(() =>
      parseContract('PublishedContext', {
        ...context,
        publishedAt: '٢٠٢٦-10-23T12:00:00.000Z'
      })
    ).toThrow('Unsupported or invalid contract');
  });
  test('all shared definitions have golden examples', () => {
    expect(new Set(fixtures.filter((f) => f.valid).map((f) => f.contract))).toEqual(
      new Set(Object.keys(contracts))
    );
  });
  test('existing worker envelope/payload parsing remains compatible, with no new job type', () => {
    const base = {
      messageId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      correlationId: '0f8e2d1a-3b4c-4d6e-8f80-91a2b3c4d5e6',
      type: 'study.search.query' as const,
      version: '1',
      requestId: 'synthetic_request',
      timestamp: '2026-10-23T12:00:00.000Z'
    };
    expect(
      validateAiJobEnvelope({
        ...base,
        userId: 'learner_synthetic',
        payload: { query: 'Synthetic query' }
      }).valid
    ).toBe(true);
    expect(validateJobPayload(base.type, { query: 'Synthetic query' }).valid).toBe(true);
    expect(
      validateAiResultEnvelope({
        ...base,
        status: 'completed',
        payload: { answer: 'Synthetic response' }
      }).valid
    ).toBe(true);
    expect(
      validateAiJobEnvelope({
        ...base,
        type: 'activity.accept.evidence',
        userId: 'learner_synthetic',
        payload: {}
      }).valid
    ).toBe(false);
  });
  test('non JSON values and nonfinite/oversized values fail safely', () => {
    const activity = fixtures.find((f) => f.name === 'interactive quiz')!.payload as Record<
      string,
      unknown
    >;
    for (const timeLimitSeconds of [NaN, Infinity, -1, 1.5])
      expect(() =>
        parseContract('ActivityDefinition', { ...activity, timeLimitSeconds })
      ).toThrow();
    expect(() =>
      parseContract('ActivityDefinition', { ...activity, instructions: '😀'.repeat(4001) })
    ).toThrow();
    expect(() => parseContract('ActivityDefinition', new Date())).toThrow();
    const context = fixtures.find((f) => f.name === 'authorized published context')!
      .payload as object;
    expect(() =>
      parseContract('PublishedContext', { ...context, publishedAt: '0000-01-01T00:00:00.000Z' })
    ).toThrow();
  });
});

import express from 'express';
import request from 'supertest';
import { createContracts } from '../../shared/domainContracts';
import { readAttemptSubmission } from '../../shared/ednova/boundary';

describe('existing domain handler adapter contract consumption', () => {
  // Only an in-memory test route; no production endpoint/service is registered.
  const router = createContracts();
  router.post('/fixture', (req, res) => res.json(readAttemptSubmission(req)));
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, { user: { userId: 'learner_synthetic', role: 'student' } });
    next();
  });
  app.use(router);
  app.use(
    (
      _error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      res.status(422).json({ code: 'INVALID_CONTRACT' });
    }
  );
  const submission = parseContract(
    'AttemptSubmission',
    fixtures.find((f) => f.name === 'private submission')!.payload
  );
  test('preserves typed serialized submission and derives actor from the handler context', async () => {
    const response = await request(app).post('/fixture').send(submission);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ userId: 'learner_synthetic', submission });
  });
  test('rejects forged authoritative fields before the handler accepts a submission', async () => {
    const response = await request(app)
      .post('/fixture')
      .send({ ...(submission as object), userId: 'other', acceptedEvidence: true });
    expect(response.status).toBe(422);
    expect(response.body).toEqual({ code: 'INVALID_CONTRACT' });
  });
});
