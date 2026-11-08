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

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27018/ednova-test';

test('M17 / ED-07 & ED-29: Real Shared Room Synchronized Activity & Private Submission Integration', async (t) => {
  await mongoose.connect(MONGO_URI);

  const testPrefix = `m17_${Date.now()}`;
  const ownerUserId = `${testPrefix}_owner`;
  const instructorId = `${testPrefix}_instructor`;
  const presenterId = `${testPrefix}_presenter`;
  const studentId = `${testPrefix}_student`;
  const institutionId = new mongoose.Types.ObjectId();

  let courseId: string;
  let publishedRevisionTag: string;
  let contentHash = 'sha256:7777777777777777777777777777777777777777777777777777777777777777';
  const quizActivityId = `act_${testPrefix}_quiz1`;
  const problemActivityId = `act_${testPrefix}_problem1`;
  const activityRevision = 'rev_act_1';
  const objectiveId = 'obj_thermo_laws_1';

  let roomId: string;
  let inviteCode: string;

  // Setup Express test app mounting rooms and activities
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
      await StudyRoom.deleteMany({ roomId });
    } finally {
      await mongoose.disconnect();
    }
  });

  await t.test(
    '1. Setup: Create published course, enrollments, and registered activities',
    async () => {
      // Institution memberships
      await InstitutionMembership.create([
        {
          institutionId,
          userId: instructorId,
          email: `${instructorId}@test.edu`,
          role: 'instructor',
          status: 'active'
        },
        {
          institutionId,
          userId: studentId,
          email: `${studentId}@test.edu`,
          role: 'university_student',
          status: 'active'
        }
      ]);

      // Create course draft
      const rawCourse = await Course.create({
        title: 'Thermodynamics & Heat Transfer',
        slug: `thermo-${testPrefix}`,
        description: 'Core concepts in heat exchange and state functions',
        scope: 'institutional',
        institutionId,
        ownerUserId,
        userId: ownerUserId,
        subjectId: 'sub_thermo',
        assignedInstructorIds: [instructorId],
        settings: { isPublic: false }
      });
      courseId = rawCourse._id.toString();
      await prepareCourseFixture(courseId, t);

      // The instructor publishes the revision, then two learners study it.
      await CourseEnrollment.create(
        [presenterId, studentId].map((userId) => ({
          courseId,
          institutionId,
          userId,
          enrolledRole: 'student',
          status: 'active',
          enrolledAt: new Date()
        }))
      );

      // 3. Draft revision
      const initialDraftTag = `rev_${Date.now()}`;
      const initialTopics = [
        {
          id: 'topic_first_law',
          title: 'First Law of Thermodynamics',
          subtopics: [
            {
              id: 'sub_heat_work',
              title: 'Heat and Work Conservation',
              learning_objectives: [
                {
                  id: objectiveId,
                  statement: 'Apply the first law to closed cyclic processes',
                  bloomLevel: 'apply'
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

      // Populate and review draft
      const draft = await updateCourseDraft(instructorId, courseId, {
        expectedRevisionTag: initialDraftTag,
        topics: initialTopics,
        isInstructorReviewed: true
      });

      publishedRevisionTag = draft.revisionTag;
      contentHash = draft.contentHash;
      contentHash = await prepareDraftFixture(courseId, publishedRevisionTag);
      assert.ok(publishedRevisionTag, 'Course must be published');

      // Register Contract 04 InteractiveQuiz with ServerEvaluationDefinition
      const quizDef = {
        schemaVersion: '1.0.0',
        activityId: quizActivityId,
        activityRevision,
        componentVersion: '1.0.0',
        courseId,
        revisionId: publishedRevisionTag,
        contentHash,
        objectiveId,
        title: 'First Law Cyclic Engine Quiz',
        instructions: 'Determine net work output per cycle.',
        timeLimitSeconds: 180,
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
        constraints: {
          maxAttempts: 3,
          allowCalculator: false
        },
        activityType: 'InteractiveQuiz',
        presentationData: {
          question: 'What is net heat input for a cycle with Q_in = 500J and Q_out = 300J?',
          isMultiSelect: false,
          options: [
            { id: 'opt_1', label: '200 J' },
            { id: 'opt_2', label: '800 J' },
            { id: 'opt_3', label: '-200 J' }
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
        evaluationRef: `eval_${testPrefix}_quiz`,
        evaluatorType: 'deterministic_rubric',
        rubricVersion: 'v1',
        rubric: 'Exact option match required',
        answerKey: ['opt_1']
      };

      await reviewActivityFixture(courseId, quizDef, quizEval);
      const regQuizRes = await request(app)
        .post(`/api/v1/study/activities/${quizActivityId}/register`)
        .set('x-test-actor', instructorId)
        .send({ courseId, activity: quizDef, serverEvaluation: quizEval });
      assert.equal(
        regQuizRes.status,
        201,
        `Quiz register failed: ${JSON.stringify(regQuizRes.body)}`
      );

      // Register Contract 04 GuidedProblem
      const problemDef = {
        schemaVersion: '1.0.0',
        activityId: problemActivityId,
        activityRevision,
        componentVersion: '1.0.0',
        courseId,
        revisionId: publishedRevisionTag,
        contentHash,
        objectiveId,
        title: 'Carnot Efficiency Derivation',
        instructions: 'Step-by-step Carnot limit derivation.',
        timeLimitSeconds: 300,
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
        constraints: {
          maxAttempts: 3,
          allowCalculator: false
        },
        activityType: 'GuidedProblem',
        presentationData: {
          problem: 'Calculate maximum theoretical efficiency between 600K and 300K reservoirs.',
          steps: [
            { stepId: 'step_1', prompt: 'Compute temperature ratio Tc/Th.' },
            { stepId: 'step_2', prompt: 'Compute eta = 1 - Tc/Th.' }
          ]
        }
      };

      const problemEval = {
        schemaVersion: '1.0.0',
        visibility: 'server_only',
        activity: {
          courseId,
          revisionId: publishedRevisionTag,
          contentHash,
          activityId: problemActivityId,
          activityRevision,
          activityType: 'GuidedProblem'
        },
        evaluationRef: `eval_${testPrefix}_prob`,
        evaluatorType: 'deterministic_rubric',
        rubricVersion: 'v1',
        rubric: 'Step by step derivation required',
        answerKey: ['step_1', 'step_2']
      };

      await reviewActivityFixture(courseId, problemDef, problemEval);
      const regProbRes = await request(app)
        .post(`/api/v1/study/activities/${problemActivityId}/register`)
        .set('x-test-actor', instructorId)
        .send({ courseId, activity: problemDef, serverEvaluation: problemEval });
      assert.equal(
        regProbRes.status,
        201,
        `Problem register failed: ${JSON.stringify(regProbRes.body)}`
      );

      await prepareCourseFixture(courseId, t);

      await publishCourseRevision(instructorId, courseId, publishedRevisionTag);
    }
  );

  await t.test('2. Room Lifecycle: Create room and join peer learner', async () => {
    // Presenter creates room bound to published course
    const createRes = await request(app)
      .post('/api/v1/study/rooms')
      .set('x-test-actor', presenterId)
      .send({
        courseId,
        title: 'Thermo Study Group Alpha',
        maxParticipants: 4
      });

    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.revisionId, publishedRevisionTag);
    roomId = createRes.body.roomId;
    inviteCode = createRes.body.inviteCode;
    assert.ok(roomId, 'roomId should be generated');
    assert.ok(inviteCode, 'inviteCode should be generated');

    // Student joins room via inviteCode
    const joinRes = await request(app)
      .post('/api/v1/study/rooms/join')
      .set('x-test-actor', studentId)
      .send({ inviteCode });

    assert.equal(joinRes.status, 200);
    assert.equal(joinRes.body.participantsCount, 2);

    // Verify room state
    const roomDoc = await StudyRoom.findOne({ roomId });
    assert.ok(roomDoc);
    assert.equal(roomDoc.participants.length, 2);
    assert.equal(roomDoc.presenterUserId, presenterId);
    assert.equal(roomDoc.currentPhase, 'idle');
    assert.equal(roomDoc.revisionId, publishedRevisionTag);
    assert.equal(roomDoc.activeActivityId, null);
  });

  await t.test(
    '3. Synchronized Activity Selection: Presenter authority and validation',
    async () => {
      // Non-presenter (student) cannot select activity or change phase
      const forbidRes = await request(app)
        .put(`/api/v1/study/rooms/${roomId}/phase`)
        .set('x-test-actor', studentId)
        .send({
          currentPhase: 'individual_attempt',
          activeActivityId: quizActivityId
        });
      assert.equal(forbidRes.status, 403, 'Non-presenter must be forbidden from advancing phase');

      // Presenter selects non-existent activity -> 404
      const notFoundRes = await request(app)
        .put(`/api/v1/study/rooms/${roomId}/phase`)
        .set('x-test-actor', presenterId)
        .send({
          currentPhase: 'individual_attempt',
          activeActivityId: 'act_non_existent_999'
        });
      assert.equal(notFoundRes.status, 404, 'Non-existent activity must return 404');

      // Presenter successfully selects registered quiz activity
      const selectRes = await request(app)
        .put(`/api/v1/study/rooms/${roomId}/phase`)
        .set('x-test-actor', presenterId)
        .send({
          currentPhase: 'individual_attempt',
          activeActivityId: quizActivityId
        });

      assert.equal(selectRes.status, 200);
      assert.equal(selectRes.body.currentPhase, 'individual_attempt');
      assert.equal(selectRes.body.activeActivityId, quizActivityId);

      // Verify persistence in MongoDB
      const roomDoc = await StudyRoom.findOne({ roomId });
      assert.ok(roomDoc);
      assert.equal(roomDoc.activeActivityId, quizActivityId);
      assert.equal(roomDoc.currentPhase, 'individual_attempt');
      // Ensure all participants start with hasSubmitted = false
      assert.ok(roomDoc.participants.every((p) => p.hasSubmitted === false));
    }
  );

  await t.test(
    '4. Private Attempt Submission: Real-time room submission synchronization without leak',
    async () => {
      const attemptId = crypto.randomUUID();

      // Student submits private attempt with roomId
      const submitRes = await request(app)
        .post(`/api/v1/study/activities/${quizActivityId}/attempts`)
        .set('x-test-actor', studentId)
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
          answers: { selectedOptionIds: ['opt_1'] },
          timeSpentSeconds: 42
        });

      assert.equal(submitRes.status, 200);
      assert.equal(submitRes.body.status, 'graded');
      assert.equal(submitRes.body.isCorrect, true);
      assert.equal(submitRes.body.score, 1.0);
      assert.equal(submitRes.body.visibility, 'recipient_only');

      // Verify room state is synchronized in database
      const roomDoc = await StudyRoom.findOne({ roomId });
      assert.ok(roomDoc);

      const studentParticipant = roomDoc.participants.find((p) => p.userId === studentId);
      assert.ok(studentParticipant);
      assert.equal(
        studentParticipant.hasSubmitted,
        true,
        'Student participant must be marked as hasSubmitted'
      );

      const presenterParticipant = roomDoc.participants.find((p) => p.userId === presenterId);
      assert.ok(presenterParticipant);
      assert.equal(
        presenterParticipant.hasSubmitted,
        false,
        'Presenter participant has not submitted'
      );

      // Fetch public room state via GET
      const roomGetRes = await request(app)
        .get(`/api/v1/study/rooms/${roomId}`)
        .set('x-test-actor', presenterId);

      assert.equal(roomGetRes.status, 200);
      assert.equal(roomGetRes.body.room.publicSubmissionsCount, 1);
      assert.equal(roomGetRes.body.room.activeActivityId, quizActivityId);

      // PRIVACY VERIFICATION: Room public state must never leak student answers or scores
      const payloadStr = JSON.stringify(roomGetRes.body);
      assert.ok(!payloadStr.includes('opt_1'), 'Public room state must never leak selected option');
      assert.ok(!payloadStr.includes('score'), 'Public room state must never leak private score');
      assert.ok(
        !payloadStr.includes('feedback'),
        'Public room state must never leak private feedback'
      );
    }
  );

  await t.test('5. Round Transition: Selecting next activity resets submission flags', async () => {
    // Presenter selects second activity (GuidedProblem)
    const selectRes2 = await request(app)
      .put(`/api/v1/study/rooms/${roomId}/phase`)
      .set('x-test-actor', presenterId)
      .send({
        currentPhase: 'individual_attempt',
        activeActivityId: problemActivityId
      });

    assert.equal(selectRes2.status, 200);
    assert.equal(selectRes2.body.activeActivityId, problemActivityId);

    // Verify submission flags are cleanly reset for all active participants
    const roomDoc = await StudyRoom.findOne({ roomId });
    assert.ok(roomDoc);
    assert.equal(roomDoc.activeActivityId, problemActivityId);
    assert.ok(
      roomDoc.participants.every((p) => p.hasSubmitted === false),
      'All participants must have hasSubmitted reset to false for new activity round'
    );

    // Verify public submissions count is back to 0
    const roomGetRes = await request(app)
      .get(`/api/v1/study/rooms/${roomId}`)
      .set('x-test-actor', studentId);

    assert.equal(roomGetRes.status, 200);
    assert.equal(roomGetRes.body.room.publicSubmissionsCount, 0);
  });
});
