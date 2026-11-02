import { materializeRevisionFixture } from '../helpers/revisionArtifactFixture';
import {
  cleanupCourseFixtures,
  prepareCourseFixture,
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
  FacilitatorIntervention,
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
import { generateActivityCandidate } from '../../modules/study/src/services/courseStudio';
import { registerActivity } from '../../modules/study/src/services/activityAttempt';
import type { DomainRequest } from '../../src/framework/contracts';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27018/ednova-test';

test('M22 / ED-14: Master End-to-End Educational System Evaluation Scenario', async (t) => {
  await mongoose.connect(MONGO_URI);

  const testPrefix = `m22_e2e_${Date.now()}`;
  const institutionId = new mongoose.Types.ObjectId();
  const adminUserId = `${testPrefix}_admin`;
  const instructorUserId = `${testPrefix}_instructor`;
  const student1UserId = `${testPrefix}_alice`;
  const student2UserId = `${testPrefix}_bob`;
  const student3UserId = `${testPrefix}_carol`;
  const foreignUserId = `${testPrefix}_mallory`;

  let courseId: string;
  let draftRevisionTag: string;
  let publishedRevisionTag: string;
  const objectiveId = 'obj_master_algorithm_1';

  let generatedActivityId: string;
  let registeredQuizDef: Record<string, unknown>;
  let registeredQuizEval: Record<string, unknown>;

  let roomId: string;
  let inviteCode: string;

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
      if (courseId) {
        await Course.deleteMany({ _id: courseId });
        await CourseRevision.deleteMany({ courseId });
        await CourseEnrollment.deleteMany({ courseId });
        await ActivityRecord.deleteMany({ courseId });
        await StudentAttempt.deleteMany({ courseId });
        await LearningEvidence.deleteMany({ 'activity.courseId': courseId });
      }
      await Institution.deleteMany({ _id: institutionId });
      await InstitutionMembership.deleteMany({ institutionId });
      if (roomId) {
        await StudyRoom.deleteMany({ roomId });
        await FacilitatorIntervention.deleteMany({ roomId });
      }
    } finally {
      await mongoose.disconnect();
    }
  });

  // STEP 1: Institutional Setup and Enrollment
  await t.test(
    'Step 1: Institutional scoping, assigned instructors, and student enrollment',
    async () => {
      await Institution.create({
        _id: institutionId,
        name: 'EdNova University of Science',
        slug: `ednova-sci-${testPrefix}`,
        createdByUserId: adminUserId,
        domain: 'ednova.synthetic.edu',
        status: 'active'
      });

      await InstitutionMembership.create([
        { institutionId, userId: adminUserId, role: 'university_admin', status: 'active' },
        { institutionId, userId: instructorUserId, role: 'instructor', status: 'active' },
        { institutionId, userId: student1UserId, role: 'university_student', status: 'active' },
        { institutionId, userId: student2UserId, role: 'university_student', status: 'active' },
        { institutionId, userId: student3UserId, role: 'university_student', status: 'active' }
      ]);

      const courseDoc = await Course.create({
        title: 'Advanced Graph Algorithms & Network Flow',
        description: 'Master course on max-flow min-cut and residual networks.',
        subjectId: 'subj_cs_301',
        userId: adminUserId,
        ownerUserId: adminUserId,
        scope: 'institutional',
        institutionId: institutionId.toString(),
        assignedInstructorIds: [instructorUserId],
        status: 'completed',
        topics: []
      });
      courseId = courseDoc._id.toString();
      await prepareCourseFixture(courseId, t);

      // Enroll students in course
      await CourseEnrollment.create([
        {
          courseId,
          institutionId,
          userId: student1UserId,
          enrolledRole: 'student',
          status: 'active'
        },
        {
          courseId,
          institutionId,
          userId: student2UserId,
          enrolledRole: 'student',
          status: 'active'
        },
        {
          courseId,
          institutionId,
          userId: student3UserId,
          enrolledRole: 'student',
          status: 'active'
        }
      ]);

      assert.ok(courseId, 'Course must be created');

      await prepareCourseFixture(courseId, t);
    }
  );

  // STEP 2: Course Studio Ingestion & Hierarchy Curation
  await t.test('Step 2: Course Studio draft hierarchy curation & provenance tracking', async () => {
    const initialRev = await CourseRevision.create({
      courseId,
      revisionTag: `rev_init_${Date.now()}`,
      contentHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      status: 'draft',
      isInstructorReviewed: false,
      topics: []
    });

    const draftUpdate = await updateCourseDraft(instructorUserId, courseId, {
      expectedRevisionTag: initialRev.revisionTag,
      summary: 'Curated curriculum covering Ford-Fulkerson and Edmonds-Karp complexity',
      isInstructorReviewed: true,
      topics: [
        {
          id: 'topic_network_flow',
          title: 'Maximum Flow and Minimum Cut Equivalence',
          subtopics: [
            {
              id: 'subtopic_edmonds_karp',
              title: 'Edmonds-Karp BFS Augmenting Paths',
              learning_objectives: [
                {
                  id: objectiveId,
                  text: 'Analyze the polynomial bound O(V*E^2) using shortest augmenting paths',
                  bloomLevel: 'analyze'
                }
              ]
            }
          ]
        }
      ]
    });

    draftRevisionTag = draftUpdate.revisionTag;
    await materializeRevisionFixture(courseId, draftRevisionTag);

    assert.ok(draftRevisionTag);
    assert.equal(draftUpdate.isInstructorReviewed, true);
  });

  // STEP 3: Studio Activity Candidate Generation & Explicit Registration
  await t.test(
    'Step 3: Studio AI proposal generation and explicit instructor registration',
    async () => {
      const candidateProposal = await generateActivityCandidate(instructorUserId, courseId, {
        objectiveId,
        activityType: 'InteractiveQuiz',
        title: 'Edmonds-Karp Complexity Verification'
      });

      assert.ok(candidateProposal.candidateActivity);
      assert.ok(candidateProposal.candidateEvaluation);
      generatedActivityId = String(candidateProposal.candidateActivity.activityId);

      // Invariant: Proposal is NOT auto-persisted
      const unreviewed = await ActivityRecord.findOne({ activityId: generatedActivityId });
      assert.equal(unreviewed, null, 'Proposal must not auto-persist');

      // Register approved candidate activity
      registeredQuizDef = candidateProposal.candidateActivity;
      registeredQuizEval = candidateProposal.candidateEvaluation;

      await reviewActivityFixture(courseId, registeredQuizDef, registeredQuizEval);
      const regRes = await registerActivity(
        instructorUserId,
        courseId,
        registeredQuizDef,
        registeredQuizEval
      );
      assert.ok(regRes);

      const savedRecord = await ActivityRecord.findOne({
        courseId,
        activityId: generatedActivityId
      });
      assert.ok(savedRecord, 'Activity record must now be stored');
    }
  );

  // STEP 4: Review Gate & Immutable Course Publication
  await t.test(
    'Step 4: Instructor review gate and immutable course revision publication',
    async () => {
      const pubRes = await publishCourseRevision(instructorUserId, courseId, draftRevisionTag);
      publishedRevisionTag = pubRes.publishedRevisionTag;
      assert.ok(publishedRevisionTag);

      // Verify published context accessible to enrolled student Alice
      const ctxRes = await request(app)
        .get(`/api/v1/study/courses/${courseId}/published-context`)
        .set('x-test-actor', student1UserId);
      assert.equal(ctxRes.status, 200);
      assert.equal(ctxRes.body.revisionId, publishedRevisionTag);
    }
  );

  // STEP 5: Study Together Room Lifecycle & Synchronized Activity
  await t.test(
    'Step 5: Study Together room creation, join, capacity enforcement & phase sync',
    async () => {
      // Alice creates room with capacity 2
      const createRes = await request(app)
        .post('/api/v1/study/rooms')
        .set('x-test-actor', student1UserId)
        .send({
          title: 'Network Flow Study Circle',
          courseId,
          maxParticipants: 2
        });
      assert.equal(createRes.status, 201);
      roomId = createRes.body.roomId;
      inviteCode = createRes.body.inviteCode;

      // Bob joins room successfully
      const bobJoin = await request(app)
        .post('/api/v1/study/rooms/join')
        .set('x-test-actor', student2UserId)
        .send({ inviteCode });
      assert.equal(bobJoin.status, 200);

      // Carol tries to join full room -> 409 Conflict
      const carolJoin = await request(app)
        .post('/api/v1/study/rooms/join')
        .set('x-test-actor', student3UserId)
        .send({ inviteCode });
      assert.equal(carolJoin.status, 409, 'Excess participant rejected with 409 Conflict');

      // Alice advances room to individual_attempt phase with active quiz
      const phaseRes = await request(app)
        .put(`/api/v1/study/rooms/${roomId}/phase`)
        .set('x-test-actor', student1UserId)
        .send({
          currentPhase: 'individual_attempt',
          activeActivityId: generatedActivityId
        });
      assert.equal(phaseRes.status, 200);
      assert.equal(phaseRes.body.currentPhase, 'individual_attempt');
      assert.equal(phaseRes.body.activeActivityId, generatedActivityId);
    }
  );

  // STEP 6: AI Facilitator Peer-First Intervention
  await t.test('Step 6: AI Facilitator peer-first guidance and learner agency', async () => {
    // Facilitator deflects direct answer into peer reasoning (L1 Socratic nudge)
    const hintRes = await request(app)
      .post(`/api/v1/study/rooms/${roomId}/facilitator/action`)
      .set('x-test-actor', student1UserId)
      .send({
        actionType: 'request_hint',
        hintLevel: 1
      });

    assert.equal(hintRes.status, 200);
    assert.equal(hintRes.body.intervened, true);
    assert.equal(hintRes.body.intervention.strategy, 'SOCRATIC_NUDGE');
    assert.ok(hintRes.body.intervention.message.includes('Level 1'));

    const interventionId = hintRes.body.intervention.interventionId;

    // Quiet learner agency: Bob declines prompt suggestion
    const declineRes = await request(app)
      .post(`/api/v1/study/rooms/${roomId}/facilitator/action`)
      .set('x-test-actor', student2UserId)
      .send({
        actionType: 'decline_prompt',
        interventionId
      });
    assert.equal(declineRes.status, 200);
    assert.equal(declineRes.body.success, true);
  });

  // STEP 7: Authoritative Attempt Submission, Idempotency & Accepted Evidence
  let aliceAttemptId: string;
  await t.test(
    'Step 7: Concurrent private attempt submission, idempotency & accepted evidence',
    async () => {
      aliceAttemptId = crypto.randomUUID();

      const submitRes = await request(app)
        .post(`/api/v1/study/activities/${generatedActivityId}/attempts`)
        .set('x-test-actor', student1UserId)
        .send({
          schemaVersion: '1.0.0',
          attemptId: aliceAttemptId,
          activity: {
            courseId,
            revisionId: registeredQuizDef.revisionId,
            contentHash: registeredQuizDef.contentHash,
            activityId: generatedActivityId,
            activityRevision: registeredQuizDef.activityRevision,
            activityType: 'InteractiveQuiz'
          },
          roomId,
          answers: { selectedOptionIds: registeredQuizEval.answerKey },
          timeSpentSeconds: 65
        });

      assert.equal(submitRes.status, 200);
      assert.equal(submitRes.body.status, 'graded');
      assert.equal(submitRes.body.isCorrect, true);
      assert.equal(submitRes.body.score, 1.0);
      assert.ok(submitRes.body.evidenceId, 'Should yield accepted evidence ID');

      // Idempotency: exact same attempt re-submission returns identical result without duplicate evidence
      const replayRes = await request(app)
        .post(`/api/v1/study/activities/${generatedActivityId}/attempts`)
        .set('x-test-actor', student1UserId)
        .send({
          schemaVersion: '1.0.0',
          attemptId: aliceAttemptId,
          activity: {
            courseId,
            revisionId: registeredQuizDef.revisionId,
            contentHash: registeredQuizDef.contentHash,
            activityId: generatedActivityId,
            activityRevision: registeredQuizDef.activityRevision,
            activityType: 'InteractiveQuiz'
          },
          roomId,
          answers: { selectedOptionIds: registeredQuizEval.answerKey },
          timeSpentSeconds: 65
        });
      assert.equal(replayRes.status, 200);
      assert.equal(replayRes.body.evidenceId, submitRes.body.evidenceId);

      // Verify Evidence record in database
      const evidenceCount = await LearningEvidence.countDocuments({
        attemptId: aliceAttemptId
      });
      assert.equal(evidenceCount, 1, 'Exactly one evidence record must be created');
    }
  );

  // STEP 8: Group Debrief Dual-Projection
  await t.test(
    'Step 8: Group debrief phase transition with dual public/private projection',
    async () => {
      // Advance to debrief
      const debriefPhase = await request(app)
        .put(`/api/v1/study/rooms/${roomId}/phase`)
        .set('x-test-actor', student1UserId)
        .send({ currentPhase: 'debrief' });
      assert.equal(debriefPhase.status, 200);

      // Alice requests debrief (submitted and passed)
      const aliceDebrief = await request(app)
        .get(`/api/v1/study/rooms/${roomId}/debrief`)
        .set('x-test-actor', student1UserId);
      assert.equal(aliceDebrief.status, 200);
      assert.equal(aliceDebrief.body.recap.publicSubmissionsCount, 1);
      assert.equal(aliceDebrief.body.privateOutcome.status, 'graded');
      assert.equal(aliceDebrief.body.privateOutcome.score, 1.0);

      // Bob requests debrief (untested)
      const bobDebrief = await request(app)
        .get(`/api/v1/study/rooms/${roomId}/debrief`)
        .set('x-test-actor', student2UserId);
      assert.equal(bobDebrief.status, 200);
      assert.equal(bobDebrief.body.recap.publicSubmissionsCount, 1);
      assert.equal(bobDebrief.body.privateOutcome.status, 'untested');
      assert.equal(bobDebrief.body.privateOutcome.score, undefined);
    }
  );

  // STEP 9: Security & Negative Adversarial Injections
  await t.test(
    'Step 9: Adversarial negative injections: stale revisions, unauthorized actors, schema violations',
    async () => {
      // 1. Foreign unauthorized user cannot access course materials
      const malloryAccess = await request(app)
        .get(`/api/v1/study/courses/${courseId}/draft`)
        .set('x-test-actor', foreignUserId);
      assert.equal(malloryAccess.status, 403);

      // 2. Mallory cannot join active room without invite code
      const malloryJoin = await request(app)
        .post('/api/v1/study/rooms/join')
        .set('x-test-actor', foreignUserId)
        .send({ roomId });
      assert.ok([400, 403, 404].includes(malloryJoin.status));

      // 3. Stale revision submission rejected with 409 Conflict
      const staleAttempt = await request(app)
        .post(`/api/v1/study/activities/${generatedActivityId}/attempts`)
        .set('x-test-actor', student1UserId)
        .send({
          schemaVersion: '1.0.0',
          attemptId: crypto.randomUUID(),
          activity: {
            courseId,
            revisionId: 'rev_stale_9999999',
            contentHash: registeredQuizDef.contentHash,
            activityId: generatedActivityId,
            activityRevision: registeredQuizDef.activityRevision,
            activityType: 'InteractiveQuiz'
          },
          roomId,
          answers: { selectedOptionIds: registeredQuizEval.answerKey },
          timeSpentSeconds: 30
        });
      assert.equal(staleAttempt.status, 409, 'Stale revision must be rejected with 409 Conflict');

      // 4. Schema injection violation: non-whitelisted property in submission rejected
      const tamperAttempt = await request(app)
        .post(`/api/v1/study/activities/${generatedActivityId}/attempts`)
        .set('x-test-actor', student1UserId)
        .send({
          schemaVersion: '1.0.0',
          attemptId: crypto.randomUUID(),
          activity: registeredQuizDef,
          answers: {
            selectedOptionIds: registeredQuizEval.answerKey,
            extraInjectedField: 'malicious'
          },
          timeSpentSeconds: 30
        });
      assert.equal(
        tamperAttempt.status,
        400,
        'Tampered payload must be rejected with 400 Validation Error'
      );
    }
  );
});
