"use server";
import { unstable_rethrow } from "next/navigation";
import { api, ApiError, segment } from "@/lib/api";
import type {
  FormulaWorkspace,
  FormulaResult,
  FormulaJob,
  FormulaProposal,
} from "./formula-types";
async function call<T>(
  course: string,
  revision: string,
  suffix: string,
  body?: unknown,
): Promise<FormulaResult<T>> {
  try {
    return {
      ok: true,
      data: await api<T>(
        `/api/v1/study/courses/${segment(course)}/drafts/${segment(revision)}/${suffix}`,
        body === undefined
          ? {}
          : { method: "POST", body: JSON.stringify(body) },
      ),
    };
  } catch (e) {
    unstable_rethrow(e);
    return {
      ok: false,
      status: e instanceof ApiError ? e.status : 503,
      error: e instanceof Error ? e.message : "Formula service unavailable",
    };
  }
}
export async function loadFormulaWorkspace(course: string, revision: string) {
  return call<FormulaWorkspace>(course, revision, "formula-workspace");
}
export async function grantFormulaConsent(
  course: string,
  revision: string,
  documentId: string,
  draftVersion: number,
) {
  return call<{ granted: boolean }>(course, revision, "formula-consent", {
    consent: true,
    documentId,
    draftVersion,
  });
}
export async function requestFormulaRecognition(
  course: string,
  revision: string,
  documentId: string,
  regionId: string,
  draftVersion: number,
) {
  return call<{ job: FormulaJob }>(course, revision, "recognition-jobs", {
    documentId,
    regionId,
    draftVersion,
  });
}
export async function getFormulaJob(
  course: string,
  revision: string,
  jobId: string,
) {
  return call<{ job: FormulaJob }>(
    course,
    revision,
    `recognition-jobs/${segment(jobId)}`,
  );
}
export async function cancelFormulaJob(
  course: string,
  revision: string,
  jobId: string,
) {
  return call<{ job: FormulaJob }>(
    course,
    revision,
    `recognition-jobs/${segment(jobId)}/cancel`,
    {},
  );
}
export async function readFormulaProposal(
  course: string,
  revision: string,
  proposalId: string,
) {
  return call<{ proposal: FormulaProposal }>(
    course,
    revision,
    `formula-proposals/${segment(proposalId)}`,
  );
}
export async function reviewFormulaProposal(
  course: string,
  revision: string,
  proposalId: string,
  action: "accept" | "correct" | "reject",
  reviewVersion: number,
  draftVersion: number,
  latex?: string,
) {
  return call<{ proposal: FormulaProposal }>(
    course,
    revision,
    `formula-proposals/${segment(proposalId)}/review`,
    {
      action,
      reviewVersion,
      draftVersion,
      ...(action === "correct" ? { latex } : {}),
    },
  );
}
export async function formulaReviewHistory(
  course: string,
  revision: string,
  proposalId: string,
) {
  return call<{
    history: FormulaProposal["history"];
    reviewVersion: number;
    state: string;
  }>(course, revision, `formula-proposals/${segment(proposalId)}/history`);
}

export async function approveStudioPublication(
  course: string,
  revision: string,
  extractionReviewAcknowledged: boolean,
) {
  const w = await loadFormulaWorkspace(course, revision);
  if (!w.ok) return w;
  return call<{ approved: boolean }>(course, revision, "approve", {
    draftVersion: w.data.draftVersion,
    extractionReviewAcknowledged,
  });
}
