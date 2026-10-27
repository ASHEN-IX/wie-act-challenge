"use server";
import { api, segment } from "@/lib/api";
import { requireIdentity } from "@/server/identity";
import {
  parseBinarySearchState,
  type BinarySearchState,
} from "@study-partner/shared/visualization";

export async function loadRoomVisualization(roomId: string) {
  await requireIdentity();
  const response = await api<{ roomId: string; seq: number; state: unknown }>(
    `/api/v1/study/rooms/${segment(roomId)}/visualization`,
  );
  return {
    roomId: response.roomId,
    seq: response.seq,
    state: parseBinarySearchState(response.state),
  };
}
export async function updateRoomVisualization(
  roomId: string,
  state: BinarySearchState,
  commandId: string,
  expectedSeq: number,
) {
  await requireIdentity();
  const validated = parseBinarySearchState(state);
  await api(`/api/v1/study/rooms/${segment(roomId)}/visualization`, {
    method: "PUT",
    body: JSON.stringify({ commandId, expectedSeq, ...validated }),
  });
  return loadRoomVisualization(roomId);
}
