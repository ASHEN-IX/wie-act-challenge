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
  InstitutionMembership,
  LearningEvidence,
  StudentAttempt,
  StudyRoom
} from '../../modules/study/src/models';
import activitiesRouter from '../../modules/study/src/routes/activities';
import roomsRouter from '../../modules/study/src/routes/rooms';
import { updateCourseDraft } from '../../modules/study/src/services/courseDraft';
import { publishCourseRevision } from '../../modules/study/src/services/coursePublication';
import type { DomainRequest } from '../../src/framework/contracts';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27018/mindflow-test';

test('M18 / ED-12: Capacity-Aware Routing and Degraded Operation Integration', async (t) => {
  await mongoose.connect(MONGO_URI);

  const testPrefix = `m18_${Date.now()}`;
  const ownerUserId = `${testPrefix}_owner`;
  const instructorId = `${testPrefix}_instructor`;
  const student1Id = `${testPrefix}_student1`;
  const student2Id = `${testPrefix}_student2`;
  const student3Id = `${testPrefix}_student3`;
  const institutionId = new mongoose.Types.ObjectId();

  let courseId: string;
  let publishedRevisionTag: string;
  let contentHash = 'sha256:8888888888888888888888888888888888888888888888888888888888888888';
  const quizActivityId = `act_${testPrefix}_quiz`;
  const activityRevision = 'rev_act_1';
  const objectiveId = 'obj_limits_degrade_1';

  let roomId: string;
  let inviteCode: string;

  const app = express();
  app.use(express.json());
  app.use((req: DomainRequest, _res: Response, next: NextFunction) => {
    const actorHeader = req.headers['x-test-actor'];
    if (actorHeader) {
      req.user = {
        userId: String(actorHeader),
        email: `${actorHeader}@test.edu`,
        name: String(actorHeader).replace(/_/g, ' '),
        role: 'user'
      };
    }
    next();
  });
  app.use('/api/v1/study/rooms', roomsRouter);
  app.use('/api/v1/study/activities', activitiesRouter);

  t.after(async () => {
    await cleanupCourseFixtures();
    try {
      if (courseId) {
        await Course.deleteMany({ courseId });
        await CourseRevision.deleteMany({ courseId });
        await CourseEnrollment.deleteMany({ courseId });
        await ActivityRecord.deleteMany({ courseId });
        await StudentAttempt.deleteMany({ courseId });
        await LearningEvidence.deleteMany({ 'activity.courseId': courseId });
      }
      await InstitutionMembership.deleteMany({ institutionId });
      if (roomId) {
        await StudyRoom.deleteMany({ roomId });
      }
    } finally {
      await mongoose.disconnect();
    }
  });

  await t.test(
    '1. Setup: Create published course, enrollments, and registered activity',
    async () => {
      await InstitutionMembership.create([
        { institutionId, userId: instructorId, role: 'instructor', status: 'active' },
        { institutionId, userId: student1Id, role: 'university_student', status: 'active' },
        { institutionId, userId: student2Id, role: 'university_student', status: 'active' },
        { institutionId, userId: student3Id, role: 'university_student', status: 'active' }
      ]);

      const rawCourse = await Course.create({
        title: 'Degraded Operations Architecture',
        slug: `degrade-${testPrefix}`,
        description: 'Testing graceful degradation under load and outage',
        scope: 'institutional',
        institutionId,
        ownerUserId,
        userId: ownerUserId,
        subjectId: 'sub_systems',
        assignedInstructorIds: [instructorId],
        settings: { isPublic: false }
      });
      courseId = rawCourse._id.toString();
      await prepareCourseFixture(courseId, t);

      await CourseEnrollment.create([
        { courseId, institutionId, userId: student1Id, enrolledRole: 'student', status: 'active' },
        { courseId, institutionId, userId: student2Id, enrolledRole: 'student', status: 'active' },
        { courseId, institutionId, userId: student3Id, enrolledRole: 'student', status: 'active' }
      ]);

      const initialDraftTag = `rev_${Date.now()}`;
      const initialTopics = [
        {
          id: 'topic_sys_1',
          title: 'Distributed Fallbacks',
          subtopics: [
            {
              id: 'sub_sys_1',
              title: 'Resilience Patterns',
              learning_objectives: [
                {
                  id: objectiveId,
                  statement: 'Analyze system behavior during provider outage',
                  bloomLevel: 'analyze'
                }
              ]
            }
          ]
        }
      ];

      await CourseRevision.create({
        courseId: rawCourse._id,
        revisionTag: initialDraftTag,
        contentHash,
        status: 'draft',
        isInstructorReviewed: false,
        topics: initialTopics,
        vectorIndexRef: `faiss/${courseId}/${initialDraftTag}.faiss`
      });

      const draft = await updateCourseDraft(instructorId, courseId, {
        expectedRevisionTag: initialDraftTag,
        topics: initialTopics,
        isInstructorReviewed: true
      });

      publishedRevisionTag = draft.revisionTag;
      contentHash = draft.contentHash;
      contentHash = await prepareDraftFixture(courseId, publishedRevisionTag);
      assert.ok(publishedRevisionTag);

      // Register activity with deterministic rubric
      const quizDef = {
        schemaVersion: '1.0.0',
        activityId: quizActivityId,
        activityRevision,
        componentVersion: '1.0.0',
        courseId,
        revisionId: publishedRevisionTag,
        contentHash,
        objectiveId,
        title: 'Circuit Breaker Pattern Quiz',
        instructions: 'Select the primary purpose of a circuit breaker.',
        timeLimitSeconds: 120,
        visibility: 'public',
        language: 'en',
        sourceRefs: [
          {
            documentId: `doc_${contentHash.replace('sha256:', '').slice(0, 16)}`,
            pageNumber: 1,
            contentHash,
            provenance: 'extracted',
            locationKnown: true
          }
        ],
        constraints: { maxAttempts: 2, allowCalculator: false },
        activityType: 'InteractiveQuiz',
        presentationData: {
          question: 'What is the primary role of a circuit breaker in distributed microservices?',
          isMultiSelect: false,
          options: [
            { id: 'opt_a', label: 'Fail fast to prevent cascading failures' },
            { id: 'opt_b', label: 'Encrypt all database passwords' },
            { id: 'opt_c', label: 'Double the maximum thread pool limit' }
          ]
        }
      };

      const quizEval = {
        schemaVersion: '1.0.0',
        visibility: 'server_only',
        activity: {
          courseId,
          revisionId: publishedRevisionTag,
          contentHash,
          activityId: quizActivityId,
          activityRevision,
          activityType: 'InteractiveQuiz'
        },
        evaluationRef: `eval_${testPrefix}`,
        evaluatorType: 'deterministic_rubric',
        rubricVersion: 'v1',
        rubric: 'Exact option match required',
        answerKey: ['opt_a']
      };

      await reviewActivityFixture(courseId, quizDef, quizEval);
      const regRes = await request(app)
        .post(`/api/v1/study/activities/${quizActivityId}/register`)
        .set('x-test-actor', instructorId)
        .send({ courseId, activity: quizDef, serverEvaluation: quizEval });
      assert.equal(regRes.status, 201);

      await prepareCourseFixture(courseId, t);

      await publishCourseRevision(instructorId, courseId, publishedRevisionTag);
    }
  );

  await t.test(
    '2. Capacity Enforcement: Room rejects joins exceeding maxParticipants (ED-12)',
    async () => {
      // Create room with maxParticipants = 2
      const createRes = await request(app)
        .post('/api/v1/study/rooms')
        .set('x-test-actor', instructorId)
        .send({
          courseId,
          title: 'High-Concurrency Small Room',
          maxParticipants: 2
        });

      assert.equal(createRes.status, 201);
      roomId = createRes.body.roomId;
      inviteCode = createRes.body.inviteCode;

      // Student 1 joins (participant 2/2)
      const join1Res = await request(app)
        .post('/api/v1/study/rooms/join')
        .set('x-test-actor', student1Id)
        .send({ inviteCode });
      assert.equal(join1Res.status, 200);
      assert.equal(join1Res.body.participantsCount, 2);

      // Student 2 attempts to join (room is full)
      const join2Res = await request(app)
        .post('/api/v1/study/rooms/join')
        .set('x-test-actor', student2Id)
        .send({ inviteCode });

      assert.equal(join2Res.status, 409, 'Overcapacity join must return 409');
      assert.ok(
        join2Res.body.error?.toLowerCase().includes('capacity'),
        'Error message must indicate capacity limit'
      );

      // Verify room roster remains strictly 2 participants in MongoDB
      const roomDoc = await StudyRoom.findOne({ roomId });
      assert.ok(roomDoc);
      const activeCount = roomDoc.participants.filter((p) => !p.leftAt).length;
      assert.equal(activeCount, 2, 'Active participant count must not exceed capacity');
      const phase = await request(app)
        .put(`/api/v1/study/rooms/${roomId}/phase`)
        .set('x-test-actor', instructorId)
        .send({ currentPhase: 'individual_attempt', activeActivityId: quizActivityId });
      assert.equal(phase.status, 200);
    }
  );

  await t.test(
    '3. AI Outage Fallback: Facilitator falls back to deterministic peer-first rules (ED-09 / ED-12)',
    async () => {
      // Request a hint during AI service outage
      const hintRes = await request(app)
        .post(`/api/v1/study/rooms/${roomId}/facilitator/action`)
        .set('x-test-actor', student1Id)
        .send({
          actionType: 'request_hint',
          hintLevel: 1
        });

      assert.equal(hintRes.status, 200, 'Facilitator must return 200 via fallback engine');
      assert.equal(hintRes.body.intervention?.strategy, 'SOCRATIC_NUDGE');
      assert.ok(hintRes.body.intervention?.message, 'Message must be present from rule fallback');

      // Observe dialogue with misconception during AI outage
      const observeRes = await request(app)
        .post(`/api/v1/study/rooms/${roomId}/facilitator/observe`)
        .set('x-test-actor', student1Id)
        .send({
          transcriptText:
            'I think a table is in 1NF as long as every record has a unique primary key ID.',
          actionType: 'statement'
        });

      assert.equal(observeRes.status, 200, 'Observation must succeed via fallback');
      assert.equal(observeRes.body.intervention?.strategy, 'PEER_CHALLENGE');
      assert.equal(observeRes.body.intervention?.trigger, 'misconception_detected');
    }
  );

  await t.test(
    '4. Solo Evaluation & Mastery Evidence During Outage: Deterministic rubric succeeds (ED-12.2)',
    async () => {
      const attemptId = crypto.randomUUID();

      // Student submits correct answer for activity
      const submitRes = await request(app)
        .post(`/api/v1/study/activities/${quizActivityId}/attempts`)
        .set('x-test-actor', student1Id)
        .send({
          schemaVersion: '1.0.0',
          attemptId,
          activity: {
            courseId,
            revisionId: publishedRevisionTag,
            contentHash,
            activityId: quizActivityId,
            activityRevision,
            activityType: 'InteractiveQuiz'
          },
          roomId,
          answers: { selectedOptionIds: ['opt_a'] },
          timeSpentSeconds: 30
        });

      assert.equal(submitRes.status, 200);
      assert.equal(submitRes.body.status, 'graded');
      assert.equal(submitRes.body.score, 1.0);
      assert.equal(submitRes.body.isCorrect, true);

      // Verify AcceptedEvidence is recorded for verified passing attempt
      const evidence = await LearningEvidence.findOne({ attemptId });
      assert.ok(evidence, 'Passing attempt must generate authoritative AcceptedEvidence');
      assert.equal(evidence.status, 'accepted');
      assert.equal(evidence.score, 1.0);
    }
  );

  await t.test(
    '5. Unresolved Reasoning Safety: Incorrect or incomplete attempt never yields evidence (ED-12.3)',
    async () => {
      const failAttemptId = crypto.randomUUID();

      // Student submits incorrect answer
      const submitFailRes = await request(app)
        .post(`/api/v1/study/activities/${quizActivityId}/attempts`)
        .set('x-test-actor', student1Id)
        .send({
          schemaVersion: '1.0.0',
          attemptId: failAttemptId,
          activity: {
            courseId,
            revisionId: publishedRevisionTag,
            contentHash,
            activityId: quizActivityId,
            activityRevision,
            activityType: 'InteractiveQuiz'
          },
          roomId,
          answers: { selectedOptionIds: ['opt_b'] },
          timeSpentSeconds: 15
        });

      assert.equal(submitFailRes.status, 200);
      assert.equal(submitFailRes.body.status, 'graded');
      assert.equal(submitFailRes.body.score, 0.0);
      assert.equal(submitFailRes.body.isCorrect, false);

      // CRITICAL SECURITY ASSERTION (ED-12.3): Unresolved reasoning / failed score must NEVER produce AcceptedEvidence
      const evidenceCount = await LearningEvidence.countDocuments({ attemptId: failAttemptId });
      assert.equal(
        evidenceCount,
        0,
        'Unresolved or failing attempts must NEVER produce AcceptedEvidence'
      );
    }
  );

  await t.test(
    '6. Guaranteed Exit: Leaving room succeeds even when participant leaves full room',
    async () => {
      // Student 1 leaves the room
      const leaveRes = await request(app)
        .post(`/api/v1/study/rooms/${roomId}/leave`)
        .set('x-test-actor', student1Id);

      assert.equal(leaveRes.status, 200);

      // Now room capacity has 1 slot available
      // Student 2 can now join successfully!
      const join2AgainRes = await request(app)
        .post('/api/v1/study/rooms/join')
        .set('x-test-actor', student2Id)
        .send({ inviteCode });

      assert.equal(
        join2AgainRes.status,
        200,
        'Slot freed after leave allows new participant to join'
      );
      assert.equal(join2AgainRes.body.participantsCount, 2);
    }
  );
});
