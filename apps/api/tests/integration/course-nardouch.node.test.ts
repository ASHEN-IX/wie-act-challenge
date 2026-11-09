/** Real Mongo, source artifacts, publication access and the existing reviewed grader. */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { connectDatabase, disconnectDatabase } from '../../shared/database';
import { newId } from '../../shared/ids';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import type { DomainRequest } from '../../src/framework/contracts';
import { Course, CourseRevision, ActivityRecord } from '../../modules/study/src/models';
import { CourseNardouchProgress } from '../../modules/study/src/models/CourseNardouchProgress';
import { materializeRevisionFixture } from '../helpers/revisionArtifactFixture';
import {
  getCourseNardouch,
  completeNardouchLesson
} from '../../modules/study/src/services/courseNardouch';
import { publishCourseRevision } from '../../modules/study/src/services/coursePublication';
import { submitAttempt } from '../../modules/study/src/services/activityAttempt';
import { parseContract } from '../../shared/ednova/contracts';
import learningRouter from '../../modules/study/src/routes/learning';

test(
  'course mascot persists independently and graduates only on accepted checks',
  { timeout: 30000 },
  async (t) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nardouch-growth-'));
    process.env.DATABASE_URL =
      process.env.DATABASE_URL || 'postgresql://ednova:ednova@127.0.0.1:5433/ednova_test';
    process.env.INGEST_UPLOADS_DIR = path.join(root, 'uploads');
    process.env.FAISS_INDEX_DIR = path.join(root, 'indexes');
    await connectDatabase();
    const runTag = `${process.pid}_${Date.now()}`;
    const actor = 'growth-owner_' + runTag;
    const courseIds: string[] = [];
    t.after(async () => {
      try {
        if (courseIds.length) {
          await CourseNardouchProgress.deleteMany({ courseId: { $in: courseIds } });
          await ActivityRecord.deleteMany({ courseId: { $in: courseIds } });
          await CourseRevision.deleteMany({ courseId: { $in: courseIds } });
        }
        await CourseNardouchProgress.deleteMany({ userId: actor });
        await Course.deleteMany({ userId: actor });
      } finally {
        await disconnectDatabase().catch(() => {});
        await fs.rm(root, { recursive: true, force: true });
      }
    });
    const topics = Array.from({ length: 4 }, (_, i) => ({
      id: `lesson_${i}`,
      title: `Lesson ${i + 1}`,
      subtopics: [
        {
          id: `sub_${i}`,
          title: 'Arithmetic',
          learning_objectives:
            i === 0
              ? [{ id: 'obj_sum', statement: 'Compute two plus two', bloomLevel: 'understand' }]
              : []
        }
      ]
    }));
    async function seedCourse() {
      const course = await Course.create({
        id: newId(),
        userId: actor,
        ownerUserId: actor,
        scope: 'personal',
        subjectId: 'synthetic',
        title: 'Arithmetic',
        status: 'completed',
        activeRevisionId: 'rev_growth'
      });
      const courseId = course.id.toString();
      courseIds.push(courseId);
      await CourseRevision.create({
        courseId,
        revisionTag: 'rev_growth',
        contentHash: 'a'.repeat(64),
        status: 'draft',
        isInstructorReviewed: true,
        topics
      });
      const source = await materializeRevisionFixture(courseId, 'rev_growth');
      return { courseId, source };
    }
    const { courseId, source } = await seedCourse();
    const { courseId: otherCourse } = await seedCourse();
    const pin = {
      courseId,
      revisionId: 'rev_growth',
      contentHash: 'sha256:' + 'a'.repeat(64),
      activityId: 'act_growth',
      activityRevision: 'rev_1',
      activityType: 'InteractiveQuiz' as const
    };
    const definition = parseContract('ActivityDefinition', {
      schemaVersion: '1.0.0',
      ...pin,
      componentVersion: '1.0.0',
      objectiveId: 'obj_sum',
      title: 'Two plus two',
      instructions: 'Select the sum.',
      timeLimitSeconds: null,
      visibility: 'public',
      language: 'en',
      sourceRefs: [
        {
          documentId: source.documentId,
          contentHash: source.contentHash,
          pageNumber: null,
          provenance: 'extracted',
          locationKnown: false
        }
      ],
      constraints: { maxAttempts: 10, allowCalculator: false },
      presentationData: {
        question: 'Two plus two?',
        options: [
          { id: 'four', label: '4' },
          { id: 'five', label: '5' }
        ],
        isMultiSelect: false
      }
    });
    await ActivityRecord.create({
      ...pin,
      objectiveId: 'obj_sum',
      publicDefinition: definition,
      serverEvaluation: {
        schemaVersion: '1.0.0',
        visibility: 'server_only',
        activity: pin,
        evaluationRef: 'eval_growth',
        evaluatorType: 'deterministic_rubric',
        rubricVersion: 'exact-options-v1',
        rubric: 'Reviewed exact sum.',
        answerKey: ['four']
      }
    });
    await publishCourseRevision(actor, courseId, 'rev_growth');
    await publishCourseRevision(actor, otherCourse, 'rev_growth');
    const app = express();
    app.use(express.json());
    // Test-only identity transport; production uses the existing Better Auth middleware.
    app.use((req: DomainRequest, _res, next) => {
      if (req.headers['x-test-actor'])
        req.user = {
          userId: String(req.headers['x-test-actor']),
          role: 'student'
        } as DomainRequest['user'];
      next();
    });
    app.use('/learning', learningRouter);
    const route = `/learning/courses/${courseId}/nardouch`;
    await t.test('HTTP middleware requires identity and course authority', async () => {
      assert.equal((await request(app).get(route)).status, 401);
      assert.equal((await request(app).get(route).set('x-test-actor', 'stranger')).status, 403);
      assert.equal(
        (
          await request(app)
            .post(route + '/lessons')
            .set('x-test-actor', 'stranger')
            .send({ revisionId: 'rev_growth', lessonId: 'lesson_0' })
        ).status,
        403
      );
    });
    await t.test('fresh courses start at Baby and fabricated graduation is rejected', async () => {
      assert.equal((await getCourseNardouch(actor, courseId)).stage, 'baby');
      assert.equal(
        (
          await request(app)
            .post(route + '/lessons')
            .set('x-test-actor', actor)
            .send({ revisionId: 'rev_growth', lessonId: 'lesson_0', stage: 'graduate' })
        ).status,
        400
      );
      assert.equal(await CourseNardouchProgress.countDocuments({ userId: actor }), 0);
    });
    await t.test(
      'concurrent and repeated completion grows once and survives reconnect',
      async () => {
        await Promise.all(
          Array.from({ length: 4 }, () =>
            completeNardouchLesson(actor, courseId, {
              revisionId: 'rev_growth',
              lessonId: 'lesson_0'
            })
          )
        );
        assert.equal((await getCourseNardouch(actor, courseId)).stage, 'learner');
        await disconnectDatabase();
        await connectDatabase();
        const saved = await getCourseNardouch(actor, courseId);
        assert.deepEqual(saved.completedLessonIds, ['lesson_0']);
        assert.equal((await getCourseNardouch(actor, otherCourse)).stage, 'baby');
        assert.equal(await CourseNardouchProgress.countDocuments({ userId: actor }), 1);
      }
    );
    await t.test('reading grows Explorer and Expert without certifying graduation', async () => {
      assert.equal(
        (
          await completeNardouchLesson(actor, courseId, {
            revisionId: 'rev_growth',
            lessonId: 'lesson_1'
          })
        ).stage,
        'explorer'
      );
      assert.equal(
        (
          await completeNardouchLesson(actor, courseId, {
            revisionId: 'rev_growth',
            lessonId: 'lesson_2'
          })
        ).stage,
        'expert'
      );
      const finished = await completeNardouchLesson(actor, courseId, {
        revisionId: 'rev_growth',
        lessonId: 'lesson_3'
      });
      assert.equal(finished.readingPercent, 100);
      assert.equal(finished.graduated, false);
    });
    const answer = (option: string) => ({
      schemaVersion: '1.0.0',
      attemptId: crypto.randomUUID(),
      activity: pin,
      roomId: null,
      timeSpentSeconds: 5,
      answers: { selectedOptionIds: [option] }
    });
    await t.test(
      'incorrect checks do not graduate; a real accepted check unlocks Graduate',
      async () => {
        await submitAttempt(actor, answer('five'), pin.activityId);
        assert.equal((await getCourseNardouch(actor, courseId)).stage, 'expert');
        await submitAttempt(actor, answer('four'), pin.activityId);
        const graduated = await getCourseNardouch(actor, courseId);
        assert.equal(graduated.stage, 'graduate');
        assert.equal(graduated.passedChecks, 1);
        assert.equal((await getCourseNardouch(actor, otherCourse)).stage, 'baby');
      }
    );
    await t.test(
      'another published revision begins fresh and unknown lessons cannot write',
      async () => {
        await CourseRevision.create({
          courseId,
          revisionTag: 'rev_new',
          contentHash: 'b'.repeat(64),
          status: 'published',
          activationState: 'committed',
          isInstructorReviewed: true,
          topics
        });
        await materializeRevisionFixture(courseId, 'rev_new');
        assert.equal((await getCourseNardouch(actor, courseId, 'rev_new')).stage, 'baby');
        await assert.rejects(
          completeNardouchLesson(actor, courseId, { revisionId: 'rev_new', lessonId: 'unknown' })
        );
        assert.equal((await getCourseNardouch(actor, courseId, 'rev_growth')).stage, 'graduate');
      }
    );
  }
);
