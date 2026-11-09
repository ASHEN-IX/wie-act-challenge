/**
 * AiJob — persisted AI job state machine (F01 / AI-COM-07).
 *
 * Every AI operation creates an AiJob in PENDING and returns its jobId
 * immediately (202). Result events correlate via correlationId. Terminal jobs
 * get expireAt = +30d; the column is indexed and swept by the cleanup job.
 */

import crypto from 'crypto';
import { Prisma, type AiJob as AiJobRow } from '../../../../src/generated/prisma/client';
import { prisma, toDocument } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';

export type JobStatus = 'PENDING' | 'PROCESSING' | 'RETRYING' | 'COMPLETED' | 'FAILED';

export const JOB_STATUSES: JobStatus[] = [
  'PENDING',
  'PROCESSING',
  'RETRYING',
  'COMPLETED',
  'FAILED'
];

/** Statuses a correlated result may still move to a terminal state. */
const ACTIVE_STATUSES: JobStatus[] = ['PENDING', 'PROCESSING', 'RETRYING'];

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Allowed transitions; anything else is rejected.
// PENDING -> COMPLETED/FAILED covers result races (worker finishes before
// the orchestrator observes PROCESSING).
const TRANSITIONS: Record<string, string[]> = {
  PENDING: ['PROCESSING', 'COMPLETED', 'FAILED'],
  PROCESSING: ['COMPLETED', 'FAILED', 'RETRYING'],
  RETRYING: ['PROCESSING', 'COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: []
};

export interface JobResourceScope {
  courseId?: string;
  sessionId?: string;
  objectiveId?: string;
  step?: number;
}

export interface IAiJob extends Omit<AiJobRow, 'resourceScope' | 'result'> {
  id: string;
  resourceScope: JobResourceScope | null;
  result: unknown;
  transitionTo(nextStatus: JobStatus | string): Promise<IAiJob>;
}

export type JobBinding = Pick<AiJobRow, 'userId' | 'messageId' | 'type' | 'requestId'>;

function hydrate(row: AiJobRow): IAiJob {
  const job = {
    ...toDocument(row),
    resourceScope: (row.resourceScope ?? null) as JobResourceScope | null,
    result: row.result
  } as unknown as IAiJob;
  job.transitionTo = (nextStatus) => transitionTo(job, nextStatus);
  return job;
}

function invalidTransitionError(from: string, to: string): Error & { code?: string } {
  const err = new Error(`invalid job transition ${from} -> ${to}`) as Error & {
    code?: string;
  };
  err.code = 'EINVALIDTRANSITION';
  return err;
}

/**
 * Move a job to `nextStatus`, enforcing the transition table. Terminal states
 * schedule the TTL sweep.
 *
 * The in-memory document is mutated optimistically (as the previous Mongoose
 * instance method did) and validated synchronously, so an illegal move throws
 * before any I/O.
 */
function transitionTo(job: IAiJob, nextStatus: JobStatus | string): Promise<IAiJob> {
  const allowed = TRANSITIONS[job.status] || [];
  if (!allowed.includes(nextStatus)) {
    throw invalidTransitionError(job.status, nextStatus);
  }
  const updatedAt = new Date();
  job.status = nextStatus as JobStatus;
  job.updatedAt = updatedAt;
  if (nextStatus === 'COMPLETED' || nextStatus === 'FAILED') {
    job.expireAt = new Date(updatedAt.getTime() + THIRTY_DAYS_MS);
  }
  return prisma.aiJob
    .update({
      where: { id: job.id },
      data: { status: job.status, expireAt: job.expireAt, updatedAt }
    })
    .then(() => job);
}

export const AiJob = {
  async create(
    data: Omit<Prisma.AiJobUncheckedCreateInput, 'id' | 'jobId'> & {
      id?: string;
      jobId?: string;
    }
  ): Promise<IAiJob> {
    const row = await prisma.aiJob.create({
      data: {
        ...(data as Prisma.AiJobUncheckedCreateInput),
        id: data.id ?? newId(),
        jobId: data.jobId ?? crypto.randomUUID()
      }
    });
    return hydrate(row);
  },

  async findById(id: string): Promise<IAiJob | null> {
    const row = await prisma.aiJob.findUnique({ where: { id } });
    return row ? hydrate(row) : null;
  },

  async findOne(where: Prisma.AiJobWhereInput = {}): Promise<IAiJob | null> {
    const row = await prisma.aiJob.findFirst({ where, orderBy: { createdAt: 'asc' } });
    return row ? hydrate(row) : null;
  },

  async findMany(
    where: Prisma.AiJobWhereInput = {},
    order: Prisma.AiJobOrderByWithRelationInput = { createdAt: 'desc' },
    take?: number
  ): Promise<IAiJob[]> {
    const rows = await prisma.aiJob.findMany({ where, orderBy: order, take });
    return rows.map(hydrate);
  },

  async countDocuments(where: Prisma.AiJobWhereInput = {}): Promise<number> {
    return prisma.aiJob.count({ where });
  },

  async deleteOne(where: Prisma.AiJobWhereInput): Promise<number> {
    const result = await prisma.aiJob.deleteMany({ where });
    return result.count;
  },

  async deleteMany(where: Prisma.AiJobWhereInput = {}): Promise<number> {
    const result = await prisma.aiJob.deleteMany({ where });
    return result.count;
  },

  /** Create a PENDING job from a published envelope's identifiers. */
  async createPending({
    type,
    userId,
    requestId,
    correlationId,
    messageId,
    payloadSnapshot = undefined
  }: {
    type: string;
    userId: string;
    requestId?: string;
    correlationId: string;
    messageId: string;
    payloadSnapshot?: unknown;
  }): Promise<IAiJob> {
    const source =
      payloadSnapshot && typeof payloadSnapshot === 'object'
        ? (payloadSnapshot as Record<string, unknown>)
        : {};
    const resourceScope: JobResourceScope = {};
    for (const field of ['courseId', 'sessionId', 'objectiveId'] as const) {
      const value = source[field] ?? source[field.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())];
      if (typeof value === 'string' && value) resourceScope[field] = value;
    }
    if (typeof source.step === 'number') resourceScope.step = source.step;
    return AiJob.create({
      type,
      userId,
      requestId,
      correlationId,
      messageId,
      status: 'PENDING',
      // An explicit empty object marks an authorized source-free job; never
      // collapse it to NULL.
      resourceScope: resourceScope as unknown as Prisma.InputJsonValue
    });
  },

  /**
   * Correlated completion — idempotent: replayed results are ignored once the
   * job is terminal. Only rows still PENDING/PROCESSING/RETRYING are moved.
   */
  async completeByCorrelation(
    correlationId: string,
    payload?: unknown,
    binding?: JobBinding
  ): Promise<IAiJob | null> {
    const where: Prisma.AiJobWhereInput = { correlationId, ...binding };
    await prisma.aiJob.updateMany({
      where: { ...where, status: { in: ACTIVE_STATUSES } },
      data: {
        status: 'COMPLETED',
        result: (payload || {}) as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
        expireAt: new Date(Date.now() + THIRTY_DAYS_MS)
      }
    });
    return AiJob.findOne(where);
  },

  /** Correlated failure — idempotent in the same way as completion. */
  async failByCorrelation(
    correlationId: string,
    sanitizedError?: string,
    binding?: JobBinding
  ): Promise<IAiJob | null> {
    const where: Prisma.AiJobWhereInput = { correlationId, ...binding };
    await prisma.aiJob.updateMany({
      where: { ...where, status: { in: ACTIVE_STATUSES } },
      data: {
        status: 'FAILED',
        error: String(sanitizedError || 'AI job failed').slice(0, 512),
        updatedAt: new Date(),
        expireAt: new Date(Date.now() + THIRTY_DAYS_MS)
      }
    });
    return AiJob.findOne(where);
  }
};

export default AiJob;
module.exports = AiJob;
