/** Concrete experience-planner providers (Batch 4, Milestone 4.2).
 *
 * Two adapters, one contract:
 *
 *   MockProvider    the deterministic M4.1 planner, for QA and tests
 *   GeminiProvider  dispatches through the existing Python AI boundary
 *
 * The Gemini adapter does NOT import a Gemini SDK. The Python service already
 * owns the SDK, the approval and durable-budget machinery, and the provider
 * eligibility records; duplicating any of that in Node would be a second,
 * diverging implementation of a security control. Node sends a bounded request
 * over the authenticated internal boundary and receives untrusted JSON back.
 *
 * Neither adapter authorizes, decides review status, or validates. That is the
 * application's job and it happens after these return.
 */

import type {
  BoundedPlanningRequest,
  ExperiencePlannerProvider,
  ProviderFailureCode,
  ProviderIdentity,
  ProviderOutcome,
  ProviderUsage
} from '../../../../shared/ednova/experiencePlannerProvider';
import { failureClass, NO_USAGE } from '../../../../shared/ednova/experiencePlannerProvider';
import type { UntrustedExperiencePlanProposal } from '../../../../shared/ednova/experiencePlan';
import { parseExperiencePlanProposal } from '../../../../shared/ednova/experiencePlan';
import aiClient from '../../../../shared/aiClient';

/** Gemini models the planner may use. Configurable, never hardcoded at call
 * sites, and never silently upgraded. `gemini-2.5-flash` is deprecated by the
 * provider (rerouting from 2026-12-01), so it is not the default. */
export const DEFAULT_PLANNER_MODEL = 'gemini/gemini-3.6-flash';
export const PLANNER_MODEL_ENV = 'EXPERIENCE_PLANNER_MODEL';

export function configuredPlannerModel(): string {
  const configured = process.env[PLANNER_MODEL_ENV];
  return configured && /^[a-z0-9_-]+\/[a-z0-9][a-z0-9.-]{1,80}$/i.test(configured)
    ? configured
    : DEFAULT_PLANNER_MODEL;
}

/** Real planning is off unless an operator turns it on. A default-off switch is
 * the difference between "safe by configuration" and "safe by hope". */
export function realPlanningEnabled(): boolean {
  return process.env.EDNOVA_ENABLE_GEMINI_EXPERIENCE_PLANNING === 'true';
}

function usageFrom(raw: unknown, reservedTokens: number): ProviderUsage {
  const value = (raw ?? {}) as Record<string, unknown>;
  const int = (input: unknown): number | null =>
    typeof input === 'number' && Number.isSafeInteger(input) && input >= 0 ? input : null;
  const inputTokens = int(value.inputTokens);
  const outputTokens = int(value.outputTokens);
  const totalTokens = int(value.totalTokens);
  const reported = totalTokens !== null || inputTokens !== null || outputTokens !== null;
  return {
    usageReported: reported,
    inputTokens,
    outputTokens,
    totalTokens,
    reservedTokens,
    modelVersion: typeof value.modelVersion === 'string' ? value.modelVersion.slice(0, 256) : null,
    costUsd:
      typeof value.costUsd === 'number' && Number.isFinite(value.costUsd) ? value.costUsd : null
  };
}

/**
 * Mock provider: reuses the M4.1 deterministic planner behind the new contract.
 *
 * It reports `usageReported: false` and `costUsd: null`, because a mock makes no
 * provider call. Nothing in the accounting path may read that as "free".
 */
export class MockExperiencePlannerProvider implements ExperiencePlannerProvider {
  readonly identity: ProviderIdentity = {
    provider: 'mock',
    model: 'mock_experience_planner'
  };

  constructor(
    private readonly delegate: (
      request: BoundedPlanningRequest
    ) => Promise<UntrustedExperiencePlanProposal>,
    private readonly enabled: () => boolean = () =>
      process.env.EDNOVA_ENABLE_MOCK_EXPERIENCE_PLANNING === 'true'
  ) {}

  isEnabled(): boolean {
    return this.enabled();
  }

  async plan(request: BoundedPlanningRequest): Promise<ProviderOutcome> {
    if (!this.isEnabled())
      return {
        ok: false,
        code: 'PROVIDER_DISABLED',
        failure: 'known',
        usage: NO_USAGE
      };
    try {
      const proposal = await this.delegate(request);
      return {
        ok: true,
        proposal,
        usage: {
          usageReported: false,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          reservedTokens: 0,
          modelVersion: null,
          costUsd: null
        },
        identity: this.identity
      };
    } catch {
      // A mock that throws produced no output; nothing was dispatched anywhere.
      return {
        ok: false,
        code: 'PROVIDER_UNAVAILABLE',
        failure: 'known',
        usage: NO_USAGE
      };
    }
  }
}

