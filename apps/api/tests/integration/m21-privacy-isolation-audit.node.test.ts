import {
  cleanupCourseFixtures,
  prepareCourseFixture,
  prepareDraftFixture,
  reviewActivityFixture
} from '../helpers/reviewedActivityFixture';
import test from 'node:test';
import assert from 'node:assert/strict';
import express, { type Response, type NextFunction } from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import crypto from 'node:crypto';

import {
  ActivityRecord,
  Course,
  CourseEnrollment,
  CourseRevision,
  Institution,
  InstitutionMembership,
  LearningEvidence,
  StudentAttempt,
  StudyRoom
} from '../../modules/study/src/models';
import coursesRouter from '../../modules/study/src/routes/courses';
import activitiesRouter from '../../modules/study/src/routes/activities';
import roomsRouter from '../../modules/study/src/routes/rooms';
import institutionsRouter from '../../modules/study/src/routes/institutions';
import enrollmentsRouter from '../../modules/study/src/routes/enrollments';
import { updateCourseDraft } from '../../modules/study/src/services/courseDraft';
import { publishCourseRevision } from '../../modules/study/src/services/coursePublication';
import { registerActivity, submitAttempt } from '../../modules/study/src/services/activityAttempt';
import type { DomainRequest } from '../../src/framework/contracts';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27018/ednova-test';

