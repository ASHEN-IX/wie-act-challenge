import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { Course, CourseRevision, StudyRoom } from '../../modules/study/src/models';
import {
  materializeRevisionFixture,
  cleanupRevisionFixtures
} from '../helpers/revisionArtifactFixture';
import { publishCourseRevision } from '../../modules/study/src/services/coursePublication';
import {
  askPrivateRoomHelp,
  privateHelpHistory
} from '../../modules/study/src/services/privateRoomHelp';
import aiClient from '../../shared/aiClient';

test('Private room help persists only requester history and fails closed at delivery', async (t) => {
  const storage = await mkdtemp(path.join(os.tmpdir(), 'ednova-final-private-'));
  const originalStorage = {
    INGEST_UPLOADS_DIR: process.env.INGEST_UPLOADS_DIR,
    FAISS_INDEX_DIR: process.env.FAISS_INDEX_DIR
  };
  process.env.INGEST_UPLOADS_DIR = path.join(storage, 'uploads');
  process.env.FAISS_INDEX_DIR = path.join(storage, 'faiss');
  await mongoose.connect(
    'mongodb://127.0.0.1:27018/ednova_private_help_' + process.pid + '_' + Date.now()
  );
  t.after(async () => {
    await cleanupRevisionFixtures();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await rm(storage, { recursive: true, force: true });
    for (const [key, value] of Object.entries(originalStorage)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const actor = 'private_owner',
    peer = 'private_peer',
    teacher = 'private_teacher';
  const course = await Course.create({
    userId: actor,
    ownerUserId: actor,
    title: 'Synthetic private help',
    scope: 'personal',
    subjectId: 'fixture',
    status: 'completed'
  });
  const courseId = String(course._id);
  await CourseRevision.create({
    courseId,
    revisionTag: 'rev_private',
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
            title: 'Read',
            learning_objectives: [{ id: 'obj', statement: 'Read source', bloomLevel: 'understand' }]
          }
        ]
      }
    ]
  });
  await materializeRevisionFixture(courseId, 'rev_private');
  await publishCourseRevision(actor, courseId, 'rev_private');
  const roomId = 'room_private_' + Date.now();
  await StudyRoom.create({
    roomId,
    inviteCode: 'PRIV01',
    title: 'Synthetic private',
    status: 'active',
    hostUserId: actor,
    presenterUserId: actor,
    courseId,
    revisionId: 'rev_private',
    participants: [
      { userId: actor, displayName: 'Owner' },
      { userId: peer, displayName: 'Peer' },
      { userId: teacher, displayName: 'Educator' }
    ]
  });
  const original = aiClient.post;
  let calls = 0;
  aiClient.post = (async () => {
    calls++;
    throw new Error('Synthetic provider outage');
  }) as typeof aiClient.post;
  t.after(() => {
    aiClient.post = original;
  });
  const request = { requestId: crypto.randomUUID(), question: 'PRIVATE_SENTINEL_SOURCE_HELP' };
  await t.test(
    'outage retains retry identity without fabricating an answer or duplicate rows',
    async () => {
      const result = await askPrivateRoomHelp(actor, roomId, request);
      assert.equal(result.status, 'unavailable');
      assert.equal(result.response, null);
      assert.equal(calls, 1);
      await askPrivateRoomHelp(actor, roomId, request);
      assert.equal(calls, 2);
      const history = await privateHelpHistory(actor, roomId);
      assert.equal(history.history.length, 1);
      assert.equal(history.history[0].question, request.question);
      await assert.rejects(() =>
        askPrivateRoomHelp(actor, roomId, { ...request, question: 'conflicting question' })
      );
    }
  );
  await t.test('older course rooms can use the published source before selecting an activity', async () => {
    await StudyRoom.updateOne({ roomId }, { $unset: { revisionId: 1 } });
    try {
      const previousCalls = calls;
      await askPrivateRoomHelp(actor, roomId, request);
      assert.equal(calls, previousCalls + 1);
      assert.equal((await privateHelpHistory(actor, roomId)).history.length, 1);
    } finally {
      await StudyRoom.updateOne({ roomId }, { $set: { revisionId: 'rev_private' } });
    }
  });
  await t.test(
    'peer, educator and forged requester cannot read or ask for private course context',
    async () => {
      const previousCalls = calls;
      for (const foreign of [peer, teacher, 'outsider']) {
        await assert.rejects(() => privateHelpHistory(foreign, roomId));
        await assert.rejects(() => askPrivateRoomHelp(foreign, roomId, request));
      }
      await assert.rejects(() => askPrivateRoomHelp(actor, roomId, { ...request, userId: peer }));
      const publicRoom = await StudyRoom.findOne({ roomId }).lean();
      assert.ok(!JSON.stringify(publicRoom).includes(request.question));
      assert.equal(calls, previousCalls);
    }
  );
  await t.test(
    'delayed tutor outcome is withheld when source access is revoked in flight',
    async () => {
      let entered!: () => void, release!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      aiClient.post = (async () => {
        entered();
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        throw new Error('Synthetic delayed unavailable provider');
      }) as typeof aiClient.post;
      const pending = askPrivateRoomHelp(actor, roomId, {
        requestId: crypto.randomUUID(),
        question: 'PRIVATE_DELAYED_SENTINEL'
      });
      await started;
      await Course.updateOne(
        { _id: courseId },
        { $set: { ownerUserId: 'revoked', userId: 'revoked' } }
      );
      release();
      await assert.rejects(() => pending);
      const records = await mongoose.connection
        .db!.collection('private_room_help')
        .find({ question: 'PRIVATE_DELAYED_SENTINEL' })
        .toArray();
      assert.equal(records.length, 1);
      assert.equal(records[0].state, 'unavailable');
      assert.equal(records[0].result, undefined);
      await Course.updateOne({ _id: courseId }, { $set: { ownerUserId: actor, userId: actor } });
      aiClient.post = (async () => {
        calls++;
        throw new Error('Synthetic provider outage');
      }) as typeof aiClient.post;
    }
  );
  await t.test('history fetch reauthorizes at current revocation', async () => {
    const uri = mongoose.connection.getClient().options.hosts[0].toString();
    assert.ok(uri.includes('27018'));
    const recovered = await privateHelpHistory(actor, roomId);
    assert.equal(recovered.history.length, 2);
    assert.ok(recovered.history.some((row) => row.requestId === request.requestId));
    await Course.updateOne(
      { _id: courseId },
      { $set: { ownerUserId: 'revoked', userId: 'revoked' } }
    );
    await assert.rejects(() => privateHelpHistory(actor, roomId));
    await assert.rejects(() => askPrivateRoomHelp(actor, roomId, request));
  });
  await t.test('source-free room returns explicit unavailable without invoking AI', async () => {
    const previousCalls = calls;
    const free = 'room_free_' + Date.now();
    await StudyRoom.create({
      roomId: free,
      inviteCode: 'FREE01',
      title: 'Free',
      status: 'active',
      hostUserId: actor,
      presenterUserId: actor,
      participants: [{ userId: actor, displayName: 'Owner' }]
    });
    const result = await askPrivateRoomHelp(actor, free, {
      requestId: crypto.randomUUID(),
      question: 'Explain'
    });
    assert.equal(result.status, 'unavailable');
    assert.equal(result.response, null);
    assert.equal(calls, previousCalls);
  });
});
