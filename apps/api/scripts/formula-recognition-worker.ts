import mongoose from 'mongoose';
import amqp from 'amqplib';
import { FORMULA_QUEUE, processJob, recover } from '../modules/study/src/services/formulaJobs';
import { EXCHANGE_JOBS } from '../shared/ai-messaging/topology';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
  const channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE_JOBS, 'direct', { durable: true });
  await channel.assertQueue(FORMULA_QUEUE, { durable: true, arguments: { 'x-single-active-consumer': true, 'x-max-length': 100, 'x-overflow': 'reject-publish' } });
  await channel.bindQueue(FORMULA_QUEUE, EXCHANGE_JOBS, process.env.FORMULA_ROUTING_KEY || 'study.formula.recognize');
  await channel.prefetch(1);
  await recover();
  const timer = setInterval(() => { recover().catch(() => {}); }, 30000);
  let active: Promise<void> = Promise.resolve();
  const consumer = await channel.consume(FORMULA_QUEUE, message => {
    if (!message) return;
    active = (async () => {
      try { const body = JSON.parse(message.content.toString()); await processJob(body.jobId); channel.ack(message); }
      catch { channel.nack(message, false, false); }
    })();
  });
  async function stop() { clearInterval(timer); await channel.cancel(consumer.consumerTag); await active; await channel.close(); await connection.close(); await mongoose.disconnect(); process.exit(0); }
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
  process.stdout.write('formula-worker-ready\n');
}
main().catch(() => { process.stderr.write('formula-worker-start-failed\n'); process.exit(1); });
