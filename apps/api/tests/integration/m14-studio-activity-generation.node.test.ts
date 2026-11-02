import { materializeRevisionFixture } from '../helpers/revisionArtifactFixture';
import { cleanupCourseFixtures, prepareCourseFixture } from '../helpers/reviewedActivityFixture';
import test from 'node:test';
import assert from 'node:assert/strict';
import express, { type Response, type NextFunction } from 'express';
import request from 'supertest';
import mongoose from 'mongoose';

import {
  ActivityRecord,
  Course,
  CourseRevision,
  InstitutionMembership
} from '../../modules/study/src/models';
import coursesRouter from '../../modules/study/src/routes/courses';
import activitiesRouter from '../../modules/study/src/routes/activities';
import { updateCourseDraft } from '../../modules/study/src/services/courseDraft';
import type { DomainRequest } from '../../src/framework/contracts';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27018/ednova-test';

test('M14 / ED-32: Course Studio Source-Backed Activity Proposal Generation Integration', async (t) => {
  await mongoose.connect(MONGO_URI);

  const testPrefix = `m14_${Date.now()}`;
  const ownerUserId = `${testPrefix}_owner`;
  const instructorId = `${testPrefix}_instructor`;
  const unauthorizedUserId = `${testPrefix}_unauthorized`;
  const institutionId = new mongoose.Types.ObjectId();

  let courseId: string;
  let draftRevisionTag: string;

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
  app.use('/api/v1/study/courses', coursesRouter);
  app.use('/api/v1/study/activities', activitiesRouter);

  t.after(async () => {
    await cleanupCourseFixtures();
    try {
      if (courseId) {
        await Course.deleteMany({ courseId });
        await CourseRevision.deleteMany({ courseId });
        await ActivityRecord.deleteMany({ courseId });
      }
      await InstitutionMembership.deleteMany({ institutionId });
    } finally {
      await mongoose.disconnect();
    }
  });

  await t.test(
    'Setup: Create institutional course with draft hierarchy and objectives',
    async () => {
      await InstitutionMembership.create({
        institutionId,
        userId: instructorId,
        role: 'instructor',
        status: 'active'
      });

      const courseDoc = await Course.create({
        title: 'Neural Networks and Optimization',
        description: 'Advanced course on deep learning gradient descent methods.',
        subjectId: 'subj_dl_101',
        userId: ownerUserId,
        ownerUserId,
        scope: 'institutional',
        institutionId: institutionId.toString(),
        assignedInstructorIds: [instructorId],
        status: 'completed',
        topics: []
      });

      courseId = courseDoc._id.toString();

      await prepareCourseFixture(courseId, t);

      const initialRevision = await CourseRevision.create({
        courseId,
        revisionTag: `rev_init_${Date.now()}`,
        contentHash: 'sha256:7777777777777777777777777777777777777777777777777777777777777777',
        status: 'draft',
        isInstructorReviewed: false,
        topics: []
      });

      const draftUpdate = await updateCourseDraft(instructorId, courseId, {
        expectedRevisionTag: initialRevision.revisionTag,
        summary: 'Curated deep learning optimization curriculum',
        isInstructorReviewed: true,
        topics: [
          {
            id: 'topic_backprop',
            title: 'Backpropagation and Automatic Differentiation',
            subtopics: [
              {
                id: 'subtopic_chain_rule',
                title: 'Vector Calculus Chain Rule',
                learning_objectives: [
                  {
                    id: 'obj_gradient_derivation',
                    text: 'Apply multivariate chain rule to derive analytical matrix gradients',
                    bloomLevel: 'apply'
                  }
                ]
              }
            ]
          }
        ]
      });

      draftRevisionTag = draftUpdate.revisionTag;
      await materializeRevisionFixture(
        courseId,
        draftRevisionTag,
        'Verified calculus source: differentiation combines gradients through the chain rule while optimization compares directions and selects stable steps.'
      );
      assert.ok(draftRevisionTag, 'Draft revision tag should be populated');

      await prepareCourseFixture(courseId, t);
    }
  );

  await t.test(
    'ED-32.1: Rejects unauthorized student or outsider from generating proposals',
    async () => {
      const res = await request(app)
        .post(`/api/v1/study/courses/${courseId}/studio/generate-activity`)
        .set('x-test-actor', unauthorizedUserId)
        .send({
          objectiveId: 'obj_gradient_derivation',
          activityType: 'InteractiveQuiz'
        });

      assert.equal(res.status, 403, 'Unauthorized user should be rejected with 403 Forbidden');
      assert.equal(res.body.error, 'FORBIDDEN');
    }
  );

  await t.test('ED-32.2: Rejects generation for non-existent learning objective', async () => {
    const res = await request(app)
      .post(`/api/v1/study/courses/${courseId}/studio/generate-activity`)
      .set('x-test-actor', instructorId)
      .send({
        objectiveId: 'non_existent_objective_999',
        activityType: 'InteractiveQuiz'
      });

    assert.equal(res.status, 404, 'Non-existent objective should return 404');
    assert.equal(res.body.error, 'OBJECTIVE_NOT_FOUND');
  });

  let generatedQuizCandidate: {
    candidateActivity: Record<string, unknown>;
    candidateEvaluation: Record<string, unknown>;
  };

  await t.test(
    'ED-32.3: Generates Contract 04 InteractiveQuiz proposal grounded in draft objective',
    async () => {
      const res = await request(app)
        .post(`/api/v1/study/courses/${courseId}/studio/generate-activity`)
        .set('x-test-actor', instructorId)
        .send({
          objectiveId: 'obj_gradient_derivation',
          activityType: 'InteractiveQuiz',
          title: 'Multivariate Chain Rule Quiz'
        });

      assert.equal(res.status, 200, 'Generation should succeed with 200 OK');
      const body = res.body;

      assert.ok(body.candidateActivity, 'Should return candidateActivity');
      assert.ok(body.candidateEvaluation, 'Should return candidateEvaluation');
      assert.equal(body.draftRevisionTag, draftRevisionTag);

      // Contract 04 conformance
      const act = body.candidateActivity;
      assert.equal(act.schemaVersion, '1.0.0');
      assert.equal(act.activityType, 'InteractiveQuiz');
      assert.equal(act.courseId, courseId);
      assert.equal(act.objectiveId, 'obj_gradient_derivation');
      assert.equal(act.visibility, 'public');
      assert.ok(Array.isArray(act.sourceRefs) && act.sourceRefs.length > 0);
      assert.equal(act.sourceRefs[0].provenance, 'extracted');
      assert.equal(act.sourceRefs[0].locationKnown, false);

      // Presentation data check
      const pres = act.presentationData as {
        question: string;
        options: Array<{ id: string; label: string }>;
      };
      assert.ok(pres.question.includes('_____'));
      assert.ok(pres.options.length >= 2);

      // ServerEvaluationDefinition conformance
      const evalDef = body.candidateEvaluation;
      assert.equal(evalDef.schemaVersion, '1.0.0');
      assert.equal(evalDef.visibility, 'server_only');
      assert.equal(evalDef.evaluatorType, 'deterministic_rubric');
      assert.equal(evalDef.activity.activityId, act.activityId);
      assert.equal(evalDef.activity.courseId, courseId);
      assert.ok(Array.isArray(evalDef.answerKey));

      generatedQuizCandidate = body;
    }
  );

  await t.test(
    'ED-32.4: Generates Contract 04 GuidedProblem proposal grounded in draft objective',
    async () => {
      const res = await request(app)
        .post(`/api/v1/study/courses/${courseId}/studio/generate-activity`)
        .set('x-test-actor', instructorId)
        .send({
          objectiveId: 'obj_gradient_derivation',
          activityType: 'GuidedProblem'
        });

      assert.equal(res.status, 200);
      const body = res.body;
      assert.equal(body.candidateActivity.activityType, 'GuidedProblem');
      const pres = body.candidateActivity.presentationData as {
        problem: string;
        steps: Array<{ stepId: string; prompt: string }>;
      };
      assert.ok(pres.problem.length > 0);
      assert.ok(pres.steps.length >= 1);
      assert.equal(body.candidateEvaluation.activity.activityType, 'GuidedProblem');
    }
  );

  await t.test(
    'ED-32 settings: all supported prompt languages, difficulty and hint settings affect exact-source candidates',
    async () => {
      for (const language of ['en', 'fr', 'ar', 'ary']) {
        const response = await request(app)
          .post(`/api/v1/study/courses/${courseId}/studio/generate-activity`)
          .set('x-test-actor', instructorId)
          .send({
            objectiveId: 'obj_gradient_derivation',
            activityType: 'InteractiveQuiz',
            expectedRevisionTag: draftRevisionTag,
            sourceSectionId: 'section_1',
            language,
            difficulty: 'advanced',
            hintDepth: 'context'
          });
        assert.equal(response.status, 200, JSON.stringify(response.body));
        const body = response.body;
        assert.equal(body.candidateActivity.language, language);
        assert.equal(body.candidateActivity.presentationData.options.length, 6);
        assert.equal(body.candidateActivity.constraints.maxAttempts, 2);
        assert.equal(body.candidateActivity.timeLimitSeconds, 90);
        assert.ok(
          body.candidateActivity.instructions.includes(':'),
          'Requested hint must affect instructions'
        );
        assert.equal(body.generationSettings.hintDepth, 'context');
        assert.equal(body.evidencePreview.sectionId, 'section_1');
        assert.ok(body.evidencePreview.text.includes('differentiation'));
        assert.ok(body.warnings.includes('SOURCE_LOCATION_UNKNOWN'));
        assert.ok(body.warnings.includes('OBJECTIVE_ALIGNMENT_UNVERIFIED'));
        if (language !== 'en') assert.ok(body.warnings.includes('LANGUAGE_QUALITY_UNREVIEWED'));
        assert.equal(body.executionMode, 'DETERMINISTIC_FALLBACK');
      }
      for (const [difficulty, choices, steps] of [
        ['beginner', 2, 1],
        ['standard', 4, 2],
        ['advanced', 6, 3]
      ] as const) {
        for (const activityType of ['InteractiveQuiz', 'GuidedProblem']) {
          const response = await request(app)
            .post(`/api/v1/study/courses/${courseId}/studio/generate-activity`)
            .set('x-test-actor', instructorId)
            .send({
              objectiveId: 'obj_gradient_derivation',
              activityType,
              expectedRevisionTag: draftRevisionTag,
              difficulty
            });
          assert.equal(response.status, 200, JSON.stringify(response.body));
          if (activityType === 'InteractiveQuiz') {
            assert.equal(response.body.candidateActivity.presentationData.options.length, choices);
          } else {
            assert.equal(response.body.candidateActivity.presentationData.steps.length, steps);
            assert.equal(response.body.candidateEvaluation.answerKey.length, steps);
            assert.equal(new Set(response.body.candidateEvaluation.answerKey).size, steps);
          }
        }
      }
    }
  );

  await t.test(
    'ED-32 rejects unsupported settings, foreign sections and stale drafts without mutation',
    async () => {
      const before = await CourseRevision.findOne({
        courseId,
        revisionTag: draftRevisionTag
      }).lean();
      for (const invalid of [
        { language: 'xx' },
        { difficulty: 'expert' },
        { hintDepth: 'answer-key' },
        { sourceSectionId: 42 }
      ]) {
        const response = await request(app)
          .post(`/api/v1/study/courses/${courseId}/studio/generate-activity`)
          .set('x-test-actor', instructorId)
          .send({
            objectiveId: 'obj_gradient_derivation',
            activityType: 'InteractiveQuiz',
            ...invalid
          });
        assert.equal(response.status, 400, JSON.stringify(response.body));
        assert.equal(response.body.error, 'INVALID_GENERATION_SETTINGS');
      }
      const foreign = await request(app)
        .post(`/api/v1/study/courses/${courseId}/studio/generate-activity`)
        .set('x-test-actor', instructorId)
        .send({
          objectiveId: 'obj_gradient_derivation',
          activityType: 'InteractiveQuiz',
          sourceSectionId: 'foreign_section'
        });
      assert.equal(foreign.status, 503);
      const stale = await request(app)
        .post(`/api/v1/study/courses/${courseId}/studio/generate-activity`)
        .set('x-test-actor', instructorId)
        .send({
          objectiveId: 'obj_gradient_derivation',
          activityType: 'InteractiveQuiz',
          expectedRevisionTag: 'stale_revision'
        });
      assert.equal(stale.status, 409);
      const after = await CourseRevision.findOne({
        courseId,
        revisionTag: draftRevisionTag
      }).lean();
      assert.deepEqual(after, before);
    }
  );

  await t.test('ED-32.5: Invariant - Zero model self-publication or draft alteration', async () => {
    // Check that course draft was NOT auto-published
    const revisions = await CourseRevision.find({ courseId });
    const published = revisions.find((r) => r.status === 'published');
    assert.equal(published, undefined, 'Draft must not be auto-published by AI generation');

    // Check that activity was not auto-registered in persistent ActivityRecord
    const unreviewedRecord = await ActivityRecord.findOne({
      activityId: generatedQuizCandidate.candidateActivity.activityId
    });
    assert.equal(
      unreviewedRecord,
      null,
      'Activity must not be auto-registered before instructor approval'
    );
  });

  await t.test(
    'ED-32.6: Explicit instructor registration accepts the verified candidate without publishing',
    async () => {
      const activityId = generatedQuizCandidate.candidateActivity.activityId;
      const res = await request(app)
        .post(`/api/v1/study/activities/${activityId}/register`)
        .set('x-test-actor', instructorId)
        .send({
          courseId,
          activity: generatedQuizCandidate.candidateActivity,
          serverEvaluation: generatedQuizCandidate.candidateEvaluation
        });

      assert.equal(res.status, 201);
      const savedRecord = await ActivityRecord.findOne({ courseId, activityId });
      assert.ok(savedRecord);
      assert.equal(await CourseRevision.countDocuments({ courseId, status: 'published' }), 0);
    }
  );
});
