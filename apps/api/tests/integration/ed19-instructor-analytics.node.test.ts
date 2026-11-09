import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase, prisma } from '../../shared/database';
import { newId } from '../../shared/ids';

/** Real Nest/session/PostgreSQL checks. All records and users are synthetic. */
test(
  'ED-19 instructor aggregate authorization, suppression and verified receipts',
  { timeout: 90000 },
  async (t) => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL || 'postgresql://ednova:ednova@127.0.0.1:5433/ednova_test';
    Object.assign(process.env, {
      NODE_ENV: 'test',
      BETTER_AUTH_SECRET: 'ed19-test-secret-at-least-32-characters',
      BETTER_AUTH_URL: 'http://localhost:5173',
      AUTH_TRUSTED_ORIGINS: 'http://localhost:5173',
      INTERNAL_API_SECRET: 'ed19-internal-secret',
      AI_SERVICE_URL: 'http://127.0.0.1:1',
      RABBITMQ_URL: 'amqp://127.0.0.1:1',
      REDIS_URL: ''
    });
    const originalThreshold = process.env.EDNOVA_ANALYTICS_MIN_COHORT;
    await connectDatabase();
    const runtime: {
      current?: Awaited<ReturnType<(typeof import('../../src/main.js'))['start']>>;
    } = {};
    // One migrated database is shared by every suite; keep run-unique identity.
    const run = `${process.pid}_${Date.now()}`;
    const actors = ['owner', 'other', 'foreign', 'admin', 'student'].map((name) => ({
      name,
      id: newId(),
      email: `ed19-${name}-${run}@synthetic.test`,
      cookie: ''
    }));
    const cohort = [actors[4].id, ...Array.from({ length: 19 }, () => newId())];
    const actorIds = actors.map((actor) => actor.id);
    const allUserIds = [...actorIds, ...cohort];
    let institutionIds: string[] = [];
    let courseId = '';
    t.after(async () => {
      if (originalThreshold === undefined) delete process.env.EDNOVA_ANALYTICS_MIN_COHORT;
      else process.env.EDNOVA_ANALYTICS_MIN_COHORT = originalThreshold;
      await runtime.current?.stop().catch(() => {});
      try {
        await prisma.learningEvidence.deleteMany({ where: { userId: { in: allUserIds } } });
        await prisma.studentAttempt.deleteMany({ where: { userId: { in: allUserIds } } });
        if (courseId) {
          await prisma.courseEnrollment.deleteMany({ where: { courseId } });
          await prisma.courseRevision.deleteMany({ where: { courseId } });
          await prisma.course.deleteMany({ where: { id: courseId } });
        }
        if (institutionIds.length)
          await prisma.institution.deleteMany({ where: { id: { in: institutionIds } } });
        await prisma.authSession.deleteMany({ where: { userId: { in: actorIds } } });
        await prisma.authAccount.deleteMany({ where: { userId: { in: actorIds } } });
        await prisma.authUser.deleteMany({ where: { id: { in: actorIds } } });
        await prisma.user.deleteMany({ where: { id: { in: actorIds } } });
        await prisma.authRateLimit.deleteMany({});
      } catch {
        /* Cleanup is best-effort; the run's rows are namespaced. */
      } finally {
        await disconnectDatabase().catch(() => {});
      }
    });
    await prisma.authRateLimit.deleteMany({});
    const password = await bcrypt.hash('Synthetic!123', 12);
    for (const actor of actors) {
      await prisma.user.create({
        data: {
          id: actor.id,
          name: actor.name,
          email: actor.email,
          password,
          role: 'student',
          tier: 'vip',
          isActive: true,
          isVerified: true,
          notificationPreferences: {},
          onboardingDraft: {}
        }
      });
      await prisma.authUser.create({
        data: { id: actor.id, email: actor.email, name: actor.name, emailVerified: true }
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
    // Cohort learners only need a domain row; they never sign in.
    await prisma.user.createMany({
      data: cohort.slice(1).map((id, i) => ({
        id,
        email: `ed19-cohort-${i}-${run}@synthetic.test`,
        name: 'Private synthetic learner',
        role: 'student' as const,
        isActive: true,
        isVerified: true,
        notificationPreferences: {},
        onboardingDraft: {}
      }))
    });
    const auth = await (await import('../../shared/betterAuth.js')).getAuth();
    for (const actor of actors) {
      const signed = await auth.api.signInEmail({
        body: { email: actor.email, password: 'Synthetic!123' },
        asResponse: true
      });
      assert.equal(signed.status, 200);
      actor.cookie = signed.headers
        .getSetCookie()
        .map((cookie: string) => cookie.split(';')[0])
        .join('; ');
    }
    const [owner, other, foreign, admin, student] = actors;
    runtime.current = await (await import('../../src/main.js')).start({ port: 0, workers: false });
    assert.ok(runtime.current);
    const address = runtime.current.server.address();
    assert.ok(address && typeof address === 'object');
    const origin = 'http://127.0.0.1:' + address.port;
    const models = await import('../../modules/study/src/models/index.js');
    const alpha = await models.Institution.create({
      name: 'Alpha',
      slug: `ed19-alpha-${run}`,
      status: 'active',
      createdByUserId: admin.id
    });
    const beta = await models.Institution.create({
      name: 'Beta',
      slug: `ed19-beta-${run}`,
      status: 'active',
      createdByUserId: foreign.id
    });
    institutionIds = [String(alpha.id), String(beta.id)];
    await models.InstitutionMembership.createMany(
      actors.map((actor) => ({
        institutionId: actor === foreign ? beta.id : alpha.id,
        userId: actor.id,
        status: 'active',
        role:
          actor === admin
            ? 'university_admin'
            : actor === student
              ? 'university_student'
              : 'instructor'
      }))
    );
    await models.InstitutionMembership.createMany(
      cohort.slice(1).map((id) => ({
        institutionId: alpha.id,
        userId: id,
        role: 'university_student',
        status: 'active'
      }))
    );
    const course = await models.Course.create({
      userId: owner.id,
      ownerUserId: owner.id,
      title: 'Owned reviewed course',
      subjectId: 'synthetic',
      scope: 'institutional',
      institutionId: alpha.id,
      assignedInstructorIds: [owner.id],
      status: 'completed',
      activeRevisionId: 'rev_analytics'
    });
    courseId = String(course.id);
    const hash = 'sha256:' + 'a'.repeat(64);
    await models.CourseEnrollment.createMany(
      cohort.map((id) => ({
        courseId,
        institutionId: alpha.id,
        userId: id,
        status: 'active'
      }))
    );
    await models.CourseRevision.create({
      courseId,
      revisionTag: 'rev_analytics',
      contentHash: hash,
      status: 'published',
      activationState: 'committed',
      isInstructorReviewed: true,
      approvedActivities: [
        {
          activityId: 'quiz',
          activityRevision: 'quiz_v1',
          definitionHash: hash,
          evaluationHash: hash
        },
        {
          activityId: 'guided',
          activityRevision: 'guided_v1',
          definitionHash: hash,
          evaluationHash: hash
        }
      ]
    });
    const past = new Date();
    past.setUTCDate(past.getUTCDate() - ((past.getUTCDay() + 6) % 7) - 7);
    past.setUTCHours(12, 0, 0, 0);
    async function evidence(
      index: number,
      suffix: string,
      options: {
        activityId?: string;
        executionMode?: string;
        completed?: boolean;
        revisionId?: string;
      } = {}
    ) {
      const activityId = options.activityId || 'quiz',
        activityRevision = activityId + '_v1';
      const attemptId = 'attempt_' + suffix,
        evidenceId = 'evidence_' + suffix;
      const activityType = activityId === 'guided' ? 'GuidedProblem' : 'InteractiveQuiz';
      const activity = {
        courseId,
        revisionId: options.revisionId || 'rev_analytics',
        contentHash: hash,
        activityId,
        activityRevision,
        activityType
      };
      await models.LearningEvidence.create({
        evidenceId,
        evidenceVersion: '1.0.0',
        userId: cohort[index],
        attemptId,
        activity,
        objectiveId: 'objective',
        status: 'accepted',
        bloomLevel: 'understand',
        score: 1,
        masteryAchieved: true,
        evaluator: {
          type: 'deterministic_rubric',
          validationVersion: '1.0.0',
          executionMode: options.executionMode || 'DETERMINISTIC_FALLBACK'
        },
        timestamp: past
      });
      await models.StudentAttempt.create({
        ...activity,
        userId: cohort[index],
        attemptId,
        timeSpentSeconds: 1,
        answers: { value: 'PRIVATE_ANSWER_SENTINEL' },
        payloadHash: hash,
        status: 'graded',
        evidenceId,
        processingState: options.completed === false ? 'prepared' : 'completed',
        assessmentResult: { privateTutorText: 'PRIVATE_TRANSCRIPT_SENTINEL' }
      });
    }
    for (let i = 0; i < 6; i++) await evidence(i, 'accepted_' + i);
    await evidence(0, 'duplicate_user');
    await evidence(0, 'guided', { activityId: 'guided' });
    await evidence(6, 'mock', { executionMode: 'MOCK_TEST' });
    await evidence(7, 'pending', { completed: false });
    await evidence(8, 'old', { revisionId: 'rev_old' });
    const endpoint = '/api/v1/study/insights/courses/' + courseId;
    async function request(actor: typeof owner | null, url = endpoint) {
      const response = await fetch(origin + url, {
        headers: actor ? { cookie: actor.cookie } : {}
      });
      return {
        status: response.status,
        body: await response.json(),
        cache: response.headers.get('cache-control')
      };
    }
    await t.test(
      'real sessions enforce instructor assignment, institution and no administrator override',
      async () => {
        assert.equal((await request(null)).status, 401);
        for (const actor of [other, foreign, admin, student])
          assert.equal((await request(actor)).status, 403);
        assert.equal((await request(owner, '/api/v1/study/insights/courses/forged')).status, 403);
        const listed = await request(owner, '/api/v1/study/insights/courses');
        assert.equal(listed.status, 200);
        assert.deepEqual(listed.body.courses, [{ courseId, title: course.title }]);
        assert.deepEqual(
          (await request(foreign, '/api/v1/study/insights/courses')).body.courses,
          []
        );
        assert.equal((await request(owner, endpoint + '?userId=' + student.id)).status, 400);
      }
    );
    await t.test(
      'absent, unsafe or invalid privacy configuration discloses no counts',
      async () => {
        for (const value of [undefined, '1', '4', 'NaN', '5.5', '1001']) {
          if (value === undefined) delete process.env.EDNOVA_ANALYTICS_MIN_COHORT;
          else process.env.EDNOVA_ANALYTICS_MIN_COHORT = value;
          const result = await request(owner);
          assert.equal(result.status, 200);
          assert.equal(result.body.suppressionReason, 'policy_pending');
          assert.equal(result.body.summary, null);
          assert.deepEqual(result.body.trends, []);
        }
      }
    );
    await t.test(
      'aggregate correctness caps repeat attempts and excludes mock, stale and incomplete receipts',
      async () => {
        process.env.EDNOVA_ANALYTICS_MIN_COHORT = '5';
        const result = await request(owner);
        assert.equal(result.status, 200);
        assert.match(result.cache || '', /no-store/);
        assert.equal(result.body.suppressed, false);
        assert.deepEqual(result.body.summary, {
          enrolledLearners: 20,
          practicedLearners: 6,
          masteredLearners: 6
        });
        assert.deepEqual(result.body.activityBreakdown, [
          { activityType: 'InteractiveQuiz', practicedLearners: 6 },
          { activityType: 'GuidedProblem', practicedLearners: null }
        ]);
        assert.equal(result.body.trends.length, 8);
        assert.equal(result.body.trends.at(-1).practicedLearners, 6);
        const serialized = JSON.stringify(result.body);
        for (const secret of [
          'PRIVATE_',
          'answers',
          'attemptId',
          'evidenceId',
          'userId',
          'rubric',
          'storageRef',
          cohort[0]
        ])
          assert.ok(!serialized.includes(secret), secret);
      }
    );
    await t.test(
      'small cohorts and complementary cells suppress all identifying counts',
      async () => {
        process.env.EDNOVA_ANALYTICS_MIN_COHORT = '15';
        const complementary = await request(owner);
        assert.equal(complementary.body.summary.practicedLearners, null);
        process.env.EDNOVA_ANALYTICS_MIN_COHORT = '21';
        const small = await request(owner);
        assert.equal(small.body.suppressionReason, 'small_cohort');
        assert.equal(small.body.summary, null);
        assert.deepEqual(small.body.activityBreakdown, []);
        process.env.EDNOVA_ANALYTICS_MIN_COHORT = '5';
      }
    );
    await t.test(
      'delivery-time revoked instructor access is denied after an actual evidence read',
      async () => {
        // Revoke while the service is reading evidence, which is the window the
        // previous aggregation spy opened. The service must re-check access at
        // delivery and refuse rather than return the rows it already read.
        const original = models.LearningEvidence.find;
        models.LearningEvidence.find = function (
          this: typeof models.LearningEvidence,
          ...args: Parameters<typeof original>
        ) {
          const cursor = original.apply(this, args);
          const then = cursor.then.bind(cursor);
          cursor.then = async function (onFulfilled?: never, onRejected?: never) {
            const rows = await then();
            await models.InstitutionMembership.updateOne(
              { institutionId: alpha.id, userId: owner.id },
              { status: 'suspended' }
            );
            return then(onFulfilled, onRejected).then(() => rows);
          } as typeof cursor.then;
          return cursor;
        } as typeof original;
        try {
          assert.equal((await request(owner)).status, 403);
        } finally {
          models.LearningEvidence.find = original;
          await models.InstitutionMembership.updateOne(
            { institutionId: alpha.id, userId: owner.id },
            { status: 'active' }
          );
        }
      }
    );
    await t.test(
      'changing the active cohort during the read fails closed at delivery',
      async () => {
        const original = models.LearningEvidence.find;
        models.LearningEvidence.find = function (
          this: typeof models.LearningEvidence,
          ...args: Parameters<typeof original>
        ) {
          const cursor = original.apply(this, args);
          const then = cursor.then.bind(cursor);
          cursor.then = async function (onFulfilled?: never, onRejected?: never) {
            const rows = await then();
            await models.CourseEnrollment.updateOne(
              { courseId, userId: cohort[19] },
              { status: 'revoked' }
            );
            return then(onFulfilled, onRejected).then(() => rows);
          } as typeof cursor.then;
          return cursor;
        } as typeof original;
        try {
          assert.equal((await request(owner)).status, 409);
        } finally {
          models.LearningEvidence.find = original;
        }
      }
    );
  }
);
