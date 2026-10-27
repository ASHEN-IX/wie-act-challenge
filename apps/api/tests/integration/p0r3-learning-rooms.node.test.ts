import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import express from 'express';
import roomsRouter from '../../modules/study/src/routes/rooms';
import type { DomainRequest } from '../../src/framework/contracts';
import {
  Course,
  CourseRevision,
  ActivityRecord,
  StudentAttempt,
  LearningEvidence,
  StudyRoom
} from '../../modules/study/src/models';
import {
  materializeRevisionFixture,
  cleanupRevisionFixtures
} from '../helpers/revisionArtifactFixture';
import { generateActivityCandidate } from '../../modules/study/src/services/courseStudio';
import { registerActivity, submitAttempt } from '../../modules/study/src/services/activityAttempt';
import { publishCourseRevision } from '../../modules/study/src/services/coursePublication';
import {
  publishedActivities,
  selectLearningActivity,
  learnerProgress,
  diagnosticChecks
} from '../../modules/study/src/services/learningJourney';
import { runRoomCommand } from '../../modules/study/src/services/roomCommands';
import {
  ownRoomCheck,
  submitOwnRoomCheck,
  proposeRoomSupport,
  decideRoomSupport,
  roomLearningDebrief
} from '../../modules/study/src/services/roomLearning';

