/**
 * AI job publisher + result consumer (F01 / AI-COM-04).
 *
 * Single shared module for publishing validated AI jobs to RabbitMQ and
 * consuming AI result events. Enforces the AI-COM-02/03 envelope contracts,
 * owns connection lifecycle (reconnect with exponential backoff + heartbeat),
 * and uses publisher confirms so a publish is only reported as successful
 * once the broker has accepted it.
 */

import crypto from 'crypto';
import amqp, { Channel, ConfirmChannel, ChannelModel, ConsumeMessage } from 'amqplib';
import {
  validateAiJobEnvelope,
  validateAiResultEnvelope,
  validateAiProgressEnvelope,
  AiJobType,
  AiJobEnvelope,
  AiResultEnvelope,
  AiProgressEnvelope,
  ValidationResult
} from './envelope';
import {
  EXCHANGE_JOBS,
  EXCHANGE_DELAY,
  EXCHANGE_RESULTS,
  RESULT_QUEUE,
  PROGRESS_QUEUE,
  INGEST_RESULT_QUEUE,
  PROGRESS_ROUTING_KEY,
  RETRY_DELAYS_MS,
  workQueueName,
  dlqQueueName,
  delayQueueName,
  retryRoutingKey
} from './topology';
import logger from '../logger';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672/%2F';
const HEARTBEAT_SECONDS = 30;
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 30000;

let connection: ChannelModel | null = null;
let confirmChannel: ConfirmChannel | null = null;
let connecting: Promise<ChannelModel> | null = null;
let reconnectAttempts = 0;
let closing = false;
let reconnectTimer: NodeJS.Timeout | null = null;

interface ConsumerDef {
  handler: (event: any) => Promise<void>;
  options: {
    queue: string;
    routingKey: string;
    validator: (envelope: any) => ValidationResult;
    name: string;
  };
}

const consumerDefinitions = new Map<string, ConsumerDef>();
const consumerChannels = new Map<string, Channel>();
const unroutableMessageIds = new Set<string>();

function backoffDelay(attempt: number): number {
  return Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempt);
}

async function connect(): Promise<ChannelModel> {
  if (connection && (connection as any) !== 'closed') return connection;
  if (connecting) return connecting;

  connecting = (async () => {
    try {
      const conn = await amqp.connect(RABBITMQ_URL, {
        heartbeat: HEARTBEAT_SECONDS
      } as any);
      connection = conn;
      reconnectAttempts = 0;
      logger.info('ai_messaging_connected', { url: safeUrl(RABBITMQ_URL) });

      conn.on('error', (err: Error) => {
        logger.error('ai_messaging_connection_error', { error: err.message });
      });
      conn.on('close', () => {
        connection = null;
        confirmChannel = null;
        consumerChannels.clear();
        if (!closing) scheduleReconnect();
      });

      const ch = await conn.createConfirmChannel();
      confirmChannel = ch;
      await ch.assertExchange(EXCHANGE_JOBS, 'direct', { durable: true });
      ch.on('return', (msg: ConsumeMessage) => {
        const id = msg && msg.properties && msg.properties.messageId;
        logger.error('ai_job_unroutable', { messageId: id });
        if (id) unroutableMessageIds.add(id);
      });
      ch.on('error', () => {});
      return conn;
    } catch (err) {
      connection = null;
      confirmChannel = null;
      scheduleReconnect();
      throw err;
    } finally {
      connecting = null;
    }
  })();

  return connecting;
}

function scheduleReconnect(): void {
  if (closing || reconnectTimer) return;
  const delay = backoffDelay(reconnectAttempts++);
  logger.warn('ai_messaging_reconnect_scheduled', { delayMs: delay });
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect()
      .then(async () => {
        for (const { handler, options } of consumerDefinitions.values()) {
          await startResultsConsumer(handler, options);
        }
      })
      .catch(() => {});
  }, delay);
  reconnectTimer.unref();
}

function safeUrl(url: string): string {
  return String(url).replace(/\/\/[^@]*@/, '//***@');
}

export interface PublishAiJobOptions {
  messageId?: string;
  correlationId?: string;
  requestId?: string;
}

