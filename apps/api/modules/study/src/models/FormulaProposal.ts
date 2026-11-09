import type {
  FormulaProposal as FormulaProposalRow,
  Prisma
} from '../../../../src/generated/prisma/client';
import { prisma } from '../../../../shared/database';
import { table } from './_table';

/** Separate from immutable canonical source blocks. */
export interface FormulaProposalDecision {
  reviewer: string;
  action: 'accepted' | 'corrected' | 'rejected';
  previous: string;
  next: string;
  expression?: string;
  draftVersion: number;
  revisionTag: string;
  revisionId: string;
  reviewVersion: number;
  at: Date;
}

export type IFormulaProposal = Omit<FormulaProposalRow, 'usage' | 'history' | 'bbox'> & {
  id: string;
  usage?: unknown;
  history: FormulaProposalDecision[];
  bbox: number[];
};

export const FormulaProposal = table<IFormulaProposal>({
  delegate: () => prisma.formulaProposal,
  jsonColumns: ['usage', 'history'],
  // Mongo's `$ne` also matched absent fields; these columns are required.
  requiredColumns: [
    'courseId',
    'revisionId',
    'revisionTag',
    'draftVersion',
    'documentId',
    'documentHash',
    'regionId',
    'page',
    'cropHash',
    'provider',
    'model',
    'latex',
    'sourceText',
    'identity',
    'state',
    'reviewVersion'
  ],
  defaults: () => ({ warnings: [], state: 'pending', reviewVersion: 0, history: [] }),
  columns: (row) => ({
    courseId: row.courseId,
    revisionId: row.revisionId,
    revisionTag: row.revisionTag,
    draftVersion: row.draftVersion,
    documentId: row.documentId,
    documentHash: row.documentHash,
    regionId: row.regionId,
    page: row.page,
    bbox: row.bbox,
    sourceText: row.sourceText,
    cropHash: row.cropHash,
    provider: row.provider,
    model: row.model,
    modelVersion: row.modelVersion,
    recognitionJobId: row.recognitionJobId,
    usage: row.usage as unknown as Prisma.InputJsonValue,
    latex: row.latex,
    warnings: row.warnings,
    identity: row.identity,
    reviewedLatex: row.reviewedLatex,
    state: row.state,
    reviewVersion: row.reviewVersion,
    history: row.history as unknown as Prisma.InputJsonValue
  })
});

export default FormulaProposal;
