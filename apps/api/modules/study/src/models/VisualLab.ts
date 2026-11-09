import type { Prisma, VisualLab as VisualLabRow } from '../../../../src/generated/prisma/client';
import { prisma } from '../../../../shared/database';
import { table } from './_table';

/**
 * Persisted Visual Learning Lab. Only validated definitions reach this table;
 * the derived answer key stays here and is never projected to a browser.
 */
export type IVisualLab = Omit<VisualLabRow, 'definition' | 'guidance' | 'check'> & {
  _id: string;
  definition: Record<string, unknown>;
  guidance: Record<string, unknown>;
  check: {
    prompt: string;
    options: Array<{ id: string; label: string }>;
    correctOptionId: string;
    explanation: string;
  };
};

export const VisualLab = table<IVisualLab>({
  delegate: () => prisma.visualLab,
  jsonColumns: ['definition', 'guidance', 'check'],
  defaults: () => ({ scope: 'private', passageIds: [] }),
  columns: (row) => ({
    labId: row.labId,
    schemaVersion: row.schemaVersion,
    ownerUserId: row.ownerUserId,
    scope: row.scope,
    sourceMode: row.sourceMode,
    courseId: row.courseId,
    revisionId: row.revisionId,
    topicId: row.topicId,
    passageIds: row.passageIds,
    topic: row.topic,
    engine: row.engine,
    title: row.title,
    concept: row.concept,
    learningObjective: row.learningObjective,
    definition: row.definition as unknown as Prisma.InputJsonValue,
    guidance: row.guidance as unknown as Prisma.InputJsonValue,
    check: row.check as unknown as Prisma.InputJsonValue,
    generationMode: row.generationMode,
    generationKey: row.generationKey
  })
});

export default VisualLab;
