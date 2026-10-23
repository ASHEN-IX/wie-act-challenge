import { canDeliverJob } from './jobAccess';
import type { AiResultEnvelope } from '@study-partner/shared/ai-messaging/envelope';
/**
 * Consumes AI result events from RabbitMQ and correlates them to persisted
 * AiJobs via correlationId (F01 / AI-COM-07 + OPS-03).
 */

import { consumeAiResults } from '@study-partner/shared/ai-messaging';
import { logger } from '@study-partner/shared';
import AiJob from '../models/AiJob';
import { buildEvalResultRecord } from './evalResultBuilder';
import { upsertByCorrelation } from './evalResultStore';

export async function handleResult(result: AiResultEnvelope): Promise<void> {
  logger.info('ai_result_received', {
    correlationId: result.correlationId,
    type: result.type,
    status: result.status,
    requestId: result.requestId
  });

  // Correlation alone is not authority. Bind every available envelope identity
  // and immutable request scope before touching either job or private results.
  const job = await AiJob.findOne({
    correlationId: result.correlationId,
    messageId: result.messageId,
    type: result.type,
    requestId: result.requestId
  });
  const payload = result.payload;
  const scope = job?.resourceScope;
  if (
    !job ||
    !scope ||
    (result.userId !== undefined && result.userId !== job.userId) ||
    (payload?.userId !== undefined && payload.userId !== job.userId) ||
    (payload?.user_id !== undefined && payload.user_id !== job.userId) ||
    (result.status === 'completed' &&
      ['sessionId', 'step', 'objectiveId', 'courseId'].some((field) => {
        const expected = scope[field as keyof typeof scope];
        const actual = payload?.[field] ?? (field === 'courseId' ? payload?.course_id : undefined);
        return result.type === 'study.eval.step' && field !== 'courseId'
          ? (expected !== undefined || actual !== undefined) && expected !== actual
          : actual !== undefined &&
              (field === 'courseId' || expected !== undefined) &&
              expected !== actual;
      })) ||
    !(await canDeliverJob(job))
  ) {
    logger.warn('ai_result_rejected_scope', { correlationId: result.correlationId });
    return;
  }
  const binding = {
    userId: job.userId,
    messageId: job.messageId,
    type: job.type,
    requestId: job.requestId
  };
  if (job.status === 'FAILED') return;
  if (result.status === 'completed') {
    const completed = await AiJob.completeByCorrelation(
      result.correlationId,
      result.payload,
      binding
    );
    if (!completed || completed.status !== 'COMPLETED') {
      logger.warn('ai_result_unmatched', {
        correlationId: result.correlationId
      });
      return;
    }

    // EVAL-08: persist each completed eval step as a per-step Mongo record,
    // idempotent by correlationId. Mongo writes are owned by this Node backend;
    // the Python agents only publish the ai.results event that lands here.
    const evalRecord = buildEvalResultRecord({
      ...result,
      userId: job.userId,
      payload: completed.result
    });
    if (evalRecord) {
      await upsertByCorrelation(evalRecord);
      logger.info('eval_result_persisted', {
        sessionId: evalRecord.sessionId,
        step: evalRecord.step,
        correlationId: evalRecord.correlationId
      });
    }
  } else {
    await AiJob.failByCorrelation(result.correlationId, result.error, binding);
  }
}

/** Start the consumer; resolves once the subscription is live. */
export async function startResultConsumer() {
  return consumeAiResults(handleResult);
}

export default { startResultConsumer, handleResult };
module.exports = { startResultConsumer, handleResult };
