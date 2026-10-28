import type { ParticipantInfo, RoomStateInfo } from "./room-view";

export interface RoomSnapshotState {
  room: RoomStateInfo;
  participants: ParticipantInfo[];
  presenceEpoch?: string;
  presenceVersion?: number;
}

function applyPresence(
  previous: RoomSnapshotState,
  event: Record<string, unknown>,
): RoomSnapshotState {
  if (
    typeof event.presenceEpoch !== "string" ||
    !event.presenceEpoch ||
    !Number.isSafeInteger(event.presenceVersion) ||
    (event.presenceVersion as number) < 1 ||
    (previous.presenceEpoch !== undefined &&
      previous.presenceEpoch !== event.presenceEpoch) ||
    (event.presenceVersion as number) <= (previous.presenceVersion ?? 0) ||
    !Array.isArray(event.onlineUserIds) ||
    !event.onlineUserIds.every((id) => typeof id === "string") ||
    event.onlineUserIds.length > 10
  )
    return previous;
  return {
    ...previous,
    presenceEpoch: event.presenceEpoch,
    presenceVersion: event.presenceVersion as number,
    participants: previous.participants.map((p) => ({
      ...p,
      isOnline: (event.onlineUserIds as string[]).includes(p.userId),
    })),
  };
}

/** ROOM_STATE_SYNC is a complete authoritative snapshot, including on reconnect.
 * Apply its room and roster together; a jump in sequence needs no delta replay.
 */
export function applyRoomSnapshot(
  previous: RoomSnapshotState,
  input: unknown,
): RoomSnapshotState {
  if (!input || typeof input !== "object") return previous;
  const event = input as Record<string, unknown>;
  if (event.roomId !== previous.room.roomId) return previous;
  if (event.type === "ROOM_PRESENCE_SYNC")
    return applyPresence(previous, event);
  if (
    event.type !== "ROOM_STATE_SYNC" ||
    event.roomId !== previous.room.roomId ||
    !Number.isSafeInteger(event.seq) ||
    (event.seq as number) < previous.room.seq ||
    !["idle", "peer_discussion", "individual_attempt", "debrief"].includes(
      String(event.currentPhase),
    ) ||
    typeof event.presenterUserId !== "string" ||
    !(
      event.activeActivityId === null ||
      typeof event.activeActivityId === "string"
    ) ||
    !Array.isArray(event.participants) ||
    event.participants.length > 10 ||
    !Number.isSafeInteger(event.publicSubmissionsCount) ||
    (event.publicSubmissionsCount as number) < 0 ||
    (event.publicSubmissionsCount as number) > event.participants.length
  )
    return previous;

  const participants: ParticipantInfo[] = [];
  for (const value of event.participants) {
    if (
      !value ||
      typeof value !== "object" ||
      typeof value.userId !== "string" ||
      typeof value.name !== "string" ||
      typeof value.role !== "string" ||
      typeof value.isOnline !== "boolean" ||
      typeof value.hasSubmitted !== "boolean"
    )
      return previous;
    participants.push({
      userId: value.userId,
      name: value.name,
      role: value.role,
      isOnline: value.isOnline,
      isSpeaking: value.isSpeaking === true,
      hasSubmitted: value.hasSubmitted,
    });
  }
  if (event.seq === previous.room.seq) return applyPresence(previous, event);
  const next: RoomSnapshotState = {
    ...previous,
    room: {
      ...previous.room,
      seq: event.seq as number,
      currentPhase: event.currentPhase as RoomStateInfo["currentPhase"],
      presenterUserId: event.presenterUserId,
      activeActivityId: event.activeActivityId as string | null,
      publicSubmissionsCount: event.publicSubmissionsCount as number,
      courseId: typeof event.courseId === "string" ? event.courseId : undefined,
      revisionId:
        typeof event.revisionId === "string" ? event.revisionId : undefined,
      activityRound:
        typeof event.activityRound === "string"
          ? event.activityRound
          : undefined,
      activePin: event.activePin as RoomStateInfo["activePin"],
    },
    participants:
      event.presenceEpoch === undefined
        ? participants
        : participants.map((p) => ({
            ...p,
            isOnline:
              previous.participants.find((old) => old.userId === p.userId)
                ?.isOnline ?? false,
          })),
  };
  return applyPresence(next, event);
}
