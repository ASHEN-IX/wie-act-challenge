import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient, ObjectId } from 'mongodb';
import mongoose from 'mongoose';
import express, { type Response, type NextFunction } from 'express';
import request from 'supertest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { DomainRequest } from '../../src/framework/contracts';
import coursesRouter from '../../modules/study/src/routes/courses';
import { handleIngestResult } from '../../modules/study/src/services/ingestStatus';
import { setCustomPublisher } from '../../modules/study/src/services/ingestionJob';
import { validateIngestPayload } from '../../shared/ai-messaging/payloadSchemas';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/ednova_m05_test';

setCustomPublisher(async () => {
  return {
    messageId: `job_${Date.now()}`,
    correlationId: `corr_${Date.now()}`
  };
});

test('M05 / ED-06: Scoped source ingestion, revision pinning, and provenance', async (t) => {
  const client = await new MongoClient(MONGO_URI).connect();
  const db = client.db();
  await mongoose.connect(MONGO_URI);

  const userId = new ObjectId().toString();
  const subjectId = new ObjectId().toString();
  let createdCourseId: string | undefined;

  t.after(async () => {
    try {
      if (createdCourseId) {
        await db.collection('courses').deleteOne({ _id: new ObjectId(createdCourseId) });
        await db
          .collection('course_revisions')
          .deleteMany({ courseId: new ObjectId(createdCourseId) });
      }
      await db.collection('subjects').deleteOne({ _id: new ObjectId(subjectId) });
    } catch {
      // ignore teardown error
    } finally {
      await client.close().catch(() => {});
    }
  });

  await db.collection('subjects').insertOne({
    _id: new ObjectId(subjectId),
    userId,
    name: 'Distributed Systems',
    description: 'Core concepts',
    color: '#3b82f6',
    totalStudyTime: 0
  });

  function buildApp() {
    const app = express();
    app.use(express.json());
    app.use((req: DomainRequest, _res: Response, next: NextFunction) => {
      req.user = { userId, role: 'student', tier: 'vip' };
      next();
    });
    app.use('/api/v1/study/courses', coursesRouter);
    return app;
  }

  // Temporary synthetic file for upload
  const tmpDir = path.join('/tmp', `ednova_m05_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  const testFilePath = path.join(tmpDir, 'chapter1.txt');
  const fileContent = 'Chapter 1: Fault tolerance and Paxos consensus in distributed algorithms.';
  fs.writeFileSync(testFilePath, fileContent, 'utf-8');
  const expectedFileHash = crypto.createHash('sha256').update(fileContent).digest('hex');

  let courseId = '';
  let initialRevisionTag = '';

  await t.test(
    '1. Uploading source files creates course with SHA-256 fileHash and draft CourseRevision',
    async () => {
      const res = await request(buildApp())
        .post('/api/v1/study/courses')
        .field('title', 'Distributed Systems 101')
        .field('subject_id', subjectId)
        .attach('files', testFilePath);

      assert.equal(res.status, 202);
      assert.ok(res.body.courseId);
      assert.equal(res.body.status, 'processing');
      courseId = res.body.courseId;
      createdCourseId = courseId;

      // Verify course document in MongoDB
      const courseDoc = await db.collection('courses').findOne({ _id: new ObjectId(courseId) });
      assert.ok(courseDoc);
      assert.equal(courseDoc.status, 'processing');
      assert.equal(courseDoc.files.length, 1);
      assert.equal(courseDoc.files[0].fileHash, expectedFileHash, 'Original file hash preserved');

      // Verify draft CourseRevision in MongoDB
      const revisions = await db
        .collection('course_revisions')
        .find({ courseId: new ObjectId(courseId) })
        .toArray();
      assert.equal(revisions.length, 1);
      const rev = revisions[0];
      assert.ok(rev.revisionTag.startsWith('rev_'));
      initialRevisionTag = rev.revisionTag;
      assert.equal(rev.status, 'draft', 'Ingested revision is initially a draft');
      assert.equal(rev.isInstructorReviewed, false, 'Unreviewed by default');
      assert.ok(rev.contentHash, 'Content hash exists');
      assert.equal(rev.vectorIndexRef, `faiss/${courseId}/${rev.revisionTag}.faiss`);
    }
  );

  await t.test(
    '2. Ingestion worker result completion links sanitized draft topics without activating an unreviewed revision',
    async () => {
      const courseDoc = await db.collection('courses').findOne({ _id: new ObjectId(courseId) });
      assert.ok(courseDoc);

      const syntheticResult = {
        type: 'study.ingest.course' as const,
        correlationId: courseDoc.correlationId,
        status: 'completed' as const,
        payload: {
          courseId,
          revisionId: initialRevisionTag,
          vectorIndexRef: `faiss/${courseId}/${initialRevisionTag}.faiss`,
          course: {
            topics: [
              {
                title: 'Consensus Protocols',
                subtopics: [
                  {
                    id: 'sub_paxos',
                    title: 'Paxos Basics',
                    summary: 'Consensus under asynchronous network model',
                    key_concepts: ['proposer', 'acceptor', 'learner'],
                    learning_objectives: [
                      {
                        id: 'obj_1',
                        statement: 'Explain the 2-phase commit consensus cycle',
                        bloomLevel: 'understand'
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      };

      await handleIngestResult(syntheticResult);

      const updatedCourse = await db.collection('courses').findOne({ _id: new ObjectId(courseId) });
      assert.equal(updatedCourse!.status, 'completed');
      assert.equal(updatedCourse!.topics.length, 1);
      assert.equal(updatedCourse!.topics[0].title, 'Consensus Protocols');
      assert.ok(
        !updatedCourse!.activeRevisionId,
        'Ingestion cannot activate an unreviewed revision'
      );

      const updatedRev = await db.collection('course_revisions').findOne({
        courseId: new ObjectId(courseId),
        revisionTag: initialRevisionTag
      });
      assert.ok(updatedRev);
      assert.equal(updatedRev.topics.length, 1);
      assert.equal(updatedRev.topics[0].title, 'Consensus Protocols');
      assert.equal(updatedRev.status, 'draft', 'Stays draft until explicit publication');
    }
  );

  await t.test(
    '3. Subsequent file upload stages a new distinct revision without destroying previous revision',
    async () => {
      const testFile2Path = path.join(tmpDir, 'chapter2.txt');
      const file2Content = 'Chapter 2: Raft consensus and log replication.';
      fs.writeFileSync(testFile2Path, file2Content, 'utf-8');
      const file2Hash = crypto.createHash('sha256').update(file2Content).digest('hex');

      const res = await request(buildApp())
        .post(`/api/v1/study/courses/${courseId}/files`)
        .attach('files', testFile2Path);

      assert.equal(res.status, 202);

      const revisions = await db
        .collection('course_revisions')
        .find({ courseId: new ObjectId(courseId) })
        .toArray();
      assert.equal(revisions.length, 2, 'Two distinct revisions coexist');

      const revTags = revisions.map((r) => r.revisionTag);
      assert.ok(revTags.includes(initialRevisionTag));
      const newRev = revisions.find((r) => r.revisionTag !== initialRevisionTag);
      assert.ok(newRev);
      assert.notEqual(newRev.revisionTag, initialRevisionTag);
      assert.notEqual(
        newRev.contentHash,
        revisions.find((r) => r.revisionTag === initialRevisionTag)!.contentHash
      );

      // Verify course files list has both files with their distinct hashes
      const updatedCourse = await db.collection('courses').findOne({ _id: new ObjectId(courseId) });
      assert.equal(updatedCourse!.files.length, 2);
      const hashes = updatedCourse!.files.map((f: { fileHash: string }) => f.fileHash);
      assert.ok(hashes.includes(expectedFileHash));
      assert.ok(hashes.includes(file2Hash));
    }
  );

  await t.test(
    '4. Payload schema validation rejects malformed revisionId and path traversal attempts',
    async () => {
      // Valid envelope with revisionId
      const valid = validateIngestPayload({
        courseId: '64a000000000000000000001',
        revisionId: 'rev_20261023_v1',
        fileRef: 'uploads/courses/64a000000000000000000001',
        files: [
          { filename: 'a.pdf', originalName: 'a.pdf', mimetype: 'application/pdf', size: 100 }
        ]
      });
      assert.equal(valid.valid, true);

      // Path traversal in revisionId rejected
      const invalidTraversal = validateIngestPayload({
        courseId: '64a000000000000000000001',
        revisionId: '../../etc/passwd',
        fileRef: 'uploads/courses/64a000000000000000000001',
        files: []
      });
      assert.equal(invalidTraversal.valid, false);
      assert.ok(invalidTraversal.errors.some((e) => e.includes('revisionId')));

      // Unknown fields rejected
      const unknownField = validateIngestPayload({
        courseId: '64a000000000000000000001',
        fileRef: 'uploads/courses/64a000000000000000000001',
        forgedAdminKey: 'admin'
      });
      assert.equal(unknownField.valid, false);
      assert.ok(unknownField.errors.some((e) => e.includes('unknown field')));
    }
  );

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
  await db.dropDatabase();
  await mongoose.disconnect();
  await client.close();
});
