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
import crypto from 'node:crypto';
import { connectDatabase, disconnectDatabase } from '../../shared/database';
import { newId } from '../../shared/ids';

import {
  ActivityRecord,
  Course,
  CourseEnrollment,
  CourseRevision,
  Institution,
  InstitutionMembership,
  LearningEvidence,
  StudentAttempt
} from '../../modules/study/src/models';
import activitiesRouter from '../../modules/study/src/routes/activities';
import { updateCourseDraft } from '../../modules/study/src/services/courseDraft';
import { publishCourseRevision } from '../../modules/study/src/services/coursePublication';
import type { DomainRequest } from '../../src/framework/contracts';

test('M10 / ED-29: Durable Activity Attempts, Assessment & Accepted Evidence Integration', async (t) => {
  await connectDatabase();

  const testPrefix = `m10_${Date.now()}`;
  const ownerUserId = `${testPrefix}_owner`;
  const instructorId = `${testPrefix}_instructor`;
  const studentId = `${testPrefix}_student`;
  const otherStudentId = `${testPrefix}_other_student`;
  const foreignUserId = `${testPrefix}_foreign_user`;
  const institutionId = newId();

  let courseId: string;
  let publishedRevisionTag: string;
  let contentHash = 'sha256:2222222222222222222222222222222222222222222222222222222222222222';
  const activityId = `act_${testPrefix}_quiz1`;
  const activityRevision = 'rev_act_1';
  const objectiveId = 'obj_calc_limits_1';

  // Setup Express test app mounting activities router
  const app = express();
  app.use(express.json());
  app.use((req: DomainRequest, _res: Response, next: NextFunction) => {
    const actorHeader = req.headers['x-test-actor'];
    if (actorHeader) {
      req.user = {
        userId: String(actorHeader),
        email: `${actorHeader}@test.edu`,
        role: 'user'
      };
    }
    next();
  });
  app.use('/api/v1/study/activities', activitiesRouter);

  t.after(async () => {
    await cleanupCourseFixtures();
    try {
      if (courseId) {
        await CourseRevision.deleteMany({ courseId });
        await ActivityRecord.deleteMany({ courseId });
      }
      await Course.deleteMany({ userId: { contains: testPrefix } });
      await CourseEnrollment.deleteMany({ userId: { contains: testPrefix } });
      await InstitutionMembership.deleteMany({ userId: { contains: testPrefix } });
      await StudentAttempt.deleteMany({ userId: { contains: testPrefix } });
      await LearningEvidence.deleteMany({ userId: { contains: testPrefix } });
      await Institution.deleteMany({ id: institutionId });
    } catch {
      // ignore
    } finally {
      await disconnectDatabase().catch(() => {});
    }
  });

  await t.test(
    '1. Setup: Create published course with active enrollment and registered activity',
    async () => {
      // 1. Institution before memberships (real foreign key).
      await Institution.create({
        id: institutionId,
        name: 'M10 Real Analysis Institution',
        slug: `m10-${institutionId}`,
        createdByUserId: ownerUserId,
        status: 'active'
      });
      await InstitutionMembership.create({
        institutionId,
        userId: instructorId,
        role: 'instructor',
        status: 'active'
      });

      // 2. Institutional course
      const courseDoc = await Course.create({
        title: 'Real Analysis',
        scope: 'institutional',
        institutionId,
        ownerUserId,
        userId: ownerUserId,
        subjectId: 'sub_math',
        assignedInstructorIds: [instructorId],
        status: 'completed',
        files: [
          {
            filename: 'analysis.pdf',
            originalName: 'analysis.pdf',
            size: 20480,
            fileHash: contentHash,
            uploadedAt: new Date()
          }
        ]
      });
      courseId = courseDoc.id.toString();
      await prepareCourseFixture(courseId, t);

      // 3. Draft revision
      const initialDraftTag = `rev_${Date.now()}`;
      const initialTopics = [
        {
          id: 'topic_analysis_1',
          title: 'Limits & Continuity',
          subtopics: [
            {
              id: 'sub_calc_1',
              title: 'Epsilon-Delta Definition',
              learning_objectives: [
                {
                  id: objectiveId,
                  statement: 'Formulate epsilon-delta proofs for linear functions',
                  bloomLevel: 'apply'
                }
              ]
            }
          ]
        }
      ];

      await CourseRevision.create({
        courseId: courseDoc.id,
        revisionTag: initialDraftTag,
        contentHash,
        status: 'draft',
        isInstructorReviewed: false,
        topics: initialTopics,
        vectorIndexRef: `faiss/${courseId}/${initialDraftTag}.faiss`
      });

      // 4. Review & Publish
      const reviewUpdate = await updateCourseDraft(instructorId, courseId, {
        expectedRevisionTag: initialDraftTag,
        topics: initialTopics,
        isInstructorReviewed: true
      });

      publishedRevisionTag = reviewUpdate.revisionTag;
      contentHash = reviewUpdate.contentHash;
      contentHash = await prepareDraftFixture(courseId, publishedRevisionTag);
      assert.ok(publishedRevisionTag);

      // 5. Enroll students
      await CourseEnrollment.create({
        courseId: courseDoc.id,
        institutionId,
        userId: studentId,
        status: 'active'
      });
      await CourseEnrollment.create({
        courseId: courseDoc.id,
        institutionId,
        userId: otherStudentId,
        status: 'active'
      });

      // 6. Register Contract 04 InteractiveQuiz activity and ServerEvaluationDefinition
      const publicActivityDef = {
        schemaVersion: '1.0.0',
        activityId,
        activityRevision,
        activityType: 'InteractiveQuiz',
        componentVersion: '1.0.0',
        courseId,
        revisionId: publishedRevisionTag,
        contentHash,
        objectiveId,
        title: 'Epsilon-Delta Limit Challenge',
        instructions: 'Select the statement that correctly expresses the limit condition.',
        timeLimitSeconds: 600,
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
        presentationData: {
          question: 'Which statement accurately describes the epsilon-delta definition of a limit?',
          isMultiSelect: false,
          options: [
            { id: 'opt_1', label: 'For every epsilon > 0, there exists delta = 0' },
            {
              id: 'opt_2',
              label:
                'For every epsilon > 0, there exists delta > 0 such that |x - a| < delta implies |f(x) - L| < epsilon'
            },
            { id: 'opt_3', label: 'For any delta, epsilon is zero' }
          ]
        }
      };

      const serverEvalDef = {
        schemaVersion: '1.0.0',
        visibility: 'server_only',
        activity: {
          courseId,
          revisionId: publishedRevisionTag,
          contentHash,
          activityId,
          activityRevision,
          activityType: 'InteractiveQuiz'
        },
        evaluationRef: `eval_${testPrefix}`,
        evaluatorType: 'deterministic_rubric',
        rubricVersion: 'v1',
        rubric: 'Exact option match required',
        answerKey: ['opt_2']
      };

      await reviewActivityFixture(courseId, publicActivityDef, serverEvalDef);
      const regRes = await request(app)
        .post(`/api/v1/study/activities/${activityId}/register`)
        .set('x-test-actor', instructorId)
        .send({
          courseId,
          activity: publicActivityDef,
          serverEvaluation: serverEvalDef
        });

      assert.equal(regRes.status, 201);
      assert.equal(regRes.body.activityId, activityId);

      await prepareCourseFixture(courseId, t);

      await publishCourseRevision(instructorId, courseId, publishedRevisionTag);
    }
  );

  await t.test(
    '2. Contract 04: Public activity delivery strictly omits serverEvaluation and answerKey',
    async () => {
      const res = await request(app)
        .get(`/api/v1/study/activities/${activityId}`)
        .set('x-test-actor', studentId);

      assert.equal(res.status, 200);
      assert.equal(res.body.activityId, activityId);
      assert.equal(res.body.title, 'Epsilon-Delta Limit Challenge');
      assert.ok(res.body.presentationData.options);

      // CRITICAL SECURITY ASSERTION: No answer key, rubric, or server evaluation in public payload
      assert.equal(res.body.serverEvaluation, undefined);
      assert.equal(res.body.answerKey, undefined);
      assert.equal(res.body.rubric, undefined);
      assert.equal(res.body.presentationData.answerKey, undefined);
    }
  );

  await t.test(
    '3. First Submission: Passing attempt produces Contract 06 result and Contract 07 AcceptedEvidence',
    async () => {
      const attemptId = crypto.randomUUID();

      const submissionPayload = {
        schemaVersion: '1.0.0',
        attemptId,
        activity: {
          courseId,
          revisionId: publishedRevisionTag,
          contentHash,
          activityId,
          activityRevision,
          activityType: 'InteractiveQuiz'
        },
        roomId: null,
        timeSpentSeconds: 120,
        answers: {
          selectedOptionIds: ['opt_2']
        }
      };

      const res = await request(app)
        .post(`/api/v1/study/activities/${activityId}/attempts`)
        .set('x-test-actor', studentId)
        .send(submissionPayload);

      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'graded');
      assert.equal(res.body.score, 1.0);
      assert.equal(res.body.isCorrect, true);
      assert.equal(res.body.userId, studentId);
      assert.equal(res.body.attemptId, attemptId);
      assert.ok(res.body.evidenceId, 'Passing attempt must link an accepted evidenceId');

      // Verify StudentAttempt in MongoDB
      const storedAttempt = await StudentAttempt.findOne({ userId: studentId, attemptId });
      assert.ok(storedAttempt);
      assert.equal(storedAttempt.status, 'graded');
      assert.equal(storedAttempt.timeSpentSeconds, 120);

      // Verify LearningEvidence in MongoDB
      const storedEvidence = await LearningEvidence.findOne({ userId: studentId, attemptId });
      assert.ok(storedEvidence);
      assert.equal(storedEvidence.evidenceId, res.body.evidenceId);
      assert.equal(storedEvidence.score, 1.0);
      assert.equal(storedEvidence.masteryAchieved, true);
      assert.ok(storedEvidence.rewardReference?.eventKey.startsWith(`xp:${studentId}:`));
    }
  );

  await t.test(
    '4. Idempotency: Duplicate identical retry returns existing assessment without double evidence',
    async () => {
      const attemptId = crypto.randomUUID();

      const submissionPayload = {
        schemaVersion: '1.0.0',
        attemptId,
        activity: {
          courseId,
          revisionId: publishedRevisionTag,
          contentHash,
          activityId,
          activityRevision,
          activityType: 'InteractiveQuiz'
        },
        roomId: null,
        timeSpentSeconds: 95,
        answers: {
          selectedOptionIds: ['opt_2']
        }
      };

      // First attempt
      const res1 = await request(app)
        .post(`/api/v1/study/activities/${activityId}/attempts`)
        .set('x-test-actor', studentId)
        .send(submissionPayload);
      assert.equal(res1.status, 200);

      // Second identical retry
      const res2 = await request(app)
        .post(`/api/v1/study/activities/${activityId}/attempts`)
        .set('x-test-actor', studentId)
        .send(submissionPayload);

      assert.equal(res2.status, 200);
      assert.equal(res2.body.attemptId, attemptId);
      assert.equal(res2.body.score, 1.0);
      assert.equal(res2.body.evidenceId, res1.body.evidenceId);

      // Ensure strictly ONE evidence record exists
      const evidenceCount = await LearningEvidence.countDocuments({ userId: studentId, attemptId });
      assert.equal(evidenceCount, 1);
    }
  );

  await t.test(
    '5. Conflict: Re-submitting same attemptId with different answers triggers 409 STALE_ATTEMPT',
    async () => {
      const attemptId = crypto.randomUUID();

      const initialPayload = {
        schemaVersion: '1.0.0',
        attemptId,
        activity: {
          courseId,
          revisionId: publishedRevisionTag,
          contentHash,
          activityId,
          activityRevision,
          activityType: 'InteractiveQuiz'
        },
        roomId: null,
        timeSpentSeconds: 45,
        answers: {
          selectedOptionIds: ['opt_2']
        }
      };

      const resInitial = await request(app)
        .post(`/api/v1/study/activities/${activityId}/attempts`)
        .set('x-test-actor', studentId)
        .send(initialPayload);

      assert.equal(resInitial.status, 200);

      // Send conflicting payload with different answers on same attemptId
      const conflictingPayload = {
        ...initialPayload,
        answers: {
          selectedOptionIds: ['opt_1']
        }
      };

      const conflictRes = await request(app)
        .post(`/api/v1/study/activities/${activityId}/attempts`)
        .set('x-test-actor', studentId)
        .send(conflictingPayload);

      assert.equal(conflictRes.status, 409);
      assert.equal(conflictRes.body.error, 'STALE_ATTEMPT');

      // Confirm stored answer remains unchanged
      const stored = await StudentAttempt.findOne({ userId: studentId, attemptId });
      assert.deepEqual(stored!.answers, { selectedOptionIds: ['opt_2'] });
    }
  );

  await t.test(
    '6. Recipient Isolation: Submitter retrieves result; other user receives 404',
    async () => {
      const attemptId = crypto.randomUUID();

      await request(app)
        .post(`/api/v1/study/activities/${activityId}/attempts`)
        .set('x-test-actor', studentId)
        .send({
          schemaVersion: '1.0.0',
          attemptId,
          activity: {
            courseId,
            revisionId: publishedRevisionTag,
            contentHash,
            activityId,
            activityRevision,
            activityType: 'InteractiveQuiz'
          },
          roomId: null,
          timeSpentSeconds: 60,
          answers: { selectedOptionIds: ['opt_2'] }
        });

      // Submitter can fetch
      const okRes = await request(app)
        .get(`/api/v1/study/activities/${activityId}/attempts/${attemptId}`)
        .set('x-test-actor', studentId);
      assert.equal(okRes.status, 200);
      assert.equal(okRes.body.attemptId, attemptId);

      // Another student cannot fetch someone else's attempt
      const forbiddenRes = await request(app)
        .get(`/api/v1/study/activities/${activityId}/attempts/${attemptId}`)
        .set('x-test-actor', otherStudentId);
      assert.equal(forbiddenRes.status, 404);
      assert.equal(forbiddenRes.body.error, 'ATTEMPT_NOT_FOUND');
    }
  );

  await t.test(
    '7. Incorrect Answer: Score 0.0, Socratic hint provided, no evidence recorded',
    async () => {
      const attemptId = crypto.randomUUID();

      const res = await request(app)
        .post(`/api/v1/study/activities/${activityId}/attempts`)
        .set('x-test-actor', studentId)
        .send({
          schemaVersion: '1.0.0',
          attemptId,
          activity: {
            courseId,
            revisionId: publishedRevisionTag,
            contentHash,
            activityId,
            activityRevision,
            activityType: 'InteractiveQuiz'
          },
          roomId: null,
          timeSpentSeconds: 30,
          answers: { selectedOptionIds: ['opt_1'] }
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.score, 0.0);
      assert.equal(res.body.isCorrect, false);
      assert.ok(res.body.socraticHint);
      assert.equal(res.body.evidenceId, null);

      // Ensure NO evidence record was created for score 0.0
      const evidence = await LearningEvidence.findOne({ userId: studentId, attemptId });
      assert.equal(evidence, null);
    }
  );

  await t.test('8. Stale Revision & Foreign User Boundaries', async () => {
    const attemptId = crypto.randomUUID();

    // 1. Stale revision
    const staleRes = await request(app)
      .post(`/api/v1/study/activities/${activityId}/attempts`)
      .set('x-test-actor', studentId)
      .send({
        schemaVersion: '1.0.0',
        attemptId,
        activity: {
          courseId,
          revisionId: 'rev_stale_nonexistent',
          contentHash,
          activityId,
          activityRevision,
          activityType: 'InteractiveQuiz'
        },
        roomId: null,
        timeSpentSeconds: 30,
        answers: { selectedOptionIds: ['opt_2'] }
      });

    assert.equal(staleRes.status, 409);
    assert.equal(staleRes.body.error, 'STALE_REVISION');

    // 2. Foreign non-enrolled user
    const foreignRes = await request(app)
      .post(`/api/v1/study/activities/${activityId}/attempts`)
      .set('x-test-actor', foreignUserId)
      .send({
        schemaVersion: '1.0.0',
        attemptId: crypto.randomUUID(),
        activity: {
          courseId,
          revisionId: publishedRevisionTag,
          contentHash,
          activityId,
          activityRevision,
          activityType: 'InteractiveQuiz'
        },
        roomId: null,
        timeSpentSeconds: 30,
        answers: { selectedOptionIds: ['opt_2'] }
      });

    assert.equal(foreignRes.status, 403);
    assert.equal(foreignRes.body.error, 'FORBIDDEN');
  });
});
