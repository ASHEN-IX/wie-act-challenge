/** Real PostgreSQL reward protocol over shared synthetic reviewed records;
 * no provider/model result is relabelled as real inference. */
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { connectDatabase, disconnectDatabase, prisma } from '../../shared/database';
import { newId } from '../../shared/ids';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import express from 'express';
import request from 'supertest';
import {
  Course,
  CourseRevision,
  CourseEnrollment,
  Institution,
  InstitutionMembership,
  StudentAttempt,
  LearningEvidence,
  ActivityRecord
} from '../../modules/study/src/models';
import Gamification from '../../modules/user-profile/src/models/Gamification';
import { LearningRewardLedger } from '../../modules/user-profile/src/models/LearningRewardLedger';
import {
  awardAcceptedLearningEvidence,
  learningRewardSummary
} from '../../modules/user-profile/src/services/learningRewards';
import router from '../../modules/user-profile/src/routes/learningRewards';
import legacyRouter from '../../modules/user-profile/src/routes/gamification';
import questRouter from '../../modules/user-profile/src/routes/quests';
import Quest from '../../modules/user-profile/src/models/Quest';
import { generateActivityCandidate } from '../../modules/study/src/services/courseStudio';
import { registerActivity, submitAttempt } from '../../modules/study/src/services/activityAttempt';
import { publishCourseRevision } from '../../modules/study/src/services/coursePublication';
import { materializeRevisionFixture } from '../helpers/revisionArtifactFixture';
import type { DomainRequest } from '../../src/framework/contracts';

