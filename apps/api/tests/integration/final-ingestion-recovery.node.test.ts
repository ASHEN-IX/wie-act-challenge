import test from 'node:test';
import assert from 'node:assert/strict';
import { connectDatabase, disconnectDatabase } from '../../shared/database';
import { Course, CourseRevision } from '../../modules/study/src/models';
import { CourseIngestionOperation } from '../../modules/study/src/models/CourseIngestionOperation';
import {
  enqueueCourseIngestionOperation,
  cancelIngestionOperation,
  reconcileIngestionOperation,
  retryIngestionOperation
} from '../../modules/study/src/services/ingestionControl';
import { setCustomPublisher } from '../../modules/study/src/services/ingestionJob';
import { handleIngestResult } from '../../modules/study/src/services/ingestStatus';

test('Durable source dispatch linkage, uncertain acknowledgement, cancellation and outcome replay', async (t) => {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || 'postgresql://ednova:ednova@127.0.0.1:5433/ednova_test';
  await connectDatabase();
  // The test database is shared, so every row this suite owns carries a
  // run-unique actor id and teardown deletes exactly those rows.
  const actor = `recovery_${process.pid}_${Date.now()}`;
  t.after(async () => {
    setCustomPublisher(null);
    try {
      await CourseIngestionOperation.deleteMany({ userId: actor });
      // Revisions cascade from the course row.
      await Course.deleteMany({ userId: actor });
    } finally {
      await disconnectDatabase().catch(() => {});
    }
  });
  async function fixture() {
    const course = await Course.create({
      userId: actor,
      ownerUserId: actor,
      title: 'Synthetic source recovery',
      scope: 'personal',
      subjectId: 'fixture',
      status: 'processing',
      files: []
    });
    const courseId = String(course._id);
    await CourseRevision.create({
      courseId,
      revisionTag: 'rev_ingest',
      contentHash: 'a'.repeat(64),
      status: 'draft',
      isInstructorReviewed: false,
      topics: [],
      sourceManifest: [
        {
          documentId: 'doc_synthetic',
          contentHash: 'sha256:' + 'b'.repeat(64),
          storageRef: 'originals/' + 'b'.repeat(64),
          filename: 'source.txt',
          provenance: 'extracted',
          mediaType: 'text/plain'
        }
      ]
    });
    return {
      courseId,
      revisionId: 'rev_ingest',
      userId: actor,
      fileRef: 'courses/' + courseId,
      files: []
    };
  }
  const result = (correlationId: string) => ({
    type: 'study.ingest.course' as const,
    correlationId,
    status: 'completed' as const,
    payload: { course: { topics: [] }, revisionId: 'rev_ingest' }
  });
  await t.test('fast callback sees durable pointer before publisher returns', async () => {
    const params = await fixture();
    setCustomPublisher(async (...args) => {
      const options = args[3] as { messageId: string; correlationId: string };
      const course = await Course.findById(params.courseId).lean();
      assert.equal(course?.jobId, options.messageId);
      assert.equal(course?.correlationId, options.correlationId);
      await handleIngestResult(result(options.correlationId));
      return options;
    });
    const enqueued = await enqueueCourseIngestionOperation(params);
    assert.equal((await Course.findById(params.courseId).lean())?.status, 'completed');
    assert.equal(
      (await CourseIngestionOperation.findById(enqueued.jobId).lean())?.resultApplied,
      true
    );
  });
  await t.test(
    'lost acknowledgement retains original IDs and reconcile republishes same message',
    async () => {
      const params = await fixture();
      let original: { messageId: string; correlationId: string } | undefined;
      setCustomPublisher(async (...args) => {
        original = args[3] as typeof original;
        throw new Error('Synthetic lost acknowledgement');
      });
      await assert.rejects(() => enqueueCourseIngestionOperation(params));
      const failed = await Course.findById(params.courseId).lean();
      assert.equal(failed?.status, 'failed');
      assert.ok(original);
      await assert.rejects(() => retryIngestionOperation(actor, params.courseId, failed!.jobId!));
      setCustomPublisher(async (...args) => {
        const options = args[3] as { messageId: string; correlationId: string };
        assert.deepEqual(
          { messageId: options.messageId, correlationId: options.correlationId },
          { messageId: original!.messageId, correlationId: original!.correlationId }
        );
        await handleIngestResult(result(options.correlationId));
        return options;
      });
      await reconcileIngestionOperation(actor, params.courseId, failed!.jobId!);
      assert.equal((await Course.findById(params.courseId).lean())?.status, 'completed');
    }
  );
  await t.test(
    'cancel invalidates delayed outcome; retry preserves source and isolates old revision',
    async () => {
      const params = await fixture();
      setCustomPublisher(
        async (...args) => args[3] as { messageId: string; correlationId: string }
      );
      const original = await enqueueCourseIngestionOperation(params);
      await assert.rejects(() =>
        cancelIngestionOperation('foreign', params.courseId, original.jobId)
      );
      await cancelIngestionOperation(actor, params.courseId, original.jobId);
      await handleIngestResult(result(original.correlationId));
      assert.equal((await Course.findById(params.courseId).lean())?.ingestDetail, 'cancelled');
      const replacement = await retryIngestionOperation(actor, params.courseId, original.jobId);
      assert.notEqual(replacement.jobId, original.jobId);
      const operation = await CourseIngestionOperation.findById(replacement.jobId).lean();
      const revision = await CourseRevision.findOne({
        courseId: params.courseId,
        revisionTag: operation!.revisionId
      }).lean();
      assert.equal(revision?.sourceManifest?.[0].documentId, 'doc_synthetic');
      assert.equal(revision?.isInstructorReviewed, false);
      await handleIngestResult(result(original.correlationId));
      assert.equal((await Course.findById(params.courseId).lean())?.jobId, replacement.jobId);
      await assert.rejects(() =>
        reconcileIngestionOperation(actor, params.courseId, original.jobId)
      );
    }
  );
  await t.test(
    'foreign result revision cannot complete or populate a different draft',
    async () => {
      const params = await fixture();
      setCustomPublisher(
        async (...args) => args[3] as { messageId: string; correlationId: string }
      );
      const enqueued = await enqueueCourseIngestionOperation(params);
      await handleIngestResult({
        ...result(enqueued.correlationId),
        payload: { course: { topics: [] }, revisionId: 'foreign_revision' }
      });
      assert.equal((await Course.findById(params.courseId).lean())?.status, 'processing');
      assert.equal((await CourseIngestionOperation.findById(enqueued.jobId).lean())?.result, null);
    }
  );
  await t.test(
    'persisted outcome reconciles crash after claim and cannot overwrite reviewed draft',
    async () => {
      const params = await fixture();
      setCustomPublisher(
        async (...args) => args[3] as { messageId: string; correlationId: string }
      );
      const enqueued = await enqueueCourseIngestionOperation(params);
      await CourseIngestionOperation.updateOne(
        { _id: enqueued.jobId },
        { $set: { result: result(enqueued.correlationId) } }
      );
      await Course.updateOne({ _id: params.courseId }, { $set: { status: 'completed' } });
      await CourseRevision.updateOne(
        { courseId: params.courseId },
        {
          $set: {
            isInstructorReviewed: true,
            topics: [{ id: 'reviewed', title: 'Instructor corrected source' }]
          }
        }
      );
      await reconcileIngestionOperation(actor, params.courseId, enqueued.jobId);
      assert.equal(
        (
          (await CourseRevision.findOne({ courseId: params.courseId }))?.topics as Array<{
            title?: string;
          }>
        )?.[0]?.title,
        'Instructor corrected source'
      );
      assert.equal(
        (await CourseIngestionOperation.findById(enqueued.jobId).lean())?.resultApplied,
        true
      );
      await handleIngestResult({
        ...result(enqueued.correlationId),
        status: 'failed',
        error: 'late conflicting failure'
      });
      assert.equal((await Course.findById(params.courseId).lean())?.status, 'completed');
    }
  );
});
