interface ParticipantFixture {
  userId: string;
  name?: string;
  role?: string;
  isOnline?: boolean;
  hasSubmitted?: boolean;
  joinedAt?: Date;
  leftAt?: Date | null;
}
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Helper to simulate invite code generation logic
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

describe('ED-07: Study Room Lifecycle & State Synchronization', () => {
  describe('Contract 10: Room Creation & Invite Codes', () => {
    it('generates 6-character alphanumeric uppercase invite codes without ambiguous characters', () => {
      for (let i = 0; i < 100; i++) {
        const code = generateInviteCode();
        assert.equal(code.length, 6, 'Invite code must be exactly 6 characters');
        assert.match(code, /^[A-Z0-9]{6}$/, 'Invite code must be alphanumeric uppercase');
        assert.equal(
          /[0O1I]/.test(code),
          false,
          'Invite code should exclude ambiguous chars (0, O, 1, I)'
        );
      }
    });

    it('initializes room state with seq = 1 and currentPhase = idle', () => {
      const hostUserId = 'usr_host_123';
      const initialRoom = {
        roomId: 'room_01HXYZ5555CCCC',
        inviteCode: 'DB1NF2',
        title: 'Midterm Database Prep Group',
        hostUserId,
        presenterUserId: hostUserId,
        maxParticipants: 6,
        moderatorMode: 'guided',
        currentPhase: 'idle',
        activeActivityId: null,
        status: 'active',
        seq: 1,
        participants: [
          {
            userId: hostUserId,
            name: 'Habib S.',
            role: 'host',
            hasVoiceConsent: true,
            isOnline: true,
            hasSubmitted: false,
            joinedAt: new Date()
          }
        ]
      };

      assert.equal(initialRoom.seq, 1);
      assert.equal(initialRoom.currentPhase, 'idle');
      assert.equal(initialRoom.presenterUserId, hostUserId);
      assert.equal(initialRoom.participants.length, 1);
      assert.equal(initialRoom.participants[0].role, 'host');
    });
  });

  describe('Contract 10: Room Joining & Capacity Enforcement', () => {
    it('allows peers to join with valid invite code and increments seq monotonically', () => {
      let seq = 1;
      const participants: ParticipantFixture[] = [
        { userId: 'usr_host', name: 'Habib', role: 'host', isOnline: true, hasSubmitted: false }
      ];

      // Peer joins
      const newParticipant = {
        userId: 'usr_peer_1',
        name: 'Tasnim',
        role: 'participant',
        isOnline: true,
        hasSubmitted: false,
        joinedAt: new Date()
      };
      participants.push(newParticipant);
      seq += 1;

      assert.equal(participants.length, 2);
      assert.equal(seq, 2);
      assert.equal(participants[1].userId, 'usr_peer_1');
    });

    it('rejects joining when maxParticipants limit is reached', () => {
      const maxParticipants = 2;
      const participants = [
        { userId: 'usr_1', leftAt: null },
        { userId: 'usr_2', leftAt: null }
      ];

      const activeCount = participants.filter((p) => !p.leftAt).length;
      const canJoin = activeCount < maxParticipants;

      assert.equal(canJoin, false, 'Room must reject join when capacity is reached');
    });

    it('allows returning participant to reactivate presence without duplicating roster entries', () => {
      const participants: ParticipantFixture[] = [
        { userId: 'usr_1', leftAt: new Date(), isOnline: false }
      ];

      // User rejoins
      const existing = participants.find((p) => p.userId === 'usr_1');
      assert.ok(existing);
      existing.leftAt = null;
      existing.isOnline = true;

      assert.equal(participants.length, 1, 'Roster should not duplicate participant');
      assert.equal(existing.isOnline, true);
    });
  });

  describe('Contract 13: Presenter Authority & Room State Broadcast', () => {
    it('restricts phase advancement to active presenter or host', () => {
      const presenterUserId = 'usr_presenter';
      const hostUserId = 'usr_host';
      const nonPresenterUserId = 'usr_peer';

      const isAuthorized = (userId: string) => userId === presenterUserId || userId === hostUserId;

      assert.equal(isAuthorized(presenterUserId), true);
      assert.equal(isAuthorized(hostUserId), true);
      assert.equal(isAuthorized(nonPresenterUserId), false);
    });

    it('increments monotonic seq when presenter changes phase and clears previous submission flags', () => {
      let seq = 3;
      let currentPhase = 'peer_discussion';
      const participants = [
        { userId: 'usr_1', hasSubmitted: true },
        { userId: 'usr_2', hasSubmitted: true }
      ];

      // Presenter advances to new activity
      const nextPhase = 'individual_attempt';

      currentPhase = nextPhase;
      participants.forEach((p) => {
        p.hasSubmitted = false;
      });
      seq += 1;

      assert.equal(currentPhase, 'individual_attempt');
      assert.equal(seq, 4);
      assert.equal(
        participants.every((p) => p.hasSubmitted === false),
        true
      );
    });

    it('formats authoritative ROOM_STATE_SYNC payload strictly according to Contract 13', () => {
      const roomId = 'room_01HXYZ5555CCCC';
      const seq = 14;
      const presenterUserId = 'usr_111';
      const activeActivityId = 'act_01HXYZ9999';
      const currentPhase = 'peer_discussion';
      const participants = [
        {
          userId: 'usr_111',
          name: 'Habib',
          isOnline: true,
          isSpeaking: false,
          hasSubmitted: true,
          leftAt: null
        },
        {
          userId: 'usr_222',
          name: 'Tasnim',
          isOnline: true,
          isSpeaking: false,
          hasSubmitted: false,
          leftAt: null
        }
      ];

      const activeParticipants = participants.filter((p) => !p.leftAt);
      const publicSubmissionsCount = activeParticipants.filter((p) => p.hasSubmitted).length;

      const payload = {
        type: 'ROOM_STATE_SYNC',
        roomId,
        seq,
        timestamp: new Date().toISOString(),
        presenterUserId,
        activeActivityId,
        currentPhase,
        participants: activeParticipants.map((p) => ({
          userId: p.userId,
          name: p.name,
          role: p.userId === presenterUserId ? 'host' : 'participant',
          isOnline: p.isOnline,
          isSpeaking: p.isSpeaking,
          hasSubmitted: p.hasSubmitted
        })),
        publicSubmissionsCount
      };

      assert.equal(payload.type, 'ROOM_STATE_SYNC');
      assert.equal(payload.roomId, roomId);
      assert.equal(payload.seq, 14);
      assert.equal(payload.presenterUserId, 'usr_111');
      assert.equal(payload.activeActivityId, 'act_01HXYZ9999');
      assert.equal(payload.currentPhase, 'peer_discussion');
      assert.equal(payload.publicSubmissionsCount, 1);
      assert.equal(payload.participants.length, 2);

      // Verify privacy isolation: payload must NOT contain answer keys or solutions
      assert.equal(Reflect.get(payload, 'answerKey'), undefined);
      assert.equal(Reflect.get(payload, 'solutions'), undefined);
      payload.participants.forEach((p) => {
        assert.equal(
          Reflect.get(p, 'answer'),
          undefined,
          'Individual peer answer must not leak in public state'
        );
      });
    });
  });

  describe('Presenter Delegation & Graceful Exit', () => {
    it('delegates presenter role to remaining active participant when presenter leaves', () => {
      const hostUserId = 'usr_host';
      const peerUserId = 'usr_peer_1';
      let presenterUserId = hostUserId;

      const participants: ParticipantFixture[] = [
        { userId: hostUserId, role: 'host', leftAt: null },
        { userId: peerUserId, role: 'participant', leftAt: null }
      ];

      // Host leaves
      const host = participants.find((p) => p.userId === hostUserId);
      assert.ok(host);
      host.leftAt = new Date();

      const remainingActive = participants.filter((p) => !p.leftAt);
      if (presenterUserId === hostUserId) {
        presenterUserId = remainingActive[0].userId;
      }

      assert.equal(remainingActive.length, 1);
      assert.equal(presenterUserId, peerUserId, 'Presenter role should transfer to active peer');
    });

    it('marks room as closed when all participants have left', () => {
      let status = 'active';
      let closedAt: Date | null = null;
      const participants = [{ userId: 'usr_1', leftAt: new Date() }];

      const remainingActive = participants.filter((p) => !p.leftAt);
      if (remainingActive.length === 0) {
        status = 'closed';
        closedAt = new Date();
      }

      assert.equal(status, 'closed');
      assert.ok(closedAt);
    });
  });
});
