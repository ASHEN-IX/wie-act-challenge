/**
 * AI message contract — canonical envelopes (AI-COM-02 / AI-COM-03).
 *
 * Single source of truth for the shape of AI job messages and AI result
 * events travelling over RabbitMQ. Mirrored by the Pydantic models in
 * `ednova-ai/messaging/envelope.py`; both sides MUST validate on
 * publish AND on consume. Contract doc: docs/contracts/ai-message-contract.md
 */

export const ENVELOPE_VERSION = '1';

/**
 * Known AI job types. Each maps to one RabbitMQ work queue.
 */
export const AI_JOB_TYPES = Object.freeze([
  'study.plan.generate',
  'study.coach.nudge',
  'study.eval.step',
  'study.search.query',
  'study.ingest.course',
  'study.knowledge.extract',
  'study.schedule.apply'
] as const);

export type AiJobType = (typeof AI_JOB_TYPES)[number];

export const JOB_STATUSES = Object.freeze([
  'PENDING',
  'PROCESSING',
  'RETRYING',
  'COMPLETED',
  'FAILED'
] as const);
export type JobStatus = (typeof JOB_STATUSES)[number];

export const RESULT_STATUSES = Object.freeze(['completed', 'failed'] as const);
export type ResultStatus = (typeof RESULT_STATUSES)[number];

/**
 * INGEST-06/07 — staged progress events published on ai.results under the
 * `progress` routing key. Mirrors `AiProgressEnvelope` in
 * ednova-ai/messaging/envelope.py (status "progress", stage in
 * PROGRESS_STAGES, progress ∈ [0,1], detail ≤256, no payload field).
 */
export const PROGRESS_STATUS = 'progress';
export const PROGRESS_STAGES = Object.freeze([
  'parsing',
  'enriching',
  'embedding',
  'indexing'
] as const);
export type ProgressStage = (typeof PROGRESS_STAGES)[number];

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_8601_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface AiJobEnvelope {
  messageId: string;
  correlationId: string;
  type: AiJobType;
  version: string;
  userId: string;
  requestId: string;
  timestamp: string;
  payload: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AiResultEnvelope {
  messageId: string;
  correlationId: string;
  type: AiJobType;
  version: string;
  requestId: string;
  timestamp: string;
  status: ResultStatus;
  payload?: Record<string, unknown>;
  error?: string;
  [key: string]: unknown;
}

export interface AiProgressEnvelope {
  messageId: string;
  correlationId: string;
  type: AiJobType;
  version: string;
  requestId: string;
  timestamp: string;
  status: typeof PROGRESS_STATUS;
  stage: ProgressStage;
  progress?: number;
  detail?: string;
  [key: string]: unknown;
}

function isNonEmptyString(value: unknown, maxLength = 256): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function validateCommonFields(
  envelope: unknown,
  errors: string[]
): envelope is Record<string, unknown> {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    errors.push('envelope must be a JSON object');
    return false;
  }
  const fields = envelope as Record<string, unknown>;
  if (!isNonEmptyString(fields.messageId) || !UUID_V4_RE.test(fields.messageId)) {
    errors.push('messageId must be a UUID v4 string');
  }
  if (!isNonEmptyString(fields.correlationId) || !UUID_V4_RE.test(fields.correlationId)) {
    errors.push('correlationId must be a UUID v4 string');
  }
  if (!isNonEmptyString(fields.requestId, 128)) {
    errors.push('requestId must be a non-empty string (max 128 chars)');
  }
  if (fields.version !== ENVELOPE_VERSION) {
    errors.push(`version must be "${ENVELOPE_VERSION}"`);
  }
  if (!isNonEmptyString(fields.timestamp, 40) || !ISO_8601_RE.test(fields.timestamp)) {
    errors.push('timestamp must be an ISO-8601 UTC string');
  }
  return true;
}

/**
 * Validate an AI job (request) envelope.
 */
export function validateAiJobEnvelope(envelope: unknown): ValidationResult {
  const errors: string[] = [];
  if (!validateCommonFields(envelope, errors)) {
    return { valid: false, errors };
  }
  if (!AI_JOB_TYPES.some((type) => type === envelope.type)) {
    errors.push(`type must be one of: ${AI_JOB_TYPES.join(', ')}`);
  }
  if (!isNonEmptyString(envelope.userId, 128)) {
    errors.push('userId must be a non-empty string taken from the authenticated context');
  }
  if (
    !envelope.payload ||
    typeof envelope.payload !== 'object' ||
    Array.isArray(envelope.payload)
  ) {
    errors.push('payload must be a JSON object');
  }
  if ('status' in envelope || 'error' in envelope || 'result' in envelope) {
    errors.push('job envelopes must not carry status/error/result fields');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate an AI result event envelope.
 */
export function validateAiResultEnvelope(envelope: unknown): ValidationResult {
  const errors: string[] = [];
  if (!validateCommonFields(envelope, errors)) {
    return { valid: false, errors };
  }
  if (!AI_JOB_TYPES.some((type) => type === envelope.type)) {
    errors.push(`type must be one of: ${AI_JOB_TYPES.join(', ')}`);
  }
  if (!RESULT_STATUSES.some((status) => status === envelope.status)) {
    errors.push('status must be "completed" or "failed"');
  }
  if (envelope.status === 'completed') {
    if (
      !envelope.payload ||
      typeof envelope.payload !== 'object' ||
      Array.isArray(envelope.payload)
    ) {
      errors.push('completed results must carry a payload object');
    }
    if ('error' in envelope && envelope.error !== undefined && envelope.error !== null) {
      errors.push('completed results must not carry an error field');
    }
  }
  if (envelope.status === 'failed') {
    if (!isNonEmptyString(envelope.error, 512)) {
      errors.push('failed results must carry a sanitized error message (max 512 chars)');
    } else if (/stack|at .*\(|mongodb(\+srv)?:\/\//i.test(envelope.error)) {
      errors.push('error must be sanitized: no stack traces or connection strings');
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate an AI progress event envelope (INGEST-06/07).
 */
export function validateAiProgressEnvelope(envelope: unknown): ValidationResult {
  const errors: string[] = [];
  if (!validateCommonFields(envelope, errors)) {
    return { valid: false, errors };
  }
  if (!AI_JOB_TYPES.some((type) => type === envelope.type)) {
    errors.push(`type must be one of: ${AI_JOB_TYPES.join(', ')}`);
  }
  if (envelope.status !== PROGRESS_STATUS) {
    errors.push(`status must be "${PROGRESS_STATUS}"`);
  }
  if (!PROGRESS_STAGES.some((stage) => stage === envelope.stage)) {
    errors.push(`stage must be one of: ${PROGRESS_STAGES.join(', ')}`);
  }
  if (envelope.progress !== undefined && envelope.progress !== null) {
    if (
      typeof envelope.progress !== 'number' ||
      Number.isNaN(envelope.progress) ||
      envelope.progress < 0 ||
      envelope.progress > 1
    ) {
      errors.push('progress must be a number in [0, 1]');
    }
  }
  if (envelope.detail !== undefined && envelope.detail !== null) {
    if (!isNonEmptyString(envelope.detail, 256)) {
      errors.push('detail must be a string (max 256 chars)');
    }
  }
  if ('payload' in envelope || 'error' in envelope) {
    errors.push('progress envelopes must not carry payload/error fields');
  }
  return { valid: errors.length === 0, errors };
}
