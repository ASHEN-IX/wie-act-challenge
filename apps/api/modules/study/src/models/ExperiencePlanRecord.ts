import type {
  ExperiencePlanRecord as ExperiencePlanRecordRow,
  Prisma
} from '../../../../src/generated/prisma/client';
import { prisma } from '../../../../shared/database';
import { table } from './_table';

/**
 * A persisted, accepted experience plan (Batch 4, Milestone 4.3).
 *
 * Storing the plan body does **not** make it trusted. The validated-plan brand
 * is a module-private symbol and does not survive serialization, so a record
 * read from here is exactly as untrusted as raw provider output until the read
 * path re-runs the trusted validator.
 */
export type IExperiencePlanRecord = Omit<ExperiencePlanRecordRow, 'plan'> & {
  id: string;
  /** The accepted plan body, as proposed and validated. Untrusted on read. */
  plan: unknown;
};

export const ExperiencePlanRecord = table<IExperiencePlanRecord>({
  delegate: () => prisma.experiencePlanRecord,
  jsonColumns: ['plan'],
  columns: (row) => ({
    planId: row.planId,
    courseId: row.courseId,
    revisionId: row.revisionId,
    lessonId: row.lessonId,
    mode: row.mode,
    contentHash: row.contentHash,
    contextFingerprint: row.contextFingerprint,
    planSchemaVersion: row.planSchemaVersion,
    registryVersion: row.registryVersion,
    presentationSchemaVersion: row.presentationSchemaVersion,
    provider: row.provider,
    providerModel: row.providerModel,
    plannerImplementation: row.plannerImplementation,
    plannerVersion: row.plannerVersion,
    planDigest: row.planDigest,
    plan: row.plan as unknown as Prisma.InputJsonValue,
    generatedBy: row.generatedBy,
    generatedAt: row.generatedAt,
    supersededAt: row.supersededAt,
    supersededByPlanId: row.supersededByPlanId,
    invalidatedAt: row.invalidatedAt,
    invalidationReason: row.invalidationReason
  })
});

export default ExperiencePlanRecord;
