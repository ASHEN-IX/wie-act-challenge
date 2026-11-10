/** Batch 4 M4.2: provider contract, Gemini adapter and failure classification.
 *
 * The provider SDK is mocked here — no live call is made. What is under test is
 * the adapter's *classification*: which failures are provably pre-dispatch and
 * which may have been charged. Getting that wrong is how a system pays twice or
 * loses an audit trail.
 */
jest.mock('../../../../shared/aiClient', () => ({
  __esModule: true,
  default: { post: jest.fn() }
}));

import aiClient from '../../../../shared/aiClient';
import {
  GeminiExperiencePlannerProvider,
  MockExperiencePlannerProvider,
  DEFAULT_PLANNER_MODEL,
  configuredPlannerModel,
  realPlanningEnabled,
  resolvePlannerProvider
} from '../services/experiencePlannerProviders';
import {
  failureClass,
  NO_USAGE,
  type BoundedPlanningRequest
} from '../../../../shared/ednova/experiencePlannerProvider';
import { parseExperiencePlanProposal } from '../../../../shared/ednova/experiencePlan';

const post = aiClient.post as jest.MockedFunction<typeof aiClient.post>;

const request: BoundedPlanningRequest = {
  requestId: 'req-1',
  contextFingerprint: 'fnv1a64:0123456789abcdef',
  systemPolicy: 'policy',
  task: 'task',
  outputSchema: { type: 'object' },
  limits: { maxInputCharacters: 1000, maxOutputTokens: 512, timeoutMs: 5000 }
};

/** A minimal proposal the M4.1 parser accepts, so a "success" path is real. */
const validProposal = {
  schemaVersion: '1.0.0',
  planId: 'plan-1',
  claims: {
    courseId: 'a57d9f30-21c4-58ff-b48c-1e9e140f4c6d',
    revisionId: 'rev_1',
    contentHash: 'sha256:' + 'a'.repeat(64),
    lessonId: 'lesson-1',
    mode: 'read',
    registryVersion: '1.0.0',
    presentationSchemaVersion: '1.0.0',
    contextFingerprint: 'fnv1a64:0123456789abcdef'
  },
  planner: { implementation: 'gemini', version: '1.0.0' },
  placements: []
};

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.EDNOVA_ENABLE_GEMINI_EXPERIENCE_PLANNING;
  delete process.env.EDNOVA_ENABLE_MOCK_EXPERIENCE_PLANNING;
  delete process.env.EXPERIENCE_PLANNER_MODEL;
});

describe('provider configuration', () => {
  it('defaults to a current stable model, not the deprecated 2.5 flash', () => {
    expect(DEFAULT_PLANNER_MODEL).toBe('gemini/gemini-3.6-flash');
    expect(configuredPlannerModel()).toBe(DEFAULT_PLANNER_MODEL);
  });

  it('accepts an operator-configured model', () => {
    process.env.EXPERIENCE_PLANNER_MODEL = 'gemini/gemini-3.5-flash-lite';
    expect(configuredPlannerModel()).toBe('gemini/gemini-3.5-flash-lite');
  });

  it('ignores a malformed model override rather than dispatching to it', () => {
    process.env.EXPERIENCE_PLANNER_MODEL = 'not a model!!';
    expect(configuredPlannerModel()).toBe(DEFAULT_PLANNER_MODEL);
  });

  it('is disabled by default', () => {
    expect(realPlanningEnabled()).toBe(false);
  });

  it('resolves no provider when nothing is enabled', () => {
    expect(resolvePlannerProvider(async () => validProposal as never)).toBeNull();
  });

  it('prefers real Gemini only when explicitly enabled', () => {
    process.env.EDNOVA_ENABLE_GEMINI_EXPERIENCE_PLANNING = 'true';
    const provider = resolvePlannerProvider(async () => validProposal as never);
    expect(provider?.identity.provider).toBe('gemini');
  });
});

