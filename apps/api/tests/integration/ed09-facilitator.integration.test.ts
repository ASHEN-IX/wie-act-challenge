interface InterventionProjection {
  interventionId: string;
  strategy: string;
  message: string;
  [field: string]: unknown;
}
interface FacilitatorResponse {
  roomId: string;
  inviteCode: string;
  participantsCount: number;
  intervened: boolean;
  intervention: InterventionProjection;
  interventions: InterventionProjection[];
  success: boolean;
  status: string;
}
interface FacilitatorEvent {
  type: string;
  seq: number;
  intervention: InterventionProjection;
  [field: string]: unknown;
}
import { listeningPort } from '../listening-port';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import WebSocket from 'ws';
import { migrateAuth } from '../../scripts/migrate-auth';

// Real Integration Test Suite for ED-09 (Pedagogical Facilitator Policy & Live WS Broadcast)
async function runTests() {
  const dbName = 'ed09_verify_test_' + process.pid + '_' + Date.now();
  process.env.MONGODB_URI = `mongodb://127.0.0.1:27018/${dbName}`;
  process.env.BETTER_AUTH_SECRET = 'isolated-auth-test-secret-at-least-32-characters';
  process.env.AUTH_TRUSTED_ORIGINS = 'http://localhost:5173';
  process.env.BETTER_AUTH_URL = 'http://localhost:5173';
  process.env.INTERNAL_API_SECRET = 'test-internal-secret-ed09';
  process.env.RABBITMQ_URL = 'amqp://localhost:5672';
  process.env.REDIS_URL = '';
  process.env.NODE_ENV = 'test';

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  // Create 3 real test users in MongoDB
  const users = [
    { id: new ObjectId(), email: 'habib_f@test.ednova', name: 'Habib S.', role: 'student' },
    { id: new ObjectId(), email: 'tasnim_f@test.ednova', name: 'Tasnim K.', role: 'student' },
    { id: new ObjectId(), email: 'stranger_f@test.ednova', name: 'Stranger X.', role: 'student' }
  ];

  const hashedPw = await bcrypt.hash('Password!123', 12);
  for (const u of users) {
    await db.collection('users').insertOne({
      _id: u.id,
      email: u.email,
      name: u.name,
      password: hashedPw,
      isVerified: true,
      isActive: true,
      role: u.role,
      tier: 'standard'
    });
  }

  await migrateAuth(db, { apply: true });

  const { getAuth } = await import('../../shared/betterAuth.js');
  const auth = await getAuth();

  // Log in each user and obtain valid session cookies
  const cookies: Record<string, string> = {};
  for (const u of users) {
    const res = await auth.api.signInEmail({
      body: { email: u.email, password: 'Password!123' },
      asResponse: true
    });
    cookies[u.email] = res.headers
      .getSetCookie()
      .map((val: string) => val.split(';')[0])
      .join('; ');
  }

  // Start real NestJS application server
  const { start } = await import('../../src/main.js');
  const runtime = await start({ port: 0, workers: false });
  const baseUrl = 'http://127.0.0.1:' + listeningPort(runtime.server);
  const wsBaseUrl = 'ws://127.0.0.1:' + listeningPort(runtime.server);

  after(async () => {
    try {
      await runtime?.stop();
    } catch {
      /* Best-effort test cleanup / ignore non-JSON transport frames. */
    }
    try {
      await db.dropDatabase();
      await client.close();
    } catch {
      /* Best-effort test cleanup / ignore non-JSON transport frames. */
    }
  });

  // Helper for authenticated HTTP requests
  const apiCall = async (
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown,
    cookie?: string,
    extraHeaders: Record<string, string> = {}
  ) => {
    const headers: Record<string, string> = {
      origin: 'http://localhost:5173',
      ...extraHeaders
    };
    if (cookie) headers.cookie = cookie;
    if (body !== undefined) headers['content-type'] = 'application/json';

    const res = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });

    let data: FacilitatorResponse;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Expected JSON response, received ${res.status}: ${text}`);
    }
    return { status: res.status, data, headers: res.headers };
  };

  let testRoomId: string;
  let testInviteCode: string;

  // 1. Setup Room with 2 participants
  test('Room Setup: Create room and join peers', async () => {
    const createRes = await apiCall(
      '/api/v1/study/rooms',
      'POST',
      { title: 'Database Normalization Workshop', maxParticipants: 4 },
      cookies['habib_f@test.ednova']
    );
    assert.equal(createRes.status, 201);
    testRoomId = createRes.data.roomId;
    testInviteCode = createRes.data.inviteCode;
    assert.ok(testRoomId);
    assert.ok(testInviteCode);

    // Tasnim joins room
    const joinRes = await apiCall(
      '/api/v1/study/rooms/join',
      'POST',
      { inviteCode: testInviteCode, hasVoiceConsent: true },
      cookies['tasnim_f@test.ednova']
    );
    assert.equal(joinRes.status, 200);
    assert.equal(joinRes.data.participantsCount, 2);
  });

  // 2. Peer-First Guardrail: Direct Answer Deflection
  test('ED-09 Rule 1: Prohibits direct answers and deflects to peer reasoning', async () => {
    const res = await apiCall(
      `/api/v1/study/rooms/${testRoomId}/facilitator/action`,
      'POST',
      {
        actionType: 'ask_facilitator',
        promptText: 'What is the direct answer to question 2?'
      },
      cookies['tasnim_f@test.ednova']
    );

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.intervened, true);

    const intervention = res.data.intervention;
    assert.equal(intervention.strategy, 'SOCRATIC_NUDGE');
    assert.equal(intervention.trigger, 'explicit_ask');
    assert.ok(
      intervention.message.includes('cannot provide the direct answer') ||
        intervention.message.includes('break down'),
      'Must deflect direct answer and prompt peer reasoning'
    );
    // Must target Habib as peer
    assert.equal(intervention.targetSpeakerName, 'Habib S.');

    // Verify stored in MongoDB
    const stored = await db
      .collection('facilitatorinterventions')
      .findOne({ interventionId: intervention.interventionId });
    assert.ok(stored);
    assert.equal(stored.strategy, 'SOCRATIC_NUDGE');
    assert.equal(stored.status, 'delivered');
  });

  // 3. Misconception Detection & Peer Challenge
  test('ED-09 Rule 2: Detects misconception and triggers PEER_CHALLENGE targeting teammate', async () => {
    const res = await apiCall(
      `/api/v1/study/rooms/${testRoomId}/facilitator/observe`,
      'POST',
      {
        transcriptText:
          'I think a table is in 1NF as long as every student has a unique primary key ID.',
        actionType: 'statement'
      },
      cookies['tasnim_f@test.ednova']
    );

    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.intervened, true);

    const intervention = res.data.intervention;
    assert.equal(intervention.strategy, 'PEER_CHALLENGE');
    assert.equal(intervention.trigger, 'misconception_detected');
    assert.equal(intervention.targetSpeakerName, 'Habib S.');
    assert.ok(
      intervention.message.toLowerCase().includes('atomicity'),
      'Must challenge peer on column atomicity vs primary key'
    );

    // Verify seq incremented
    const room = await db.collection('study_rooms').findOne({ roomId: testRoomId });
    assert.ok(room, 'Expected persisted study room');
    assert.ok(room.seq >= 2);
  });

  // 4. Graduated Socratic Hints (Level 1 & Level 2)
  test('ED-09 Rule 3: Graduated Socratic nudges (Level 1 invariant, Level 2 structural)', async () => {
    // Level 1: Conceptual Invariant
    const resL1 = await apiCall(
      `/api/v1/study/rooms/${testRoomId}/facilitator/action`,
      'POST',
      { actionType: 'request_hint', hintLevel: 1 },
      cookies['habib_f@test.ednova']
    );
    assert.equal(resL1.status, 200);
    assert.equal(resL1.data.intervened, true);
    assert.equal(resL1.data.intervention.strategy, 'SOCRATIC_NUDGE');
    assert.ok(resL1.data.intervention.message.includes('Level 1'));

    // Level 2: Structural Breakdown
    const resL2 = await apiCall(
      `/api/v1/study/rooms/${testRoomId}/facilitator/action`,
      'POST',
      { actionType: 'request_hint', hintLevel: 2 },
      cookies['habib_f@test.ednova']
    );
    assert.equal(resL2.status, 200);
    assert.equal(resL2.data.intervened, true);
    assert.equal(resL2.data.intervention.strategy, 'SOCRATIC_NUDGE');
    assert.ok(resL2.data.intervention.message.includes('Level 2'));
  });

  // 5. Learner Agency: Quiet participant voluntarily declines prompt
  test('ED-09 Agency: Learner can decline prompt and update intervention status', async () => {
    // Generate a targeted intervention first
    const genRes = await apiCall(
      `/api/v1/study/rooms/${testRoomId}/facilitator/action`,
      'POST',
      {
        actionType: 'ask_facilitator',
        promptText: 'Can you check if we are on the right track?'
      },
      cookies['habib_f@test.ednova']
    );
    const intId = genRes.data.intervention.interventionId;

    // Tasnim declines the prompt
    const declineRes = await apiCall(
      `/api/v1/study/rooms/${testRoomId}/facilitator/action`,
      'POST',
      {
        actionType: 'decline_prompt',
        interventionId: intId
      },
      cookies['tasnim_f@test.ednova']
    );

    assert.equal(declineRes.status, 200);
    assert.equal(declineRes.data.success, true);
    assert.equal(declineRes.data.status, 'declined');

    // Verify DB updated to declined
    const doc = await db.collection('facilitatorinterventions').findOne({ interventionId: intId });
    assert.ok(doc, 'Expected persisted facilitator intervention');
    assert.equal(doc.status, 'declined');
  });

  // 6. Live Realtime WebSocket Broadcast Verification
  test('ED-09 Contract 13: Live authoritative WebSocket broadcast of FACILITATOR_INTERVENTION', async () => {
    // Open WebSocket connections for Habib and Tasnim
    const wsHabib = new WebSocket(
      `${wsBaseUrl}/ws/realtime?roomId=${testRoomId}&userId=${users[0].id.toString()}`,
      {
        headers: { cookie: cookies['habib_f@test.ednova'] }
      }
    );
    const wsTasnim = new WebSocket(
      `${wsBaseUrl}/ws/realtime?roomId=${testRoomId}&userId=${users[1].id.toString()}`,
      {
        headers: { cookie: cookies['tasnim_f@test.ednova'] }
      }
    );

    await Promise.all([
      new Promise<void>((resolve) => wsHabib.on('open', resolve)),
      new Promise<void>((resolve) => wsTasnim.on('open', resolve))
    ]);

    const tasnimMessages: FacilitatorEvent[] = [];
    wsTasnim.on('message', (raw) => {
      try {
        tasnimMessages.push(JSON.parse(raw.toString()));
      } catch {
        /* Best-effort test cleanup / ignore non-JSON transport frames. */
      }
    });

    // Habib triggers a facilitator hint action via HTTP
    const hintRes = await apiCall(
      `/api/v1/study/rooms/${testRoomId}/facilitator/action`,
      'POST',
      { actionType: 'request_hint', hintLevel: 1 },
      cookies['habib_f@test.ednova']
    );
    assert.equal(hintRes.status, 200);

    // Wait for WebSocket message delivery to Tasnim
    await new Promise((r) => setTimeout(r, 600));

    const interventionMsg = tasnimMessages.find((m) => m.type === 'FACILITATOR_INTERVENTION');
    assert.ok(
      interventionMsg,
      'Tasnim must receive authoritative FACILITATOR_INTERVENTION via WebSocket'
    );
    assert.equal(interventionMsg.roomId, testRoomId);
    assert.ok(interventionMsg.seq > 0);
    assert.equal(interventionMsg.intervention.strategy, 'SOCRATIC_NUDGE');
    assert.ok(interventionMsg.intervention.message);

    wsHabib.close();
    wsTasnim.close();
  });

  // 7. Interventions Retrieval & Security Boundaries
  test('ED-09 Query & Security: History retrieval and access restriction for non-members', async () => {
    // Member fetch succeeds
    const listRes = await apiCall(
      `/api/v1/study/rooms/${testRoomId}/facilitator/interventions`,
      'GET',
      undefined,
      cookies['habib_f@test.ednova']
    );
    assert.equal(listRes.status, 200);
    assert.ok(Array.isArray(listRes.data.interventions));
    assert.ok(listRes.data.interventions.length >= 3);

    // Non-member stranger fetch receives 403
    const strangerRes = await apiCall(
      `/api/v1/study/rooms/${testRoomId}/facilitator/interventions`,
      'GET',
      undefined,
      cookies['stranger_f@test.ednova']
    );
    assert.equal(strangerRes.status, 403);
  });
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
