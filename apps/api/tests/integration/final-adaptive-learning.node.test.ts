import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { connectDatabase, disconnectDatabase, prisma } from '../../shared/database';
import type { ActivityDefinition, Contract } from '../../shared/ednova/contracts';
import {
  Course,
  CourseRevision,
  ActivityRecord,
  LearningEvidence
} from '../../modules/study/src/models';
import {
  materializeRevisionFixture,
  cleanupRevisionFixtures
} from '../helpers/revisionArtifactFixture';
import { generateActivityCandidate } from '../../modules/study/src/services/courseStudio';
import { registerActivity, submitAttempt } from '../../modules/study/src/services/activityAttempt';
import { publishCourseRevision } from '../../modules/study/src/services/coursePublication';
import { selectLearningActivity } from '../../modules/study/src/services/learningJourney';
import { sourceLearningSupport } from '../../modules/study/src/services/learningSupport';

test('Adaptive reviewed evidence and requester-only graduated source support', async (t) => {
  const storage = await mkdtemp(path.join(os.tmpdir(), 'ednova-final-private-'));
  const originalStorage = {
    INGEST_UPLOADS_DIR: process.env.INGEST_UPLOADS_DIR,
    FAISS_INDEX_DIR: process.env.FAISS_INDEX_DIR
  };
  process.env.INGEST_UPLOADS_DIR = path.join(storage, 'uploads');
  process.env.FAISS_INDEX_DIR = path.join(storage, 'faiss');
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || 'postgresql://ednova:ednova@127.0.0.1:5433/ednova_test';
  await connectDatabase();
  // The test database is shared, so the actor is run-unique and teardown deletes
  // exactly the rows this suite created.
  const actor = `adaptive_${process.pid}_${Date.now()}`;
  let courseId = '';
  t.after(async () => {
    await cleanupRevisionFixtures();
    try {
      if (courseId) {
        await ActivityRecord.deleteMany({ courseId });
        await LearningEvidence.deleteMany({ userId: actor });
        await prisma.learningSupport.deleteMany({ where: { userId: actor } });
        // Revisions cascade from the course row.
        await Course.deleteMany({ userId: actor });
      }
    } finally {
      await disconnectDatabase().catch(() => {});
      await rm(storage, { recursive: true, force: true });
      for (const [key, value] of Object.entries(originalStorage)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
  const course = await Course.create({
    userId: actor,
    ownerUserId: actor,
    title: 'Synthetic structural practice',
    scope: 'personal',
    subjectId: 'fixture',
    status: 'completed'
  });
  courseId = String(course._id);
  await CourseRevision.create({
    courseId,
    revisionTag: 'rev_policy',
    contentHash: 'a'.repeat(64),
    status: 'draft',
    isInstructorReviewed: true,
    topics: [
      {
        id: 'topic',
        title: 'Source',
        subtopics: [
          {
            id: 'sub',
            title: 'Practice',
            learning_objectives: [
              { id: 'obj', statement: 'Complete source quotation', bloomLevel: 'understand' }
            ]
          }
        ]
      }
    ]
  });
  await materializeRevisionFixture(courseId, 'rev_policy');
  const candidate = await generateActivityCandidate(actor, courseId, {
    objectiveId: 'obj',
    activityType: 'InteractiveQuiz'
  });
  if (candidate.candidateActivity.activityType !== 'InteractiveQuiz')
    throw new Error('quiz required');
  const records: Array<{
    definition: Extract<ActivityDefinition, { activityType: 'InteractiveQuiz' }>;
    evaluation: Contract<'ServerEvaluationDefinition'>;
  }> = [];
  for (const [i, size] of [3, 4, 6].entries()) {
    const definition = structuredClone(candidate.candidateActivity);
    definition.activityId = 'act_demand_' + i;
    definition.presentationData.options = [
      ...definition.presentationData.options,
      ...Array.from({ length: size - definition.presentationData.options.length }, (_, j) => ({
        id: 'extra_' + j,
        label: 'Different source term ' + j
      }))
    ];
    const evaluation = structuredClone(candidate.candidateEvaluation);
    evaluation.activity.activityId = definition.activityId;
    evaluation.evaluationRef = 'eval_demand_' + i;
    await registerActivity(actor, courseId, definition, evaluation);
    records.push({ definition, evaluation });
  }
  await publishCourseRevision(actor, courseId, 'rev_policy');
  const input = {
    revisionId: 'rev_policy',
    objectiveId: 'obj',
    activityType: 'InteractiveQuiz',
    intent: 'practice'
  };
  const choose = () => selectLearningActivity(actor, courseId, input);
  const answer = async (index: number, correct: boolean) => {
    const { definition, evaluation } = records[index];
    return submitAttempt(
      actor,
      {
        schemaVersion: '1.0.0',
        attemptId: crypto.randomUUID(),
        roomId: null,
        activity: evaluation.activity,
        answers: {
          selectedOptionIds: correct
            ? evaluation.answerKey
            : [
                definition.presentationData.options.find(
                  (o) => !evaluation.answerKey.includes(o.id)
                )!.id
              ]
        },
        timeSpentSeconds: 1
      },
      definition.activityId
    );
  };
  await t.test(
    'untested remains unassessed; choices and explanations reproduce exactly',
    async () => {
      const result = await choose();
      assert.equal(result.assessmentState, 'unassessed');
      assert.equal(result.activity?.activityId, records[0].definition.activityId);
      assert.deepEqual(result, await choose());
      assert.equal(result.acceptedEvidenceCount, 0);
    }
  );
  await t.test(
    'accepted correct evidence advances demand; incorrect check remediates without new mastery',
    async () => {
      await answer(0, true);
      assert.equal((await choose()).activity?.activityId, records[1].definition.activityId);
      await answer(1, true);
      assert.equal((await choose()).activity?.activityId, records[2].definition.activityId);
      const count = await LearningEvidence.countDocuments({ userId: actor });
      await answer(2, false);
      const result = await choose();
      assert.equal(result.assessmentState, 'needs_support');
      assert.equal(result.activity?.activityId, records[0].definition.activityId);
      assert.equal(await LearningEvidence.countDocuments({ userId: actor }), count);
      await answer(2, true);
      assert.equal((await choose()).targetDemand, 3);
    }
  );
  await t.test('foreign, forged type/version and stale revisions fail closed', async () => {
    await assert.rejects(() => selectLearningActivity('foreign', courseId, input));
    for (const attack of [
      { activityType: '<script>' },
      { version: '9' },
      { revisionId: 'unknown' },
      { userId: actor }
    ])
      await assert.rejects(() => selectLearningActivity(actor, courseId, { ...input, ...attack }));
  });
  const support = {
    revisionId: 'rev_policy',
    activityId: records[0].definition.activityId,
    mode: 'hint'
  };
  await t.test(
    'server-enforced hint first; bounded durable hints and explicit source explanation',
    async () => {
      await assert.rejects(
        () => sourceLearningSupport(actor, courseId, { ...support, mode: 'explain' }),
        /hint before/
      );
      const hint = await sourceLearningSupport(actor, courseId, support);
      assert.equal(hint.hintLevel, 1);
      assert.equal(hint.visibility, 'recipient_only');
      assert.equal(hint.userId, actor);
      const explanation = await sourceLearningSupport(actor, courseId, {
        ...support,
        mode: 'explain'
      });
      assert.ok(explanation.text.includes('Source explanation'));
      assert.ok(explanation.citation.chunkId);
      await Promise.all(
        Array.from({ length: 8 }, () => sourceLearningSupport(actor, courseId, support))
      );
      assert.equal((await sourceLearningSupport(actor, courseId, support)).hintLevel, 2);
      assert.ok(!('answerKey' in explanation) && !('rubric' in explanation));
      await assert.rejects(() => sourceLearningSupport('foreign', courseId, support));
      await assert.rejects(() =>
        sourceLearningSupport(actor, courseId, { ...support, hintLevel: 1 })
      );
    }
  );
  await t.test('revocation blocks both selection and persisted support', async () => {
    await Course.updateOne({ _id: courseId }, { $set: { userId: 'other', ownerUserId: 'other' } });
    await assert.rejects(choose);
    await assert.rejects(() =>
      sourceLearningSupport(actor, courseId, { ...support, mode: 'explain' })
    );
    assert.equal(await ActivityRecord.countDocuments({ courseId }), 3);
  });
});
