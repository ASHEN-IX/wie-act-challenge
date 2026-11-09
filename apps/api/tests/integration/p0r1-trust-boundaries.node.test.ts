import {
  materializeRevisionFixture,
  cleanupRevisionFixtures
} from '../helpers/revisionArtifactFixture';
import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase, prisma } from '../../shared/database';
import { newId } from '../../shared/ids';
import http from 'node:http';
import WebSocket from 'ws';
import { randomUUID, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';

test(
  'P0-R1 real sessions, current grants and secure activity foundation',
  { timeout: 120000 },
  async (t) => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL || 'postgresql://ednova:ednova@127.0.0.1:5433/ednova_test';
    Object.assign(process.env, {
      NODE_ENV: 'test',
      BETTER_AUTH_SECRET: 'p0r1-synthetic-secret-at-least-32-characters',
      INTERNAL_API_SECRET: 'p0r1-synthetic-internal-secret',
      BETTER_AUTH_URL: 'http://localhost:5173',
      AUTH_TRUSTED_ORIGINS: 'http://localhost:5173',
      RABBITMQ_URL: 'amqp://127.0.0.1:1',
      REDIS_URL: '',
      AI_SERVICE_URL: 'http://127.0.0.1:1'
    });
    await connectDatabase();
    // Teardown must also handle bootstrap failure before assignment.
    // eslint-disable-next-line prefer-const
    let runtime: Awaited<ReturnType<(typeof import('../../src/main.js'))['start']>> | undefined;
    const sockets: WebSocket[] = [];
    const servers: http.Server[] = [];
    const actorIds = ['instructor', 'learner', 'peer', 'admin', 'foreign', 'personal'].map(() =>
      newId()
    );
    const courses: string[] = [];
    const institutions: string[] = [];
    t.after(async () => {
      for (const socket of sockets) socket.terminate();
      for (const server of servers) {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
      await cleanupRevisionFixtures();
      await runtime?.stop();
      try {
        await prisma.authSession.deleteMany({ where: { userId: { in: actorIds } } });
        await prisma.authAccount.deleteMany({ where: { userId: { in: actorIds } } });
        await prisma.authUser.deleteMany({ where: { id: { in: actorIds } } });
        await prisma.user.deleteMany({ where: { id: { in: actorIds } } });
        await prisma.authRateLimit.deleteMany({});
        const models: typeof import('../../modules/study/src/models/index.js') | undefined =
          await import('../../modules/study/src/models/index.js').catch(() => undefined);
        if (models && courses.length) {
          await models.CourseRevision.deleteMany({ courseId: { $in: courses } });
          await models.CourseEnrollment.deleteMany({ courseId: { $in: courses } });
          await models.ActivityRecord.deleteMany({ courseId: { $in: courses } });
          await models.StudentAttempt.deleteMany({ courseId: { $in: courses } });
          await models.Course.deleteMany({ id: { $in: courses } });
        }
        if (models && institutions.length) {
          await models.InstitutionMembership.deleteMany({
            institutionId: { $in: institutions }
          });
          await models.Institution.deleteMany({ id: { $in: institutions } });
        }
      } finally {
        await disconnectDatabase().catch(() => {});
      }
    });
    const runTag = `${process.pid}_${Date.now()}`;
    const actors = ['instructor', 'learner', 'peer', 'admin', 'foreign', 'personal'].map(
      (name, index) => ({
        id: actorIds[index],
        name,
        email: name + '-' + runTag + '@p0r1.test',
        cookie: ''
      })
    );
    const [instructor, learner, peer, admin, foreign, personal] = actors;
    const password = await bcrypt.hash('Synthetic!123', 12);
    await prisma.authRateLimit.deleteMany({});
    for (const a of actors) {
      await prisma.user.create({
        data: {
          id: a.id,
          name: a.name,
          email: a.email,
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
        data: { id: a.id, email: a.email, name: a.name, emailVerified: true }
      });
      await prisma.authAccount.create({
        data: { id: newId(), accountId: a.id, providerId: 'credential', userId: a.id, password }
      });
    }
    const auth = await (await import('../../shared/betterAuth.js')).getAuth();
    for (const a of actors) {
      const r = await auth.api.signInEmail({
        body: { email: a.email, password: 'Synthetic!123' },
        asResponse: true
      });
      assert.equal(r.status, 200);
      a.cookie = r.headers
        .getSetCookie()
        .map((s: string) => s.split(';')[0])
        .join('; ');
    }
    runtime = await (await import('../../src/main.js')).start({ port: 0, workers: false });
    const origin = () => 'http://127.0.0.1:' + (runtime!.server.address() as { port: number }).port;
    async function request(a: typeof learner | null, method: string, path: string, body?: unknown) {
      const r = await fetch(origin() + path, {
        method,
        headers: {
          origin: 'http://localhost:5173',
          ...(a ? { cookie: a.cookie } : {}),
          ...(body === undefined ? {} : { 'content-type': 'application/json' })
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      return { status: r.status, body: (await r.json()) as Record<string, unknown> };
    }
    const m = await import('../../modules/study/src/models/index.js');
    const institution = await m.Institution.create({
      name: 'P0R1 A',
      slug: 'p0r1-a-' + Date.now(),
      createdByUserId: admin.id
    });
    institutions.push(institution.id.toString());
    const otherInstitution = await m.Institution.create({
      name: 'P0R1 B',
      slug: 'p0r1-b-' + Date.now(),
      createdByUserId: foreign.id
    });
    institutions.push(otherInstitution.id.toString());
    await m.InstitutionMembership.createMany([
      {
        institutionId: institution.id,
        userId: instructor.id,
        role: 'instructor',
        status: 'active'
      },
      {
        institutionId: institution.id,
        userId: learner.id,
        role: 'university_student',
        status: 'active'
      },
      {
        institutionId: institution.id,
        userId: peer.id,
        role: 'university_student',
        status: 'active'
      },
      {
        institutionId: institution.id,
        userId: admin.id,
        role: 'university_admin',
        status: 'active'
      },
      {
        institutionId: otherInstitution.id,
        userId: foreign.id,
        role: 'instructor',
        status: 'active'
      }
    ]);
    const hash =
      'sha256:' +
      createHash('sha256').update('Synthetic source: two plus two equals four.').digest('hex');
    const docId = 'doc_' + hash.slice(7, 23);
    const source = {
      documentId: docId,
      filename: 'synthetic.txt',
      contentHash: hash,
      provenance: 'extracted' as const
    };
    const topics = [
      {
        id: 'top_arithmetic',
        title: 'Arithmetic',
        subtopics: [
          {
            id: 'sub_addition',
            title: 'Addition',
            learning_objectives: [
              { id: 'obj_sum', statement: 'Compute two plus two', bloomLevel: 'apply' }
            ]
          }
        ]
      }
    ];
    const course = await m.Course.create({
      title: 'P0R1 arithmetic',
      subjectId: 'synthetic',
      userId: instructor.id,
      ownerUserId: instructor.id,
      scope: 'institutional',
      institutionId: institution.id,
      assignedInstructorIds: [instructor.id],
      status: 'completed',
      activeRevisionId: 'rev_source',
      topics,
      files: [
        {
          filename: 'synthetic.txt',
          originalName: 'synthetic.txt',
          size: 45,
          fileHash: hash,
          uploadedAt: new Date()
        }
      ]
    });
    const courseId = course.id.toString();
    courses.push(courseId);
    await m.CourseRevision.create({
      courseId,
      revisionTag: 'rev_source',
      contentHash: hash,
      status: 'published',
      isInstructorReviewed: true,
      publishedAt: new Date(),
      topics
    });
    await materializeRevisionFixture(courseId, 'rev_source');
    for (const a of [learner, peer])
      await m.CourseEnrollment.create({
        courseId,
        institutionId: institution.id,
        userId: a.id,
        status: 'active'
      });
    const context = '/api/v1/study/courses/' + courseId + '/published-context';

    await t.test(
      'REAL NEST HTTP: current membership/enrollment/institution and personal grants',
      async () => {
        assert.equal((await request(learner, 'GET', context)).status, 200);
        await m.InstitutionMembership.updateOne(
          { userId: learner.id },
          { $set: { status: 'suspended' } }
        );
        assert.equal((await request(learner, 'GET', context)).status, 403);
        await m.InstitutionMembership.updateOne(
          { userId: learner.id },
          { $set: { status: 'active' } }
        );
        await m.CourseEnrollment.updateOne({ userId: learner.id }, { $set: { status: 'revoked' } });
        assert.equal((await request(learner, 'GET', context)).status, 403);
        await m.CourseEnrollment.updateOne({ userId: learner.id }, { $set: { status: 'active' } });
        await m.Institution.updateOne({ id: institution.id }, { $set: { status: 'suspended' } });
        assert.equal((await request(learner, 'GET', context)).status, 403);
        await m.Institution.updateOne({ id: institution.id }, { $set: { status: 'active' } });
        assert.equal((await request(foreign, 'GET', context)).status, 403);
        const c = await m.Course.create({
          title: 'Personal',
          subjectId: 'synthetic',
          userId: personal.id,
          scope: 'personal'
        });
        courses.push(c.id.toString());
        assert.equal((await request(personal, 'GET', '/api/v1/study/courses/' + c.id)).status, 200);
        assert.equal((await request(admin, 'GET', '/api/v1/study/courses/' + c.id)).status, 404);
      }
    );

    await t.test(
      'REAL NEST HTTP: metadata admin cannot author/publish, revoked instructor loses authoring',
      async () => {
        assert.equal(
          (await request(admin, 'GET', '/api/v1/study/courses/' + courseId + '/draft')).status,
          403
        );
        assert.equal(
          (await request(admin, 'POST', '/api/v1/study/courses/' + courseId + '/publish', {}))
            .status,
          403
        );
        assert.equal(
          (await request(admin, 'GET', '/api/v1/study/courses/' + courseId + '/enrollments'))
            .status,
          200
        );
        await m.Course.updateOne({ id: courseId }, { $set: { assignedInstructorIds: [] } });
        assert.equal(
          (await request(instructor, 'GET', '/api/v1/study/courses/' + courseId + '/draft')).status,
          403
        );
        await m.Course.updateOne(
          { id: courseId },
          { $set: { assignedInstructorIds: [instructor.id] } }
        );
      }
    );

    await t.test('REAL NEST HTTP: delayed AI completion is withheld after revocation', async () => {
      let release!: () => void;
      let arrived!: () => void;
      const arrival = new Promise<void>((resolve) => {
        arrived = resolve;
      });
      const waiting = new Promise<void>((resolve) => {
        release = resolve;
      });
      const server = http.createServer(async (_req, res) => {
        arrived();
        await waiting;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            answer: 'protected synthetic text',
            pin: { courseId, revisionId: 'rev_source', contentHash: hash }
          })
        );
      });
      servers.push(server);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      process.env.AI_SERVICE_URL =
        'http://127.0.0.1:' + (server.address() as { port: number }).port;
      const pending = request(learner, 'POST', '/api/v1/study/courses/' + courseId + '/tutor/ask', {
        question: 'Explain addition'
      });
      await arrival;
      await m.InstitutionMembership.updateOne(
        { userId: learner.id },
        { $set: { status: 'suspended' } }
      );
      release();
      const r = await pending;
      assert.equal(r.status, 403);
      assert.ok(!JSON.stringify(r.body).includes('protected synthetic text'));
      await m.InstitutionMembership.updateOne(
        { userId: learner.id },
        { $set: { status: 'active' } }
      );
      process.env.AI_SERVICE_URL = 'http://127.0.0.1:1';
    });

    await t.test(
      'REAL WEBSOCKET: current institutional grant checked on subsequent delivery',
      async () => {
        // Peer study rooms are student-only, so the enrolled peer presents and
        // the suspended learner is the listener whose delivery must stop.
        const created = await request(peer, 'POST', '/api/v1/study/rooms', {
          courseId,
          title: 'Revocation room'
        });
        assert.equal(created.status, 201);
        const roomId = created.body.roomId;
        const joined = await request(learner, 'POST', '/api/v1/study/rooms/join', {
          inviteCode: created.body.inviteCode
        });
        assert.equal(joined.status, 200);
        const events: string[] = [];
        const socket = new WebSocket(
          origin().replace('http:', 'ws:') +
            '/ws/realtime?roomId=' +
            roomId +
            '&sessionId=' +
            roomId +
            '&userId=' +
            learner.id,
          {
            headers: { cookie: learner.cookie, origin: 'http://localhost:5173' }
          }
        );
        sockets.push(socket);
        socket.on('message', (x) => events.push(x.toString()));
        await new Promise<void>((resolve, reject) => {
          socket.once('open', resolve);
          socket.once('error', reject);
        });
        for (let i = 0; i < 100 && !events.some((x) => x.includes('ROOM_STATE_SYNC')); i++)
          await new Promise((r) => setTimeout(r, 20));
        assert.ok(events.some((x) => x.includes('ROOM_STATE_SYNC')));
        await m.InstitutionMembership.updateOne(
          { userId: learner.id },
          { $set: { status: 'suspended' } }
        );
        events.length = 0;
        const response = await request(peer, 'PUT', '/api/v1/study/rooms/' + roomId + '/phase', {
          currentPhase: 'peer_discussion'
        });
        assert.equal(response.status, 200);
        await new Promise((r) => setTimeout(r, 100));
        assert.ok(!events.some((x) => x.includes('"currentPhase":"peer_discussion"')));
        assert.equal((await request(learner, 'GET', '/api/v1/study/rooms/' + roomId)).status, 403);
        await m.InstitutionMembership.updateOne(
          { userId: learner.id },
          { $set: { status: 'active' } }
        );
      }
    );
    const service = await import('../../modules/study/src/services/activityAttempt.js');
    const publication = await import('../../modules/study/src/services/coursePublication.js');
    const { evaluateActivity } =
      await import('../../modules/study/src/services/activityEvaluation.js');
    const { parseContract } = await import('../../shared/ednova/contracts.js');
    const draft = await m.CourseRevision.create({
      courseId,
      revisionTag: 'rev_learning',
      contentHash: hash,
      status: 'draft',
      isInstructorReviewed: true,
      topics,
      sourceManifest: [source]
    });
    await materializeRevisionFixture(courseId, 'rev_learning');
    const definition = (id: string, type: 'GuidedProblem' | 'InteractiveQuiz' = 'GuidedProblem') =>
      parseContract('ActivityDefinition', {
        schemaVersion: '1.0.0',
        activityId: id,
        activityRevision: 'rev_act_1',
        componentVersion: '1.0.0',
        courseId,
        revisionId: 'rev_learning',
        contentHash: hash,
        objectiveId: 'obj_sum',
        title: 'Arithmetic',
        instructions: 'Answer the reviewed question',
        timeLimitSeconds: 180,
        visibility: 'public',
        language: 'en',
        sourceRefs: [
          {
            documentId: docId,
            pageNumber: null,
            contentHash: hash,
            provenance: 'extracted',
            locationKnown: false
          }
        ],
        constraints: { maxAttempts: 3, allowCalculator: false },
        activityType: type,
        presentationData:
          type === 'GuidedProblem'
            ? {
                problem: 'What is two plus two?',
                steps: [
                  { stepId: 'step_sum', prompt: 'State sum' },
                  { stepId: 'step_name', prompt: 'Name the sum' }
                ]
              }
            : {
                question: 'Two plus two?',
                options: [
                  { id: 'opt_four', label: '4' },
                  { id: 'opt_other', label: '999' }
                ],
                isMultiSelect: false
              }
      });
    const pin = (a: ReturnType<typeof definition>) => ({
      courseId: a.courseId,
      revisionId: a.revisionId,
      contentHash: a.contentHash,
      activityId: a.activityId,
      activityRevision: a.activityRevision,
      activityType: a.activityType
    });
    const evaluation = (a: ReturnType<typeof definition>, model = false) =>
      parseContract('ServerEvaluationDefinition', {
        schemaVersion: '1.0.0',
        visibility: 'server_only',
        activity: pin(a),
        evaluationRef: 'eval_' + a.activityId,
        evaluatorType: model ? 'llm_evaluation' : 'deterministic_rubric',
        rubricVersion: a.activityType === 'GuidedProblem' ? 'exact-answer-v1' : 'exact-options-v1',
        rubric: 'Instructor reviewed exact answer policy; no executable rubric',
        answerKey: a.activityType === 'GuidedProblem' ? ['4', 'four'] : ['opt_four']
      });
    const guided = definition('act_p0r1_guided'),
      quiz = definition('act_p0r1_quiz', 'InteractiveQuiz');
    const unavailable = definition('act_p0r1_unavailable');
    const answer = (a: ReturnType<typeof definition>, id = randomUUID(), correct = true) =>
      parseContract('AttemptSubmission', {
        schemaVersion: '1.0.0',
        attemptId: id,
        activity: pin(a),
        roomId: null,
        timeSpentSeconds: 5,
        answers:
          a.activityType === 'GuidedProblem'
            ? {
                steps: [
                  { stepId: 'step_sum', answer: correct ? '4' : '2+2=999' },
                  { stepId: 'step_name', answer: correct ? 'four' : 'nonsense' }
                ]
              }
            : { selectedOptionIds: [correct ? 'opt_four' : 'opt_other'] }
      });

    await t.test(
      'DIRECT SERVICE: draft registration binds actor/course/path/source/full evaluation pin',
      async () => {
        for (const a of [guided, quiz, unavailable]) {
          await service.registerActivity(
            instructor.id,
            courseId,
            a,
            evaluation(a, a === unavailable),
            a.activityId
          );
        }
        const foreignDefinition = {
          ...guided,
          activityId: 'act_foreign',
          courseId: newId()
        };
        await assert.rejects(
          service.registerActivity(instructor.id, courseId, foreignDefinition, {
            ...evaluation(guided),
            activity: pin(foreignDefinition)
          }),
          { status: 400 }
        );
        await assert.rejects(
          service.registerActivity(admin.id, courseId, guided, evaluation(guided)),
          { status: 403 }
        );
        const forgedSource = {
          ...guided,
          activityId: 'act_forged_source',
          sourceRefs: [{ ...guided.sourceRefs[0], documentId: 'doc_foreign' }]
        };
        await assert.rejects(
          service.registerActivity(instructor.id, courseId, forgedSource, {
            ...evaluation(guided),
            activity: pin(forgedSource)
          }),
          { status: 400 }
        );
        const knownPage = {
          ...guided,
          activityId: 'act_forged_page',
          sourceRefs: [{ ...guided.sourceRefs[0], pageNumber: 99999, locationKnown: true }]
        };
        await assert.rejects(
          service.registerActivity(instructor.id, courseId, knownPage, {
            ...evaluation(guided),
            activity: pin(knownPage)
          }),
          { status: 400 }
        );
        assert.equal(await m.ActivityRecord.countDocuments({ courseId }), 3);
        await publication.publishCourseRevision(instructor.id, courseId, draft.revisionTag);
      }
    );

    await t.test('PURE DOMAIN: actual correctness and unsupported evaluation fail closed', () => {
      assert.equal(evaluateActivity(guided, evaluation(guided), answer(guided)).status, 'graded');
      const wrong = evaluateActivity(
        guided,
        evaluation(guided),
        answer(guided, randomUUID(), false)
      );
      assert.deepEqual(wrong.status === 'graded' && [wrong.score, wrong.isCorrect], [0, false]);
      assert.equal(evaluateActivity(quiz, evaluation(quiz), answer(quiz)).status, 'graded');
      assert.equal(
        evaluateActivity(guided, evaluation(guided, true), answer(guided)).status,
        'unavailable'
      );
      assert.equal(
        evaluateActivity(
          guided,
          { ...evaluation(guided), rubricVersion: 'legacy-free-text' },
          answer(guided)
        ).status,
        'unavailable'
      );
    });

    await t.test(
      'DIRECT SERVICE: nonsense has private feedback but no evidence; unavailable has no mastery',
      async () => {
        const wrongId = randomUUID();
        const wrong = await service.submitAttempt(learner.id, answer(guided, wrongId, false));
        assert.equal(wrong.status, 'graded');
        if (wrong.status === 'graded') {
          assert.equal(wrong.score, 0);
          assert.equal(wrong.evidenceId, null);
        }
        assert.equal(
          await m.LearningEvidence.countDocuments({ userId: learner.id, attemptId: wrongId }),
          0
        );
        const id = randomUUID();
        assert.equal(
          (await service.submitAttempt(learner.id, answer(unavailable, id))).status,
          'unavailable'
        );
        assert.equal(await m.LearningEvidence.countDocuments({ attemptId: id }), 0);
      }
    );

    await t.test(
      'DIRECT SERVICE: forged hash/revision, missing/duplicate/foreign/empty steps and invalid options write nothing',
      async () => {
        const invalid: unknown[] = [];
        const original = answer(guided);
        invalid.push({
          ...original,
          activity: { ...original.activity, contentHash: 'sha256:' + 'f'.repeat(64) }
        });
        invalid.push({
          ...original,
          activity: { ...original.activity, activityRevision: 'rev_forged' }
        });
        invalid.push({
          ...original,
          activity: { ...original.activity, revisionId: 'rev_missing' }
        });
        invalid.push({ ...original, answers: { steps: [{ stepId: 'step_sum', answer: '4' }] } });
        invalid.push({
          ...original,
          answers: {
            steps: [
              { stepId: 'step_sum', answer: '4' },
              { stepId: 'step_sum', answer: 'four' }
            ]
          }
        });
        invalid.push({
          ...original,
          answers: {
            steps: [
              { stepId: 'step_sum', answer: '4' },
              { stepId: 'foreign', answer: 'four' }
            ]
          }
        });
        invalid.push({
          ...original,
          answers: {
            steps: [
              { stepId: 'step_sum', answer: '' },
              { stepId: 'step_name', answer: 'four' }
            ]
          }
        });
        invalid.push({ ...answer(quiz), answers: { selectedOptionIds: ['forged'] } });
        const before = await m.StudentAttempt.countDocuments();
        const evidenceBefore = await m.LearningEvidence.countDocuments();
        for (const input of invalid) await assert.rejects(service.submitAttempt(learner.id, input));
        assert.equal(await m.StudentAttempt.countDocuments(), before);
        assert.equal(await m.LearningEvidence.countDocuments(), evidenceBefore);
        await assert.rejects(
          publication.getPublishedCourseContext(learner.id, courseId, 'rev_missing'),
          { code: 'UNPUBLISHED' }
        );
        await assert.rejects(
          service.registerActivity(instructor.id, courseId, guided, {
            ...evaluation(guided),
            answerKey: ['999', 'bad']
          }),
          { status: 409 }
        );
      }
    );

    await t.test(
      'DIRECT SERVICE: eight concurrent submissions, conflicting retry and independent actor receipt IDs',
      async () => {
        const attemptId = randomUUID(),
          submission = answer(guided, attemptId);
        const results = await Promise.all(
          Array.from({ length: 8 }, () => service.submitAttempt(learner.id, submission))
        );
        for (const r of results) assert.deepEqual(r, results[0]);
        assert.equal(results[0].status, 'graded');
        assert.equal(await m.StudentAttempt.countDocuments({ userId: learner.id, attemptId }), 1);
        assert.equal(await m.LearningEvidence.countDocuments({ userId: learner.id, attemptId }), 1);
        const evidence = await m.LearningEvidence.findOne({ userId: learner.id, attemptId }).lean();
        assert.equal(evidence?.evaluator.executionMode, 'MOCK_TEST');
        await assert.rejects(service.submitAttempt(learner.id, answer(guided, attemptId, false)), {
          status: 409
        });
        await service.submitAttempt(peer.id, submission);
        const own = await service.getAttemptResult(learner.id, attemptId, guided.activityId);
        const peers = await service.getAttemptResult(peer.id, attemptId, guided.activityId);
        assert.equal(own.userId, learner.id);
        assert.equal(peers.userId, peer.id);
        await assert.rejects(service.getAttemptResult(foreign.id, attemptId, guided.activityId), {
          status: 404
        });
        await assert.rejects(service.getAttemptResult(learner.id, attemptId, quiz.activityId), {
          status: 404
        });
        await m.CourseEnrollment.updateOne({ userId: learner.id }, { $set: { status: 'revoked' } });
        await assert.rejects(service.getAttemptResult(learner.id, attemptId), { status: 403 });
        assert.equal(await m.LearningEvidence.countDocuments({ userId: learner.id, attemptId }), 1);
        await m.CourseEnrollment.updateOne({ userId: learner.id }, { $set: { status: 'active' } });
      }
    );

    for (const stage of ['claim', 'prepare', 'evidence']) {
      await t.test('DIRECT SERVICE / ACTUAL PROCESS KILL: recover after ' + stage, async () => {
        const attemptId = randomUUID(),
          submission = answer(guided, attemptId);
        const inputFile = path.join(tmpdir(), 'p0r1-crash-' + attemptId + '.json');
        await writeFile(inputFile, JSON.stringify({ actor: learner.id, submission, stage }));
        const child = spawn(
          process.execPath,
          [
            '--import',
            require.resolve('tsx'),
            path.resolve(__dirname, '../helpers/p0r1-attempt-crash.ts'),
            inputFile
          ],
          {
            env: {
              ...process.env,
              TSX_TSCONFIG_PATH: path.resolve(__dirname, '../../tsconfig.json')
            },
            stdio: ['ignore', 'pipe', 'pipe']
          }
        );
        let output = '';
        try {
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              child.kill('SIGKILL');
              reject(new Error('Child did not reach crash boundary: ' + output));
            }, 15000);
            child.stdout.on('data', (x) => {
              output += x.toString();
              if (output.includes('P0R1_CRASH_READY')) child.kill('SIGKILL');
            });
            child.stderr.on('data', (x) => {
              output += x.toString();
            });
            child.once('error', (error) => {
              clearTimeout(timeout);
              reject(error);
            });
            child.once('exit', (_code, signal) => {
              clearTimeout(timeout);
              if (signal === 'SIGKILL' && output.includes('P0R1_CRASH_READY')) resolve();
              else reject(new Error(output));
            });
          });
          assert.equal(await m.StudentAttempt.countDocuments({ userId: learner.id, attemptId }), 1);
          assert.equal(
            await m.LearningEvidence.countDocuments({ userId: learner.id, attemptId }),
            stage === 'evidence' ? 1 : 0
          );
          const recovered = await service.submitAttempt(learner.id, submission);
          assert.equal(recovered.status, 'graded');
          assert.equal(
            await m.LearningEvidence.countDocuments({ userId: learner.id, attemptId }),
            1
          );
          assert.deepEqual(await service.submitAttempt(learner.id, submission), recovered);
        } finally {
          child.kill('SIGKILL');
          await unlink(inputFile);
        }
      });
    }

    await t.test(
      'DIRECT SERVICE: published original survives mutable course upload replacement',
      async () => {
        const before = await m.Course.findById(courseId).lean();
        await m.Course.updateOne({ id: courseId }, { $set: { files: [] } });
        assert.equal(
          (await service.getPublicActivity(learner.id, guided.activityId)).activityId,
          guided.activityId
        );
        await m.Course.updateOne({ id: courseId }, { $set: { files: before!.files } });
      }
    );

    // Canonical HTTP was restored only after the service gate passed.
    {
      await t.test(
        'REAL NEST HTTP: register draft, publish, submit, replay, private lookup and revocation',
        async () => {
          const rev = 'rev_http';
          await m.CourseRevision.create({
            courseId,
            revisionTag: rev,
            contentHash: hash,
            status: 'draft',
            isInstructorReviewed: true,
            topics,
            sourceManifest: [source]
          });
          await materializeRevisionFixture(courseId, rev);
          const a = { ...quiz, activityId: 'act_p0r1_http', revisionId: rev };
          const ev = { ...evaluation(a), activity: pin(a) };
          const url = '/api/v1/study/activities/' + a.activityId;
          assert.equal(
            (
              await request(instructor, 'POST', url + '/register', {
                courseId,
                activity: a,
                serverEvaluation: ev
              })
            ).status,
            201
          );
          await publication.publishCourseRevision(instructor.id, courseId, rev);
          assert.equal((await request(null, 'GET', url)).status, 401);
          assert.equal((await request(foreign, 'GET', url)).status, 403);
          const loaded = await request(learner, 'GET', url);
          assert.equal(loaded.status, 200);
          assert.ok(!JSON.stringify(loaded.body).includes('answerKey'));
          const wrong = await request(
            learner,
            'POST',
            url + '/attempts',
            answer(a, randomUUID(), false)
          );
          assert.equal(wrong.status, 200);
          assert.equal(wrong.body.evidenceId, null);
          const id = randomUUID(),
            payload = answer(a, id);
          const results = await Promise.all(
            Array.from({ length: 8 }, () => request(learner, 'POST', url + '/attempts', payload))
          );
          for (const r of results) {
            assert.equal(r.status, 200);
            assert.deepEqual(r.body, results[0].body);
          }
          assert.equal(
            (await request(learner, 'POST', url + '/attempts', answer(a, id, false))).status,
            409
          );
          assert.equal((await request(learner, 'GET', url + '/attempts/' + id)).status, 200);
          assert.equal((await request(peer, 'GET', url + '/attempts/' + id)).status, 404);
          await m.InstitutionMembership.updateOne(
            { userId: learner.id },
            { $set: { status: 'suspended' } }
          );
          for (const path of [url, url + '/attempts/' + id])
            assert.equal((await request(learner, 'GET', path)).status, 403);
          assert.equal((await request(learner, 'POST', url + '/attempts', answer(a))).status, 403);
        }
      );
    }
  }
);
