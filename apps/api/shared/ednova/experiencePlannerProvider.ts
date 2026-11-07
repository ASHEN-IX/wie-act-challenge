/** Provider-neutral experience-planner contract (Batch 4, Milestone 4.2).
 *
 * The planner is an *untrusted* proposer. This interface is the only way a
 * provider — mock, Gemini, or a future one — reaches the application, and it is
 * deliberately narrow:
 *
 *   - it receives a bounded, already-authorized planning request
 *   - it returns raw structured output plus whatever usage the provider reported
 *   - it classifies its own failure as "known" or "uncertain dispatch"
 *
 * It must never: authorize, decide review status, read collections, validate
 * source ownership, render components, or write learner progress. Those stay in
 * the application, which is why this module has no database or model imports.
 */

import type { UntrustedExperiencePlanProposal } from './experiencePlan';

export const EXPERIENCE_PLANNER_CONTRACT_VERSION = '1.0.0' as const;

/**
 * Why a provider call failed.
 *
 * `known` means the request provably did not reach the model (a local
 * validation or preflight refusal), so no usage occurred and a retry is safe.
 * `uncertain` means dispatch may have happened: the provider may have been
 * charged, so the request must be accounted for and never auto-retried.
 */
export type ProviderFailureClass = 'known' | 'uncertain';

export const PROVIDER_FAILURE_CODES = [
  // Refused before dispatch — no usage occurred.
  'PROVIDER_NOT_CONFIGURED',
  'PROVIDER_DISABLED',
  'PROVIDER_CONTEXT_REJECTED',
  'PROVIDER_CONSENT_MISSING',
  'PROVIDER_ELIGIBILITY_MISSING',
  'PROVIDER_BILLING_NOT_FREE_TIER',
  'PROVIDER_BUDGET_UNAVAILABLE',
  'PROVIDER_APPROVAL_MISSING',
  'PROVIDER_CREDENTIAL_MISMATCH',
  'PROVIDER_CANCELLED_BEFORE_DISPATCH',
  'PROVIDER_CONCURRENT_DUPLICATE',
  // Dispatch may have occurred — usage uncertain.
  'PROVIDER_TIMEOUT_AFTER_DISPATCH',
  'PROVIDER_QUOTA_EXCEEDED',
  'PROVIDER_AUTH_REJECTED',
  'PROVIDER_MODEL_UNAVAILABLE',
  'PROVIDER_EMPTY_OUTPUT',
  'PROVIDER_TRUNCATED_OUTPUT',
  'PROVIDER_MALFORMED_JSON',
  'PROVIDER_SCHEMA_INCOMPATIBLE',
  'PROVIDER_USAGE_MISSING',
  'PROVIDER_CANCELLED_AFTER_DISPATCH',
  'PROVIDER_UNAVAILABLE',
] as const;

export type ProviderFailureCode = (typeof PROVIDER_FAILURE_CODES)[number];

/** Codes that are safe to retry: the request provably never reached the model. */
export const KNOWN_FAILURE_CODES: readonly ProviderFailureCode[] = Object.freeze([
  'PROVIDER_NOT_CONFIGURED',
  'PROVIDER_DISABLED',
  'PROVIDER_CONTEXT_REJECTED',
  'PROVIDER_CONSENT_MISSING',
  'PROVIDER_ELIGIBILITY_MISSING',
  'PROVIDER_BILLING_NOT_FREE_TIER',
  'PROVIDER_BUDGET_UNAVAILABLE',
  'PROVIDER_APPROVAL_MISSING',
  'PROVIDER_CREDENTIAL_MISMATCH',
  'PROVIDER_CANCELLED_BEFORE_DISPATCH',
  'PROVIDER_CONCURRENT_DUPLICATE',
]);

export function failureClass(code: ProviderFailureCode): ProviderFailureClass {
  return KNOWN_FAILURE_CODES.includes(code) ? 'known' : 'uncertain';
}

/**
 * Observed provider usage.
 *
 * `reported` is what the provider said it used. `reserved` is what the
 * application reserved before dispatch. A missing report is not zero cost:
 * `reportedTokens: null` with `usageReported: false` means "unknown", and the
 * accounting layer must treat the reservation as spent.
 */
export type ProviderUsage = {
  usageReported: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  /** Reserved before dispatch; the conservative charge when nothing is reported. */
  reservedTokens: number;
  /** Provider-side model version string, when returned. */
  modelVersion: string | null;
  /** Never estimated from mocks. Null means "not measured", not "zero". */
  costUsd: number | null;
};

export type ProviderIdentity = {
  provider: string;
  model: string;
};

/** What the provider is allowed to see. Built by the application, never by the
 * provider, and already stripped of secrets, learner identity and raw images. */
export type BoundedPlanningRequest = {
  /** Stable request identity; also the idempotency key. */
  requestId: string;
  /** Fingerprint of the trusted context this request was built from. */
  contextFingerprint: string;
  /** Provider-neutral instructions. The system policy text lives here. */
  systemPolicy: string;
  /** The user-facing task, assembled from bounded lesson material. */
  task: string;
  /** JSON schema the proposal must satisfy. */
  outputSchema: Record<string, unknown>;
  /** Hard bounds the provider adapter must not exceed. */
  limits: {
    maxInputCharacters: number;
    maxOutputTokens: number;
    timeoutMs: number;
  };
};

export type ProviderOutcome =
  | {
      ok: true;
      proposal: UntrustedExperiencePlanProposal;
      usage: ProviderUsage;
      identity: ProviderIdentity;
    }
  | {
      ok: false;
      code: ProviderFailureCode;
      failure: ProviderFailureClass;
      /** Usage observed before the failure, when the provider reported any. */
      usage: ProviderUsage | null;
      /** Safe, non-leaking detail for logs. Never shown to a learner. */
      detail?: string;
    };

/**
 * The provider contract.
 *
 * `plan` must be total: it returns an outcome for every input and never throws
 * for an expected provider condition. A thrown error is treated by the caller
 * as `uncertain`, because the adapter failing is not proof that no dispatch
 * happened.
 */
export interface ExperiencePlannerProvider {
  readonly identity: ProviderIdentity;
  /** Whether this deployment may dispatch to the provider at all. */
  isEnabled(): boolean;
  plan(request: BoundedPlanningRequest): Promise<ProviderOutcome>;
}

/** Zero usage, for refusals that provably never dispatched. */
export const NO_USAGE: ProviderUsage = Object.freeze({
  usageReported: false,
  inputTokens: null,
  outputTokens: null,
  totalTokens: null,
  reservedTokens: 0,
  modelVersion: null,
  costUsd: null,
});