test('M21 / ED-13: Comprehensive Privacy, Resource Isolation & Synthetic Compliance Audit', async (t) => {
  await mongoose.connect(MONGO_URI);

  const testPrefix = `m21_priv_${Date.now()}`;
  const instAId = new mongoose.Types.ObjectId();
  const instBId = new mongoose.Types.ObjectId();

  // Synthetic user identities
  const instAAdmin = `${testPrefix}_admin_a`;
  const instAInstructor = `${testPrefix}_instructor_a`;
  const instAStudent1 = `${testPrefix}_student1_a`;
  const instAStudent2 = `${testPrefix}_student2_a`;

  const instBInstructor = `${testPrefix}_instructor_b`;
  const instBStudent = `${testPrefix}_student_b`;

  let courseAId: string;
  let courseBId: string;
  let publishedRevA: string;
  let effectiveContentHash: string;
  const quizActivityId = `act_${testPrefix}_quiz_1`;
  const activityRevision = 'rev_act_1';
  const objectiveId = 'obj_privacy_eval_1';
  async function registerReviewedActivity(
    actor: string,
    id: string,
    activity: Record<string, unknown>,
    evaluation: Record<string, unknown>
  ) {
    await reviewActivityFixture(id, activity, evaluation);
    return registerActivity(actor, id, activity, evaluation);
  }

  let roomId: string;
  let inviteCode: string;
  let student1AttemptId: string;

  const app = express();
  app.use(express.json());
  app.use((req: DomainRequest, _res: Response, next: NextFunction) => {
    const actorHeader = req.headers['x-test-actor'];
    if (actorHeader) {
      req.user = {
        userId: String(actorHeader),
        email: `${actorHeader}@synthetic.edu`,
        name: String(actorHeader).replace(/_/g, ' '),
        role: 'user'
      };
    }
    next();
  });
  app.use('/api/v1/study/courses', coursesRouter);
  app.use('/api/v1/study/activities', activitiesRouter);
  app.use('/api/v1/study/rooms', roomsRouter);
  app.use('/api/v1/study/institutions', institutionsRouter);
  app.use('/api/v1/study/enrollments', enrollmentsRouter);

  t.after(async () => {
    await cleanupCourseFixtures();
    try {
      if (courseAId) {
        await Course.deleteMany({ _id: { $in: [courseAId, courseBId] } });
        await CourseRevision.deleteMany({ courseId: { $in: [courseAId, courseBId] } });
        await CourseEnrollment.deleteMany({ courseId: { $in: [courseAId, courseBId] } });
        await ActivityRecord.deleteMany({ courseId: { $in: [courseAId, courseBId] } });
        await StudentAttempt.deleteMany({ courseId: { $in: [courseAId, courseBId] } });
        await LearningEvidence.deleteMany({ 'activity.courseId': { $in: [courseAId, courseBId] } });
      }
      await Institution.deleteMany({ _id: { $in: [instAId, instBId] } });
      await InstitutionMembership.deleteMany({ institutionId: { $in: [instAId, instBId] } });
      if (roomId) {
        await StudyRoom.deleteMany({ roomId });
      }
    } finally {
      await mongoose.disconnect();
    }
  });

  await t.test('Setup: Create dual synthetic institutions, courses, and memberships', async () => {
    // Institution A
    await Institution.create({
      _id: instAId,
      name: 'Synthetic Institute of Technology',
      slug: `sit-${testPrefix}`,
      createdByUserId: instAAdmin,
      domain: 'sit.synthetic.edu',
      status: 'active'
    });
    await InstitutionMembership.create([
      { institutionId: instAId, userId: instAAdmin, role: 'university_admin', status: 'active' },
      { institutionId: instAId, userId: instAInstructor, role: 'instructor', status: 'active' },
      {
        institutionId: instAId,
        userId: instAStudent1,
        role: 'university_student',
        status: 'active'
      },
      {
        institutionId: instAId,
        userId: instAStudent2,
        role: 'university_student',
        status: 'active'
      }
    ]);

    // Institution B
    await Institution.create({
      _id: instBId,
      name: 'Synthetic Academy of Science',
      slug: `sas-${testPrefix}`,
      createdByUserId: instBInstructor,
      domain: 'sas.synthetic.edu',
      status: 'active'
    });
    await InstitutionMembership.create([
      { institutionId: instBId, userId: instBInstructor, role: 'instructor', status: 'active' },
      { institutionId: instBId, userId: instBStudent, role: 'university_student', status: 'active' }
    ]);

    // Course A
    const courseADoc = await Course.create({
      title: 'Course A - Data Structures',
      description: 'Privacy isolated course A.',
      subjectId: 'subj_cs_101',
      userId: instAAdmin,
      ownerUserId: instAAdmin,
      scope: 'institutional',
      institutionId: instAId.toString(),
      assignedInstructorIds: [instAInstructor],
      status: 'completed',
      topics: []
    });
    courseAId = courseADoc._id.toString();
    await prepareCourseFixture(courseAId, t);

    // Course B
    const courseBDoc = await Course.create({
      title: 'Course B - Quantum Computing',
      description: 'Privacy isolated course B.',
      subjectId: 'subj_qc_201',
      userId: instBInstructor,
      ownerUserId: instBInstructor,
      scope: 'institutional',
      institutionId: instBId.toString(),
      assignedInstructorIds: [instBInstructor],
      status: 'completed',
      topics: []
    });
    courseBId = courseBDoc._id.toString();
    await prepareCourseFixture(courseBId, t);

    // Draft & Publish Course A
    const initialHash = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const revA = await CourseRevision.create({
      courseId: courseAId,
      revisionTag: `rev_init_${Date.now()}`,
      contentHash: initialHash,
      status: 'draft',
      isInstructorReviewed: false,
      topics: []
    });

    const draftRes = await updateCourseDraft(instAInstructor, courseAId, {
      expectedRevisionTag: revA.revisionTag,
      summary: 'Reviewed data structures curriculum',
      isInstructorReviewed: true,
      topics: [
        {
          id: 'topic_hash_tables',
          title: 'Hash Tables and Collision Resolution',
          subtopics: [
            {
              id: 'sub_chaining',
              title: 'Separate Chaining Analysis',
              learning_objectives: [
                {
                  id: objectiveId,
                  text: 'Analyze worst-case lookup complexity in hash tables with chaining',
                  bloomLevel: 'analyze'
                }
              ]
            }
          ]
        }
      ]
    });

    const rawContentHash = draftRes.contentHash.replace(/^sha256:/, '');
    effectiveContentHash = `sha256:${rawContentHash.length === 64 ? rawContentHash : '0'.repeat(64)}`;

    publishedRevA = draftRes.revisionTag;
    await prepareDraftFixture(courseAId, publishedRevA);

    // Register Activity in Course A
    await registerReviewedActivity(
      instAInstructor,
      courseAId,
      {
        schemaVersion: '1.0.0',
        activityId: quizActivityId,
        activityRevision,
        componentVersion: '1.0.0',
        courseId: courseAId,
        revisionId: publishedRevA,
        contentHash: effectiveContentHash,
        objectiveId,
        title: 'Chaining Complexity Check',
        instructions: 'Choose the correct worst-case bound.',
        timeLimitSeconds: 120,
        visibility: 'public',
        language: 'en',
        sourceRefs: [
          {
            documentId: 'doc_hash_1',
            pageNumber: 1,
            contentHash: effectiveContentHash,
            provenance: 'extracted',
            locationKnown: true
          }
        ],
        constraints: { maxAttempts: 3, allowCalculator: false },
        activityType: 'InteractiveQuiz',
        presentationData: {
          question: 'What is the worst-case lookup time in a hash table with separate chaining?',
          options: [
            { id: 'opt_o_n', label: 'O(n) when all keys hash to the same bucket' },
            { id: 'opt_o_1', label: 'Strict O(1) guaranteed bound' }
          ],
          isMultiSelect: false
        }
      },
      {
        schemaVersion: '1.0.0',
        visibility: 'server_only',
        activity: {
          courseId: courseAId,
          revisionId: publishedRevA,
          contentHash: effectiveContentHash,
          activityId: quizActivityId,
          activityRevision,
          activityType: 'InteractiveQuiz'
        },
        evaluationRef: 'eval_chaining_1',
        evaluatorType: 'deterministic_rubric',
        rubricVersion: 'v1',
        rubric: 'Grounded complexity check',
        answerKey: ['opt_o_n']
      }
    );

    // Enroll students in Course A
    await CourseEnrollment.create([
      {
        courseId: courseAId,
        institutionId: instAId,
        userId: instAStudent1,
        enrolledRole: 'student',
        status: 'active'
      },
      {
        courseId: courseAId,
        institutionId: instAId,
        userId: instAStudent2,
        enrolledRole: 'student',
        status: 'active'
      }
    ]);

    await prepareCourseFixture(courseAId, t);

    await publishCourseRevision(instAInstructor, courseAId, publishedRevA);
  });

  await t.test(
    'ED-13.1: Cross-Tenant Isolation: Inst B instructor cannot read or modify Inst A course',
    async () => {
      // Read attempt by foreign instructor (404 hides course presence, preventing enumeration)
      const readRes = await request(app)
        .get(`/api/v1/study/courses/${courseAId}`)
        .set('x-test-actor', instBInstructor);
      assert.ok([403, 404].includes(readRes.status), 'Foreign instructor must not access Course A');

      // Draft attempt by foreign instructor (403 forbidden)
      const draftRes = await request(app)
        .get(`/api/v1/study/courses/${courseAId}/draft`)
        .set('x-test-actor', instBInstructor);
      assert.equal(draftRes.status, 403, 'Foreign instructor must not access Course A draft (403)');

      // Student enrollment list attempt by foreign instructor
      const enrollRes = await request(app)
        .get(`/api/v1/study/courses/${courseAId}/enrollments`)
        .set('x-test-actor', instBInstructor);
      assert.equal(
        enrollRes.status,
        403,
        'Foreign instructor cannot inspect Course A student roster'
      );
    }
  );

  await t.test(
    'ED-13.2: Cross-Tenant Isolation: Inst B student cannot read Inst A course content',
    async () => {
      const res = await request(app)
        .get(`/api/v1/study/courses/${courseAId}`)
        .set('x-test-actor', instBStudent);
      assert.ok([403, 404].includes(res.status), 'Unenrolled foreign student cannot read Course A');
    }
  );

  await t.test(
    'ED-13.3: Attempt & Grading Privacy: Submitting attempt preserves server-only secrets',
    async () => {
      student1AttemptId = crypto.randomUUID();
      const subRes = await submitAttempt(instAStudent1, {
        schemaVersion: '1.0.0',
        attemptId: student1AttemptId,
        activity: {
          courseId: courseAId,
          revisionId: publishedRevA,
          contentHash: effectiveContentHash,
          activityId: quizActivityId,
          activityRevision,
          activityType: 'InteractiveQuiz'
        },
        roomId: null,
        answers: { selectedOptionIds: ['opt_o_n'] },
        timeSpentSeconds: 45
      });

      assert.ok(subRes, 'Submission result must be returned');
      assert.equal(subRes.status, 'graded');
      if (subRes.status === 'graded') {
        assert.equal(subRes.isCorrect, true);
      }

      // Verify database record doesn't leak secrets into public fields
      const attemptInDb = await StudentAttempt.findOne({ attemptId: student1AttemptId }).lean();
      assert.ok(attemptInDb, 'Student attempt must exist in DB');
      assert.equal(attemptInDb.userId, instAStudent1);

      // Verify activity record publicDefinition strictly excludes serverEvaluation
      const actRecord = await ActivityRecord.findOne({ activityId: quizActivityId }).lean();
      assert.ok(actRecord);
      const pubDef = actRecord.publicDefinition as Record<string, unknown>;
      assert.equal(pubDef.answerKey, undefined, 'Public definition must never contain answerKey');
      assert.equal(
        pubDef.serverEvaluation,
        undefined,
        'Public definition must never contain serverEvaluation'
      );
      assert.equal(pubDef.rubric, undefined, 'Public definition must never contain rubric');
    }
  );

  await t.test(
    'ED-13.4: Student Privacy: Peer students cannot read each other private attempt evaluations',
    async () => {
      const peerRes = await request(app)
        .get(`/api/v1/study/activities/${quizActivityId}/attempts/${student1AttemptId}`)
        .set('x-test-actor', instAStudent2);

      assert.equal(peerRes.status, 404, 'Actor-scoped lookup does not reveal a foreign receipt');
      assert.equal(peerRes.body.error, 'ATTEMPT_NOT_FOUND');
    }
  );

  await t.test(
    'ED-13.5: Room State Synchronization Privacy: Room state broadcasts never leak private answers',
    async () => {
      // Create study room
      const createRes = await request(app)
        .post('/api/v1/study/rooms')
        .set('x-test-actor', instAStudent1)
        .send({
          title: 'Privacy Verification Room',
          courseId: courseAId,
          maxParticipants: 4
        });
      assert.equal(createRes.status, 201);
      roomId = createRes.body.roomId;
      inviteCode = createRes.body.inviteCode;

      // Student 2 joins room via public invite code
      const joinRes = await request(app)
        .post('/api/v1/study/rooms/join')
        .set('x-test-actor', instAStudent2)
        .send({ inviteCode });
      assert.equal(joinRes.status, 200, 'Student 2 should join room successfully');

      // Transition to individual_attempt phase with active activity
      const phaseRes = await request(app)
        .put(`/api/v1/study/rooms/${roomId}/phase`)
        .set('x-test-actor', instAStudent1)
        .send({
          currentPhase: 'individual_attempt',
          activeActivityId: quizActivityId
        });
      assert.equal(phaseRes.status, 200);

      // Student 1 submits attempt in room context
      const roomAttemptId = crypto.randomUUID();
      await submitAttempt(instAStudent1, {
        schemaVersion: '1.0.0',
        attemptId: roomAttemptId,
        activity: {
          courseId: courseAId,
          revisionId: publishedRevA,
          contentHash: effectiveContentHash,
          activityId: quizActivityId,
          activityRevision,
          activityType: 'InteractiveQuiz'
        },
        answers: { selectedOptionIds: ['opt_o_n'] },
        timeSpentSeconds: 30,
        roomId
      });

      // Inspect room state as Student 2
      const roomRes = await request(app)
        .get(`/api/v1/study/rooms/${roomId}`)
        .set('x-test-actor', instAStudent2);
      assert.equal(roomRes.status, 200);

      const participants = roomRes.body.participants;
      const student1InRoom = participants.find(
        (p: { userId: string }) => p.userId === instAStudent1
      );
      assert.ok(student1InRoom, 'Student 1 must be present in room participants');
      assert.equal(student1InRoom.hasSubmitted, true, 'hasSubmitted flag is public boolean');

      // PRIVACY INVARIANT: zero answers, scores, feedback, or choices in public room state
      assert.equal((student1InRoom as Record<string, unknown>).answers, undefined);
      assert.equal((student1InRoom as Record<string, unknown>).score, undefined);
      assert.equal((student1InRoom as Record<string, unknown>).isCorrect, undefined);
      assert.equal((student1InRoom as Record<string, unknown>).selectedOptionIds, undefined);
      assert.equal((student1InRoom as Record<string, unknown>).feedback, undefined);
    }
  );

  await t.test(
    'ED-13.6: Debrief Projection Privacy: Distinct recipient-only outcome separation',
    async () => {
      // Transition room to debrief
      const debriefPhaseRes = await request(app)
        .put(`/api/v1/study/rooms/${roomId}/phase`)
        .set('x-test-actor', instAStudent1)
        .send({ currentPhase: 'debrief' });
      assert.equal(debriefPhaseRes.status, 200);

      // Student 1 requests debrief (submitted and passed)
      const debrief1 = await request(app)
        .get(`/api/v1/study/rooms/${roomId}/debrief`)
        .set('x-test-actor', instAStudent1);
      assert.equal(debrief1.status, 200);
      assert.equal(debrief1.body.recap.publicSubmissionsCount, 1);
      assert.equal(debrief1.body.privateOutcome.status, 'graded');
      assert.equal(debrief1.body.privateOutcome.isCorrect, true);
      assert.ok(debrief1.body.privateOutcome.evidenceId, 'Student 1 has evidence ID');

      // Student 2 requests debrief (did not submit)
      const debrief2 = await request(app)
        .get(`/api/v1/study/rooms/${roomId}/debrief`)
        .set('x-test-actor', instAStudent2);
      assert.equal(debrief2.status, 200);
      // Student 2 gets identical public recap, but private outcome is 'untested'
      assert.equal(debrief2.body.recap.publicSubmissionsCount, 1);
      assert.equal(debrief2.body.privateOutcome.status, 'untested');
      assert.equal(debrief2.body.privateOutcome.score, undefined);
      assert.equal(debrief2.body.privateOutcome.evidenceId, undefined);

      // PRIVACY INVARIANT: Recap contains ZERO private answers or scores
      const recap = debrief1.body.recap as Record<string, unknown>;
      assert.equal(recap.scores, undefined);
      assert.equal(recap.answers, undefined);
      assert.equal(recap.individualOutcomes, undefined);
    }
  );

  await t.test(
    'ED-13.7: Synthetic Identity Verification: Zero PII or real credentials in persisted data',
    async () => {
      const allMemberships = await InstitutionMembership.find({
        institutionId: { $in: [instAId, instBId] }
      }).lean();

      for (const m of allMemberships) {
        assert.ok(
          m.userId.startsWith('m21_priv_'),
          `User ID '${m.userId}' must follow synthetic prefix convention`
        );
      }

      const allCourses = await Course.find({
        _id: { $in: [courseAId, courseBId] }
      }).lean();

      for (const c of allCourses) {
        assert.ok(
          c.title.startsWith('Course A') || c.title.startsWith('Course B'),
          'Course titles must follow synthetic demo naming convention'
        );
      }
    }
  );
});
