export type FormulaState = "pending" | "accepted" | "corrected" | "rejected";
export interface FormulaProposal {
  _id: string;
  regionId: string;
  documentId: string;
  latex: string;
  reviewedLatex?: string;
  provider: string;
  model: string;
  modelVersion?: string;
  warnings: string[];
  state: FormulaState;
  reviewVersion: number;
  draftVersion: number;
  history: {
    reviewer: string;
    action: string;
    previous: string;
    next: string;
    expression?: string;
    at: string;
    reviewVersion: number;
  }[];
}
export interface FormulaJob {
  _id: string;
  regionId: string;
  documentId: string;
  proposalId?: string;
  state:
    | "queued"
    | "running"
    | "completed"
    | "failed"
    | "cancelled"
    | "stale"
    | "uncertain";
  error?: string;
}
export interface FormulaWorkspace {
  draftVersion: number;
  revisionTag: string;
  canConsent: boolean;
  staleFormulaReviews?: number;
  regions: {
    documentId: string;
    regionId: string;
    page: number;
    text: string;
    warnings: string[];
  }[];
  proposals: FormulaProposal[];
  jobs: FormulaJob[];
}
export type FormulaResult<T> =
  { ok: true; data: T } | { ok: false; status: number; error: string };
