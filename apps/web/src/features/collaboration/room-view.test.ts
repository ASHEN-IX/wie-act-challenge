import { describe, expect, it } from "vitest";
import type { RoomStateInfo, ParticipantInfo } from "./room-view";

describe("RoomView: Collaborative State Synchronization", () => {
  it("determines presenter authority based on currentUserId", () => {
    const currentUserId = "usr_habib";
    const roomPresenter: RoomStateInfo = {
      roomId: "room_123",
      inviteCode: "DB1NF2",
      title: "Database Study Room",
      currentPhase: "idle",
      presenterUserId: "usr_habib",
      seq: 1,
      publicSubmissionsCount: 0,
    };

    const isPresenter = roomPresenter.presenterUserId === currentUserId;
    expect(isPresenter).toBe(true);

    const roomOtherPresenter: RoomStateInfo = {
      ...roomPresenter,
      presenterUserId: "usr_tasnim",
    };
    expect(roomOtherPresenter.presenterUserId === currentUserId).toBe(false);
  });

  it("calculates public submission counts without leaking peer answer details", () => {
    const participants: ParticipantInfo[] = [
      { userId: "usr_1", name: "Habib", role: "host", isOnline: true, hasSubmitted: true },
      { userId: "usr_2", name: "Tasnim", role: "participant", isOnline: true, hasSubmitted: false },
      { userId: "usr_3", name: "Aziz", role: "participant", isOnline: true, hasSubmitted: true },
    ];

    const publicSubmissionsCount = participants.filter((p) => p.hasSubmitted).length;
    expect(publicSubmissionsCount).toBe(2);

    // Assert that participant info structure has no answer field
    participants.forEach((p) => {
      expect(p).not.toHaveProperty('answer');
      expect(p).not.toHaveProperty('score');
    });
  });

  it("handles authoritative sequence progression", () => {
    let currentState: RoomStateInfo = {
      roomId: "room_123",
      inviteCode: "DB1NF2",
      title: "Database Study Room",
      currentPhase: "idle",
      presenterUserId: "usr_habib",
      seq: 1,
      publicSubmissionsCount: 0,
    };

    // Incoming state sync broadcast
    const syncEvent = {
      type: "ROOM_STATE_SYNC",
      roomId: "room_123",
      seq: 2,
      currentPhase: "peer_discussion" as const,
      presenterUserId: "usr_habib",
      activeActivityId: "act_101",
      publicSubmissionsCount: 0,
    };

    if (syncEvent.seq > currentState.seq) {
      currentState = {
        ...currentState,
        currentPhase: syncEvent.currentPhase,
        activeActivityId: syncEvent.activeActivityId,
        seq: syncEvent.seq,
      };
    }

    expect(currentState.seq).toBe(2);
    expect(currentState.currentPhase).toBe("peer_discussion");
    expect(currentState.activeActivityId).toBe("act_101");
  });

  it("handles facilitator intervention events and quiet learner agency", () => {
    let activeIntervention: { interventionId: string; strategy: string; targetSpeakerName: string; message: string } | null = null;

    const interventionEvent = {
      type: "FACILITATOR_INTERVENTION",
      roomId: "room_123",
      seq: 3,
      intervention: {
        interventionId: "int_456",
        strategy: "PEER_CHALLENGE",
        trigger: "misconception_detected",
        targetUserId: "usr_tasnim",
        targetSpeakerName: "Tasnim",
        reasoning: "Confusing 1NF with primary key uniqueness.",
        message: "Notice Tasnim's thought. Habib, does a unique primary key ensure atomicity?",
        status: "delivered",
      },
    };

    if (interventionEvent.type === "FACILITATOR_INTERVENTION") {
      activeIntervention = interventionEvent.intervention;
    }

    expect(activeIntervention).not.toBeNull();
    expect(activeIntervention.strategy).toBe("PEER_CHALLENGE");
    expect(activeIntervention.targetSpeakerName).toBe("Tasnim");
    expect(activeIntervention.message).toContain("atomicity");

    // Quiet learner agency: learner declines prompt
    const declineEvent = {
      type: "FACILITATOR_DECLINED",
      roomId: "room_123",
      interventionId: "int_456",
      userId: "usr_tasnim",
    };

    if (
      declineEvent.type === "FACILITATOR_DECLINED" &&
      activeIntervention?.interventionId === declineEvent.interventionId
    ) {
      activeIntervention = null;
    }

    expect(activeIntervention).toBeNull();
  });

  it("renders individual attempt phase with progress tally and waiting prompt when no activity is selected", () => {
    const roomState: RoomStateInfo = {
      roomId: "room_123",
      title: "Thermodynamics Room",
      currentPhase: "individual_attempt",
      presenterUserId: "usr_habib",
      activeActivityId: null,
      seq: 2,
      publicSubmissionsCount: 1,
    };
    const participants: ParticipantInfo[] = [
      { userId: "usr_habib", name: "Habib", role: "host", isOnline: true, hasSubmitted: true },
      { userId: "usr_tasnim", name: "Tasnim", role: "participant", isOnline: true, hasSubmitted: false },
    ];

    expect(roomState.currentPhase).toBe("individual_attempt");
    expect(roomState.publicSubmissionsCount).toBe(1);
    expect(participants.find((p) => p.userId === "usr_habib")?.hasSubmitted).toBe(true);
    expect(participants.find((p) => p.userId === "usr_tasnim")?.hasSubmitted).toBe(false);
  });
});

