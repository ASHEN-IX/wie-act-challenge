/**
 * RabbitMQ topology for AI jobs (F01 / AI-COM-06).
 *
 * Mirrored by `study-partner-ai/messaging/topology.py`. Names and semantics
 * MUST stay identical on both sides — covered by topology-parity tests.
 *
 * Layout (vhost `/`):
 *   ai.jobs   (direct)  → work queue per type: ai.work.<type>
 *                         args: dead-letter-exchange = ai.dlx
 *                         Extra binding per (type, step): retry.<type>.<ms>
 *   ai.delay  (direct)  → per-type delay queues: ai.delay.<type>.<ms>
 *                         args: x-message-ttl = step, dead-letter-exchange = ai.jobs
 *                         (dead-lettering preserves routing key = retry.<type>.<ms>,
 *                          which is bound to the work queue above)
 *   ai.dlx    (direct)  → DLQ per type: ai.dlq.<type>
 *   ai.results(direct)  → result events consumed by the orchestrator: ai.results.inbox
 */

export const EXCHANGE_JOBS = 'ai.jobs';
export const EXCHANGE_DELAY = 'ai.delay';
export const EXCHANGE_DLX = 'ai.dlx';
export const EXCHANGE_RESULTS = 'ai.results';

export const RESULT_QUEUE = 'ai.results.inbox';

/**
 * SEPARATE routing key for staged progress events (INGEST-06). Workers publish
 * progress on ai.results with this key so the result inbox (bound to `result`)
 * never sees them. INGEST-07: the study service binds a consumer here.
 */
export const PROGRESS_ROUTING_KEY = 'progress';

/**
 * INGEST-07 — study-service consumers on ai.results (direct exchange).
 * A direct exchange COPIES every message to every queue bound to its routing
 * key, so the orchestrator's result inbox stays untouched:
 *   • PROGRESS_QUEUE      binds `progress` → course ingest progress (stage/%)
 *   • INGEST_RESULT_QUEUE binds `result`    → course completion/failure
 * The study service ACKs only ingest events (type study.ingest.course) and
 * acks everything else harmlessly.
 */
export const PROGRESS_QUEUE = 'ai.results.progress';
export const INGEST_RESULT_QUEUE = 'ai.results.ingest';

export const RETRY_DELAYS_MS: readonly number[] = Object.freeze(
  (() => {
    // Env override exists for integration tests (tiny delays); production
    // uses the canonical 1s → 4s → 16s ladder.
    const raw = process.env.AI_RETRY_DELAYS_MS;
    if (!raw) return [1000, 4000, 16000];
    const parsed = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      !parsed.length ||
      parsed.some((n: unknown) => typeof n !== 'number' || !Number.isInteger(n) || n < 1)
    ) {
      throw new Error('AI_RETRY_DELAYS_MS must be a JSON array of positive integers');
    }
    return parsed;
  })()
);
export const MAX_RETRIES = RETRY_DELAYS_MS.length;

export const workQueueName = (type: string): string => `ai.work.${type}`;
export const dlqQueueName = (type: string): string => `ai.dlq.${type}`;
/**
 * Delay queues are PER-TYPE: a dead-lettered retry keeps its CURRENT routing
 * key, so each (type, step) delay queue publishes under a dedicated retry key
 * that is ALSO bound from the jobs exchange to the work queue. Expired
 * retries therefore land back on the right work queue without needing
 * x-dead-letter-routing-key.
 */
export const delayQueueName = (type: string, delayMs: number): string =>
  `ai.delay.${type}.${delayMs}`;
export const retryRoutingKey = (type: string, delayMs: number): string =>
  `retry.${type}.${delayMs}`;

/**
 * Classify a failure as retryable or terminal.
 * Retryable: transient infrastructure/provider issues (timeouts, connections, quotas).
 * Terminal: schema/validation/authorization problems — retrying cannot succeed.
 */
export const FAILURE_CLASSES = Object.freeze({
  RETRYABLE: 'retryable',
  TERMINAL: 'terminal'
} as const);

export function classifyFailure(err: unknown): 'retryable' | 'terminal' {
  const fields = err && typeof err === 'object' ? err : {};
  const message = String(('message' in fields && fields.message) || err || '');
  const code = ('code' in fields && fields.code) || ('name' in fields && fields.name) || '';
  const combined = `${code} ${message}`.toLowerCase();

  const terminalPatterns = [
    'validation',
    'invalid',
    'schema',
    'unauthorized',
    'forbidden',
    'notfound',
    'not found',
    'rejected', // output rejected by validation pipeline
    'parseerror',
    'payload'
  ];
  if (terminalPatterns.some((p) => combined.includes(p))) {
    return FAILURE_CLASSES.TERMINAL;
  }

  const retryablePatterns = [
    'timeout',
    'timed out',
    'etimedout',
    'econnrefused',
    'econnreset',
    'econnaborted',
    'enotfound',
    'ehostunreach',
    'enetunreach',
    'socket hang up',
    'rate limit',
    'quota',
    '429',
    '502',
    '503',
    '504',
    'temporarily unavailable',
    'connection closed'
  ];
  if (retryablePatterns.some((p) => combined.includes(p))) {
    return FAILURE_CLASSES.RETRYABLE;
  }

  // Unknown failures are treated as retryable so transient blips recover;
  // persistent unknowns exhaust retries and land in the DLQ.
  return FAILURE_CLASSES.RETRYABLE;
}

/** Retry attempt number stored in message headers (1-based). */
export const retryHeader = 'x-retry-count';
