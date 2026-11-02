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

test('M20 / ED-11: Private Participant Understanding Checks, Debrief and Next Steps Integration', async (t) => {
  await mongoose.connect(MONGO_URI);

  const testPrefix = `m20_${Date.now()}`;
  const ownerUserId = `${testPrefix}_owner`;
  const instructorId = `${testPrefix}_instructor`;
  const student1Id = `${testPrefix}_student1`;
  const student2Id = `${testPrefix}_student2`;
  const nonMemberId = `${testPrefix}_non_member`;
  const institutionId = new mongoose.Types.ObjectId();

  let courseId: string;
  let publishedRevisionTag: string;
  let contentHash = 'sha256:9999999999999999999999999999999999999999999999999999999999999999';
  const quizActivityId = `act_${testPrefix}_debrief_quiz`;
  const activityRevision = 'rev_act_1';
  const objectiveId = 'obj_debrief_eval_1';

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
        { institutionId, userId: student2Id, role: 'university_student', status: 'active' }
      ]);

      const rawCourse = await Course.create({
        title: 'Debrief & Assessment Architecture',
        slug: `debrief-${testPrefix}`,
        description: 'Course verifying private checks and group debrief separation',
        scope: 'institutional',
        institutionId,
        ownerUserId,
        userId: ownerUserId,
        subjectId: 'sub_eval',
        assignedInstructorIds: [instructorId],
        settings: { isPublic: false }
      });
      courseId = rawCourse._id.toString();
      await prepareCourseFixture(courseId, t);

      await CourseEnrollment.create([
        { courseId, institutionId, userId: student1Id, enrolledRole: 'student', status: 'active' },
        { courseId, institutionId, userId: student2Id, enrolledRole: 'student', status: 'active' }
      ]);

      const initialDraftTag = `rev_${Date.now()}`;
      const initialTopics = [
        {
          id: 'topic_eval_1',
          title: 'Mastery Verification',
          subtopics: [
            {
              id: 'sub_eval_1',
              title: 'Formative Assessment',
              learning_objectives: [
                {
                  id: objectiveId,
                  statement: 'Synthesize evidence from private problem attempts',
                  bloomLevel: 'evaluate'
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

      const quizDef = {
        schemaVersion: '1.0.0',
        activityId: quizActivityId,
        activityRevision,
        componentVersion: '1.0.0',
        courseId,
        revisionId: publishedRevisionTag,
        contentHash,
        objectiveId,
        title: 'Exit Ticket Understanding Check',
        instructions: 'Select the statement that captures the core lesson takeaway.',
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
        constraints: { maxAttempts: 2, allowCalculator: false },
        activityType: 'InteractiveQuiz',
        presentationData: {
          question: 'Which invariant differentiates private outcome evaluation from group debrief?',
          isMultiSelect: false,
          options: [
            {
              id: 'opt_correct',
              label: 'Private feedback is recipient-only; debrief is aggregate'
            },
            { id: 'opt_wrong', label: 'All student answers are projected on the shared whiteboard' }
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
        answerKey: ['opt_correct']
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

  await t.test('2. Room Session & Activity Pinning: Create room and join peers', async () => {
    const createRes = await request(app)
      .post('/api/v1/study/rooms')
      .set('x-test-actor', instructorId)
      .send({
        courseId,
        title: 'Formative Assessment Room',
        maxParticipants: 4
      });

    assert.equal(createRes.status, 201);
    roomId = createRes.body.roomId;
    inviteCode = createRes.body.inviteCode;

    // Student 1 and Student 2 join
    const join1 = await request(app)
      .post('/api/v1/study/rooms/join')
      .set('x-test-actor', student1Id)
      .send({ inviteCode });
    assert.equal(join1.status, 200);

    const join2 = await request(app)
      .post('/api/v1/study/rooms/join')
      .set('x-test-actor', student2Id)
      .send({ inviteCode });
    assert.equal(join2.status, 200);

    // Presenter selects activity and advances to individual_attempt
    const phaseRes = await request(app)
      .put(`/api/v1/study/rooms/${roomId}/phase`)
      .set('x-test-actor', instructorId)
      .send({
        currentPhase: 'individual_attempt',
        activeActivityId: quizActivityId
      });
    assert.equal(phaseRes.status, 200);
  });

  await t.test(
    '3. Asymmetric Attempt: Student 1 submits passing attempt; Student 2 remains untested',
    async () => {
      const attemptId = crypto.randomUUID();

      // Student 1 submits correct answer
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
          answers: { selectedOptionIds: ['opt_correct'] },
          timeSpentSeconds: 45
        });

      assert.equal(submitRes.status, 200);
      assert.equal(submitRes.body.status, 'graded');
      assert.equal(submitRes.body.score, 1.0);
      assert.equal(submitRes.body.isCorrect, true);
      assert.ok(submitRes.body.evidenceId);

      // Student 2 makes no submission
      // Presenter advances room to debrief
      const debriefPhaseRes = await request(app)
        .put(`/api/v1/study/rooms/${roomId}/phase`)
        .set('x-test-actor', instructorId)
        .send({
          currentPhase: 'debrief'
        });
      assert.equal(debriefPhaseRes.status, 200);
      assert.equal(debriefPhaseRes.body.currentPhase, 'debrief');
    }
  );

  await t.test(
    '4. Group Debrief Projection: Dual projection strictly isolates private outcomes (ED-11 / T13)',
    async () => {
      // 1. Student 1 queries debrief
      const s1Debrief = await request(app)
        .get(`/api/v1/study/rooms/${roomId}/debrief`)
        .set('x-test-actor', student1Id);

      assert.equal(s1Debrief.status, 200);
      // Group recap assertions
      assert.equal(s1Debrief.body.recap.title, 'Formative Assessment Room');
      assert.equal(s1Debrief.body.recap.currentPhase, 'debrief');
      assert.equal(s1Debrief.body.recap.participantsCount, 3);
      assert.equal(s1Debrief.body.recap.publicSubmissionsCount, 1);
      // Student 1 private outcome assertions
      assert.equal(s1Debrief.body.privateOutcome.status, 'graded');
      assert.equal(s1Debrief.body.privateOutcome.score, 1.0);
      assert.equal(s1Debrief.body.privateOutcome.isCorrect, true);
      assert.ok(s1Debrief.body.privateOutcome.evidenceId);

      // 2. Student 2 queries debrief
      const s2Debrief = await request(app)
        .get(`/api/v1/study/rooms/${roomId}/debrief`)
        .set('x-test-actor', student2Id);

      assert.equal(s2Debrief.status, 200);
      // Group recap is identical
      assert.equal(s2Debrief.body.recap.publicSubmissionsCount, 1);
      // Student 2 private outcome: UNTESTED (NOT incorrect)
      assert.equal(
        s2Debrief.body.privateOutcome.status,
        'untested',
        'Untested student must have status untested, not incorrect'
      );
      assert.equal(s2Debrief.body.privateOutcome.score, undefined);
      assert.equal(s2Debrief.body.privateOutcome.evidenceId, undefined);

      // PRIVACY VERIFICATION: Student 2 receives ZERO information about Student 1's score or answers
      const s2BodyStr = JSON.stringify(s2Debrief.body);
      assert.ok(
        !s2BodyStr.includes('opt_correct'),
        'Debrief must never leak student 1 answer to student 2'
      );
      assert.ok(
        !s2BodyStr.includes(student1Id),
        'Debrief must not leak student 1 ID in private outcome'
      );

      // 3. Instructor queries debrief
      const instrDebrief = await request(app)
        .get(`/api/v1/study/rooms/${roomId}/debrief`)
        .set('x-test-actor', instructorId);

      assert.equal(instrDebrief.status, 200);
      assert.equal(instrDebrief.body.recap.publicSubmissionsCount, 1);
      // Instructor's own private outcome is untested
      assert.equal(instrDebrief.body.privateOutcome.status, 'untested');
      // Instructor cannot use debrief to spy on private student attempts
      const instrBodyStr = JSON.stringify(instrDebrief.body);
      assert.ok(
        !instrBodyStr.includes('opt_correct'),
        'Instructor debrief must not leak raw student answers'
      );

      // 4. Non-member access is rejected
      const nonMemberRes = await request(app)
        .get(`/api/v1/study/rooms/${roomId}/debrief`)
        .set('x-test-actor', nonMemberId);

      assert.equal(nonMemberRes.status, 403, 'Non-member must be rejected 403');
    }
  );
});
