"use server";
import { api, segment } from "@/lib/api";
import { requireIdentity } from "@/server/identity";
import type { CourseDraft } from "./types";
export async function loadStudio(courseId: string) {
  await requireIdentity();
  return api<{
    draft: CourseDraft;
    ready: boolean;
    readiness: string;
    extractionReview?: {
      required: boolean;
      acknowledged: boolean;
      acknowledgedAt: string | null;
      reviewRegionCount: number;
      publicationState: string | null;
    };
    sources: Array<{
      documentId: string;
      chunkId: string;
      text: string;
      pageNumber: number | null;
      sectionId?: string;
      extractionMethod?: "text" | "ocr";
      ocrConfidence?: number | null;
      reviewRequired?: boolean;
      extractionWarning?: "ocr_low_confidence" | "ocr_no_text" | null;
    }>;
    activities: Array<{
      activityId: string;
      title: string;
      activityType: string;
    }>;
  }>(`/api/v1/study/learning/studio/${segment(courseId)}`);
}
export async function prepareStudio(
  courseId: string,
  expectedRevisionTag: string,
) {
  await requireIdentity();
  await api(
    `/api/v1/study/courses/${segment(courseId)}/draft/sources/prepare`,
    { method: "POST", body: JSON.stringify({ expectedRevisionTag }) },
  );
  return loadStudio(courseId);
}
export async function uploadStudioSource(courseId: string, form: FormData) {
  await requireIdentity();
  const body = new FormData();
  for (const f of form.getAll("files")) {
    if (!(f instanceof File) || !f.size || f.size > 25 * 1024 * 1024)
      throw new Error("Choose a source up to 25 MB");
    body.append("files", f);
  }
  return api(`/api/v1/study/courses/${segment(courseId)}/files`, {
    method: "POST",
    body,
  });
}
export async function studioIngestStatus(courseId: string) {
  await requireIdentity();
  return api<Record<string, unknown>>(
    `/api/v1/study/courses/${segment(courseId)}/ingest-status`,
  );
}
export async function controlStudioIngestion(
  courseId: string,
  action: "cancel" | "retry" | "reconcile",
  expectedJobId: string,
) {
  await requireIdentity();
  return api(`/api/v1/study/courses/${segment(courseId)}/ingestion/${action}`, {
    method: "POST",
    body: JSON.stringify({ expectedJobId }),
  });
}
