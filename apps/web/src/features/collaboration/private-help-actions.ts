"use server";
import { api, segment } from "@/lib/api";
import { requireIdentity } from "@/server/identity";
export interface PrivateHelpItem {
  requestId: string;
  question: string;
  status: string;
  visibility: string;
  response: {
    answer?: string;
    executionMode?: string;
    citations?: Array<{ documentId: string; pageNumber?: number | null }>;
  } | null;
}
export async function loadPrivateHelp(roomId: string) {
  await requireIdentity();
  return api<{ history: PrivateHelpItem[] }>(
    `/api/v1/study/private-help/${segment(roomId)}`,
  );
}
export async function sendPrivateHelp(
  roomId: string,
  requestId: string,
  question: string,
) {
  await requireIdentity();
  return api<PrivateHelpItem>(`/api/v1/study/private-help/${segment(roomId)}`, {
    method: "POST",
    body: JSON.stringify({ requestId, question }),
  });
}
