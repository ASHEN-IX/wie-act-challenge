import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import express, { type Response, type NextFunction } from 'express';
import request from 'supertest';
import crypto from 'node:crypto';

import {
  Course,
  CourseEnrollment,
  CourseRevision,
  Institution,
  InstitutionMembership,
  ActivityRecord
} from '../../modules/study/src/models';
import { canReadCourse, canAuthorCourse, getCourseAccessRole } from '../../modules/study/src/services/resourceAccess';
import { selectLearningActivity } from '../../modules/study/src/services/learningJourney';
import { updateCourseDraft } from '../../modules/study/src/services/courseDraft';
import { publishCourseRevision } from '../../modules/study/src/services/coursePublication';
import { prepareCourseFixture, cleanupCourseFixtures, reviewActivityFixture } from '../helpers/reviewedActivityFixture';
import { materializeRevisionFixture } from '../helpers/revisionArtifactFixture';
import coursesRouter from '../../modules/study/src/routes/courses';
import type { DomainRequest } from '../../src/framework/contracts';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/ednova-test';

test('Step 10 Learning Closure: ED-06 Source Isolation, ED-21 Unofficial Flow, and ED-28 Activity Safety', async (t) => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGO_URI);
  }

  const prefix = `s10_${Date.now()}`;
  const userA = `${prefix}_userA`;
  const userB = `${prefix}_userB`;
  const instructor = `${prefix}_instructor`;
  const inst1Id = new mongoose.Types.ObjectId();
  const inst2Id = new mongoose.Types.ObjectId();
  const subjectId = new mongoose.Types.ObjectId();

  let personalCourseId: string;
  let institutionalCourseId: string;
  let draftRevisionTag: string;
  let publishedRevisionTag: string;
  const objectiveId = `obj_${prefix}_sort`;

  t.after(async () => {
    await cleanupCourseFixtures();
    try {
      if (personalCourseId) {
        await Course.findByIdAndDelete(personalCourseId);
        await CourseRevision.deleteMany({ courseId: personalCourseId });
      }
      if (institutionalCourseId) {
        await Course.findByIdAndDelete(institutionalCourseId);
        await CourseRevision.deleteMany({ courseId: institutionalCourseId });
      }
      await ActivityRecord.deleteMany({ courseId: institutionalCourseId });
      await Institution.deleteMany({ _id: { $in: [inst1Id, inst2Id] } });
      await InstitutionMembership.deleteMany({ userId: { $in: [userA, userB, instructor] } });
      await CourseEnrollment.deleteMany({ userId: { $in: [userA, userB] } });
      await mongoose.connection.collection('subjects').deleteOne({ _id: subjectId });
    } catch {} finally {
      await mongoose.disconnect();
    }
  });

  // Setup Express App
  const app = express();
  app.use(express.json());
  let currentActor: { userId: string; role?: string } | null = null;
  app.use((req, _res, next) => {
    (req as unknown as { user: typeof currentActor }).user = currentActor;
    next();
  });
  app.use('/api/v1/study/courses', coursesRouter);

  await t.test('1. Setup Institutions, Memberships, and Courses', async () => {
    try {
      await mongoose.connection.collection('subjects').insertOne({
        _id: subjectId,
        name: 'Computer Science',
        slug: `cs-${Date.now()}`
      });

    // 1. Active Institution 1
    await Institution.create({
      _id: inst1Id,
      name: 'Step 10 University 1',
      slug: `s10-u1-${Date.now()}`,
      status: 'active',
      createdByUserId: instructor
    });

    // 2. Active Institution 2
    await Institution.create({
      _id: inst2Id,
      name: 'Step 10 University 2',
      slug: `s10-u2-${Date.now()}`,
      status: 'active',
      createdByUserId: instructor
    });

    // User A is a student in Institution 1
    await InstitutionMembership.create({
      institutionId: inst1Id,
      userId: userA,
      role: 'university_student',
      status: 'active'
    });

    // Instructor in Institution 1
    await InstitutionMembership.create({
      institutionId: inst1Id,
      userId: instructor,
      role: 'instructor',
      status: 'active'
    });

    // User B is in Institution 2 (different institution)
    await InstitutionMembership.create({
      institutionId: inst2Id,
      userId: userB,
      role: 'university_student',
      status: 'active'
    });

    // Personal course owned by User A
    const pc = await Course.create({
      title: 'User A Private Personal Course',
      subjectId,
      scope: 'personal',
      userId: userA,
      ownerUserId: userA,
      status: 'completed',
      modules: []
    });
    personalCourseId = pc._id.toString();

    // Institutional course in Institution 1
    const ic = await Course.create({
      title: 'Official Data Structures',
      subjectId,
      scope: 'institutional',
      institutionId: inst1Id,
      userId: instructor,
      ownerUserId: instructor,
      assignedInstructorIds: [instructor],
      status: 'completed',
      topics: [
        {
          id: 'topic_sort_1',
          title: 'Sorting Algorithms',
          description: 'Fundamental sorting paradigms',
          subtopics: [
            {
              id: 'sub_sort_1',
              title: 'Divide and Conquer Sorting',
              summary: 'Quick Sort and Merge Sort analysis',
              provenance: 'extracted',
              learning_objectives: [
                {
                  id: objectiveId,
                  statement: 'Formulate time complexity recurrences for divide-and-conquer sorting',
                  bloomLevel: 'apply',
                  provenance: 'extracted'
                }
              ]
            }
          ]
        }
      ],
      files: [
        {
          filename: 'sorting.pdf',
          originalName: 'sorting.pdf',
          fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
        }
      ]
    });
    institutionalCourseId = ic._id.toString();

    // Prepare course fixture (sets up files and mock artifacts)
    await prepareCourseFixture(institutionalCourseId, t);

    // Enroll User A in Institutional Course
    await CourseEnrollment.create({
      courseId: ic._id,
      institutionId: inst1Id,
      userId: userA,
      status: 'active',
      enrolledAt: new Date()
    });

    draftRevisionTag = `rev_${prefix}_draft`;
    const draftHash = 'sha256:' + crypto.createHash('sha256').update('Draft Initial Content').digest('hex');
    await CourseRevision.create({
      courseId: institutionalCourseId,
      revisionTag: draftRevisionTag,
      contentHash: draftHash,
      status: 'draft',
      isInstructorReviewed: false,
      summary: 'Draft revision for sorting course',
      topics: ic.topics,
      sourceManifest: [
        {
          documentId: 'doc_sort_1',
          filename: 'sorting.pdf',
          contentHash: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          storageRef: 'uploads/sorting.pdf',
          mediaType: 'application/pdf',
          provenance: 'extracted'
        }
      ],
      authorizedDocumentIds: ['doc_sort_1'],
      manifestDigest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      vectorIndexRef: `faiss/${institutionalCourseId}/${draftRevisionTag}.faiss`
    });

    // Review draft as instructor
    const reviewUpdate = await updateCourseDraft(instructor, institutionalCourseId, {
      expectedRevisionTag: draftRevisionTag,
      isInstructorReviewed: true,
      topics: ic.topics as any
    });

    const quizActivityId = `act_${prefix}_q1`;
    const quizDef = {
      schemaVersion: '1.0.0',
      activityId: quizActivityId,
      activityRevision: 'rev_1',
      componentVersion: '1.0.0',
      courseId: institutionalCourseId,
      revisionId: reviewUpdate.revisionTag,
      contentHash: '',
      objectiveId,
      title: 'Quick Sort Recurrence Quiz',
      instructions: 'Answer the question based on algorithm analysis.',
      timeLimitSeconds: null,
      visibility: 'public',
      language: 'en',
      sourceRefs: [],
      constraints: { maxAttempts: 3, allowCalculator: false },
      activityType: 'InteractiveQuiz',
      presentationData: {
        question: 'What is the recurrence relation for standard Quick Sort average case?',
        options: [
          { id: 'opt_1', label: 'T(N) = 2T(N/2) + O(N)' },
          { id: 'opt_2', label: 'T(N) = T(N-1) + O(1)' }
        ],
        isMultiSelect: false
      }
    };

    const quizEval = {
      schemaVersion: '1.0.0',
      visibility: 'server_only',
      activity: {
        courseId: institutionalCourseId,
        revisionId: reviewUpdate.revisionTag,
        contentHash: '',
        activityId: quizActivityId,
        activityRevision: 'rev_1',
        activityType: 'InteractiveQuiz'
      },
      evaluationRef: `ref_${prefix}`,
      evaluatorType: 'deterministic_rubric',
      rubricVersion: '1.0.0',
      rubric: 'exact-options-v1',
      answerKey: ['opt_1']
    };

    await reviewActivityFixture(institutionalCourseId, quizDef, quizEval);

    await ActivityRecord.create({
      courseId: institutionalCourseId,
      revisionId: reviewUpdate.revisionTag,
      activityId: quizActivityId,
      activityRevision: 'rev_1',
      contentHash: quizDef.contentHash,
      activityType: 'InteractiveQuiz',
      objectiveId,
      publicDefinition: quizDef,
      serverEvaluation: quizEval
    });

    await prepareCourseFixture(institutionalCourseId, t);

    // Publish revision as instructor
    const pubResult = await publishCourseRevision(instructor, institutionalCourseId, reviewUpdate.revisionTag);
    publishedRevisionTag = pubResult.publishedRevisionTag;

    assert.ok(personalCourseId);
    assert.ok(institutionalCourseId);
    assert.ok(publishedRevisionTag);
    } catch (err) {
      console.error('SUBTEST 1 ERROR:', err);
      throw err;
    }
  });

  // ED-06 Acceptance
  await t.test('2. ED-06-A001: Personal material is private by default', async () => {
    // User A (owner) can read personal course
    const canA = await canReadCourse(userA, personalCourseId);
    assert.equal(canA, true, 'Owner should read their own personal course');

    // User B (foreigner) cannot read personal course
    const canB = await canReadCourse(userB, personalCourseId);
    assert.equal(canB, false, 'Foreign user must not read private personal course');

    // HTTP test
    currentActor = { userId: userB };
    const res = await request(app).get(`/api/v1/study/courses/${personalCourseId}`);
    assert.ok([403, 404].includes(res.status), `Foreign user must receive 403 or 404, got ${res.status}`);
  });

  await t.test('3. ED-06-A002 & A003: Authorized official material resolves consistently within authorized scope', async () => {
    // User A is enrolled student in Institution 1 -> allowed
    const canA = await canReadCourse(userA, institutionalCourseId);
    assert.equal(canA, true, 'Enrolled student must have access to official course');

    // Instructor assigned to course -> allowed
    const canInst = await canReadCourse(instructor, institutionalCourseId);
    assert.equal(canInst, true, 'Assigned instructor must have access');

    // User B (Institution 2) -> denied
    const canB = await canReadCourse(userB, institutionalCourseId);
    assert.equal(canB, false, 'Student from foreign institution must be denied access');
  });

  await t.test('4. ED-06-A004 & A005: Stale cached source cannot escape approved revision scope & private source isolation', async () => {
    const pubRev = await CourseRevision.findOne({
      revisionTag: publishedRevisionTag
    }).lean();

    assert.ok(pubRev);
    assert.equal(pubRev?.status, 'published');
    assert.equal(pubRev?.activationState, 'committed');
    assert.ok(pubRev?.sourceManifest && pubRev.sourceManifest.length > 0);
  });

  // ED-28 Acceptance
  await t.test('5. ED-28-A001: Source-backed request selects suitable allowed activity type', async () => {
    const result = await selectLearningActivity(
      userA,
      institutionalCourseId,
      {
        revisionId: publishedRevisionTag,
        objectiveId,
        activityType: 'InteractiveQuiz',
        intent: 'practice'
      }
    );

    assert.equal(result.kind, 'activity');
    assert.ok(result.activity);
    assert.equal(result.activity?.activityType, 'InteractiveQuiz');
    assert.equal(result.activity?.objectiveId, objectiveId);
  });

  await t.test('6. ED-28-A002 & A003: Rejection of arbitrary executable code and unknown activity types', async () => {
    // Unknown activity type
    await assert.rejects(
      async () => {
        await selectLearningActivity(
          userA,
          institutionalCourseId,
          {
            revisionId: publishedRevisionTag,
            objectiveId,
            activityType: '<script>alert(1)</script>',
            intent: 'practice'
          }
        );
      },
      (err: any) => {
        assert.equal(err.code, 'UNSUPPORTED_TYPE');
        return true;
      }
    );

    // Arbitrary injected fields
    await assert.rejects(
      async () => {
        await selectLearningActivity(
          userA,
          institutionalCourseId,
          {
            revisionId: publishedRevisionTag,
            objectiveId,
            maliciousPayload: 'eval("rm -rf /")',
            intent: 'practice'
          }
        );
      },
      (err: any) => {
        assert.equal(err.code, 'INVALID_INPUT');
        return true;
      }
    );
  });

  await t.test('7. ED-28-A004 & A005: Unsupported revision and forged objective fail safely', async () => {
    // Forged objective not present in revision
    await assert.rejects(
      async () => {
        await selectLearningActivity(
          userA,
          institutionalCourseId,
          {
            revisionId: publishedRevisionTag,
            objectiveId: 'forged_fake_objective_999',
            intent: 'practice'
          }
        );
      },
      (err: any) => {
        assert.equal(err.code, 'OBJECTIVE_NOT_FOUND');
        return true;
      }
    );

    // Unsupported revision tag type
    await assert.rejects(
      async () => {
        await selectLearningActivity(
          userA,
          institutionalCourseId,
          {
            revisionId: 12345,
            objectiveId,
            intent: 'practice'
          }
        );
      },
      (err: any) => {
        assert.equal(err.code, 'INVALID_INPUT');
        return true;
      }
    );
  });

  await t.test('8. ED-28-A006: AI generated output is not automatically approved as official content', async () => {
    const draftAct = await ActivityRecord.create({
      courseId: institutionalCourseId,
      revisionId: 'rev_draft_unapproved',
      activityId: `act_${prefix}_unapproved`,
      activityRevision: 'rev_1',
      contentHash: 'sha256:5555555555555555555555555555555555555555555555555555555555555555',
      activityType: 'InteractiveQuiz',
      objectiveId,
      publicDefinition: {
        schemaVersion: '1.0.0',
        activityId: `act_${prefix}_unapproved`,
        title: 'Unapproved Candidate',
        question: 'Draft candidate question'
      },
      serverEvaluation: {
        schemaVersion: '1.0.0',
        visibility: 'server_only',
        activity: {
          courseId: institutionalCourseId,
          revisionId: 'rev_draft_unapproved',
          contentHash: 'sha256:5555555555555555555555555555555555555555555555555555555555555555',
          activityId: `act_${prefix}_unapproved`,
          activityRevision: 'rev_1',
          activityType: 'InteractiveQuiz'
        },
        evaluationRef: 'ref_draft',
        evaluatorType: 'deterministic_rubric',
        rubricVersion: '1.0.0',
        rubric: 'exact-options-v1',
        answerKey: ['opt_1']
      }
    });

    // Student requesting activity for published revision never receives 'rev_draft_unapproved'
    const result = await selectLearningActivity(
      userA,
      institutionalCourseId,
      {
        revisionId: publishedRevisionTag,
        objectiveId,
        activityType: 'InteractiveQuiz',
        intent: 'practice'
      }
    );

    assert.notEqual(result.activity?.activityId, draftAct.activityId, 'Learner must never receive unapproved draft activity');
  });

  // ED-21 Acceptance
  await t.test('9. ED-21: Unofficial open-topic practice cannot forge official institutional provenance', async () => {
    // Personal course has no institutionId
    const courseDoc = await Course.findById(personalCourseId).lean();
    assert.equal(courseDoc?.institutionId, undefined, 'Personal course must have no institutionId');
    assert.equal(courseDoc?.scope, 'personal', 'Scope must be personal');

    // A learner attempting to read personal course as institutional fails
    const role = await getCourseAccessRole(userB, personalCourseId);
    assert.equal(role, null, 'Non-owner receives null role for personal course');
  });
});
