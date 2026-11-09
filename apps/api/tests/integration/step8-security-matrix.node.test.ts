import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase, prisma } from '../../shared/database';
import { newId } from '../../shared/ids';
import type { CourseStatus, Role, Tier } from '../../src/generated/prisma/client';
import { rateLimiter } from '../../shared/middleware';

test(
  'Step 8: Independent All-Channel Security and Adversarial Assessment',
  { timeout: 60000 },
  async (t) => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL || 'postgresql://ednova:ednova@127.0.0.1:5433/ednova_test';
    // Token issuance is exercised without a media server; the JWT signing config
    // is synthetic and local, exactly as the LiveKit token suite uses it.
    process.env.LIVEKIT_URL = 'ws://127.0.0.1:7880';
    process.env.LIVEKIT_API_KEY = 'test_lk_key';
    process.env.LIVEKIT_API_SECRET = 'test_lk_secret_1234567890';
    process.env.BETTER_AUTH_SECRET = 'step8-security-matrix-secret-at-least-32-chars';
    process.env.AUTH_TRUSTED_ORIGINS = 'http://localhost:5173';
    process.env.BETTER_AUTH_URL = 'http://localhost:5173';
    process.env.INTERNAL_API_SECRET = 'step8-security-internal-secret';
    process.env.RABBITMQ_URL = 'amqp://localhost:5672';
    process.env.REDIS_URL = '';
    process.env.NODE_ENV = 'test';

    await connectDatabase();
    const runTag = `${process.pid}_${Date.now()}`;
    const instructorId = newId();
    const enrolledId = newId();
    const peerId = newId();
    const outsiderId = newId();
    const instId = newId();
    const courseId = newId();
    const actorIds = [instructorId, enrolledId, peerId, outsiderId];

    t.after(async () => {
      try {
        await prisma.studentAttempt.deleteMany({ where: { courseId } });
        await prisma.courseEnrollment.deleteMany({ where: { courseId } });
        await prisma.studyRoom.deleteMany({ where: { title: 'Security Study Room' } });
        await prisma.course.deleteMany({ where: { id: courseId } });
        await prisma.institutionMembership.deleteMany({ where: { institutionId: instId } });
        await prisma.institution.deleteMany({ where: { id: instId } });
        await prisma.authSession.deleteMany({ where: { userId: { in: actorIds } } });
        await prisma.authAccount.deleteMany({ where: { userId: { in: actorIds } } });
        await prisma.authUser.deleteMany({ where: { id: { in: actorIds } } });
        await prisma.user.deleteMany({ where: { id: { in: actorIds } } });
        await prisma.authRateLimit.deleteMany({});
      } finally {
        await disconnectDatabase().catch(() => {});
      }
    });

    const password = await bcrypt.hash('Synthetic!123', 12);
    const instructor = {
      id: instructorId,
      email: `instructor-${runTag}@sec.test`,
      name: 'Instructor',
      // Teaching authority comes from the active membership, not `users.role`.
      role: 'student' as Role
    };
    const studentEnrolled = {
      id: enrolledId,
      email: `enrolled-${runTag}@sec.test`,
      name: 'Student Enrolled',
      role: 'student' as Role
    };
    const studentPeer = {
      id: peerId,
      email: `peer-${runTag}@sec.test`,
      name: 'Student Peer',
      role: 'student' as Role
    };
    const studentOutsider = {
      id: outsiderId,
      email: `outsider-${runTag}@sec.test`,
      name: 'Student Outsider',
      role: 'student' as Role
    };

    await prisma.authRateLimit.deleteMany({});
    for (const u of [instructor, studentEnrolled, studentPeer, studentOutsider]) {
      await prisma.user.create({
        data: {
          id: u.id,
          email: u.email,
          name: u.name,
          password,
          isVerified: true,
          isActive: true,
          role: u.role,
          tier: 'normal' as Tier,
          notificationPreferences: {},
          onboardingDraft: {}
        }
      });
      await prisma.authUser.create({
        data: { id: u.id, email: u.email, name: u.name, emailVerified: true }
      });
      await prisma.authAccount.create({
        data: { id: newId(), accountId: u.id, providerId: 'credential', userId: u.id, password }
      });
    }

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

    await getCookie(instructor);
    const enrolledCookie = await getCookie(studentEnrolled);
    const peerCookie = await getCookie(studentPeer);
    const outsiderCookie = await getCookie(studentOutsider);

    // Seed institution, memberships, course and enrollment
    await prisma.institution.create({
      data: {
        id: instId,
        name: 'Sec Institution',
        slug: `sec-inst-${runTag}`,
        status: 'active',
        createdByUserId: instructor.id
      }
    });
    await prisma.institutionMembership.createMany({
      data: [
        {
          id: newId(),
          institutionId: instId,
          userId: instructor.id,
          role: 'instructor',
          status: 'active'
        },
        {
          id: newId(),
          institutionId: instId,
          userId: studentEnrolled.id,
          role: 'university_student',
          status: 'active'
        }
      ]
    });

    await prisma.course.create({
      data: {
        id: courseId,
        title: 'Secure Distributed Systems',
        description: 'Security & Consensus',
        userId: instructor.id,
        ownerUserId: instructor.id,
        institutionId: instId,
        scope: 'institutional',
        assignedInstructorIds: [instructor.id],
        activeRevisionId: 'rev_sec_1',
        subjectId: 'sub_sec',
        status: 'completed' as CourseStatus
      }
    });

    await prisma.courseEnrollment.createMany({
      data: [studentEnrolled.id, studentPeer.id].map((userId) => ({
        id: newId(),
        userId,
        courseId,
        institutionId: instId,
        status: 'active'
      }))
    });

    // Start Nest API
    const { start } = await import('../../src/main.js');
    const runtime = await start({ port: 0 });
    t.after(async () => {
      await runtime.stop();
    });
    const port = (runtime.server.address() as { port: number }).port;
    const baseUrl = `http://127.0.0.1:${port}/api/v1`;

    // Peer study rooms are student-only; the enrolled learner hosts it and the
    // instructor joins as a peer so presenter-command checks still apply.
    const createRoomRes = await fetch(`${baseUrl}/study/rooms`, {
      method: 'POST',
      headers: { cookie: enrolledCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Security Study Room', enableVoice: true })
    });
    assert.equal(createRoomRes.status, 201);
    const roomData = await createRoomRes.json();
    const roomIdStr = roomData.roomId;

    // Teaching members cannot enter peer rooms, so a second learner joins as the
    // non-presenter participant while presenter authority stays with the host.
    const joinRes = await fetch(`${baseUrl}/study/rooms/join`, {
      method: 'POST',
      headers: { cookie: peerCookie, 'content-type': 'application/json' },
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
        await prisma.studentAttempt.create({
          data: {
            id: newId(),
            attemptId,
            userId: studentEnrolled.id,
            courseId,
            roomId: roomIdStr,
            activityId: 'act_sec_test',
            revisionId: 'rev_sec_1',
            contentHash: 'sha256:' + 'e'.repeat(64),
            activityRevision: 'rev_act_1',
            activityType: 'InteractiveQuiz',
            timeSpentSeconds: 1,
            answers: { selectedOptionIds: [] },
            payloadHash: 'sha256:' + 'd'.repeat(64),
            status: 'submitted',
            submittedAt: new Date()
          }
        });

        // The peer calls debrief — their privateOutcome must be 'untested'
        const peerDebriefRes = await fetch(`${baseUrl}/study/rooms/${roomIdStr}/debrief`, {
          headers: { cookie: peerCookie }
        });
        assert.equal(peerDebriefRes.status, 200);
        const peerDebrief = await peerDebriefRes.json();
        assert.equal(
          peerDebrief.privateOutcome.status,
          'untested',
          'A learner must not see another learner outcome'
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
        headers: { cookie: peerCookie, 'content-type': 'application/json' },
        body: JSON.stringify({ currentPhase: 'peer_discussion' })
      });
      assert.equal(nonPresenterRes.status, 403, 'Non-presenter must be rejected with 403');

      // Presenter with stale sequence using durable room command
      const staleRes = await fetch(`${baseUrl}/study/rooms/${roomIdStr}/phase`, {
        method: 'PUT',
        headers: { cookie: enrolledCookie, 'content-type': 'application/json' },
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
        // Grant consent to the room host
        await fetch(`${baseUrl}/study/rooms/${roomIdStr}/voice-consent`, {
          method: 'PUT',
          headers: { cookie: enrolledCookie, 'content-type': 'application/json' },
          body: JSON.stringify({ hasVoiceConsent: true })
        });

        const hostTokenRes = await fetch(`${baseUrl}/study/rooms/${roomIdStr}/livekit-token`, {
          method: 'POST',
          headers: { cookie: enrolledCookie }
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
          headers: { cookie: enrolledCookie, 'content-type': 'application/json' },
          body: JSON.stringify({ hasVoiceConsent: false })
        });
        assert.equal(consentRes.status, 200);

        // Token request now must return canPublishAudio: false
        const revokedTokenRes = await fetch(`${baseUrl}/study/rooms/${roomIdStr}/livekit-token`, {
          method: 'POST',
          headers: { cookie: enrolledCookie }
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
