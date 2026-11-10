import { describe, expect, it } from "vitest";
import {
  applyInterventionSeq,
  applyRoomSnapshot,
  type RoomSnapshotState,
} from "./room-sync";

const previous: RoomSnapshotState = {
  room: {
    roomId: "room_one",
    title: "Synthetic",
    currentPhase: "idle",
    presenterUserId: "host",
    activeActivityId: "old_activity",
    seq: 5,
    publicSubmissionsCount: 0,
  },
  participants: [
    {
      userId: "host",
      name: "Host",
      role: "host",
      isOnline: true,
      hasSubmitted: false,
    },
  ],
};
const snapshot = {
  type: "ROOM_STATE_SYNC",
  roomId: "room_one",
  seq: 6,
  currentPhase: "peer_discussion",
  presenterUserId: "peer",
  activeActivityId: null,
  publicSubmissionsCount: 1,
  participants: [
    {
      userId: "peer",
      name: "Peer",
      role: "participant",
      isOnline: true,
      hasSubmitted: true,
    },
  ],
};

describe("actual room snapshot reconciliation", () => {
  it("rejects stale and duplicate room AND roster together", () => {
    for (const seq of [4, 5])
      expect(applyRoomSnapshot(previous, { ...snapshot, seq })).toBe(previous);
  });
  it("replaces all shared state and clears a null activity reference", () => {
    const next = applyRoomSnapshot(previous, snapshot);
    expect(next.room.activeActivityId).toBeNull();
    expect(next.room.presenterUserId).toBe("peer");
    expect(next.participants.map((p) => p.userId)).toEqual(["peer"]);
    expect(next.room.publicSubmissionsCount).toBe(1);
    expect(applyRoomSnapshot(next, snapshot)).toBe(next);
  });
  it("recovers missed versions from a complete reconnect snapshot", () => {
    const recovered = applyRoomSnapshot(previous, { ...snapshot, seq: 100 });
    expect(recovered.room.seq).toBe(100);
    expect(recovered.participants[0].userId).toBe("peer");
  });
  it("ignores foreign rooms, partial or malformed snapshots without partial writes", () => {
    for (const invalid of [
      null,
      { ...snapshot, roomId: "room_other" },
      { ...snapshot, seq: 6.2 },
      { ...snapshot, participants: null },
      { ...snapshot, currentPhase: "invented" },
      { ...snapshot, publicSubmissionsCount: -1 },
      { ...snapshot, publicSubmissionsCount: 3 },
      { ...snapshot, participants: [{ userId: "peer" }] },
    ]) {
      expect(applyRoomSnapshot(previous, invalid)).toBe(previous);
    }
  });
  it("projects only public participant fields", () => {
    const next = applyRoomSnapshot(previous, {
      ...snapshot,
      participants: [
        {
          ...snapshot.participants[0],
          answer: "private",
          score: 1,
          cookie: "secret",
        },
      ],
    });
    expect(next.participants[0]).not.toHaveProperty("answer");
    expect(next.participants[0]).not.toHaveProperty("score");
    expect(next.participants[0]).not.toHaveProperty("cookie");
  });
});

describe("ephemeral presence independent of durable sequence", () => {
  const presence = {
    type: "ROOM_PRESENCE_SYNC",
    roomId: "room_one",
    presenceEpoch: "server-one",
    presenceVersion: 1,
    onlineUserIds: [],
  };
  it("updates availability without changing durable room state or membership", () => {
    const next = applyRoomSnapshot(previous, presence);
    expect(next.room).toBe(previous.room);
    expect(next.participants[0].isOnline).toBe(false);
    expect(next.participants[0].userId).toBe("host");
    expect(applyRoomSnapshot(next, presence)).toBe(next);
  });
  it("rejects stale, malformed and obsolete-server presence", () => {
    const next = applyRoomSnapshot(previous, presence);
    for (const invalid of [
      { ...presence, presenceVersion: 0 },
      { ...presence, presenceVersion: 0.5 },
      { ...presence, presenceVersion: 2, onlineUserIds: [12] },
      { ...presence, presenceVersion: 2, presenceEpoch: "obsolete-server" },
      { ...presence, roomId: "another-room" },
    ])
      expect(applyRoomSnapshot(next, invalid)).toBe(next);
  });
  it("reconciles presence from an equal-sequence reconnect snapshot without replacing durable state", () => {
    const next = applyRoomSnapshot(previous, {
      ...snapshot,
      ...presence,
      type: "ROOM_STATE_SYNC",
      seq: 5,
    });
    expect(next.room).toBe(previous.room);
    expect(next.participants[0].isOnline).toBe(false);
  });
  it("preserves newer presence when a durable snapshot carries an older ephemeral version", () => {
    const next = applyRoomSnapshot(previous, {
      ...presence,
      presenceVersion: 10,
      onlineUserIds: ["host"],
    });
    const changed = applyRoomSnapshot(next, {
      ...snapshot,
      ...presence,
      type: "ROOM_STATE_SYNC",
    });
    expect(changed.room.seq).toBe(6);
    expect(changed.presenceVersion).toBe(10);
    expect(changed.participants[0].isOnline).toBe(false);
  });
  it("accepts a new server epoch only after the socket-open recovery reset", () => {
    const old = applyRoomSnapshot(previous, presence);
    const reset = {
      ...old,
      presenceEpoch: undefined,
      presenceVersion: undefined,
    };
    expect(
      applyRoomSnapshot(reset, {
        ...presence,
        presenceEpoch: "new-server",
        onlineUserIds: ["host"],
      }).participants[0].isOnline,
    ).toBe(true);
  });
});

describe("facilitator intervention sequence", () => {
  it("follows an intervention that is exactly the next room sequence", () => {
    const next = applyInterventionSeq(previous, { roomId: "room_one", seq: 6 });
    expect(next.room.seq).toBe(6);
    expect(next.room.currentPhase).toBe(previous.room.currentPhase);
  });

  it("ignores gaps, repeats and foreign rooms so missed changes come from a full sync", () => {
    expect(applyInterventionSeq(previous, { roomId: "room_one", seq: 8 })).toBe(previous);
    expect(applyInterventionSeq(previous, { roomId: "room_one", seq: 5 })).toBe(previous);
    expect(applyInterventionSeq(previous, { roomId: "room_two", seq: 6 })).toBe(previous);
    expect(applyInterventionSeq(previous, { roomId: "room_one", seq: "6" })).toBe(previous);
  });
});