export async function publishAiJob(
  type: AiJobType | string,
  userId: string,
  payload: Record<string, any>,
  opts: PublishAiJobOptions = {}
): Promise<{ messageId: string; correlationId: string }> {
  const envelope: AiJobEnvelope = {
    messageId: opts.messageId || crypto.randomUUID(),
    correlationId: opts.correlationId || crypto.randomUUID(),
    type: type as AiJobType,
    version: '1',
    userId,
    requestId: opts.requestId || `req-${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    payload: payload || {}
  };

  const validation = validateAiJobEnvelope(envelope);
  if (!validation.valid) {
    const err: any = new Error(`invalid job envelope: ${validation.errors.join('; ')}`);
    err.code = 'ENVELOPE_INVALID';
    throw err;
  }

  try {
    await connect();
    if (!confirmChannel) {
      throw Object.assign(new Error('broker channel unavailable'), { code: 'EBROKERDOWN' });
    }

    const ok = confirmChannel.publish(EXCHANGE_JOBS, type, Buffer.from(JSON.stringify(envelope)), {
      persistent: true,
      mandatory: true,
      contentType: 'application/json',
      messageId: envelope.messageId,
      correlationId: envelope.correlationId,
      type: envelope.type,
      timestamp: Date.parse(envelope.timestamp)
    });
    const confirmRes = await (confirmChannel.waitForConfirms() as any);
    if (!ok || confirmRes === false) {
      throw Object.assign(new Error('broker did not confirm job publish'), {
        code: 'EPUBLISHCONFIRM'
      });
    }
    if (unroutableMessageIds.has(envelope.messageId)) {
      unroutableMessageIds.delete(envelope.messageId);
      throw Object.assign(
        new Error(`no queue bound for job type "${type}" — worker topology missing`),
        { code: 'ENOROUTE' }
      );
    }

    logger.info('ai_job_published', {
      messageId: envelope.messageId,
      correlationId: envelope.correlationId,
      type,
      requestId: envelope.requestId
    });
    return { messageId: envelope.messageId, correlationId: envelope.correlationId };
  } catch (err: any) {
    logger.error('ai_job_publish_failed', {
      type,
      code: err.code || 'UNKNOWN',
      error: err.message
    });
    throw err;
  }
}

export async function ensureTopologyForType(type: string): Promise<void> {
  await connect();
  if (!connection) throw new Error('Not connected');
  const ch = await connection.createConfirmChannel();
  try {
    await ch.assertExchange(EXCHANGE_JOBS, 'direct', { durable: true });
    await ch.assertExchange(EXCHANGE_DELAY, 'direct', { durable: true });
    await ch.assertExchange('ai.dlx', 'direct', { durable: true });

    const workQ = workQueueName(type);

    await ch.assertQueue(workQ, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'ai.dlx',
        'x-dead-letter-routing-key': type
      }
    });
    await ch.bindQueue(workQ, EXCHANGE_JOBS, type);

    for (const delayMs of RETRY_DELAYS_MS) {
      const qName = delayQueueName(type, delayMs);
      await ch.assertQueue(qName, {
        durable: true,
        arguments: {
          'x-message-ttl': delayMs,
          'x-dead-letter-exchange': EXCHANGE_JOBS
        }
      });
      const retryKey = retryRoutingKey(type, delayMs);
      await ch.bindQueue(qName, EXCHANGE_DELAY, retryKey);
      await ch.bindQueue(workQ, EXCHANGE_JOBS, retryKey);
    }

    await ch.assertQueue(dlqQueueName(type), { durable: true });
    await ch.bindQueue(dlqQueueName(type), 'ai.dlx', type);

    await ch.waitForConfirms();
  } finally {
    await ch.close();
  }
}

interface ResultsConsumerOptions {
  queue: string;
  routingKey: string;
  validator: (envelope: any) => ValidationResult;
  name: string;
}

export async function startResultsConsumer(
  handler: (event: any) => Promise<void>,
  { queue, routingKey, validator, name }: ResultsConsumerOptions
): Promise<Channel> {
  if (typeof handler !== 'function') {
    throw new TypeError(`${name} handler must be a function`);
  }
  consumerDefinitions.set(queue, { handler, options: { queue, routingKey, validator, name } });
  if (consumerChannels.has(queue)) {
    return consumerChannels.get(queue)!;
  }
  await connect();
  if (!connection) throw new Error('Not connected');

  const ch = await connection.createChannel();
  await ch.assertExchange(EXCHANGE_RESULTS, 'direct', { durable: true });
  await ch.assertQueue(queue, { durable: true });
  await ch.bindQueue(queue, EXCHANGE_RESULTS, routingKey);
  ch.prefetch(10);

  ch.consume(
    queue,
    async (msg: ConsumeMessage | null) => {
      if (!msg) return;
      let parsed: any;
      try {
        parsed = JSON.parse(msg.content.toString());
        const validation = validator(parsed);
        if (!validation.valid) throw new Error(validation.errors.join('; '));
      } catch (err: any) {
        logger.error('ai_result_invalid', { error: err.message });
        ch.nack(msg, false, false);
        return;
      }
      try {
        await handler(parsed);
        ch.ack(msg);
      } catch (err: any) {
        logger.error('ai_result_handler_failed', {
          correlationId: parsed.correlationId,
          error: err.message
        });
        ch.nack(msg, false, msg.fields.redelivered === false);
      }
    },
    { noAck: false }
  );
  consumerChannels.set(queue, ch);
  logger.info('ai_results_consumer_started', { queue, routingKey });
  return ch;
}

export async function consumeAiResults(
  handler: (result: AiResultEnvelope) => Promise<void>
): Promise<Channel> {
  return startResultsConsumer(handler, {
    queue: RESULT_QUEUE,
    routingKey: 'result',
    validator: validateAiResultEnvelope,
    name: 'ai.results.inbox'
  });
}

export async function consumeAiProgress(
  handler: (progress: AiProgressEnvelope) => Promise<void>
): Promise<Channel> {
  return startResultsConsumer(handler, {
    queue: PROGRESS_QUEUE,
    routingKey: PROGRESS_ROUTING_KEY,
    validator: validateAiProgressEnvelope,
    name: 'ai.results.progress'
  });
}

export async function consumeIngestResults(
  handler: (result: AiResultEnvelope) => Promise<void>
): Promise<Channel> {
  return startResultsConsumer(handler, {
    queue: INGEST_RESULT_QUEUE,
    routingKey: 'result',
    validator: validateAiResultEnvelope,
    name: 'ai.results.ingest'
  });
}

export async function closeAiMessaging(): Promise<void> {
  closing = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  consumerDefinitions.clear();
  try {
    for (const ch of consumerChannels.values()) {
      await ch.close().catch(() => {});
    }
    consumerChannels.clear();
    if (confirmChannel) {
      await confirmChannel.close().catch(() => {});
      confirmChannel = null;
    }
    if (connection) {
      await connection.close().catch(() => {});
      connection = null;
    }
  } finally {
    closing = false;
    reconnectAttempts = 0;
  }
}
