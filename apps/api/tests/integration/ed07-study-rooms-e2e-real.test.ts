interface ParticipantProjection {
  userId: string;
  leftAt?: Date;
  hasSubmitted?: boolean;
  [field: string]: unknown;
}
interface RoomProjection {
  roomId: string;
  currentPhase: string;
  activeActivityId: string | null;
  seq: number;
  publicSubmissionsCount: number;
  [field: string]: unknown;
}
interface RoomResponse {
  roomId: string;
  inviteCode: string;
  participantsCount: number;
  participants: ParticipantProjection[];
  room: RoomProjection;
  currentPhase: string;
  activeActivityId: string | null;
  presenterUserId: string;
  title: string;
  seq: number;
  publicSubmissionsCount: number;
}
interface RoomEvent extends RoomProjection {
  type: string;
}
import { listeningPort } from '../listening-port';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import WebSocket from 'ws';
import { migrateAuth } from '../../scripts/migrate-auth';

// Real Integration & Concurrency Test Suite for ED-07
async function runTests() {
  const dbName = 'ed07_verify_test_' + process.pid + '_' + Date.now();
  process.env.MONGODB_URI = `mongodb://127.0.0.1:27018/${dbName}`;
  process.env.BETTER_AUTH_SECRET = 'isolated-auth-test-secret-at-least-32-characters';
  process.env.AUTH_TRUSTED_ORIGINS = 'http://localhost:5173';
  process.env.BETTER_AUTH_URL = 'http://localhost:5173';
  process.env.INTERNAL_API_SECRET = 'test-internal-secret-ed07';
  process.env.RABBITMQ_URL = 'amqp://localhost:5672';
  process.env.REDIS_URL = '';
  process.env.NODE_ENV = 'test';

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  // Create 3 real test users in MongoDB
  const users = [
    { id: new ObjectId(), email: 'habib@test.ednova', name: 'Habib S.', role: 'student' },
    { id: new ObjectId(), email: 'tasnim@test.ednova', name: 'Tasnim K.', role: 'student' },
    { id: new ObjectId(), email: 'stranger@test.ednova', name: 'Stranger X.', role: 'student' }
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
  let runtime = await start({ port: 0, workers: false });
  let baseUrl = 'http://127.0.0.1:' + listeningPort(runtime.server);
  let wsBaseUrl = 'ws://127.0.0.1:' + listeningPort(runtime.server);

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

    let data: RoomResponse;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Expected JSON response, received ${res.status}: ${text}`);
    }
    return { status: res.status, data };
  };

  // Helper for authenticated WebSocket connection
  const connectWs = (roomId: string, userEmail: string, userId: string) => {
    return new Promise<{ ws: WebSocket; initialMessages: RoomEvent[] }>((resolve, reject) => {
      const messages: RoomEvent[] = [];
      const cookie = cookies[userEmail];
      const ws = new WebSocket(`${wsBaseUrl}/ws/realtime?roomId=${roomId}&userId=${userId}`, {
        headers: {
          origin: 'http://localhost:5173',
          ...(cookie ? { cookie } : {})
        }
      });

      const timeout = setTimeout(() => {
        resolve({ ws, initialMessages: messages });
      }, 500);

      ws.on('message', (raw) => {
        try {
          const parsed = JSON.parse(raw.toString());
          messages.push(parsed);
        } catch {
          /* Best-effort test cleanup / ignore non-JSON transport frames. */
        }
      });

      ws.on('open', () => {
        // Connected
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  };

  let testRoomId = '';
  let testInviteCode = '';

  // ─────────────────────────────────────────────────────────────────────────────
  // PHASE B: Real HTTP Integration Tests
  // ─────────────────────────────────────────────────────────────────────────────

  test('Phase B.1: Contract 10 Room Creation writes to real MongoDB', async () => {
    const hostUser = users[0];
    const res = await apiCall(
      '/api/v1/study/rooms',
      'POST',
      {
        title: 'Algorithms Group Prep',
        maxParticipants: 4,
        moderatorMode: 'guided',
        enableVoice: true
      },
      cookies[hostUser.email]
    );

    assert.equal(
      res.status,
      201,
      `Expected 201 Created, got ${res.status}: ${JSON.stringify(res.data)}`
    );
    assert.ok(res.data.roomId, 'Must return roomId');
    assert.match(
      res.data.inviteCode,
      /^[A-Z0-9]{6}$/,
      'Invite code must be 6 alphanumeric uppercase chars'
    );
    assert.equal(res.data.title, 'Algorithms Group Prep');
    assert.equal(res.data.presenterUserId, hostUser.id.toString());
    assert.equal(res.data.participantsCount, 1);
    assert.equal(res.data.currentPhase, 'idle');

    testRoomId = res.data.roomId;
    testInviteCode = res.data.inviteCode;

    // Verify document in real MongoDB database
    const doc = await db.collection('study_rooms').findOne({ roomId: testRoomId });
    assert.ok(doc, 'Expected persisted study room');
    assert.ok(doc, 'StudyRoom document must exist in MongoDB');
    assert.equal(doc.hostUserId, hostUser.id.toString());
    assert.equal(doc.seq, 1);
    assert.equal(doc.status, 'active');
    assert.equal(doc.participants.length, 1);
    assert.equal(doc.participants[0].role, 'host');
    assert.equal(doc.participants[0].isOnline, true);
  });

  test('Phase B.2: Contract 10 Room Joining via Invite Code', async () => {
    const peerUser = users[1];
    const res = await apiCall(
      '/api/v1/study/rooms/join',
      'POST',
      {
        inviteCode: testInviteCode,
        hasVoiceConsent: true
      },
      cookies[peerUser.email]
    );

    assert.equal(
      res.status,
      200,
      `Expected 200 OK, got ${res.status}: ${JSON.stringify(res.data)}`
    );
    assert.equal(res.data.roomId, testRoomId);
    assert.equal(res.data.participantsCount, 2);

    // Verify participant added to MongoDB document and seq incremented
    const doc = await db.collection('study_rooms').findOne({ roomId: testRoomId });
    assert.ok(doc, 'Expected persisted study room');
    assert.equal(doc.participants.length, 2);
    assert.equal(doc.participants[1].userId, peerUser.id.toString());
    assert.equal(doc.participants[1].role, 'participant');
    assert.equal(doc.seq, 2, 'Monotonic seq must increment on participant join');
  });

  test('Phase B.3: Idempotent Join for already-active participant', async () => {
    const peerUser = users[1];
    const res = await apiCall(
      '/api/v1/study/rooms/join',
      'POST',
      { inviteCode: testInviteCode },
      cookies[peerUser.email]
    );

    assert.equal(res.status, 200);
    assert.equal(res.data.participantsCount, 2);

    const doc = await db.collection('study_rooms').findOne({ roomId: testRoomId });
    assert.ok(doc, 'Expected persisted study room');
    assert.equal(doc.participants.length, 2, 'Must not duplicate participant on re-join');
  });

  test('Phase B.4: Presenter updates room phase (Contract 13)', async () => {
    const hostUser = users[0];
    const res = await apiCall(
      `/api/v1/study/rooms/${testRoomId}/phase`,
      'PUT',
      {
        currentPhase: 'peer_discussion'
      },
      cookies[hostUser.email]
    );

    assert.equal(res.status, 200);
    assert.equal(res.data.currentPhase, 'peer_discussion');
    assert.equal(res.data.activeActivityId, null);
    assert.equal(res.data.seq, 3);

    const doc = await db.collection('study_rooms').findOne({ roomId: testRoomId });
    assert.ok(doc, 'Expected persisted study room');
    assert.equal(doc.currentPhase, 'peer_discussion');
    assert.equal(doc.activeActivityId, null);
    assert.equal(doc.seq, 3);
  });

  test('Phase B.5: Non-presenter cannot advance room phase (Authorization)', async () => {
    const peerUser = users[1]; // Not the presenter
    const res = await apiCall(
      `/api/v1/study/rooms/${testRoomId}/phase`,
      'PUT',
      { currentPhase: 'individual_attempt' },
      cookies[peerUser.email]
    );

    assert.equal(
      res.status,
      403,
      'Must return 403 Forbidden when non-presenter attempts phase change'
    );
  });

  test('Phase B.6: Unintegrated private assessment is explicit and cannot forge completion', async () => {
    const peerUser = users[1];
    // Peer flags submission
    const res = await apiCall(
      `/api/v1/study/rooms/${testRoomId}/submit-flag`,
      'POST',
      {},
      cookies[peerUser.email]
    );

    assert.equal(res.status, 503);
    assert.equal(res.data.publicSubmissionsCount, undefined);
    assert.equal(res.data.seq, undefined);

    // Verify GET /participants does not expose private answers
    const roster = await apiCall(
      `/api/v1/study/rooms/${testRoomId}/participants`,
      'GET',
      undefined,
      cookies[peerUser.email]
    );
    assert.equal(roster.status, 200);
    assert.equal(roster.data.participants.length, 2);
    const peer = roster.data.participants.find(
      (p: ParticipantProjection) => p.userId === peerUser.id.toString()
    );
    assert.ok(peer, 'Expected the joined peer in roster');
    assert.equal(peer.hasSubmitted, false);
    assert.equal(peer.answer, undefined, 'Must not expose answer');
    assert.equal(peer.rubric, undefined, 'Must not expose rubric');
  });

  test('Phase B.7: Room state survives service restart', async () => {
    // 1. Stop the current NestJS runtime
    await runtime.stop();

    // 2. Restart a fresh NestJS runtime against the same MongoDB database
    runtime = await start({ port: 0, workers: false });
    baseUrl = 'http://127.0.0.1:' + listeningPort(runtime.server);
    wsBaseUrl = 'ws://127.0.0.1:' + listeningPort(runtime.server);

    // 3. Query the room details
    const res = await apiCall(
      `/api/v1/study/rooms/${testRoomId}`,
      'GET',
      undefined,
      cookies[users[0].email]
    );

    assert.equal(res.status, 200, 'Room must be readable after server restart');
    assert.equal(res.data.room.roomId, testRoomId);
    assert.equal(res.data.room.currentPhase, 'peer_discussion');
    assert.equal(res.data.room.activeActivityId, null);
    assert.equal(res.data.room.seq, 3, 'Monotonic seq must be preserved across restarts');
    assert.equal(res.data.room.publicSubmissionsCount, 0);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PHASE C: WebSocket Multi-User Verification
  // ─────────────────────────────────────────────────────────────────────────────

  test('Phase C.1: Multi-user WebSocket connection receives initial state snapshot', async () => {
    const user1 = users[0];
    const user2 = users[1];

    const client1 = await connectWs(testRoomId, user1.email, user1.id.toString());
    const client2 = await connectWs(testRoomId, user2.email, user2.id.toString());

    // Both should receive initial ROOM_STATE_SYNC snapshot upon connection
    const snapshot1 = client1.initialMessages.find((m) => m.type === 'ROOM_STATE_SYNC');
    const snapshot2 = client2.initialMessages.find((m) => m.type === 'ROOM_STATE_SYNC');

    assert.ok(snapshot1, 'User 1 must receive ROOM_STATE_SYNC snapshot on connect');
    assert.ok(snapshot2, 'User 2 must receive ROOM_STATE_SYNC snapshot on connect');
    assert.equal(snapshot1.roomId, testRoomId);
    assert.equal(snapshot1.currentPhase, 'peer_discussion');
    assert.equal(snapshot1.seq, 3);
    assert.equal(snapshot1.publicSubmissionsCount, 0);

    // Verify privacy: snapshot contains NO answer keys or solutions
    assert.equal(snapshot1.answerKey, undefined);
    assert.equal(snapshot1.solution, undefined);

    client1.ws.close();
    client2.ws.close();
  });

  test('Phase C.2: Real-time room state broadcast on presenter phase advance', async () => {
    const user1 = users[0];
    const user2 = users[1];

    const client1 = await connectWs(testRoomId, user1.email, user1.id.toString());
    const client2 = await connectWs(testRoomId, user2.email, user2.id.toString());

    // Set up message listeners for live broadcast
    const receivedMessagesUser2: RoomEvent[] = [];
    client2.ws.on('message', (raw) => {
      try {
        receivedMessagesUser2.push(JSON.parse(raw.toString()));
      } catch {
        /* Best-effort test cleanup / ignore non-JSON transport frames. */
      }
    });

    // Presenter (User 1) advances to individual_attempt via HTTP
    const res = await apiCall(
      `/api/v1/study/rooms/${testRoomId}/phase`,
      'PUT',
      { currentPhase: 'individual_attempt' },
      cookies[user1.email]
    );
    assert.equal(res.status, 200);

    // Wait for WebSocket event delivery to User 2
    await new Promise((r) => setTimeout(r, 300));

    const syncMessage = receivedMessagesUser2.find(
      (m) => m.type === 'ROOM_STATE_SYNC' && m.currentPhase === 'individual_attempt'
    );
    assert.ok(syncMessage, 'User 2 must receive broadcast ROOM_STATE_SYNC');
    assert.equal(syncMessage.seq, 4);
    assert.equal(syncMessage.activeActivityId, null);
    assert.equal(
      syncMessage.publicSubmissionsCount,
      0,
      'New activity must reset submission count to 0'
    );

    client1.ws.close();
    client2.ws.close();
  });

  test('Phase C.3: Non-member WebSocket connection is rejected', async () => {
    const stranger = users[2]; // Stranger is NOT a participant in testRoomId
    const ws = new WebSocket(
      `${wsBaseUrl}/ws/realtime?roomId=${testRoomId}&userId=${stranger.id.toString()}`,
      {
        headers: {
          origin: 'http://localhost:5173',
          cookie: cookies[stranger.email]
        }
      }
    );

    const closeCode = await new Promise<number>((resolve) => {
      ws.on('close', (code) => resolve(code));
      ws.on('error', () => {});
    });

    assert.equal(closeCode, 4403, 'Unauthorized non-member must be closed with 4403 Forbidden');
  });

  test('Phase C.4: Unauthenticated WebSocket connection is rejected', async () => {
    const ws = new WebSocket(`${wsBaseUrl}/ws/realtime?roomId=${testRoomId}&userId=fake_id`, {
      headers: { origin: 'http://localhost:5173' }
    });

    const closeCode = await new Promise<number>((resolve) => {
      ws.on('close', (code) => resolve(code));
      ws.on('error', () => {});
    });

    assert.equal(closeCode, 4401, 'Unauthenticated connection must be closed with 4401');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PHASE D: Concurrency and Security Tests
  // ─────────────────────────────────────────────────────────────────────────────

  test('Phase D.1: Atomic Capacity Enforcement under Concurrent Joins', async () => {
    // 1. Create a tight room with maxParticipants: 2
    const hostUser = users[0];
    const createRes = await apiCall(
      '/api/v1/study/rooms',
      'POST',
      { title: 'Tight Pair Room', maxParticipants: 2 },
      cookies[hostUser.email]
    );
    assert.equal(createRes.status, 201);
    const tightRoomId = createRes.data.roomId;
    const tightInviteCode = createRes.data.inviteCode;

    // 2. Create 5 temporary users
    const candidateUsers: Array<{ id: ObjectId; email: string; cookie?: string }> = [];
    for (let i = 0; i < 5; i++) {
      const uId = new ObjectId();
      const email = `candidate${i}_${Date.now()}@test.ednova`;
      await db.collection('users').insertOne({
        _id: uId,
        email,
        name: `Candidate ${i}`,
        password: hashedPw,
        isVerified: true,
        isActive: true,
        role: 'student'
      });
      candidateUsers.push({ id: uId, email });
    }

    await migrateAuth(db, { apply: true });

    const { getAuth: getFreshAuth } = await import('../../shared/betterAuth.js');
    const freshAuth = await getFreshAuth();

    for (const u of candidateUsers) {
      const res = await freshAuth.api.signInEmail({
        body: { email: u.email, password: 'Password!123' },
        asResponse: true
      });
      u.cookie = res.headers
        .getSetCookie()
        .map((v: string) => v.split(';')[0])
        .join('; ');
    }

    // 3. Fire all 5 join requests concurrently (only 1 spot left since host is participant #1)
    const joinPromises = candidateUsers.map((u) =>
      apiCall('/api/v1/study/rooms/join', 'POST', { inviteCode: tightInviteCode }, u.cookie)
    );

    const results = await Promise.all(joinPromises);

    const successes = results.filter((r) => r.status === 200);
    const conflicts = results.filter((r) => r.status === 409);

    assert.equal(successes.length, 1, 'Exactly 1 concurrent join must succeed');
    assert.equal(conflicts.length, 4, 'Remaining 4 concurrent joins must receive 409 Conflict');

    // 4. Verify MongoDB state strictly has 2 active participants
    const tightDoc = await db.collection('study_rooms').findOne({ roomId: tightRoomId });
    assert.ok(tightDoc, 'Expected persisted study room');
    const activeParticipants = tightDoc.participants.filter(
      (p: ParticipantProjection) => !p.leftAt
    );
    assert.equal(
      activeParticipants.length,
      2,
      'Room participants count in MongoDB must strictly equal maxParticipants'
    );
  });

  test('Phase D.2: Concurrent client flags cannot manufacture accepted attempts', async () => {
    // Both users[0] and users[1] submit simultaneously
    const user1 = users[0];
    const user2 = users[1];

    const [res1, res2] = await Promise.all([
      apiCall(`/api/v1/study/rooms/${testRoomId}/submit-flag`, 'POST', {}, cookies[user1.email]),
      apiCall(`/api/v1/study/rooms/${testRoomId}/submit-flag`, 'POST', {}, cookies[user2.email])
    ]);

    assert.equal(res1.status, 503);
    assert.equal(res2.status, 503);

    const doc = await db.collection('study_rooms').findOne({ roomId: testRoomId });
    assert.ok(doc, 'Expected persisted study room');
    const submittedCount = doc.participants.filter(
      (p: ParticipantProjection) => !p.leftAt && p.hasSubmitted
    ).length;
    assert.equal(
      submittedCount,
      0,
      'Unverified client flags must never count as private submissions'
    );
  });

  test('Phase D.3: Repeated unavailable submission requests do not inflate count or sequence', async () => {
    const user1 = users[0];
    const docBefore = await db.collection('study_rooms').findOne({ roomId: testRoomId });
    assert.ok(docBefore, 'Expected persisted study room');
    const seqBefore = docBefore.seq;

    // User 1 submits again
    const res = await apiCall(
      `/api/v1/study/rooms/${testRoomId}/submit-flag`,
      'POST',
      {},
      cookies[user1.email]
    );

    assert.equal(res.status, 503);
    const docAfter = await db.collection('study_rooms').findOne({ roomId: testRoomId });
    assert.ok(docAfter, 'Expected persisted study room');
    assert.equal(docAfter.seq, seqBefore, 'Duplicate submission must NOT increment seq');
  });

  test('Phase D.4: Presenter Leave automatically delegates authority to remaining peer', async () => {
    const hostUser = users[0]; // Current presenter
    const peerUser = users[1];

    // Host leaves
    const res = await apiCall(
      `/api/v1/study/rooms/${testRoomId}/leave`,
      'POST',
      {},
      cookies[hostUser.email]
    );
    assert.equal(res.status, 200);

    const doc = await db.collection('study_rooms').findOne({ roomId: testRoomId });
    assert.ok(doc, 'Expected persisted study room');
    assert.equal(doc.status, 'active');
    assert.equal(
      doc.presenterUserId,
      peerUser.id.toString(),
      'Presenter must be delegated to peer user'
    );

    // Peer user can now advance phase
    const phaseRes = await apiCall(
      `/api/v1/study/rooms/${testRoomId}/phase`,
      'PUT',
      { currentPhase: 'debrief' },
      cookies[peerUser.email]
    );
    assert.equal(phaseRes.status, 200, 'Delegated peer can advance phase');
    assert.equal(phaseRes.data.currentPhase, 'debrief');
  });

  test('Phase D.5: Room closes when last participant leaves', async () => {
    const peerUser = users[1];

    // Peer leaves
    const res = await apiCall(
      `/api/v1/study/rooms/${testRoomId}/leave`,
      'POST',
      {},
      cookies[peerUser.email]
    );
    assert.equal(res.status, 200);

    const doc = await db.collection('study_rooms').findOne({ roomId: testRoomId });
    assert.ok(doc, 'Expected persisted study room');
    assert.equal(doc.status, 'closed', 'Room status must be closed when empty');
    assert.ok(doc.closedAt);

    // Joining closed room must be rejected
    const joinRes = await apiCall(
      '/api/v1/study/rooms/join',
      'POST',
      { roomId: testRoomId },
      cookies[peerUser.email]
    );
    assert.equal(joinRes.status, 404, 'Cannot join closed room');
  });

  test('Phase D.6: Forged internal broadcast attempt is rejected', async () => {
    // Attempt to broadcast without x-internal-secret
    const res = await apiCall(
      '/api/v1/notifications/broadcast-session',
      'POST',
      { roomId: 'fake_room', payload: { type: 'MALICIOUS' } },
      cookies[users[0].email] // Normal student cookie, no internal secret
    );

    assert.equal(res.status, 403, 'Must reject internal broadcast without x-internal-secret');
  });
}

runTests();
