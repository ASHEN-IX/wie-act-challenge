import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import { connectDatabase, disconnectDatabase, prisma } from '../../shared/database';
import roomsRouter from '../../modules/study/src/routes/rooms';
import type { DomainRequest } from '../../src/framework/contracts';
import {
  Course,
  CourseRevision,
  ActivityRecord,
  StudentAttempt,
  LearningEvidence,
  StudyRoom,
  FacilitatorIntervention
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
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || 'postgresql://ednova:ednova@127.0.0.1:5433/ednova_test';
  await connectDatabase();
  // The test database is shared; every row this suite owns is run-unique.
  const run = `${process.pid}_${Date.now()}`;
  let courseId = '';
  const roomIds: string[] = [];
  t.after(async () => {
    await cleanupRevisionFixtures();
    try {
      if (courseId) {
        await ActivityRecord.deleteMany({ courseId });
        await StudentAttempt.deleteMany({ courseId });
        await LearningEvidence.deleteMany({ userId: { contains: run } });
        await prisma.learningSupport.deleteMany({ where: { courseId } });
        await prisma.roomLearningProposal.deleteMany({ where: { roomId: { in: roomIds } } });
        await prisma.roomLearningCheck.deleteMany({ where: { roomId: { in: roomIds } } });
        await StudyRoom.deleteMany({ roomId: { in: roomIds } });
        await Course.deleteMany({ userId: actor });
      }
    } finally {
      await disconnectDatabase().catch(() => {});
    }
  });
  const actor = `r3_owner_${run}`,
    peer = `r3_peer_${run}`;
  const course = await Course.create({
    userId: actor,
    ownerUserId: actor,
    title: 'Reviewed source learning',
    scope: 'personal',
    subjectId: 'synthetic',
    status: 'completed'
  });
  courseId = course.id.toString();
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
        { commandId: crypto.randomUUID(), courseId },
        undefined,
        authorize
      );
      assert.equal(created.status, 201);
      assert.equal(created.body.revisionId, 'rev_one');
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
      roomIds.push(roomId);
      // Room commands read the reviewed registry; they never write it.
      assert.equal(await ActivityRecord.countDocuments({ courseId }), 2);
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
      const proposal = (await proposeRoomSupport(actor, roomId)) as {
        proposalId: string;
        sourceBacked: boolean;
      };
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
      const stale = (await proposeRoomSupport(actor, roomId)) as { proposalId: string };
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
      roomIds.push(delayedId);
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
        // `participants` is one JSONB column: revoke the host by writing the
        // whole array back, exactly as the room routes do.
        const delayedRoom = await StudyRoom.findOne({ roomId: delayedId });
        await StudyRoom.updateOne(
          { roomId: delayedId },
          {
            $set: {
              participants: delayedRoom!.participants.map((p, index) =>
                index === 0 ? { ...p, leftAt: new Date() } : p
              )
            }
          }
        );
        release({
          data: { shouldIntervene: true, strategy: 'PEER_CHALLENGE', messageText: 'Invite a peer.' }
        });
        assert.equal((await response).status, 403);
        assert.equal(await FacilitatorIntervention.countDocuments({ roomId: delayedId }), 0);
        const fresh = await runRoomCommand(
          'create',
          { userId: actor },
          { commandId: crypto.randomUUID(), title: 'Malformed output test' },
          undefined,
          authorize
        );
        roomIds.push(String(fresh.body.roomId));
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
