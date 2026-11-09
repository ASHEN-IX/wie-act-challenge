import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { connectDatabase, disconnectDatabase } from '../../shared/database';
import { StudyRoom } from '../../modules/study/src/models/StudyRoom';
import request from 'supertest';
import express from 'express';
import roomsRouter from '../../modules/study/src/routes/rooms';

test('ED-17 & ED-25: LiveKit token issuance, explicit voice consent and AI moderator dispatch', async (t) => {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || 'postgresql://ednova:ednova@127.0.0.1:5433/ednova_test';
  await connectDatabase();

  const prevApiKey = process.env.LIVEKIT_API_KEY;
  const prevApiSecret = process.env.LIVEKIT_API_SECRET;
  const prevUrl = process.env.LIVEKIT_URL;
  const prevAgent = process.env.LIVEKIT_MODERATOR_AGENT_NAME;
  delete process.env.LIVEKIT_MODERATOR_AGENT_NAME;
  process.env.LIVEKIT_URL = 'ws://127.0.0.1:7880';
  process.env.LIVEKIT_API_KEY = 'test_lk_key';
  process.env.LIVEKIT_API_SECRET = 'test_lk_secret_1234567890';

  t.after(async () => {
    if (prevAgent === undefined) delete process.env.LIVEKIT_MODERATOR_AGENT_NAME;
    else process.env.LIVEKIT_MODERATOR_AGENT_NAME = prevAgent;
    if (prevUrl === undefined) delete process.env.LIVEKIT_URL;
    else process.env.LIVEKIT_URL = prevUrl;
    process.env.LIVEKIT_API_KEY = prevApiKey;
    process.env.LIVEKIT_API_SECRET = prevApiSecret;
    try {
      await StudyRoom.deleteMany({ roomId: { startsWith: 'room_livekit_fixture_' } });
    } finally {
      await disconnectDatabase().catch(() => {});
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

  await t.test(
    'AI moderator dispatch reports unavailable without changing room state',
    async () => {
      currentActor = { userId: learnerConsentFalse, name: 'Host' };
      const res = await request(app).post(`/api/v1/study/rooms/${roomId}/ai-moderator/dispatch`);
      assert.equal(res.status, 503);
      assert.equal(res.body.error, 'Voice moderator dispatch is unavailable');

      const updatedRoom = await StudyRoom.findOne({ roomId }).lean();
      assert.notEqual(updatedRoom?.facilitatorActive, true);
    }
  );

  await t.test('host requests one dispatch and peers cannot dispatch a moderator', async () => {
    const livekit = express();
    livekit.use(express.json());
    let created = 0;
    const dispatch = { id: 'dispatch-test', room: roomId, agent_name: 'ednova-test' };
    livekit.post('/twirp/livekit.AgentDispatchService/ListDispatch', (_req, res) => {
      res.json({ agent_dispatches: created ? [dispatch] : [] });
    });
    livekit.post('/twirp/livekit.AgentDispatchService/CreateDispatch', (req, res) => {
      assert.equal(req.body.room, roomId);
      assert.equal(req.body.agent_name, 'ednova-test');
      assert.match(req.headers.authorization ?? '', /^Bearer /);
      created++;
      res.json(dispatch);
    });
    const server = livekit.listen(0, '127.0.0.1');
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
      });
      const address = server.address();
      assert.ok(address && typeof address === 'object');
      process.env.LIVEKIT_URL = 'ws://127.0.0.1:' + address.port;
      process.env.LIVEKIT_MODERATOR_AGENT_NAME = 'ednova-test';
      const dispatchPath = `/api/v1/study/rooms/${roomId}/ai-moderator/dispatch`;
      currentActor = { userId: learnerConsentTrue, name: 'Peer' };
      assert.equal((await request(app).post(dispatchPath)).status, 403);
      currentActor = { userId: learnerConsentFalse, name: 'Host' };
      for (let i = 0; i < 2; i++) {
        const result = await request(app).post(dispatchPath);
        assert.equal(result.status, 202);
        assert.equal(result.body.status, 'requested');
        assert.equal(result.body.dispatchId, dispatch.id);
      }
      assert.equal(created, 1);
    } finally {
      process.env.LIVEKIT_URL = 'ws://127.0.0.1:7880';
      delete process.env.LIVEKIT_MODERATOR_AGENT_NAME;
      server.close();
    }
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