/** The internal boundary path. Kept in one place so a rename cannot drift. */
export const PLANNER_DISPATCH_PATH = '/api/ai/experience/plan';

/**
 * Gemini provider, dispatched through the Python AI boundary.
 *
 * Failure classification is the whole point of this adapter:
 *
 *   - a refusal the Python service returns *before* dispatch is `known`
 *   - a timeout, a 5xx, a malformed body, or a connection error is `uncertain`
 *     because the request may have reached the model and been charged
 *
 * The adapter never retries. Retrying an uncertain dispatch is how a system
 * pays twice for one plan.
 */
export class GeminiExperiencePlannerProvider implements ExperiencePlannerProvider {
  readonly identity: ProviderIdentity;

  constructor(
    private readonly model: string = configuredPlannerModel(),
    private readonly enabled: () => boolean = realPlanningEnabled
  ) {
    this.identity = { provider: 'gemini', model: this.model };
  }

  isEnabled(): boolean {
    return this.enabled();
  }

  async plan(request: BoundedPlanningRequest): Promise<ProviderOutcome> {
    if (!this.isEnabled())
      return { ok: false, code: 'PROVIDER_DISABLED', failure: 'known', usage: NO_USAGE };

    let response;
    try {
      response = await aiClient.post(
        PLANNER_DISPATCH_PATH,
        {
          requestId: request.requestId,
          contextFingerprint: request.contextFingerprint,
          model: this.model,
          systemPolicy: request.systemPolicy,
          task: request.task,
          outputSchema: request.outputSchema,
          limits: request.limits
        },
        { timeout: request.limits.timeoutMs, maxContentLength: 262_144 }
      );
    } catch (error) {
      // Axios throws for timeouts, connection resets and non-2xx alike. None of
      // them proves the model was not called.
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status === 401 || status === 403)
        return {
          ok: false,
          code: 'PROVIDER_AUTH_REJECTED',
          failure: 'uncertain',
          usage: null
        };
      if (status === 429)
        return {
          ok: false,
          code: 'PROVIDER_QUOTA_EXCEEDED',
          failure: 'uncertain',
          usage: null
        };
      return {
        ok: false,
        code: 'PROVIDER_TIMEOUT_AFTER_DISPATCH',
        failure: 'uncertain',
        usage: null
      };
    }

    const body = (response.data ?? {}) as Record<string, unknown>;

    // A pre-dispatch refusal from the boundary carries a typed code and no
    // usage. Anything else is treated as possibly charged.
    if (body.refused === true && typeof body.code === 'string') {
      const code = body.code as ProviderFailureCode;
      return { ok: false, code, failure: failureClass(code), usage: null };
    }

    if (typeof body.output !== 'string' || body.output.length === 0)
      return { ok: false, code: 'PROVIDER_EMPTY_OUTPUT', failure: 'uncertain', usage: null };

    const usage = usageFrom(body.usage, request.limits.maxOutputTokens);

    let parsed: unknown;
    try {
      parsed = JSON.parse(body.output);
    } catch {
      return { ok: false, code: 'PROVIDER_MALFORMED_JSON', failure: 'uncertain', usage };
    }

    // The provider's own schema compliance is not proof of validity; this parse
    // only proves the payload is within the proposal contract. Authorization,
    // coverage and review are checked later, against trusted data.
    try {
      const proposal = parseExperiencePlanProposal(parsed);
      return { ok: true, proposal, usage, identity: this.identity };
    } catch {
      return {
        ok: false,
        code: 'PROVIDER_SCHEMA_INCOMPATIBLE',
        failure: 'uncertain',
        usage
      };
    }
  }
}

/** Resolve the provider this deployment is configured to use. Real Gemini wins
 * only when explicitly enabled; otherwise the mock, and otherwise nothing. */
export function resolvePlannerProvider(
  mockDelegate: (request: BoundedPlanningRequest) => Promise<UntrustedExperiencePlanProposal>
): ExperiencePlannerProvider | null {
  if (realPlanningEnabled()) return new GeminiExperiencePlannerProvider();
  if (process.env.EDNOVA_ENABLE_MOCK_EXPERIENCE_PLANNING === 'true')
    return new MockExperiencePlannerProvider(mockDelegate);
  return null;
}
