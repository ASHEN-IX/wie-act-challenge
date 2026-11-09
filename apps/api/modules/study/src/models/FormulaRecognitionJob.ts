import type {
  FormulaRecognitionJob as FormulaRecognitionJobRow,
  Prisma
} from '../../../../src/generated/prisma/client';
import { prisma } from '../../../../shared/database';
import { table } from './_table';

export type IFormulaRecognitionJob = Omit<FormulaRecognitionJobRow, 'usage' | 'result' | 'bbox'> & {
  id: string;
  usage?: unknown;
  result?: unknown;
  bbox: number[];
};

export const FormulaRecognitionJob = table<IFormulaRecognitionJob>({
  delegate: () => prisma.formulaRecognitionJob,
  jsonColumns: ['usage', 'result'],
  defaults: () => ({ bbox: [], state: 'queued' }),
  columns: (row) => ({
    identity: row.identity,
    courseId: row.courseId,
    revisionId: row.revisionId,
    revisionTag: row.revisionTag,
    draftVersion: row.draftVersion,
    actor: row.actor,
    documentId: row.documentId,
    documentHash: row.documentHash,
    regionId: row.regionId,
    cropHash: row.cropHash,
    page: row.page,
    bbox: row.bbox,
    sourceText: row.sourceText,
    model: row.model,
    state: row.state,
    claim: row.claim,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    error: row.error,
    proposalId: row.proposalId,
    usage: row.usage as unknown as Prisma.InputJsonValue,
    result: row.result as unknown as Prisma.InputJsonValue
  })
});

export default FormulaRecognitionJob;