describe('Gemini adapter failure classification', () => {
  const provider = () => new GeminiExperiencePlannerProvider('gemini/gemini-3.6-flash', () => true);

  it('refuses to dispatch when disabled', async () => {
    const disabled = new GeminiExperiencePlannerProvider('gemini/gemini-3.6-flash', () => false);
    const outcome = await disabled.plan(request);
    expect(outcome).toMatchObject({ ok: false, code: 'PROVIDER_DISABLED', failure: 'known' });
    expect(post).not.toHaveBeenCalled();
  });

  it('parses a valid structured response into a proposal', async () => {
    post.mockResolvedValue({
      data: {
        refused: false,
        output: JSON.stringify(validProposal),
        usage: { totalTokens: 1234, inputTokens: 1000, outputTokens: 234, modelVersion: 'v1' }
      }
    } as never);
    const outcome = await provider().plan(request);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.proposal.planId).toBe('plan-1');
      expect(outcome.usage.totalTokens).toBe(1234);
      expect(outcome.usage.usageReported).toBe(true);
      expect(outcome.usage.costUsd).toBeNull();
      expect(outcome.identity.provider).toBe('gemini');
    }
  });

  it('classifies a typed pre-dispatch refusal as known', async () => {
    post.mockResolvedValue({
      data: { refused: true, code: 'PROVIDER_BUDGET_UNAVAILABLE' }
    } as never);
    const outcome = await provider().plan(request);
    expect(outcome).toMatchObject({
      ok: false,
      code: 'PROVIDER_BUDGET_UNAVAILABLE',
      failure: 'known'
    });
  });

  it('classifies a timeout as uncertain, because dispatch may have happened', async () => {
    post.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }));
    const outcome = await provider().plan(request);
    expect(outcome).toMatchObject({
      ok: false,
      code: 'PROVIDER_TIMEOUT_AFTER_DISPATCH',
      failure: 'uncertain'
    });
  });

  it('classifies a quota error as uncertain', async () => {
    post.mockRejectedValue({ response: { status: 429 } });
    const outcome = await provider().plan(request);
    expect(outcome).toMatchObject({ code: 'PROVIDER_QUOTA_EXCEEDED', failure: 'uncertain' });
  });

  it('classifies an auth rejection as uncertain', async () => {
    post.mockRejectedValue({ response: { status: 403 } });
    const outcome = await provider().plan(request);
    expect(outcome).toMatchObject({ code: 'PROVIDER_AUTH_REJECTED', failure: 'uncertain' });
  });

  it('classifies malformed JSON as uncertain and keeps the usage it saw', async () => {
    post.mockResolvedValue({
      data: { refused: false, output: '{"not":"a plan"', usage: { totalTokens: 99 } }
    } as never);
    const outcome = await provider().plan(request);
    expect(outcome).toMatchObject({ ok: false, code: 'PROVIDER_MALFORMED_JSON' });
    if (!outcome.ok) expect(outcome.usage?.totalTokens).toBe(99);
  });

  it('classifies schema-incompatible output as uncertain', async () => {
    post.mockResolvedValue({
      data: { refused: false, output: JSON.stringify({ hello: 'world' }), usage: {} }
    } as never);
    const outcome = await provider().plan(request);
    expect(outcome).toMatchObject({ code: 'PROVIDER_SCHEMA_INCOMPATIBLE', failure: 'uncertain' });
  });

  it('classifies empty output as uncertain', async () => {
    post.mockResolvedValue({ data: { refused: false, output: '', usage: {} } } as never);
    const outcome = await provider().plan(request);
    expect(outcome).toMatchObject({ code: 'PROVIDER_EMPTY_OUTPUT', failure: 'uncertain' });
  });

  it('never reports cost when the provider did not report usage', async () => {
    post.mockResolvedValue({
      data: { refused: false, output: JSON.stringify(validProposal), usage: {} }
    } as never);
    const outcome = await provider().plan(request);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.usage.usageReported).toBe(false);
      expect(outcome.usage.totalTokens).toBeNull();
      expect(outcome.usage.costUsd).toBeNull();
    }
  });

  it('never sends an Authorization header or browser cookie through the boundary', async () => {
    post.mockResolvedValue({
      data: { refused: false, output: JSON.stringify(validProposal), usage: {} }
    } as never);
    await provider().plan(request);
    const [, payload, config] = post.mock.calls[0];
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('authorization');
    expect(serialized).not.toContain('cookie');
    expect(config).not.toHaveProperty('headers');
  });
});

describe('mock adapter through the same contract', () => {
  it('is disabled unless the mock flag is set', async () => {
    const mock = new MockExperiencePlannerProvider(
      async () => validProposal as never,
      () => false
    );
    const outcome = await mock.plan(request);
    expect(outcome).toMatchObject({ code: 'PROVIDER_DISABLED', failure: 'known' });
  });

  it('reports no usage, which must not be read as zero cost', async () => {
    const mock = new MockExperiencePlannerProvider(
      async () => parseExperiencePlanProposal(validProposal),
      () => true
    );
    const outcome = await mock.plan(request);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.usage.usageReported).toBe(false);
      expect(outcome.usage.costUsd).toBeNull();
      expect(outcome.usage.totalTokens).toBeNull();
    }
  });
});

describe('failure classification table', () => {
  it('treats every pre-dispatch refusal as known', () => {
    for (const code of [
      'PROVIDER_DISABLED',
      'PROVIDER_CONSENT_MISSING',
      'PROVIDER_ELIGIBILITY_MISSING',
      'PROVIDER_BILLING_NOT_FREE_TIER',
      'PROVIDER_BUDGET_UNAVAILABLE',
      'PROVIDER_APPROVAL_MISSING',
      'PROVIDER_CREDENTIAL_MISMATCH',
      'PROVIDER_CANCELLED_BEFORE_DISPATCH'
    ] as const)
      expect(failureClass(code)).toBe('known');
  });

  it('treats every post-dispatch failure as uncertain', () => {
    for (const code of [
      'PROVIDER_TIMEOUT_AFTER_DISPATCH',
      'PROVIDER_QUOTA_EXCEEDED',
      'PROVIDER_AUTH_REJECTED',
      'PROVIDER_MALFORMED_JSON',
      'PROVIDER_EMPTY_OUTPUT',
      'PROVIDER_TRUNCATED_OUTPUT',
      'PROVIDER_CANCELLED_AFTER_DISPATCH'
    ] as const)
      expect(failureClass(code)).toBe('uncertain');
  });

  it('reports zero usage for a provable pre-dispatch refusal', () => {
    expect(NO_USAGE.reservedTokens).toBe(0);
    expect(NO_USAGE.usageReported).toBe(false);
    expect(NO_USAGE.costUsd).toBeNull();
  });
});
