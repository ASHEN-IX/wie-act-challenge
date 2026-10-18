/**
 * Consumes AI result events from RabbitMQ and correlates them to persisted
 * AiJobs via correlationId (F01 / AI-COM-07 + OPS-03).
 */

import { consumeAiResults } from '@study-partner/shared/ai-messaging';
import { logger } from '@study-partner/shared';
import AiJob from '../models/AiJob';
import { buildEvalResultRecord } from './evalResultBuilder';
import { upsertByCorrelation } from './evalResultStore';

export async function handleResult(result: any): Promise<void> {
  logger.info('ai_result_received', {
    correlationId: result.correlationId,
    type: result.type,
    status: result.status,
    requestId: result.requestId
  });

  if (result.status === 'completed') {
    const job = await (AiJob as any).completeByCorrelation(result.correlationId, result.payload);
    if (!job) {
      logger.warn('ai_result_unmatched', {
        correlationId: result.correlationId
      });
    }

    // EVAL-08: persist each completed eval step as a per-step Mongo record,
    // idempotent by correlationId. Mongo writes are owned by this Node backend;
    // the Python agents only publish the ai.results event that lands here.
    const evalRecord = buildEvalResultRecord(result);
    if (evalRecord) {
      await upsertByCorrelation(evalRecord);
      logger.info('eval_result_persisted', {
        sessionId: evalRecord.sessionId,
        step: evalRecord.step,
        correlationId: evalRecord.correlationId
      });
    }
  } else {
    await (AiJob as any).failByCorrelation(result.correlationId, result.error);
  }
}

/** Start the consumer; resolves once the subscription is live. */
export async function startResultConsumer(): Promise<any> {
  return consumeAiResults(handleResult);
}

export default { startResultConsumer, handleResult };
module.exports = { startResultConsumer, handleResult };