test(
  'ED-33/34 real PostgreSQL learning reward claim/apply/confirm protocol',
  { timeout: 120000 },
  async (t) => {
    const runTag = `${process.pid}_${Date.now()}`;
    const databaseUrl =
      process.env.DATABASE_URL || 'postgresql://ednova:ednova@127.0.0.1:5433/ednova_test';
    process.env.DATABASE_URL = databaseUrl;
    const temp = await mkdtemp(path.join(os.tmpdir(), 'ednova-rewards-'));
    process.env.INGEST_UPLOADS_DIR = path.join(temp, 'uploads');
    process.env.FAISS_INDEX_DIR = path.join(temp, 'faiss');
    await connectDatabase();
    let courseId: string | undefined; // eslint-disable-line prefer-const -- assigned after fixture use
    const instructor = 'rewards_instructor_' + runTag,
      learner = 'rewards_learner_' + runTag,
      legacyAdmin = 'legacy_admin_' + runTag;
    const institution = await Institution.create({
      id: newId(),
      name: 'Synthetic rewards',
      slug: 'rewards-' + runTag,
      createdByUserId: instructor,
      status: 'active'
    });
    t.after(async () => {
      try {
        await LearningEvidence.deleteMany({ userId: { startsWith: 'rewards_' } });
        await StudentAttempt.deleteMany({ userId: { startsWith: 'rewards_' } });
        await prisma.learningRewardLedger.deleteMany({ where: { userId: learner } });
        await prisma.gamification.deleteMany({ where: { userId: learner } });
        await prisma.quest.deleteMany({ where: { userId: legacyAdmin } });
        await ActivityRecord.deleteMany({ courseId: courseId ?? '__none__' });
        await CourseEnrollment.deleteMany({ courseId: courseId ?? '__none__' });
        await CourseRevision.deleteMany({ courseId: courseId ?? '__none__' });
        await Course.deleteMany({ id: courseId ?? '__none__' });
        await InstitutionMembership.deleteMany({ institutionId: institution.id });
        await Institution.deleteMany({ id: institution.id });
      } finally {
        await disconnectDatabase().catch(() => {});
        await rm(temp, { recursive: true, force: true });
      }
    });
    await InstitutionMembership.createMany([
      { institutionId: institution.id, userId: instructor, role: 'instructor', status: 'active' },
      {
        institutionId: institution.id,
        userId: learner,
        role: 'university_student',
        status: 'active'
      }
    ]);
    const course = await Course.create({
      userId: instructor,
      ownerUserId: instructor,
      assignedInstructorIds: [instructor],
      title: 'Reward fixture',
      scope: 'institutional',
      institutionId: institution.id,
      subjectId: 'fixture',
      status: 'completed'
    });
    courseId = String(course.id);
    await CourseEnrollment.create({
      courseId,
      institutionId: institution.id,
      userId: learner,
      status: 'active'
    });
    await CourseRevision.create({
      courseId,
      revisionTag: 'rev_rewards',
      contentHash: 'a'.repeat(64),
      status: 'draft',
      isInstructorReviewed: true,
      topics: [
        {
          id: 'topic',
          title: 'Arithmetic',
          subtopics: [
            {
              id: 'section',
              title: 'Addition',
              learning_objectives: [
                {
                  id: 'objective',
                  statement: 'Use the reviewed quotation',
                  bloomLevel: 'understand'
                },
                {
                  id: 'objective_other',
                  statement: 'Explain the reviewed quotation',
                  bloomLevel: 'understand'
                }
              ]
            }
          ]
        }
      ]
    });
    await materializeRevisionFixture(courseId, 'rev_rewards');
    const candidate = await generateActivityCandidate(instructor, courseId, {
      objectiveId: 'objective',
      activityType: 'InteractiveQuiz'
    });
    const definitions: Array<typeof candidate.candidateActivity> = [];
    for (let i = 0; i < 22; i++) {
      const definition = {
        ...candidate.candidateActivity,
        activityId: 'activity_reward_' + i,
        objectiveId: i === 21 ? 'objective_other' : 'objective'
      };
      const evaluation = {
        ...candidate.candidateEvaluation,
        activity: { ...candidate.candidateEvaluation.activity, activityId: definition.activityId }
      };
      await registerActivity(instructor, courseId, definition, evaluation);
      definitions.push(definition);
    }
    await publishCourseRevision(instructor, courseId, 'rev_rewards');
    async function evidence(
      index: number,
      suffix = '',
      mode = 'DETERMINISTIC_FALLBACK',
      group = false
    ) {
      const activity = definitions[index];
      const pin = Object.fromEntries(
        [
          'courseId',
          'revisionId',
          'contentHash',
          'activityId',
          'activityRevision',
          'activityType'
        ].map((key) => [key, activity[key as keyof typeof activity]])
      );
      const evidenceId = 'evi_reward_' + index + suffix;
      const attemptId = 'attempt_reward_' + index + suffix;
      await StudentAttempt.create({
        userId: learner,
        attemptId,
        ...pin,
        roomId: group ? 'synthetic_study_room' : null,
        timeSpentSeconds: 1,
        answers: { selectedOptionIds: ['opt_1'] },
        payloadHash: 'sha256:' + 'b'.repeat(64),
        status: 'graded',
        protocolVersion: 1,
        processingState: 'completed',
        evidenceId,
        assessmentResult: { status: 'graded', evidenceId, isCorrect: true, score: 1 }
      });
      await LearningEvidence.create({
        userId: learner,
        evidenceId,
        attemptId,
        activity: pin,
        objectiveId: activity.objectiveId,
        status: 'accepted',
        bloomLevel: 'understand',
        score: 1,
        masteryAchieved: true,
        evaluator: {
          type: 'deterministic_rubric',
          validationVersion: candidate.candidateEvaluation.rubricVersion,
          executionMode: mode
        },
        timestamp: new Date()
      });
      return evidenceId;
    }
    await t.test(
      'concurrent retry and different transport/attempt IDs share one logical reward',
      async () => {
        const id = await evidence(0);
        const results = await Promise.all(
          Array.from({ length: 20 }, () => awardAcceptedLearningEvidence(learner, id))
        );
        assert.equal(new Set(results.map((r) => r.awardId)).size, 1);
        assert.equal((await learningRewardSummary(learner)).totalXp, 20);
        const retry = await evidence(0, '_new_attempt');
        assert.equal(
          (await awardAcceptedLearningEvidence(learner, retry)).awardId,
          results[0].awardId
        );
        assert.equal((await learningRewardSummary(learner)).totalXp, 20);
        // The database is shared across suites now, so scope the count to this learner.
        assert.equal(await LearningRewardLedger.countDocuments({ userId: learner }), 1);
      }
    );
    await t.test(
      'crash after claim is visible and replay applies missing profile effect',
      async () => {
        const id = await evidence(1);
        await assert.rejects(
          awardAcceptedLearningEvidence(learner, id, async (point) => {
            if (point === 'afterClaim') throw new Error('synthetic process interruption');
          })
        );
        assert.equal((await learningRewardSummary(learner)).totalXp, 20);
        assert.equal((await learningRewardSummary(learner)).pending, 1);
        await awardAcceptedLearningEvidence(learner, id);
        assert.equal((await learningRewardSummary(learner)).totalXp, 40);
      }
    );
    await t.test(
      'fresh process recovers crash after atomic profile apply without double increment',
      async () => {
        const id = await evidence(2, '', 'DETERMINISTIC_FALLBACK', true);
        await assert.rejects(
          awardAcceptedLearningEvidence(learner, id, async (point) => {
            if (point === 'afterApply') throw new Error('synthetic process interruption');
          })
        );
        assert.equal((await learningRewardSummary(learner)).totalXp, 60);
        const child = spawnSync(
          process.execPath,
          [
            'node_modules/tsx/dist/cli.mjs',
            '--tsconfig',
            'tsconfig.json',
            'tests/helpers/replay-learning-reward.ts'
          ],
          {
            cwd: path.resolve(__dirname, '../..'),
            env: {
              ...process.env,
              REWARD_TEST_DATABASE_URL: databaseUrl,
              REWARD_TEST_ACTOR: learner,
              REWARD_TEST_EVIDENCE: id
            },
            encoding: 'utf8',
            timeout: 20000
          }
        );
        assert.equal(child.status, 0, child.stderr);
        assert.ok(child.stdout.includes('award_'), 'fresh process must execute the reward replay');
        assert.equal((await learningRewardSummary(learner)).totalXp, 60);
        assert.equal(
          (await learningRewardSummary(learner)).pending,
          0,
          child.stdout + child.stderr
        );
      }
    );
    await t.test(
      'daily topic cap, milestone uniqueness, and existing balance survive concurrency',
      async () => {
        const ids = await Promise.all(Array.from({ length: 17 }, (_, i) => evidence(i + 3)));
        await Promise.all(ids.map((id) => awardAcceptedLearningEvidence(learner, id)));
        const summary = await learningRewardSummary(learner);
        assert.equal(summary.totalXp, 300);
        assert.equal(summary.awards.length, 20);
        assert.equal(summary.achievements.length, 3);
        assert.equal(new Set(summary.achievements.map((b) => b.id)).size, 3);
        assert.equal(summary.level, 4);
        assert.equal(summary.levelProgress, 0);
        assert.equal(summary.awards.filter((a) => a.xp === 0).length, 5);
        const old = await Gamification.findOne({ userId: learner });
        assert.ok(old);
        const id = await evidence(20);
        await awardAcceptedLearningEvidence(learner, id);
        // A stale document (its updatedAt no longer matches) must be rejected.
        await assert.rejects(
          () => Gamification.awardXp(old, 25, 'legacy_fixture'),
          /version|Record to update not found|No record was found for an update/i
        );
        const current = await Gamification.findOne({ userId: learner });
        assert.ok(current);
        await Gamification.awardXp(current, 25, 'legacy_fixture');
        assert.equal((await learningRewardSummary(learner)).totalXp, 325);
        assert.equal((await learningRewardSummary(learner)).legacyXp, 25);
      }
    );
    await t.test(
      'different objectives in the same reviewed topic share its daily cap',
      async () => {
        const id = await evidence(21, '_other_objective');
        const result = await awardAcceptedLearningEvidence(learner, id);
        assert.equal(result.xp, 0);
        assert.equal((await learningRewardSummary(learner)).totalXp, 325);
      }
    );
    const app = express();
    app.use(express.json());
    app.use((req: DomainRequest, _res, next) => {
      if (req.headers['x-test-actor'])
        req.user = {
          userId: String(req.headers['x-test-actor']),
          email: 'synthetic@example.test',
          role: req.headers['x-test-actor'] === legacyAdmin ? 'admin' : 'student'
        };
      next();
    });
    app.use('/rewards', router);
    app.use('/legacy', legacyRouter);
    app.use('/quests', questRouter);
    await t.test(
      'private HTTP projection rejects forged actor/value and creates no award on refresh',
      async () => {
        assert.equal((await request(app).get('/rewards')).status, 401);
        assert.equal(
          (
            await request(app)
              .get('/rewards?userId=' + learner)
              .set('x-test-actor', 'foreign')
          ).status,
          400
        );
        assert.equal(
          (
            await request(app)
              .post('/rewards/evidence/evi_reward_0')
              .set('x-test-actor', 'foreign')
              .send({})
          ).status,
          404
        );
        assert.equal(
          (
            await request(app)
              .post('/rewards/evidence/evi_reward_0')
              .set('x-test-actor', learner)
              .send({ xp: 999 })
          ).status,
          400
        );
        const before = await LearningRewardLedger.countDocuments();
        const a = await request(app).get('/rewards').set('x-test-actor', learner);
        const b = await request(app).get('/rewards').set('x-test-actor', learner);
        assert.equal(a.status, 200);
        assert.deepEqual(a.body, b.body);
        assert.equal(await LearningRewardLedger.countDocuments(), before);
        for (const forbidden of [
          'answerKey',
          'selectedOptionIds',
          'rubric',
          'payloadHash',
          'courseId',
          'objectiveId'
        ])
          assert.ok(!JSON.stringify(a.body).includes(forbidden));
        assert.equal(
          (await request(app).get('/rewards').set('x-test-actor', 'foreign')).body.totalXp,
          0
        );
      }
    );
    await t.test(
      'all new arbitrary legacy XP grants are denied without changing historical balances',
      async () => {
        for (const action of [
          'task_complete_easy',
          'challenge_complete',
          'course_upload',
          'friend_added',
          'session_complete',
          'chat_message',
          'idle_duration'
        ]) {
          const denied = await request(app)
            .post('/legacy/award-xp')
            .set('x-test-actor', legacyAdmin)
            .send({ action, xp_amount: 9999, userId: learner });
          assert.equal(denied.status, 409);
          assert.equal(denied.body.code, 'LEARNING_EVIDENCE_REQUIRED');
        }
        assert.equal(
          (
            await request(app)
              .post('/legacy/award-xp')
              .set('x-test-actor', learner)
              .send({ action: 'task_complete_easy' })
          ).status,
          403
        );
        assert.equal((await learningRewardSummary(learner)).totalXp, 325);
      }
    );
    await t.test(
      'legacy quest completion preserves bookkeeping without issuing unverified XP',
      async () => {
        const actor = legacyAdmin;
        await Quest.create({
          userId: actor,
          type: 'daily',
          title: 'Synthetic task quest',
          action: 'task_complete',
          targetCount: 1,
          xpReward: 999,
          status: 'active',
          expiresAt: new Date(Date.now() + 86400000)
        });
        const before = await learningRewardSummary(actor);
        const result = await request(app)
          .post('/quests/progress')
          .set('x-test-actor', actor)
          .send({ action: 'task_complete' });
        assert.equal(result.status, 200);
        assert.equal((await Quest.findOne({ userId: actor }))?.status, 'completed');
        assert.equal((await learningRewardSummary(actor)).totalXp, before.totalXp);
        assert.ok(!JSON.stringify(result.body).includes('999'));
      }
    );
    await t.test('mock, failed, unverified, and revoked evidence cannot award', async () => {
      const id = await evidence(21, '', 'MOCK_TEST');
      await assert.rejects(awardAcceptedLearningEvidence(learner, id), /unavailable/);
      // `evaluator` is a JSON column; the embedded mode is rewritten whole.
      const mockEvidence = await LearningEvidence.findOne({ evidenceId: id }).lean();
      assert.ok(mockEvidence);
      await LearningEvidence.updateOne(
        { evidenceId: id },
        {
          $set: {
            evaluator: { ...mockEvidence.evaluator, executionMode: 'DETERMINISTIC_FALLBACK' },
            masteryAchieved: false
          }
        }
      );
      await assert.rejects(awardAcceptedLearningEvidence(learner, id));
      await LearningEvidence.updateOne({ evidenceId: id }, { $set: { masteryAchieved: true } });
      await CourseEnrollment.updateOne(
        { userId: learner, courseId },
        { $set: { status: 'revoked' } }
      );
      await assert.rejects(awardAcceptedLearningEvidence(learner, id));
      assert.equal(await LearningRewardLedger.countDocuments({ evidenceId: id }), 0);
    });
    await t.test(
      'actual reviewed deterministic grading awards through the normal attempt hook',
      async () => {
        const previous = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        try {
          const definition = definitions[20];
          const attemptId = randomUUID();
          const pin = {
            courseId: definition.courseId,
            revisionId: definition.revisionId,
            contentHash: definition.contentHash,
            activityId: definition.activityId,
            activityRevision: definition.activityRevision,
            activityType: definition.activityType
          };
          const result = await submitAttempt(
            instructor,
            {
              schemaVersion: '1.0.0',
              attemptId,
              roomId: null,
              activity: pin,
              answers: { selectedOptionIds: candidate.candidateEvaluation.answerKey },
              timeSpentSeconds: 1
            },
            definition.activityId
          );
          assert.equal(result.status, 'graded');
          const summary = await learningRewardSummary(instructor);
          assert.equal(summary.totalXp, 20);
          await submitAttempt(
            instructor,
            {
              schemaVersion: '1.0.0',
              attemptId,
              roomId: null,
              activity: pin,
              answers: { selectedOptionIds: candidate.candidateEvaluation.answerKey },
              timeSpentSeconds: 1
            },
            definition.activityId
          );
          assert.equal((await learningRewardSummary(instructor)).totalXp, 20);
        } finally {
          if (previous === undefined) delete process.env.NODE_ENV;
          else process.env.NODE_ENV = previous;
        }
      }
    );
  }
);
