"use server";
import { unstable_rethrow } from "next/navigation";
import { api, segment, ApiError } from "@/lib/api";
import { requireIdentity } from "@/server/identity";
import {
  decodeActivityDefinition,
  decodePrivateAssessmentResult,
  type ActivityDefinition,
} from "@/lib/activity-contracts";
import type { Contract } from "@ednova/shared/ednova/contracts";
export type PrivateRoomCheck = {
  status: string;
  message?: string;
  checkId?: string;
  recipientUserId?: string;
  attemptId?: string;
  activity?: ActivityDefinition;
  result?: Contract<"AssessmentResult"> | null;
};
export async function ownPrivateCheck(roomId: string) {
  const identity = await requireIdentity();
  const data = await api<PrivateRoomCheck>(
    `/api/v1/study/learning/rooms/${segment(roomId)}/check`,
  );
  if (data.recipientUserId && data.recipientUserId !== identity.userId)
    throw new Error("Private recipient mismatch");
  return {
    ...data,
    activity: data.activity
      ? decodeActivityDefinition(data.activity)
      : undefined,
    result: data.result
      ? decodePrivateAssessmentResult(data.result, identity.userId)
      : null,
  };
}
export async function submitPrivateCheck(
  roomId: string,
  checkId: string,
  answers: Record<string, unknown>,
  timeSpentSeconds: number,
) {
  const identity = await requireIdentity();
  const data = await api(
    `/api/v1/study/learning/rooms/${segment(roomId)}/checks/${segment(checkId)}`,
    { method: "POST", body: JSON.stringify({ answers, timeSpentSeconds }) },
  );
  return decodePrivateAssessmentResult(data, identity.userId);
}
export async function roomDebrief(roomId: string) {
  await requireIdentity();
  return api<{
    recap: {
      participantsCount: number;
      publicSubmissionsCount: number;
      privacyPolicy: string;
    };
    privateCheck: PrivateRoomCheck;
  }>(`/api/v1/study/learning/rooms/${segment(roomId)}/debrief`);
}
export async function selectRoomActivity(
  roomId: string,
  activityId: string,
  commandId: string,
  expectedSeq: number,
) {
  await requireIdentity();
  try {
    const data = await api(`/api/v1/study/rooms/${segment(roomId)}/phase`, {
      method: "PUT",
      body: JSON.stringify({
        commandId,
        expectedSeq,
        currentPhase: "individual_attempt",
        activeActivityId: activityId,
      }),
    });
    return { data };
  } catch (error) {
    unstable_rethrow(error);
    return {
      error: error instanceof Error ? error.message : "Selection unavailable",
      retryable: error instanceof ApiError && error.status >= 500,
    };
  }
}
export async function proposeSupport(roomId: string) {
  await requireIdentity();
  return api<{
    proposalId: string;
    message: string;
    executionMode: string;
    expectedSeq: number;
  }>(`/api/v1/study/learning/rooms/${segment(roomId)}/proposals`, {
    method: "POST",
    body: "{}",
  });
}
export async function decideSupport(
  roomId: string,
  proposalId: string,
  decision: "accept" | "decline",
) {
  await requireIdentity();
  return api(
    `/api/v1/study/learning/rooms/${segment(roomId)}/proposals/${segment(proposalId)}/decision`,
    { method: "POST", body: JSON.stringify({ decision }) },
  );
}
