"use server";
import { unstable_rethrow } from "next/navigation";
import { api, segment, ApiError } from "@/lib/api";
import { requireIdentity } from "@/server/identity";

export interface BoardElementPayload {
  id: string;
  type: string;
  version: number;
  versionNonce: number;
  isDeleted?: boolean;
  [key: string]: unknown;
}

export interface BoardState {
  version: number;
  locked: boolean;
  canEdit: boolean;
  isHost: boolean;
  elements: BoardElementPayload[];
}

export type BoardResult = { board: BoardState } | { error: string; status?: number };

function failure(error: unknown): { error: string; status?: number } {
  unstable_rethrow(error);
  if (error instanceof ApiError) return { error: error.message, status: error.status };
  return { error: "The whiteboard is unavailable right now." };
}

/** Authorization lives in the room API; this only forwards the caller's session. */
export async function fetchWhiteboard(roomId: string): Promise<BoardResult> {
  await requireIdentity();
  try {
    return { board: await api<BoardState>(`/api/v1/study/rooms/${segment(roomId)}/whiteboard`) };
  } catch (error) {
    return failure(error);
  }
}

export async function saveWhiteboard(
  roomId: string,
  elements: BoardElementPayload[],
): Promise<BoardResult> {
  await requireIdentity();
  try {
    return {
      board: await api<BoardState>(`/api/v1/study/rooms/${segment(roomId)}/whiteboard`, {
        method: "PUT",
        body: JSON.stringify({ elements }),
      }),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function lockWhiteboard(roomId: string, locked: boolean): Promise<BoardResult> {
  await requireIdentity();
  try {
    return {
      board: await api<BoardState>(`/api/v1/study/rooms/${segment(roomId)}/whiteboard`, {
        method: "PUT",
        body: JSON.stringify({ locked }),
      }),
    };
  } catch (error) {
    return failure(error);
  }
}
