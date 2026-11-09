import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase, prisma } from '../../shared/database';
import { newId } from '../../shared/ids';

interface ContextBody {
  pendingCount?: number;
  invitations?: { id: string; title: string }[];
  course?: {
    id: string;
    title: string;
    scope: string;
    institutionId?: string;
    assignedInstructorIds?: string[];
  };
  courses?: Array<{
    id: string;
    title: string;
    scope: string;
    institutionId?: string;
  }>;
  invitation?: {
    invitationId: string;
    courseId: string;
    token: string;
    expiresAt: string;
  };
  enrollments?: Array<{
    enrollmentId: string;
    userId: string;
    status: string;
  }>;
  enrollmentId?: string;
  assignedInstructorIds?: string[];
  token?: string;
  status?: string;
  recovered?: boolean;
  error?: string;
}

interface TestActor {
  id: string;
  email: string;
  cookie: string;
}

test(
  'M04-B institutional course scope, instructor assignment, and learner enrollment integration',
  { timeout: 90000 },
  async (t) => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL || 'postgresql://ednova:ednova@127.0.0.1:5433/ednova_test';
    process.env.BETTER_AUTH_SECRET = 'm04b-isolated-session-secret-at-least-32-characters';
    process.env.INTERNAL_API_SECRET = 'm04b-isolated-internal-secret';
    process.env.AUTH_TRUSTED_ORIGINS = 'http://localhost:5173';
    process.env.BETTER_AUTH_URL = 'http://localhost:5173';
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:1';
    process.env.RABBITMQ_URL = 'amqp://127.0.0.1:1';
    process.env.REDIS_URL = '';
    process.env.NODE_ENV = 'test';

    await connectDatabase();
    const runtime: { current?: { stop: () => Promise<void> } } = {};
    const userIds: string[] = [];
    const institutionIds: string[] = [];
    const subjectIds: string[] = [];
    t.after(async () => {
      await runtime.current?.stop().catch(() => undefined);
      const { closeAuth } = await import('../../shared/betterAuth.js');
      await closeAuth();
      const courses = await prisma.course.findMany({
        where: { OR: [{ userId: { in: userIds } }, { institutionId: { in: institutionIds } }] },
        select: { id: true }
      });
      const courseIds = courses.map((row) => row.id);
      await prisma.courseEnrollment.deleteMany({ where: { courseId: { in: courseIds } } });
      await prisma.courseInvitation.deleteMany({ where: { courseId: { in: courseIds } } });
      await prisma.course.deleteMany({ where: { id: { in: courseIds } } });
      await prisma.institutionInvitation.deleteMany({
        where: { institutionId: { in: institutionIds } }
      });
      await prisma.institutionMembership.deleteMany({
        where: { institutionId: { in: institutionIds } }
      });
      await prisma.institution.deleteMany({ where: { id: { in: institutionIds } } });
      await prisma.subject.deleteMany({ where: { id: { in: subjectIds } } });
      await prisma.authUser.deleteMany({ where: { id: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await disconnectDatabase().catch(() => undefined);
    });

    const password = await bcrypt.hash('Synthetic!123', 12);
    const actorNames = [
      'platform-admin',
      'uni-admin-alpha',
      'instructor-alpha-1',
      'instructor-alpha-2',
      'student-alpha-1',
      'student-alpha-2',
      'uni-admin-beta',
      'instructor-beta-1',
      'student-beta-1',
      'personal-learner',
      'outsider'
    ];

    const actors = new Map<string, TestActor>();
    for (const name of actorNames) {
      const actor: TestActor = { id: newId(), email: `${name}@m04b.test`, cookie: '' };
      actors.set(name, actor);
      userIds.push(actor.id);
      await prisma.user.create({
        data: {
          id: actor.id,
          email: actor.email,
          name,
          isVerified: true,
          isActive: true,
          role: name === 'platform-admin' ? 'admin' : 'student',
          isAdmin: name === 'platform-admin',
          tier: 'vip',
          notificationPreferences: {},
          onboardingDraft: {}
        }
      });
      await prisma.authUser.create({
        data: { id: actor.id, email: actor.email, name, emailVerified: true }
      });
      await prisma.authAccount.create({
        data: {
          id: newId(),
          accountId: actor.id,
          providerId: 'credential',
          userId: actor.id,
          password
        }
      });
    }

    const { getAuth } = await import('../../shared/betterAuth.js');
    const auth = await getAuth();
    for (const actor of actors.values()) {
      const response = await auth.api.signInEmail({
        body: { email: actor.email, password: 'Synthetic!123' },
        asResponse: true
      });
      assert.equal(response.status, 200, `sign-in failed for ${actor.email}`);
      actor.cookie = response.headers
        .getSetCookie()
        .map((value: string) => value.split(';')[0])
        .join('; ');
    }

    const { start } = await import('../../src/main.js');
    const started = await start({ port: 0, workers: false });
    runtime.current = started;
    const address = started.server.address();
    assert.ok(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}`;

    const { Subject } = await import('../../modules/study/src/models/index.js');
    // Tables and their indexes come from the Prisma migrations; nothing to warm up.
    await import('../../modules/study/src/models/CourseInvitation.js');

    async function request(actor: TestActor | null, method: string, path: string, body?: unknown) {
      const response = await fetch(base + path, {
        method,
        headers: {
          origin: 'http://localhost:5173',
          'x-forwarded-for': `198.18.0.${actor ? userIds.indexOf(actor.id) + 1 : 99}`,
          ...(actor ? { cookie: actor.cookie } : {}),
          ...(body === undefined ? {} : { 'content-type': 'application/json' })
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const text = await response.text();
      return {
        status: response.status,
        body: (text ? JSON.parse(text) : {}) as ContextBody
      };
    }

    // Set up two synthetic institutions. Memberships carry a real foreign key,
    // so the institutions exist first.
    const instAlphaId = newId();
    const instBetaId = newId();
    institutionIds.push(instAlphaId, instBetaId);
    await prisma.institution.createMany({
      data: [
        {
          id: instAlphaId,
          name: 'Alpha University',
          slug: `m04b-alpha-${instAlphaId}`,
          isVerified: true,
          status: 'active',
          createdByUserId: actors.get('uni-admin-alpha')!.id
        },
        {
          id: instBetaId,
          name: 'Beta Polytechnic',
          slug: `m04b-beta-${instBetaId}`,
          isVerified: true,
          status: 'active',
          createdByUserId: actors.get('uni-admin-beta')!.id
        }
      ]
    });

    const membership = (
      institutionId: string,
      name: string,
      role: 'university_admin' | 'instructor' | 'university_student'
    ) => ({
      id: newId(),
      institutionId,
      userId: actors.get(name)!.id,
      role,
      status: 'active' as const
    });

    // Populate memberships in Alpha and Beta.
    await prisma.institutionMembership.createMany({
      data: [
        membership(instAlphaId, 'uni-admin-alpha', 'university_admin'),
        membership(instAlphaId, 'instructor-alpha-1', 'instructor'),
        membership(instAlphaId, 'instructor-alpha-2', 'instructor'),
        membership(instAlphaId, 'student-alpha-1', 'university_student'),
        membership(instAlphaId, 'student-alpha-2', 'university_student'),
        membership(instBetaId, 'uni-admin-beta', 'university_admin'),
        membership(instBetaId, 'instructor-beta-1', 'instructor'),
        membership(instBetaId, 'student-beta-1', 'university_student')
      ]
    });

    // Create subjects for the instructors / learners
    const subjectAlpha = await Subject.create({
      userId: actors.get('instructor-alpha-1')!.id,
      name: 'Computer Science',
      color: '#3b82f6'
    });

    const subjectBeta = await Subject.create({
      userId: actors.get('instructor-beta-1')!.id,
      name: 'Mechanical Engineering',
      color: '#ef4444'
    });

    const subjectPersonal = await Subject.create({
      userId: actors.get('personal-learner')!.id,
      name: 'Personal Mathematics',
      color: '#10b981'
    });
    subjectIds.push(String(subjectAlpha.id), String(subjectBeta.id), String(subjectPersonal.id));

    let coursePersonalId = '';
    let courseAlphaId = '';

    await t.test('1. Course scope creation and authorization', async () => {
      // Personal course created by personal-learner
      const resPersonal = await request(
        actors.get('personal-learner')!,
        'POST',
        '/api/v1/study/courses/manual',
        {
          title: 'Calculus I (Personal)',
          subject_id: subjectPersonal.id.toString()
        }
      );
      assert.equal(resPersonal.status, 201);
      assert.equal(resPersonal.body.course?.scope, 'personal');
      coursePersonalId = resPersonal.body.course!.id;

      // Institutional course created in Alpha by instructor-alpha-1
      const resAlpha = await request(
        actors.get('instructor-alpha-1')!,
        'POST',
        '/api/v1/study/courses/manual',
        {
          title: 'Algorithms & Data Structures',
          subject_id: subjectAlpha.id.toString(),
          scope: 'institutional',
          institutionId: instAlphaId
        }
      );
      assert.equal(resAlpha.status, 201);
      assert.equal(resAlpha.body.course?.scope, 'institutional');
      assert.equal(resAlpha.body.course?.institutionId, instAlphaId);
      assert.deepEqual(resAlpha.body.course?.assignedInstructorIds, [
        actors.get('instructor-alpha-1')!.id
      ]);
      courseAlphaId = resAlpha.body.course!.id;

      // Institutional course created in Beta by instructor-beta-1
      const resBeta = await request(
        actors.get('instructor-beta-1')!,
        'POST',
        '/api/v1/study/courses/manual',
        {
          title: 'Thermodynamics',
          subject_id: subjectBeta.id.toString(),
          scope: 'institutional',
          institutionId: instBetaId
        }
      );
      assert.equal(resBeta.status, 201);
      assert.ok(resBeta.body.course!.id);

      // Student attempting to create an institutional course -> rejected 403
      const resStudentCreate = await request(
        actors.get('student-alpha-1')!,
        'POST',
        '/api/v1/study/courses/manual',
        {
          title: 'Illegal Student Course',
          subject_id: subjectAlpha.id.toString(),
          scope: 'institutional',
          institutionId: instAlphaId
        }
      );
      assert.equal(resStudentCreate.status, 403);
    });

    await t.test('2. Strict resource isolation and access control', async () => {
      // Personal course: personal-learner can read
      const readPersonalSelf = await request(
        actors.get('personal-learner')!,
        'GET',
        `/api/v1/study/courses/${coursePersonalId}`
      );
      assert.equal(readPersonalSelf.status, 200);

      // Personal course: outsider denied 404
      const readPersonalOutsider = await request(
        actors.get('outsider')!,
        'GET',
        `/api/v1/study/courses/${coursePersonalId}`
      );
      assert.equal(readPersonalOutsider.status, 404);

      // Personal course: platform admin denied 404 (zero admin bypass)
      const readPersonalAdmin = await request(
        actors.get('platform-admin')!,
        'GET',
        `/api/v1/study/courses/${coursePersonalId}`
      );
      assert.equal(readPersonalAdmin.status, 404);

      // Alpha course: instructor-alpha-1 can read
      const readAlphaSelf = await request(
        actors.get('instructor-alpha-1')!,
        'GET',
        `/api/v1/study/courses/${courseAlphaId}`
      );
      assert.equal(readAlphaSelf.status, 200);

      // Alpha course: student-alpha-1 is a member of Alpha, but NOT enrolled -> denied 404!
      const readAlphaStudentUnenrolled = await request(
        actors.get('student-alpha-1')!,
        'GET',
        `/api/v1/study/courses/${courseAlphaId}`
      );
      assert.equal(readAlphaStudentUnenrolled.status, 404);

      // Alpha course: instructor-beta-1 (from Beta) -> denied 404!
      const readAlphaBetaInstructor = await request(
        actors.get('instructor-beta-1')!,
        'GET',
        `/api/v1/study/courses/${courseAlphaId}`
      );
      assert.equal(readAlphaBetaInstructor.status, 404);
    });

    await t.test('3. Instructor assignment and cross-institution boundary', async () => {
      // Assign instructor-alpha-2 to Course Alpha
      const assignRes = await request(
        actors.get('uni-admin-alpha')!,
        'POST',
        `/api/v1/study/courses/${courseAlphaId}/instructors`,
        {
          instructorUserId: actors.get('instructor-alpha-2')!.id
        }
      );
      assert.equal(assignRes.status, 200);
      assert.ok(
        assignRes.body.assignedInstructorIds?.includes(actors.get('instructor-alpha-2')!.id)
      );

      // Now instructor-alpha-2 can read Course Alpha!
      const readByAssigned = await request(
        actors.get('instructor-alpha-2')!,
        'GET',
        `/api/v1/study/courses/${courseAlphaId}`
      );
      assert.equal(readByAssigned.status, 200);

      // Attempt to assign instructor-beta-1 to Course Alpha -> rejected 400 (Foreign institution)
      const foreignAssign = await request(
        actors.get('uni-admin-alpha')!,
        'POST',
        `/api/v1/study/courses/${courseAlphaId}/instructors`,
        {
          instructorUserId: actors.get('instructor-beta-1')!.id
        }
      );
      assert.equal(foreignAssign.status, 400);

      // Attempt by student to assign instructor -> rejected 403
      const studentAssign = await request(
        actors.get('student-alpha-1')!,
        'POST',
        `/api/v1/study/courses/${courseAlphaId}/instructors`,
        {
          instructorUserId: actors.get('instructor-alpha-2')!.id
        }
      );
      assert.equal(studentAssign.status, 403);
    });

    let courseInvitationToken = '';

    await t.test('4. Learner course invitation and acceptance', async () => {
      // Issue invitation for Course Alpha
      const invRes = await request(
        actors.get('instructor-alpha-1')!,
        'POST',
        `/api/v1/study/courses/${courseAlphaId}/invitations`,
        {
          role: 'student',
          expiresInHours: 24
        }
      );
      assert.equal(invRes.status, 201);
      assert.ok(invRes.body.token);
      courseInvitationToken = invRes.body.token!;
      assert.match(courseInvitationToken, /^(?:[0-9A-Z]{4}-){3}[0-9A-Z]{4}$/);

      // Outsider (not a member of Alpha) attempts to accept -> rejected 403
      const outsiderAccept = await request(
        actors.get('outsider')!,
        'POST',
        '/api/v1/study/courses/invitations/accept',
        { token: courseInvitationToken }
      );
      assert.equal(outsiderAccept.status, 403);

      // student-alpha-1 accepts -> enrolled 200
      const acceptRes = await request(
        actors.get('student-alpha-1')!,
        'POST',
        '/api/v1/study/courses/invitations/accept',
        { token: courseInvitationToken.replaceAll('-', '').toLowerCase() }
      );
      assert.equal(acceptRes.status, 200);
      assert.equal(acceptRes.body.status, 'active');

      // Now student-alpha-1 can read Course Alpha!
      const readAlphaEnrolled = await request(
        actors.get('student-alpha-1')!,
        'GET',
        `/api/v1/study/courses/${courseAlphaId}`
      );
      assert.equal(readAlphaEnrolled.status, 200);

      // Idempotent retry: student-alpha-1 accepts same token again -> 200 recovered
      const retryAccept = await request(
        actors.get('student-alpha-1')!,
        'POST',
        '/api/v1/study/courses/invitations/accept',
        { token: courseInvitationToken }
      );
      assert.equal(retryAccept.status, 200);
      assert.equal(retryAccept.body.recovered, true);

      // Another user (student-alpha-2) attempts to claim same single-use token -> 409 conflict
      const conflictAccept = await request(
        actors.get('student-alpha-2')!,
        'POST',
        '/api/v1/study/courses/invitations/accept',
        { token: courseInvitationToken }
      );
      assert.equal(conflictAccept.status, 409);
    });

    await t.test(
      'the addressed account can accept an invitation from its inbox without a code',
      async () => {
        const recipient = actors.get('student-alpha-1')!;
        const issued = await request(
          actors.get('instructor-alpha-1')!,
          'POST',
          `/api/v1/study/courses/${courseAlphaId}/invitations`,
          { email: recipient.email }
        );
        assert.equal(issued.status, 201);
        const other = actors.get('student-alpha-2')!;
        const inbox = '/api/v1/study/courses/invitations/inbox';
        const endpoint = '/api/v1/study/courses/invitations/accept';
        const listed = await request(recipient, 'GET', inbox);
        assert.equal(listed.status, 200);
        assert.equal(listed.body.pendingCount, 1);
        const invitation = listed.body.invitations?.[0];
        assert.ok(invitation?.id);
        assert.equal(JSON.stringify(listed.body).includes(issued.body.token!), false);
        assert.deepEqual((await request(other, 'GET', inbox)).body.invitations, []);
        assert.equal(
          (await request(other, 'POST', endpoint, { invitationId: invitation.id })).status,
          404
        );
        assert.equal(
          (await request(other, 'POST', endpoint, { token: issued.body.token })).status,
          404
        );
        assert.equal(
          (await request(recipient, 'POST', endpoint, { invitationId: invitation.id })).status,
          200
        );
        assert.equal((await request(recipient, 'GET', inbox)).body.pendingCount, 0);
      }
    );

    await t.test('5. Direct administrative enrollment and roster listing', async () => {
      // University admin directly enrolls student-alpha-2
      const directEnroll = await request(
        actors.get('uni-admin-alpha')!,
        'POST',
        `/api/v1/study/courses/${courseAlphaId}/enrollments`,
        {
          studentUserId: actors.get('student-alpha-2')!.id
        }
      );
      assert.equal(directEnroll.status, 201);
      assert.equal(directEnroll.body.status, 'active');

      // List enrollments as instructor
      const rosterRes = await request(
        actors.get('instructor-alpha-1')!,
        'GET',
        `/api/v1/study/courses/${courseAlphaId}/enrollments`
      );
      assert.equal(rosterRes.status, 200);
      assert.equal(rosterRes.body.enrollments?.length, 2);

      // Student attempting to view roster -> rejected 403
      const studentViewRoster = await request(
        actors.get('student-alpha-1')!,
        'GET',
        `/api/v1/study/courses/${courseAlphaId}/enrollments`
      );
      assert.equal(studentViewRoster.status, 403);
    });

    await t.test('6. Student withdrawal and instructor revocation', async () => {
      // student-alpha-1 withdraws voluntarily
      const withdrawRes = await request(
        actors.get('student-alpha-1')!,
        'DELETE',
        `/api/v1/study/courses/${courseAlphaId}/enrollments`
      );
      assert.equal(withdrawRes.status, 200);
      assert.equal(withdrawRes.body.status, 'dropped');

      // Withdrawn student immediately loses read access to Course Alpha!
      const readDropped = await request(
        actors.get('student-alpha-1')!,
        'GET',
        `/api/v1/study/courses/${courseAlphaId}`
      );
      assert.equal(readDropped.status, 404);

      // Instructor revokes student-alpha-2
      const revokeRes = await request(
        actors.get('instructor-alpha-1')!,
        'DELETE',
        `/api/v1/study/courses/${courseAlphaId}/enrollments/${actors.get('student-alpha-2')!.id}`
      );
      assert.equal(revokeRes.status, 200);
      assert.equal(revokeRes.body.status, 'revoked');

      // Revoked student loses read access!
      const readRevoked = await request(
        actors.get('student-alpha-2')!,
        'GET',
        `/api/v1/study/courses/${courseAlphaId}`
      );
      assert.equal(readRevoked.status, 404);
    });

    await t.test('7. Scoped course listing by institutional context', async () => {
      // Re-enroll student-alpha-2
      await request(
        actors.get('uni-admin-alpha')!,
        'POST',
        `/api/v1/study/courses/${courseAlphaId}/enrollments`,
        { studentUserId: actors.get('student-alpha-2')!.id }
      );

      // Admin Alpha lists courses for Alpha -> sees Course Alpha
      const adminList = await request(
        actors.get('uni-admin-alpha')!,
        'GET',
        `/api/v1/study/courses?institution_id=${instAlphaId}`
      );
      assert.equal(adminList.status, 200);
      assert.equal(adminList.body.courses?.length, 1);
      assert.equal(adminList.body.courses?.[0].id, courseAlphaId);

      // Student-alpha-2 lists courses for Alpha -> sees Course Alpha
      const studentList = await request(
        actors.get('student-alpha-2')!,
        'GET',
        `/api/v1/study/courses?institution_id=${instAlphaId}`
      );
      assert.equal(studentList.status, 200);
      assert.equal(studentList.body.courses?.length, 1);

      // Student from Beta attempts to query Alpha's courses -> 403
      const crossOrgList = await request(
        actors.get('student-beta-1')!,
        'GET',
        `/api/v1/study/courses?institution_id=${instAlphaId}`
      );
      assert.equal(crossOrgList.status, 403);
    });
  }
);