test('P0-R3 canonical learning selection, durable pinned rooms, private checks and reviewed proposals', async (t) => {
  const dbName = 'ednova_p0r3_domain_' + process.pid + '_' + Date.now();
  await mongoose.connect('mongodb://127.0.0.1:27018/' + dbName);
  t.after(async () => {
    await cleanupRevisionFixtures();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const actor = 'r3_owner',
    peer = 'r3_peer';
  const course = await Course.create({
    userId: actor,
    ownerUserId: actor,
    title: 'Reviewed source learning',
    scope: 'personal',
    subjectId: 'synthetic',
    status: 'completed'
  });
  const courseId = course._id.toString();
  const topics = [
    {
      id: 'topic_source',
      title: 'Source study',
      subtopics: [
        {
          id: 'sub_source',
          title: 'Quotation',
          learning_objectives: [
            {
              id: 'obj_source',
              statement: 'Complete the original quotation',
              bloomLevel: 'understand'
            },
            { id: 'obj_empty', statement: 'Instructor authored extension', bloomLevel: 'apply' }
          ]
        }
      ]
    }
  ];
  await CourseRevision.create({
    courseId,
    revisionTag: 'rev_one',
    contentHash: 'a'.repeat(64),
    status: 'draft',
    topics,
    isInstructorReviewed: true
  });
  await materializeRevisionFixture(courseId, 'rev_one');
  const quiz = await generateActivityCandidate(actor, courseId, {
      objectiveId: 'obj_source',
      activityType: 'InteractiveQuiz'
    }),
    guided = await generateActivityCandidate(actor, courseId, {
      objectiveId: 'obj_source',
      activityType: 'GuidedProblem'
    });
  for (const candidate of [quiz, guided])
    await registerActivity(
      actor,
      courseId,
      candidate.candidateActivity,
      candidate.candidateEvaluation
    );
  await publishCourseRevision(actor, courseId, 'rev_one');
  const activity = quiz.candidateActivity;
  if (activity.activityType !== 'InteractiveQuiz') throw new Error('Expected quiz');
  const pin = {
    courseId,
    revisionId: activity.revisionId,
    contentHash: activity.contentHash,
    activityId: activity.activityId,
    activityRevision: activity.activityRevision,
    activityType: activity.activityType
  };
  await t.test(
    'canonical registry: deterministic selection, both types, empty and invalid input',
    async () => {
      assert.equal((await publishedActivities(actor, courseId, 'rev_one')).activities.length, 2);
      const input = {
        revisionId: 'rev_one',
        objectiveId: 'obj_source',
        activityType: 'GuidedProblem',
        intent: 'practice'
      };
      assert.deepEqual(
        await selectLearningActivity(actor, courseId, input),
        await selectLearningActivity(actor, courseId, input)
      );
      assert.equal(
        (await selectLearningActivity(actor, courseId, input)).activity?.activityId,
        guided.candidateActivity.activityId
      );
      assert.equal(
        (await selectLearningActivity(actor, courseId, { ...input, objectiveId: 'obj_empty' }))
          .kind,
        'unavailable'
      );
      await assert.rejects(() =>
        selectLearningActivity(actor, courseId, { ...input, revisionId: 42 })
      );
      await assert.rejects(() =>
        selectLearningActivity(actor, courseId, { ...input, activityType: 'Code' })
      );
      await assert.rejects(() => publishedActivities(peer, courseId, 'rev_one'));
      assert.equal((await diagnosticChecks(actor, courseId, 'rev_one')).checks.length, 2);
    }
  );
  await t.test(
    'accepted evidence is distinct from incorrect, duplicate and unavailable submissions',
    async () => {
      const wrong = activity.presentationData.options.find(
        (o) => o.id !== quiz.candidateEvaluation.answerKey[0]
      )!.id;
      const payload = {
        schemaVersion: '1.0.0',
        attemptId: crypto.randomUUID(),
        roomId: null,
        activity: pin,
        answers: { selectedOptionIds: [wrong] },
        timeSpentSeconds: 1
      };
      const result = await submitAttempt(actor, payload, activity.activityId);
      assert.equal(result.status, 'graded');
      if (result.status === 'graded') assert.equal(result.isCorrect, false);
      assert.equal(
        (await learnerProgress(actor, courseId, 'rev_one')).masteredObjectiveIds.length,
        0
      );
      assert.deepEqual(await submitAttempt(actor, payload, activity.activityId), result);
      await assert.rejects(() =>
        submitAttempt(
          actor,
          { ...payload, answers: { selectedOptionIds: quiz.candidateEvaluation.answerKey } },
          activity.activityId
        )
      );
      await submitAttempt(
        actor,
        {
          ...payload,
          attemptId: crypto.randomUUID(),
          answers: { selectedOptionIds: quiz.candidateEvaluation.answerKey }
        },
        activity.activityId
      );
      assert.deepEqual((await learnerProgress(actor, courseId, 'rev_one')).masteredObjectiveIds, [
        'obj_source'
      ]);
      assert.equal(await StudentAttempt.countDocuments({ courseId }), 2);
      assert.equal(
        await LearningEvidence.countDocuments({
          'activity.courseId': courseId,
          masteryAchieved: true
        }),
        1
      );
    }
  );
  let roomId = '',
    seq = 1;
  const authorize = async () => ({ authorized: true });
  await t.test(
    'durable command selects ActivityRecord and pins exact reviewed revision; replay is identical',
    async () => {
      const created = await runRoomCommand(
        'create',
        { userId: actor },
        { commandId: crypto.randomUUID(), courseId, revisionId: 'rev_one' },
        undefined,
        authorize
      );
      assert.equal(created.status, 201);
      roomId = String(created.body.roomId);
      const cmd = {
        commandId: crypto.randomUUID(),
        expectedSeq: seq,
        currentPhase: 'individual_attempt',
        activeActivityId: activity.activityId
      };
      const result = await runRoomCommand('phase', { userId: actor }, cmd, roomId, authorize);
      assert.equal(result.status, 200);
      assert.deepEqual(
        (await runRoomCommand('phase', { userId: actor }, cmd, roomId, authorize)).body,
        result.body
      );
      const room = await StudyRoom.findOne({ roomId }).lean();
      assert.deepEqual(room!.activePin, pin);
      assert.equal(room!.revisionId, 'rev_one');
      seq = room!.seq;
      assert.equal(
        await mongoose.connection.collection('learning_activities').countDocuments({}),
        0
      );
      const invalid = await runRoomCommand(
        'phase',
        { userId: actor },
        {
          ...cmd,
          commandId: crypto.randomUUID(),
          expectedSeq: seq,
          activeActivityId: 'unknown_activity'
        },
        roomId,
        authorize
      );
      assert.equal(invalid.status, 404);
    }
  );
  await t.test(
    'recipient checks persist identity and receipt; peers cannot alter recipient; debrief suppresses grades',
    async () => {
      const concurrent = await Promise.all(
        Array.from({ length: 8 }, () => ownRoomCheck(actor, roomId))
      );
      assert.equal(new Set(concurrent.map((c) => c.attemptId)).size, 1);
      const check = concurrent[0];
      assert.ok(check.checkId);
      assert.equal((await ownRoomCheck(actor, roomId)).checkId, check.checkId);
      await assert.rejects(() => ownRoomCheck(actor, roomId, 'check_foreign'));
      await assert.rejects(() =>
        submitOwnRoomCheck(actor, roomId, check.checkId!, {
          answers: { selectedOptionIds: quiz.candidateEvaluation.answerKey },
          timeSpentSeconds: 1,
          userId: peer
        })
      );
      const result = await submitOwnRoomCheck(actor, roomId, check.checkId!, {
        answers: { selectedOptionIds: quiz.candidateEvaluation.answerKey },
        timeSpentSeconds: 1
      });
      assert.equal(result.status, 'graded');
      assert.deepEqual(
        await submitOwnRoomCheck(actor, roomId, check.checkId!, {
          answers: { selectedOptionIds: quiz.candidateEvaluation.answerKey },
          timeSpentSeconds: 1
        }),
        result
      );
      assert.equal((await ownRoomCheck(actor, roomId)).status, 'completed');
      assert.equal((await roomLearningDebrief(actor, roomId)).recap.gradeAggregates, null);
    }
  );
  await t.test(
    'server proposals reject malformed and stale decisions, accept/replay only the persisted command',
    async () => {
      const proposal = await proposeRoomSupport(actor, roomId);
      assert.equal(proposal.sourceBacked, true);
      await assert.rejects(() =>
        decideRoomSupport(peer, roomId, proposal.proposalId, { decision: 'accept' })
      );
      await assert.rejects(() =>
        decideRoomSupport(actor, roomId, proposal.proposalId, {
          decision: 'accept',
          targetPhase: 'debrief'
        })
      );
      const accepted = await decideRoomSupport(actor, roomId, proposal.proposalId, {
        decision: 'accept'
      });
      assert.equal(accepted.status, 200);
      assert.deepEqual(
        (await decideRoomSupport(actor, roomId, proposal.proposalId, { decision: 'accept' })).body,
        accepted.body
      );
      const stale = await proposeRoomSupport(actor, roomId);
      const room = await StudyRoom.findOne({ roomId }).lean();
      await runRoomCommand(
        'phase',
        { userId: actor },
        { commandId: crypto.randomUUID(), expectedSeq: room!.seq, currentPhase: 'debrief' },
        roomId,
        authorize
      );
      assert.equal(
        (await decideRoomSupport(actor, roomId, stale.proposalId, { decision: 'accept' })).status,
        409
      );
    }
  );
  await t.test(
    'legacy facilitator withholds delayed and malformed output after membership revocation',
    async () => {
      const created = await runRoomCommand(
        'create',
        { userId: actor },
        { commandId: crypto.randomUUID(), title: 'Delayed private test' },
        undefined,
        authorize
      );
      const delayedId = String(created.body.roomId);
      const ai = require('../../shared/aiClient');
      const original = ai.post;
      let release!: (value: unknown) => void, started!: () => void;
      const held = new Promise<unknown>((r) => {
        release = r;
      });
      const began = new Promise<void>((r) => {
        started = r;
      });
      ai.post = async () => {
        started();
        return held;
      };
      const app = express();
      app.use(express.json());
      app.use((req: DomainRequest, _res, next) => {
        req.user = {
          userId: actor,
          email: 'synthetic@local.test',
          name: 'Synthetic owner',
          role: 'student'
        };
        next();
      });
      app.use('/rooms', roomsRouter);
      const server = app.listen(0, '127.0.0.1');
      await new Promise<void>((r) => server.once('listening', r));
      try {
        const response = fetch(
          'http://127.0.0.1:' +
            (server.address() as { port: number }).port +
            '/rooms/' +
            delayedId +
            '/facilitator/action',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              actionType: 'ask_facilitator',
              promptText: 'Invite peer reasoning'
            })
          }
        );
        await began;
        await StudyRoom.updateOne(
          { roomId: delayedId },
          { $set: { 'participants.0.leftAt': new Date() } }
        );
        release({
          data: { shouldIntervene: true, strategy: 'PEER_CHALLENGE', messageText: 'Invite a peer.' }
        });
        assert.equal((await response).status, 403);
        assert.equal(
          await mongoose.connection
            .collection('facilitatorinterventions')
            .countDocuments({ roomId: delayedId }),
          0
        );
        const fresh = await runRoomCommand(
          'create',
          { userId: actor },
          { commandId: crypto.randomUUID(), title: 'Malformed output test' },
          undefined,
          authorize
        );
        ai.post = async () => ({
          data: {
            shouldIntervene: true,
            strategy: 'PEER_CHALLENGE',
            messageText: 'Untrusted',
            extraPrivateFields: 'reject'
          }
        });
        const invalid = await fetch(
          'http://127.0.0.1:' +
            (server.address() as { port: number }).port +
            '/rooms/' +
            fresh.body.roomId +
            '/facilitator/action',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ actionType: 'ask_facilitator', promptText: 'Ask peers' })
          }
        );
        assert.equal(invalid.status, 503);
      } finally {
        ai.post = original;
        await new Promise<void>((r) => server.close(() => r()));
      }
    }
  );
  await t.test(
    'deprecated explicit pins remain stable and revoked sources fail closed',
    async () => {
      await CourseRevision.create({
        courseId,
        revisionTag: 'rev_two',
        contentHash: 'b'.repeat(64),
        status: 'draft',
        topics,
        isInstructorReviewed: true
      });
      await materializeRevisionFixture(courseId, 'rev_two');
      await publishCourseRevision(actor, courseId, 'rev_two');
      assert.equal((await publishedActivities(actor, courseId, 'rev_one')).activities.length, 2);
      assert.equal((await publishedActivities(actor, courseId)).context.revisionId, 'rev_two');
      await CourseRevision.updateOne(
        { courseId, revisionTag: 'rev_one' },
        { $set: { revokedAt: new Date() } }
      );
      await assert.rejects(() => ownRoomCheck(actor, roomId));
      assert.equal(await ActivityRecord.countDocuments({ courseId }), 2);
    }
  );
});
