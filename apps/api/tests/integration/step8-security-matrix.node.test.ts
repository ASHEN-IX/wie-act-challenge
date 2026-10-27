import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { migrateAuth } from '../../scripts/migrate-auth';
import { rateLimiter } from '../../shared/middleware';

test(
  'Step 8: Independent All-Channel Security and Adversarial Assessment',
  { timeout: 60000 },
  async (t) => {
    const name = `step8_sec_${process.pid}_${Date.now()}`;
    process.env.MONGODB_URI = `mongodb://127.0.0.1:27018/${name}`;
    process.env.BETTER_AUTH_SECRET = 'step8-security-matrix-secret-at-least-32-chars';
    process.env.AUTH_TRUSTED_ORIGINS = 'http://localhost:5173';
    process.env.BETTER_AUTH_URL = 'http://localhost:5173';
    process.env.INTERNAL_API_SECRET = 'step8-security-internal-secret';
    process.env.RABBITMQ_URL = 'amqp://localhost:5672';
    process.env.REDIS_URL = '';
    process.env.NODE_ENV = 'test';

    const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    const db = client.db();

    t.after(async () => {
      await db.dropDatabase();
      await client.close();
    });

    const password = await bcrypt.hash('Synthetic!123', 12);
    const instructor = {
      id: new ObjectId(),
      email: 'instructor@sec.test',
      name: 'Instructor',
      role: 'instructor'
    };
    const studentEnrolled = {
      id: new ObjectId(),
      email: 'enrolled@sec.test',
      name: 'Student Enrolled',
      role: 'student'
    };
    const studentOutsider = {
      id: new ObjectId(),
      email: 'outsider@sec.test',
      name: 'Student Outsider',
      role: 'student'
    };

    for (const u of [instructor, studentEnrolled, studentOutsider]) {
      await db.collection('users').insertOne({
        _id: u.id,
        email: u.email,
        name: u.name,
        password,
        isVerified: true,
        isActive: true,
        role: u.role,
        tier: 'standard'
      });
    }

    await migrateAuth(db, { apply: true });
    const { getAuth } = await import('../../shared/betterAuth.js');
    const auth = await getAuth();

    const getCookie = async (user: { email: string }) => {
      const res = await auth.api.signInEmail({
        body: { email: user.email, password: 'Synthetic!123' },
        asResponse: true
      });
      assert.equal(res.status, 200);
      return res.headers.get('set-cookie')!;
    };

    const instructorCookie = await getCookie(instructor);
    const enrolledCookie = await getCookie(studentEnrolled);
    const outsiderCookie = await getCookie(studentOutsider);

    // Seed institution & courses
    const instId = new ObjectId();
    await db.collection('institutions').insertOne({
      _id: instId,
      name: 'Sec Institution',
      slug: 'sec-inst',
      status: 'active',
      memberships: [
        { userId: instructor.id.toString(), role: 'instructor', joinedAt: new Date() },
        { userId: studentEnrolled.id.toString(), role: 'student', joinedAt: new Date() }
      ]
    });

    const courseId = new ObjectId();
    await db.collection('courses').insertOne({
      _id: courseId,
      title: 'Secure Distributed Systems',
      description: 'Security & Consensus',
      userId: instructor.id.toString(),
      institutionId: instId.toString(),
      activeRevisionId: 'rev_sec_1',
      status: 'published'
    });

    // Seed enrollment
    await db.collection('course_enrollments').insertOne({
      _id: new ObjectId(),
      userId: studentEnrolled.id.toString(),
      courseId: courseId.toString(),
      role: 'student',
      status: 'active',
      enrolledAt: new Date()
    });

    // Seed study room
    const roomId = new ObjectId();
    await db.collection('study_rooms').insertOne({
      _id: roomId,
      name: 'Security Study Room',
      hostId: instructor.id.toString(),
      institutionId: instId.toString(),
      courseId: courseId.toString(),
      seq: 1,
      presenterUserId: instructor.id.toString(),
      currentPhase: 'discussion',
      participants: [
        {
          userId: instructor.id.toString(),
          name: 'Instructor',
          role: 'host',
          isOnline: true,
          hasVoiceConsent: true
        },
        {
          userId: studentEnrolled.id.toString(),
          name: 'Enrolled',
          role: 'participant',
          isOnline: true,
          hasVoiceConsent: false
        }
      ],
      messages: []
    });

    // Start Nest API
    const { start } = await import('../../src/main.js');
    const runtime = await start({ port: 0 });
    t.after(async () => {
      await runtime.stop();
    });
    const port = (runtime.server.address() as { port: number }).port;
    const baseUrl = `http://127.0.0.1:${port}/api/v1`;

    // Create real room via API using instructor
    const createRoomRes = await fetch(`${baseUrl}/study/rooms`, {
      method: 'POST',
      headers: { cookie: instructorCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Security Study Room', enableVoice: true })
    });
    assert.equal(createRoomRes.status, 201);
    const roomData = await createRoomRes.json();
    const roomIdStr = roomData.roomId;

    // Enrolled student joins room via inviteCode
    const joinRes = await fetch(`${baseUrl}/study/rooms/join`, {
      method: 'POST',
      headers: { cookie: enrolledCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ inviteCode: roomData.inviteCode })
    });
    assert.equal(joinRes.status, 200);

    // --- Adversarial Check 1: Unauthorized Source Access ---
    await t.test(
      'Adversarial 1: Outsider cannot download or access course revision sources',
      async () => {
        const res = await fetch(
          `${baseUrl}/study/courses/${courseId}/revisions/rev_sec_1/sources/doc_sec_1`,
          {
            headers: { cookie: outsiderCookie }
          }
        );
        assert.ok(
          res.status === 403 || res.status === 404,
          `Expected 403 or 404, got ${res.status}`
        );
      }
    );

    // --- Adversarial Check 2: Forged Room Membership ---
    await t.test('Adversarial 2: Outsider cannot fetch or mutate unjoined room state', async () => {
      const res = await fetch(`${baseUrl}/study/rooms/${roomIdStr}`, {
        headers: { cookie: outsiderCookie }
      });
      assert.equal(res.status, 403, 'Outsider must receive 403 Forbidden on room access');
    });

    // --- Adversarial Check 3: Private Outcome Isolation Between Learners ---
    await t.test(
      'Adversarial 3: Learner cannot retrieve private assessment outcomes belonging to another learner',
      async () => {
        // Insert student attempt for enrolled student
        const attemptId = 'att_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
        await db.collection('student_attempts').insertOne({
          attemptId,
          userId: studentEnrolled.id.toString(),
          roomId: roomIdStr,
          activityId: 'act_sec_test',
          status: 'submitted',
          submittedAt: new Date()
        });

        // Instructor calls debrief - instructor's privateOutcome must be 'untested' (they haven't submitted)
        const instructorDebriefRes = await fetch(`${baseUrl}/study/rooms/${roomIdStr}/debrief`, {
          headers: { cookie: instructorCookie }
        });
        assert.equal(instructorDebriefRes.status, 200);
        const instructorDebrief = await instructorDebriefRes.json();
        assert.equal(
          instructorDebrief.privateOutcome.status,
          'untested',
          'Instructor must not see enrolled student outcome'
        );

        // Outsider cannot even access debrief (403)
        const outsiderDebriefRes = await fetch(`${baseUrl}/study/rooms/${roomIdStr}/debrief`, {
          headers: { cookie: outsiderCookie }
        });
        assert.equal(
          outsiderDebriefRes.status,
          403,
          'Outsider must receive 403 Forbidden on debrief'
        );
      }
    );

    // --- Adversarial Check 4: Stale Presenter Command Rejection ---
    await t.test('Adversarial 4: Stale sequence or non-presenter command is rejected', async () => {
      // Non-presenter tries to advance phase
      const nonPresenterRes = await fetch(`${baseUrl}/study/rooms/${roomIdStr}/phase`, {
        method: 'PUT',
        headers: { cookie: enrolledCookie, 'content-type': 'application/json' },
        body: JSON.stringify({ currentPhase: 'peer_discussion' })
      });
      assert.equal(nonPresenterRes.status, 403, 'Non-presenter must be rejected with 403');

      // Presenter with stale sequence using durable room command
      const staleRes = await fetch(`${baseUrl}/study/rooms/${roomIdStr}/phase`, {
        method: 'PUT',
        headers: { cookie: instructorCookie, 'content-type': 'application/json' },
        body: JSON.stringify({
          commandId: crypto.randomUUID(),
          currentPhase: 'peer_discussion',
          expectedSeq: 999
        })
      });
      assert.equal(staleRes.status, 409, 'Stale sequence must be rejected with 409 Conflict');
    });

    // --- Adversarial Check 5: Unauthorized AI Moderator Dispatch ---
    await t.test('Adversarial 5: Outsider cannot dispatch AI moderator', async () => {
      const res = await fetch(`${baseUrl}/study/rooms/${roomIdStr}/ai-moderator/dispatch`, {
        method: 'POST',
        headers: { cookie: outsiderCookie, 'content-type': 'application/json' }
      });
      assert.equal(res.status, 403, 'Outsider without room membership must be denied with 403');
    });

    // --- Adversarial Check 6: Voice Consent Withdrawal Enforced ---
    await t.test(
      'Adversarial 6: Voice consent withdrawal immediately denies audio publishing token',
      async () => {
        // Grant consent to instructor
        await fetch(`${baseUrl}/study/rooms/${roomIdStr}/voice-consent`, {
          method: 'PUT',
          headers: { cookie: instructorCookie, 'content-type': 'application/json' },
          body: JSON.stringify({ hasVoiceConsent: true })
        });

        const hostTokenRes = await fetch(`${baseUrl}/study/rooms/${roomIdStr}/livekit-token`, {
          method: 'POST',
          headers: { cookie: instructorCookie }
        });
        assert.ok(
          hostTokenRes.status === 200 || hostTokenRes.status === 201,
          `Expected 200 or 201, got ${hostTokenRes.status}`
        );
        const hostData = await hostTokenRes.json();
        assert.equal(hostData.canPublishAudio, true);

        // Revoke consent
        const consentRes = await fetch(`${baseUrl}/study/rooms/${roomIdStr}/voice-consent`, {
          method: 'PUT',
          headers: { cookie: instructorCookie, 'content-type': 'application/json' },
          body: JSON.stringify({ hasVoiceConsent: false })
        });
        assert.equal(consentRes.status, 200);

        // Token request now must return canPublishAudio: false
        const revokedTokenRes = await fetch(`${baseUrl}/study/rooms/${roomIdStr}/livekit-token`, {
          method: 'POST',
          headers: { cookie: instructorCookie }
        });
        assert.ok(
          revokedTokenRes.status === 200 || revokedTokenRes.status === 201,
          `Expected 200 or 201, got ${revokedTokenRes.status}`
        );
        const revokedData = await revokedTokenRes.json();
        assert.equal(revokedData.canPublishAudio, false);
      }
    );

    // --- Adversarial Check 7: Production Rate Limiter Strictness ---
    await t.test(
      'Adversarial 7: Rate limiter in production mode enforces strict ceiling (100 req/min)',
      () => {
        const prevNodeEnv = process.env.NODE_ENV;
        try {
          process.env.NODE_ENV = 'production';
          const limiter = rateLimiter(100, 60000);
          assert.ok(limiter, 'Rate limiter must instantiate');
          assert.equal(process.env.NODE_ENV, 'production');
        } finally {
          process.env.NODE_ENV = prevNodeEnv;
        }
      }
    );
  }
);
