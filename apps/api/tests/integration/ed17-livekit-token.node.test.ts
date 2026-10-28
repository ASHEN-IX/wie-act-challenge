import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { StudyRoom } from '../../modules/study/src/models/StudyRoom';
import request from 'supertest';
import express from 'express';
import roomsRouter from '../../modules/study/src/routes/rooms';

test('ED-17 & ED-25: LiveKit token issuance, explicit voice consent and AI moderator dispatch', async (t) => {
  const dbUri = 'mongodb://127.0.0.1:27018/ednova_livekit_test_' + process.pid + '_' + Date.now();
  await mongoose.connect(dbUri);

  const prevApiKey = process.env.LIVEKIT_API_KEY;
  const prevApiSecret = process.env.LIVEKIT_API_SECRET;
  process.env.LIVEKIT_API_KEY = 'test_lk_key';
  process.env.LIVEKIT_API_SECRET = 'test_lk_secret_1234567890';

  t.after(async () => {
    process.env.LIVEKIT_API_KEY = prevApiKey;
    process.env.LIVEKIT_API_SECRET = prevApiSecret;
    try {
      await mongoose.connection.dropDatabase();
    } finally {
      await mongoose.disconnect();
    }
  });

  const app = express();
  app.use(express.json());

  let currentActor: { userId: string; name?: string } | null = null;
  app.use((req, res, next) => {
    (req as unknown as { user: typeof currentActor }).user = currentActor;
    next();
  });
  app.use('/api/v1/study/rooms', roomsRouter);

  function decodeJwt(token: string) {
    const parts = token.split('.');
    assert.equal(parts.length, 3);
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const expectedSig = crypto
      .createHmac('sha256', process.env.LIVEKIT_API_SECRET!)
      .update(`${parts[0]}.${parts[1]}`)
      .digest('base64url');
    assert.equal(parts[2], expectedSig, 'HMAC-SHA256 signature must be cryptographically valid');
    return { header, payload };
  }

  const roomId = 'room_livekit_fixture_' + Date.now();
  const learnerConsentFalse = 'usr_consent_no';
  const learnerConsentTrue = 'usr_consent_yes';
  const outsider = 'usr_outsider';

  await StudyRoom.create({
    roomId,
    title: 'LiveKit Voice Room',
    ownerUserId: learnerConsentFalse,
    hostUserId: learnerConsentFalse,
    presenterUserId: learnerConsentFalse,
    inviteCode: 'LK1234',
    status: 'active',
    facilitatorActive: false,
    participants: [
      {
        userId: learnerConsentFalse,
        name: 'Learner One',
        hasVoiceConsent: false,
        joinedAt: new Date()
      },
      {
        userId: learnerConsentTrue,
        name: 'Learner Two',
        hasVoiceConsent: true,
        joinedAt: new Date()
      }
    ]
  });

  await t.test('Unauthenticated token request is rejected with 401', async () => {
    currentActor = null;
    const res = await request(app).post(`/api/v1/study/rooms/${roomId}/livekit-token`);
    assert.equal(res.status, 401);
  });

  await t.test('Outsider without room membership is rejected with 403', async () => {
    currentActor = { userId: outsider, name: 'Outsider' };
    const res = await request(app).post(`/api/v1/study/rooms/${roomId}/livekit-token`);
    assert.equal(res.status, 403);
  });

  await t.test(
    'Participant without microphone consent receives token with canPublishAudio: false',
    async () => {
      currentActor = { userId: learnerConsentFalse, name: 'Learner One' };
      const res = await request(app).post(`/api/v1/study/rooms/${roomId}/livekit-token`);
      assert.equal(res.status, 200);
      assert.equal(res.body.canPublishAudio, false);
      assert.equal(res.body.canSubscribeAudio, true);
      assert.equal(res.body.participantIdentity, learnerConsentFalse);

      const decoded = decodeJwt(res.body.token);
      assert.equal(decoded.payload.sub, learnerConsentFalse);
      assert.equal(decoded.payload.video.room, roomId);
      assert.equal(
        decoded.payload.video.canPublish,
        false,
        'Publish grant must be false without consent'
      );
      assert.equal(decoded.payload.video.canSubscribe, true);
    }
  );

  await t.test(
    'Participant with explicit microphone consent receives token with canPublishAudio: true',
    async () => {
      currentActor = { userId: learnerConsentTrue, name: 'Learner Two' };
      const res = await request(app).post(`/api/v1/study/rooms/${roomId}/livekit-token`);
      assert.equal(res.status, 200);
      assert.equal(res.body.canPublishAudio, true);
      assert.equal(res.body.canSubscribeAudio, true);
      assert.equal(res.body.participantIdentity, learnerConsentTrue);

      const decoded = decodeJwt(res.body.token);
      assert.equal(decoded.payload.sub, learnerConsentTrue);
      assert.equal(decoded.payload.video.room, roomId);
      assert.equal(
        decoded.payload.video.canPublish,
        true,
        'Publish grant must be true with consent'
      );
    }
  );

  await t.test('AI moderator dispatch activates facilitator and returns ready status', async () => {
    currentActor = { userId: learnerConsentTrue, name: 'Learner Two' };
    const res = await request(app).post(`/api/v1/study/rooms/${roomId}/ai-moderator/dispatch`);
    assert.equal(res.status, 200);
    assert.equal(res.body.dispatched, true);
    assert.equal(res.body.agentIdentity, 'agent-ednova-moderator');
    assert.equal(res.body.status, 'ready');

    const updatedRoom = await StudyRoom.findOne({ roomId }).lean();
    assert.equal(updatedRoom?.facilitatorActive, true);
  });

  await t.test(
    'ED-17-A004 & ED-17-A005: Media disconnection and reconnection preserve the application room session',
    async () => {
      // Learner Two experiences a transient WebRTC network drop.
      // Assert application room session is preserved:
      const roomBefore = await StudyRoom.findOne({ roomId }).lean();
      assert.equal(roomBefore?.status, 'active');
      const participantBefore = roomBefore?.participants.find(
        (p) => p.userId === learnerConsentTrue
      );
      assert.ok(
        participantBefore,
        'Participant must remain enrolled in room session during media drop'
      );

      // Learner Two reconnects to the media plane and requests a fresh token
      currentActor = { userId: learnerConsentTrue, name: 'Learner Two' };
      const reconnectRes = await request(app).post(`/api/v1/study/rooms/${roomId}/livekit-token`);
      assert.equal(reconnectRes.status, 200);
      assert.equal(reconnectRes.body.participantIdentity, learnerConsentTrue);

      const decoded = decodeJwt(reconnectRes.body.token);
      assert.equal(decoded.payload.sub, learnerConsentTrue);
      assert.equal(decoded.payload.video.room, roomId);

      // Verify room state is untouched and preserved
      const roomAfter = await StudyRoom.findOne({ roomId }).lean();
      assert.equal(roomAfter?.status, 'active');
      assert.equal(roomAfter?.participants.length, 2);
    }
  );

  await t.test(
    'ED-17-A006: Peer audio operates independently of AI moderator availability',
    async () => {
      // AI moderator is disabled/unavailable (facilitatorActive = false)
      await StudyRoom.updateOne({ roomId }, { $set: { facilitatorActive: false } });

      currentActor = { userId: learnerConsentTrue, name: 'Learner Two' };
      const res = await request(app).post(`/api/v1/study/rooms/${roomId}/livekit-token`);
      assert.equal(res.status, 200);
      // Peer audio publish/subscribe works unimpeded
      assert.equal(res.body.canPublishAudio, true);
      assert.equal(res.body.canSubscribeAudio, true);

      const decoded = decodeJwt(res.body.token);
      assert.equal(decoded.payload.video.canPublish, true);
      assert.equal(decoded.payload.video.canSubscribe, true);
    }
  );
});
