import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { migrateAuth } from '../../scripts/migrate-auth';

/** Real Nest/session/Mongo checks. All records and users are synthetic. */
test(
  'ED-19 instructor aggregate authorization, suppression and verified receipts',
  { timeout: 90000 },
  async (t) => {
    const database = `ednova_ed19_${process.pid}_${Date.now()}`;
    Object.assign(process.env, {
      NODE_ENV: 'test',
      MONGODB_URI: `mongodb://127.0.0.1:27018/${database}`,
      DB_NAME: database,
      BETTER_AUTH_SECRET: 'ed19-test-secret-at-least-32-characters',
      BETTER_AUTH_URL: 'http://localhost:5173',
      AUTH_TRUSTED_ORIGINS: 'http://localhost:5173',
      INTERNAL_API_SECRET: 'ed19-internal-secret',
      AI_SERVICE_URL: 'http://127.0.0.1:1',
      RABBITMQ_URL: 'amqp://127.0.0.1:1',
      REDIS_URL: ''
    });
    const originalThreshold = process.env.EDNOVA_ANALYTICS_MIN_COHORT;
    const client = await new MongoClient(process.env.MONGODB_URI!).connect();
    const db = client.db();
    const runtime: {
      current?: Awaited<ReturnType<(typeof import('../../src/main.js'))['start']>>;
    } = {};
    t.after(async () => {
      if (originalThreshold === undefined) delete process.env.EDNOVA_ANALYTICS_MIN_COHORT;
      else process.env.EDNOVA_ANALYTICS_MIN_COHORT = originalThreshold;
      await runtime.current?.stop();
      await db.dropDatabase();
      await client.close();
    });
    const actors = ['owner', 'other', 'foreign', 'admin', 'student'].map((name) => ({
      name,
      id: new ObjectId(),
      email: `ed19-${name}@synthetic.test`,
      cookie: ''
    }));
    const password = await bcrypt.hash('Synthetic!123', 12);
    await db.collection('users').insertMany(
      actors.map((actor) => ({
        _id: actor.id,
        name: actor.name,
        email: actor.email,
        password,
        role: 'student',
        tier: 'vip',
        isActive: true,
        isVerified: true
      }))
    );
    await migrateAuth(db, { apply: true });
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
      slug: 'ed19-alpha',
      status: 'active',
      createdByUserId: admin.id.toString()
    });
    const beta = await models.Institution.create({
      name: 'Beta',
      slug: 'ed19-beta',
      status: 'active',
      createdByUserId: foreign.id.toString()
    });
    await models.InstitutionMembership.create(
      actors.map((actor) => ({
        institutionId: actor === foreign ? beta._id : alpha._id,
        userId: actor.id.toString(),
        status: 'active',
        role:
          actor === admin
            ? 'university_admin'
            : actor === student
              ? 'university_student'
              : 'instructor'
      }))
    );
    const cohort = [student.id, ...Array.from({ length: 19 }, () => new ObjectId())];
    await db.collection('users').insertMany(
      cohort.slice(1).map((id, i) => ({
        _id: id,
        email: `ed19-cohort-${i}@synthetic.test`,
        name: 'Private synthetic learner',
        role: 'student',
        isActive: true,
        isVerified: true
      }))
    );
    await models.InstitutionMembership.create(
      cohort.slice(1).map((id) => ({
        institutionId: alpha._id,
        userId: id.toString(),
        role: 'university_student',
        status: 'active'
      }))
    );
    const course = await models.Course.create({
      userId: owner.id.toString(),
      ownerUserId: owner.id.toString(),
      title: 'Owned reviewed course',
      subjectId: 'synthetic',
      scope: 'institutional',
      institutionId: alpha._id,
      assignedInstructorIds: [owner.id.toString()],
      status: 'completed',
      activeRevisionId: 'rev_analytics'
    });
    const courseId = String(course._id),
      hash = 'sha256:' + 'a'.repeat(64);
    await models.CourseEnrollment.create(
      cohort.map((id) => ({
        courseId,
        institutionId: alpha._id,
        userId: id.toString(),
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
        userId: cohort[index].toString(),
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
        userId: cohort[index].toString(),
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
          cohort[0].toString()
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
      'delivery-time revoked instructor access is denied after an actual Mongo aggregation',
      async () => {
        const original = models.LearningEvidence.aggregate;
        models.LearningEvidence.aggregate = function (
          this: typeof models.LearningEvidence,
          ...args: Parameters<typeof original>
        ) {
          const aggregate = original.apply(this, args);
          const execute = aggregate.exec.bind(aggregate);
          aggregate.exec = async function () {
            const result = await execute();
            await models.InstitutionMembership.updateOne(
              { institutionId: alpha._id, userId: owner.id.toString() },
              { $set: { status: 'suspended' } }
            );
            return result;
          };
          return aggregate;
        } as typeof original;
        try {
          assert.equal((await request(owner)).status, 403);
        } finally {
          models.LearningEvidence.aggregate = original;
          await models.InstitutionMembership.updateOne(
            { institutionId: alpha._id, userId: owner.id.toString() },
            { $set: { status: 'active' } }
          );
        }
      }
    );
    await t.test(
      'changing the active cohort during aggregation fails closed at delivery',
      async () => {
        const original = models.LearningEvidence.aggregate;
        models.LearningEvidence.aggregate = function (
          this: typeof models.LearningEvidence,
          ...args: Parameters<typeof original>
        ) {
          const aggregate = original.apply(this, args);
          const execute = aggregate.exec.bind(aggregate);
          aggregate.exec = async function () {
            const result = await execute();
            await models.CourseEnrollment.updateOne(
              { courseId, userId: cohort[19].toString() },
              { $set: { status: 'revoked' } }
            );
            return result;
          };
          return aggregate;
        } as typeof original;
        try {
          assert.equal((await request(owner)).status, 409);
        } finally {
          models.LearningEvidence.aggregate = original;
        }
      }
    );
  }
);
