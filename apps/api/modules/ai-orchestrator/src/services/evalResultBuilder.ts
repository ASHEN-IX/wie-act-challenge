/**
 * buildEvalResultRecord — pure transform of an ai.results result event into the
 * EvalResult doc to persist. Extracted from the consumer so it is unit-testable
 * without a broker or a database.
 *
 * Only completed study.eval.step result events produce a record; everything
 * else returns null (non-eval jobs keep their existing AiJob persistence path).
 */

export const EVAL_JOB_TYPE = 'study.eval.step';

export const SCORE_FIELDS = [
  'concept_coverage',
  'logical_coherence',
  'causal_reasoning',
  'error_awareness',
  'specificity',
  'mastery_score'
];

export interface EvalResultRecord {
  correlationId: string;
  messageId: string;
  userId: string;
  sessionId: string;
  step: number;
  status: string;
  masteryScore: number | null;
  scores: Record<string, number>;
  nextQuestion: string | null;
  demonstratedBloomLevel: string | null;
  objectiveId: string | null;
  targetBloomLevel: string | null;
}

/**
 * @param {object} result ai.results envelope {userId, correlationId, messageId, type, status, payload}
 * @returns {EvalResultRecord|null} EvalResult doc fields, or null when not an eval step
 */
export function buildEvalResultRecord(result: unknown): EvalResultRecord | null {
  if (
    !result ||
    typeof result !== 'object' ||
    !('type' in result) ||
    result.type !== EVAL_JOB_TYPE ||
    !('payload' in result) ||
    !result.payload ||
    typeof result.payload !== 'object'
  )
    return null;
  if (
    !('correlationId' in result) ||
    typeof result.correlationId !== 'string' ||
    !('messageId' in result) ||
    typeof result.messageId !== 'string' ||
    !('userId' in result) ||
    typeof result.userId !== 'string'
  )
    return null;

  const payload = result.payload as Record<string, unknown>;
  if (
    typeof payload.sessionId !== 'string' ||
    typeof payload.step !== 'number' ||
    !Number.isInteger(payload.step)
  ) {
    return null;
  }

  const evaluationOutput: Record<string, unknown> =
    payload.evaluation_output && typeof payload.evaluation_output === 'object'
      ? (payload.evaluation_output as Record<string, unknown>)
      : {};
  const optionalText = (value: unknown): string | null =>
    typeof value === 'string' ? value : null;
  const scores: Record<string, number> = {};
  for (const field of SCORE_FIELDS) {
    if (typeof evaluationOutput[field] === 'number') {
      scores[field] = evaluationOutput[field];
    }
  }

  return {
    correlationId: result.correlationId,
    messageId: result.messageId,
    // The consumer supplies the correlated persisted job actor here. A broker
    // payload or callback actor claim never establishes learner authority.
    userId: result.userId,
    sessionId: payload.sessionId,
    step: payload.step,
    status:
      optionalText(payload.state) || optionalText(evaluationOutput.session_status) || 'CONTINUE',
    masteryScore: typeof payload.mastery_score === 'number' ? payload.mastery_score : null,
    scores,
    nextQuestion:
      evaluationOutput.next_question !== undefined && evaluationOutput.next_question !== null
        ? optionalText(evaluationOutput.next_question)
        : optionalText(payload.next_question) || null,
    demonstratedBloomLevel:
      payload.demonstratedBloomLevel !== undefined && payload.demonstratedBloomLevel !== null
        ? optionalText(payload.demonstratedBloomLevel)
        : optionalText(evaluationOutput.demonstrated_bloom_level) || null,
    objectiveId: payload.objectiveId !== undefined ? optionalText(payload.objectiveId) : null,
    targetBloomLevel:
      payload.targetBloomLevel !== undefined ? optionalText(payload.targetBloomLevel) : null
  };
}

export default { buildEvalResultRecord, EVAL_JOB_TYPE };
module.exports = { buildEvalResultRecord, EVAL_JOB_TYPE };
