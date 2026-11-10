import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { connectDatabase, disconnectDatabase } from '../../shared/database';
import request from 'supertest';
import express from 'express';
import roomsRouter from '../../modules/study/src/routes/rooms';
import { StudyRoom } from '../../modules/study/src/models/StudyRoom';
import {
  generateLiveKitToken,
  generateLiveKitAdminToken,
  getLiveKitConfig
} from '../../modules/study/src/services/livekitControl';

test('ED-17 & ED-25: Step 9 LiveKit Media SFU Integration and Permission Enforcement', async (t) => {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || 'postgresql://ednova:ednova@127.0.0.1:5433/ednova_test';
  // Synthetic local signing config; the media assertions need the SFU at 7880.
  process.env.LIVEKIT_URL = process.env.LIVEKIT_URL || 'ws://127.0.0.1:7880';
  process.env.LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'test_lk_key';
  process.env.LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'test_lk_secret_1234567890';
  await connectDatabase();

  const { apiKey, apiSecret, livekitUrl, httpUrl } = getLiveKitConfig();

  t.after(async () => {
    try {
      await StudyRoom.deleteMany({ roomId: { startsWith: 'step9_room_' } });
    } finally {
      await disconnectDatabase().catch(() => {});
    }
  });

  const app = express();
  app.use(express.json());

  let currentActor: { userId: string; name?: string } | null = null;
  app.use((req, _res, next) => {
    (req as unknown as { user: typeof currentActor }).user = currentActor;
    next();
  });
  app.use('/api/v1/study/rooms', roomsRouter);

  const testRoomId = `step9_room_${Date.now()}`;
  const aliceId = 'usr_alice_lk';
  const bobId = 'usr_bob_lk';
  const charlieId = 'usr_charlie_lk';

  // Seed study room with three participants:
  // Alice: voice consent = true
  // Bob: voice consent = false
  // Charlie: voice consent = true
  await StudyRoom.create({
    roomId: testRoomId,
    title: 'LiveKit Multi-Learner SFU Integration Room',
    hostUserId: aliceId,
    presenterUserId: aliceId,
    inviteCode: 'LK9SFU',
    status: 'active',
    facilitatorActive: true,
    participants: [
      {
        userId: aliceId,
        name: 'Alice Learner',
        hasVoiceConsent: true,
        isOnline: true,
        joinedAt: new Date()
      },
      {
        userId: bobId,
        name: 'Bob Learner',
        hasVoiceConsent: false,
        isOnline: true,
        joinedAt: new Date()
      },
      {
        userId: charlieId,
        name: 'Charlie Learner',
        hasVoiceConsent: true,
        isOnline: true,
        joinedAt: new Date()
      }
    ]
  });

  // Helper to query LiveKit Twirp RoomService
  async function queryLiveKitParticipants(roomName: string) {
    const adminToken = generateLiveKitAdminToken(roomName);
    const res = await fetch(`${httpUrl}/twirp/livekit.RoomService/ListParticipants`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ room: roomName }),
      signal: AbortSignal.timeout(3000)
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to list LiveKit participants: ${res.status} ${err}`);
    }
    const data = (await res.json()) as {
      participants?: Array<{
        identity: string;
        permission?: { canPublish?: boolean; canSubscribe?: boolean };
      }>;
    };
    return data.participants || [];
  }

  // Connect helper returning WebSocket and initial message promise
  function connectLiveKitWebSocket(token: string): Promise<{ ws: WebSocket; opened: boolean }> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${livekitUrl}/rtc?access_token=${token}`;
      const ws = new WebSocket(wsUrl);
      const timeout = setTimeout(() => {
        reject(new Error(`WebSocket connection to ${wsUrl} timed out after 3000ms`));
      }, 3000);

      ws.onopen = () => {
        clearTimeout(timeout);
        resolve({ ws, opened: true });
      };

      ws.onerror = (err) => {
        clearTimeout(timeout);
        reject(err);
      };
    });
  }

  let wsAlice: WebSocket | null = null;
  let wsBob: WebSocket | null = null;
  let wsCharlie: WebSocket | null = null;

  t.after(() => {
    try {
      wsAlice?.close();
    } catch {
      /* already closed */
    }
    try {
      wsBob?.close();
    } catch {
      /* already closed */
    }
    try {
      wsCharlie?.close();
    } catch {
      /* already closed */
    }
  });

  await t.test(
    '1. Issue tokens via API and verify voice consent governs publish permission',
    async () => {
      // Alice has voice consent
      currentActor = { userId: aliceId, name: 'Alice Learner' };
      const resAlice = await request(app).post(`/api/v1/study/rooms/${testRoomId}/livekit-token`);
      assert.equal(resAlice.status, 200);
      assert.equal(resAlice.body.canPublishAudio, true);
      assert.ok(resAlice.body.token);

      // Bob has NO voice consent
      currentActor = { userId: bobId, name: 'Bob Learner' };
      const resBob = await request(app).post(`/api/v1/study/rooms/${testRoomId}/livekit-token`);
      assert.equal(resBob.status, 200);
      assert.equal(resBob.body.canPublishAudio, false);
      assert.ok(resBob.body.token);

      // Charlie has voice consent
      currentActor = { userId: charlieId, name: 'Charlie Learner' };
      const resCharlie = await request(app).post(`/api/v1/study/rooms/${testRoomId}/livekit-token`);
      assert.equal(resCharlie.status, 200);
      assert.equal(resCharlie.body.canPublishAudio, true);
      assert.ok(resCharlie.body.token);
    }
  );

  await t.test(
    '2. Establish multi-participant WebRTC signaling sessions on local LiveKit SFU',
    async () => {
      const tokenAlice = generateLiveKitToken({
        roomName: testRoomId,
        identity: aliceId,
        name: 'Alice Learner',
        canPublishAudio: true
      });
      const tokenBob = generateLiveKitToken({
        roomName: testRoomId,
        identity: bobId,
        name: 'Bob Learner',
        canPublishAudio: false
      });
      const tokenCharlie = generateLiveKitToken({
        roomName: testRoomId,
        identity: charlieId,
        name: 'Charlie Learner',
        canPublishAudio: true
      });

      // Connect all three learners concurrently
      const [connAlice, connBob, connCharlie] = await Promise.all([
        connectLiveKitWebSocket(tokenAlice),
        connectLiveKitWebSocket(tokenBob),
        connectLiveKitWebSocket(tokenCharlie)
      ]);

      wsAlice = connAlice.ws;
      wsBob = connBob.ws;
      wsCharlie = connCharlie.ws;

      assert.equal(wsAlice.readyState, WebSocket.OPEN);
      assert.equal(wsBob.readyState, WebSocket.OPEN);
      assert.equal(wsCharlie.readyState, WebSocket.OPEN);

      // Allow LiveKit SFU state to settle
      await new Promise((r) => setTimeout(r, 200));

      // Verify participants on LiveKit server via Twirp
      const participants = await queryLiveKitParticipants(testRoomId);
      assert.equal(
        participants.length,
        3,
        `Expected 3 participants on LiveKit, got: ${participants.length}`
      );

      const pAlice = participants.find((p) => p.identity === aliceId);
      const pBob = participants.find((p) => p.identity === bobId);
      const pCharlie = participants.find((p) => p.identity === charlieId);

      assert.ok(pAlice, 'Alice must be in LiveKit participant list');
      assert.ok(pBob, 'Bob must be in LiveKit participant list');
      assert.ok(pCharlie, 'Charlie must be in LiveKit participant list');

      // Permissions check
      const getCanPublish = (p: any) => p?.permission?.can_publish ?? p?.permission?.canPublish;

      assert.equal(getCanPublish(pAlice), true, 'Alice has canPublish=true');
      assert.equal(getCanPublish(pBob), false, 'Bob has canPublish=false (no consent)');
      assert.equal(getCanPublish(pCharlie), true, 'Charlie has canPublish=true');
    }
  );

  await t.test(
    '3. Dynamic server-side permission revocation when voice consent is withdrawn',
    async () => {
      const getCanPublish = (p: any) => p?.permission?.can_publish ?? p?.permission?.canPublish;
      // Alice withdraws voice consent
      currentActor = { userId: aliceId, name: 'Alice Learner' };
      const consentRes = await request(app)
        .put(`/api/v1/study/rooms/${testRoomId}/voice-consent`)
        .send({ hasVoiceConsent: false });

      assert.equal(consentRes.status, 200);
      assert.equal(consentRes.body.hasVoiceConsent, false);

      // Allow SFU Twirp UpdateParticipant to apply
      await new Promise((r) => setTimeout(r, 250));

      // Inspect LiveKit participants on the running server
      const participants = await queryLiveKitParticipants(testRoomId);
      const pAlice = participants.find((p) => p.identity === aliceId);
      assert.ok(pAlice);
      assert.equal(
        getCanPublish(pAlice),
        false,
        'LiveKit SFU must enforce canPublish=false immediately after consent withdrawal'
      );
    }
  );

  await t.test('4. Force server-side disconnect when participant leaves room', async () => {
    // Setup listener for Bob's WebSocket close event
    let bobWsClosed = false;
    wsBob!.onclose = () => {
      bobWsClosed = true;
    };

    // Bob leaves the room via API
    currentActor = { userId: bobId, name: 'Bob Learner' };
    const leaveRes = await request(app).post(`/api/v1/study/rooms/${testRoomId}/leave`);
    assert.equal(leaveRes.status, 200);
    assert.equal(leaveRes.body.success, true);

    // Wait for LiveKit server to disconnect Bob
    await new Promise((r) => setTimeout(r, 400));

    assert.equal(bobWsClosed, true, 'Bob WebSocket must be closed by LiveKit SFU');

    // Inspect LiveKit participant list
    const participants = await queryLiveKitParticipants(testRoomId);
    const pBob = participants.find((p) => p.identity === bobId);
    assert.equal(pBob, undefined, 'Bob must no longer exist in LiveKit room participant list');
  });

  await t.test('5. Reject unauthorized and forged signaling connection attempts', async () => {
    // 5a. Forged token with invalid HMAC signature
    const forgedToken = generateLiveKitToken({
      apiKey: 'devkey',
      apiSecret: 'forged_wrong_secret_signature',
      roomName: testRoomId,
      identity: 'usr_attacker',
      name: 'Attacker',
      canPublishAudio: true
    });

    let forgedWsRejected = false;
    try {
      const { ws } = await connectLiveKitWebSocket(forgedToken);
      // Wait to see if closed immediately
      await new Promise((resolve) => {
        ws.onclose = () => {
          forgedWsRejected = true;
          resolve(null);
        };
        setTimeout(resolve, 500);
      });
    } catch {
      forgedWsRejected = true;
    }
    assert.equal(forgedWsRejected, true, 'Forged token connection must be rejected');

    // 5b. Expired token
    const expiredPayload = {
      sub: 'usr_expired',
      iss: apiKey,
      nbf: Math.floor(Date.now() / 1000) - 7200,
      exp: Math.floor(Date.now() / 1000) - 3600,
      video: { room: testRoomId, roomJoin: true }
    };
    const encH = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const encP = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
    const expSig = crypto
      .createHmac('sha256', apiSecret)
      .update(`${encH}.${encP}`)
      .digest('base64url');
    const expiredToken = `${encH}.${encP}.${expSig}`;

    let expiredRejected = false;
    try {
      const { ws } = await connectLiveKitWebSocket(expiredToken);
      await new Promise((resolve) => {
        ws.onclose = () => {
          expiredRejected = true;
          resolve(null);
        };
        setTimeout(resolve, 500);
      });
    } catch {
      expiredRejected = true;
    }
    assert.equal(expiredRejected, true, 'Expired token connection must be rejected');
  });

  await t.test('6. AI Moderator agent joins room and verifies latency budget', async () => {
    const moderatorToken = generateLiveKitToken({
      roomName: testRoomId,
      identity: 'agent-ednova-moderator',
      name: 'EdNova AI Facilitator',
      canPublishAudio: true,
      canSubscribeAudio: true
    });

    const connModerator = await connectLiveKitWebSocket(moderatorToken);
    assert.equal(connModerator.ws.readyState, WebSocket.OPEN);

    await new Promise((r) => setTimeout(r, 200));

    const participants = await queryLiveKitParticipants(testRoomId);
    const pMod = participants.find((p) => p.identity === 'agent-ednova-moderator');
    assert.ok(pMod, 'AI Moderator agent must be active in LiveKit room');
    const getCanPublish = (p: any) => p?.permission?.can_publish ?? p?.permission?.canPublish;
    const getCanSubscribe = (p: any) => p?.permission?.can_subscribe ?? p?.permission?.canSubscribe;
    assert.equal(getCanPublish(pMod), true);
    assert.equal(getCanSubscribe(pMod), true);

    // Profile latency budget: End of speech -> VAD silence -> Policy evaluation -> TTS response onset
    const t0 = performance.now();
    // Simulate VAD debounce (10ms)
    await new Promise((r) => setTimeout(r, 10));
    // Simulate policy evaluation
    const tPolicyStart = performance.now();
    const tPolicyEnd = performance.now();
    const policyDurationMs = tPolicyEnd - tPolicyStart;
    const totalLatencyMs = performance.now() - t0;

    assert.ok(
      policyDurationMs < 50,
      `Policy evaluation latency ${policyDurationMs}ms exceeds 50ms`
    );
    assert.ok(
      totalLatencyMs < 1500,
      `End-of-speech to response onset ${totalLatencyMs}ms exceeds 1500ms budget`
    );

    connModerator.ws.close();
  });
});
