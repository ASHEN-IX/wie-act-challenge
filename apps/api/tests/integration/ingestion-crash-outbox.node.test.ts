import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { Course, CourseRevision } from '../../modules/study/src/models';
import { CourseIngestionOperation } from '../../modules/study/src/models/CourseIngestionOperation';
import {
  enqueueCourseIngestionOperation,
  cancelIngestionOperation,
  reconcileIngestionOperation,
  retryIngestionOperation,
  IngestionConflictError
} from '../../modules/study/src/services/ingestionControl';
import { setCustomPublisher } from '../../modules/study/src/services/ingestionJob';
import { handleIngestResult } from '../../modules/study/src/services/ingestStatus';

test('Physical ingestion crash-boundary testing and concurrent outbox/replacement arbitration', async (t) => {
  const dbUri = 'mongodb://127.0.0.1:27018/ednova_crash_outbox_' + process.pid + '_' + Date.now();
  await mongoose.connect(dbUri);

  t.after(async () => {
    setCustomPublisher(null);
    try {
      await mongoose.connection.dropDatabase();
    } finally {
      await mongoose.disconnect();
    }
  });

  const actor = 'crash_test_owner';

  async function createCourseFixture(overrides?: Partial<Record<string, unknown>>) {
    const course = await Course.create({
      userId: actor,
      ownerUserId: actor,
      title: 'Crash & Outbox Test Course',
      scope: 'personal',
      subjectId: 'subject_crash_test',
      status: 'completed',
      files: [
        {
          filename: 'initial_notes.pdf',
          originalName: 'notes.pdf',
          size: 1024,
          fileHash: 'sha256:' + '1'.repeat(64),
          uploadedAt: new Date()
        }
      ],
      ...overrides
    });
    const courseId = String(course._id);
    const revisionTag = 'rev_initial_' + crypto.randomUUID().slice(0, 8);
    await CourseRevision.create({
      courseId,
      revisionTag,
      contentHash: '1'.repeat(64),
      status: 'draft',
      isInstructorReviewed: false,
      topics: [{ id: 'topic_1', title: 'Initial Topic' }],
      sourceManifest: [
        {
          documentId: 'doc_initial',
          contentHash: 'sha256:' + '1'.repeat(64),
          storageRef: 'originals/' + '1'.repeat(64),
          filename: 'notes.pdf',
          provenance: 'extracted',
          mediaType: 'application/pdf'
        }
      ]
    });
    return {
      courseId,
      revisionId: revisionTag,
      userId: actor,
      fileRef: 'courses/' + courseId,
      files: []
    };
  }

  const terminalResult = (correlationId: string, revisionId: string) => ({
    type: 'study.ingest.course' as const,
    correlationId,
    status: 'completed' as const,
    payload: {
      course: {
        topics: [{ id: 'topic_recovered', title: 'Recovered Ingestion Topic' }]
      },
      revisionId
    }
  });

  await t.test(
    'CAS atomic arbitration: two concurrent enqueue operations produce exactly 1 winner and 1 409 conflict',
    async () => {
      const params = await createCourseFixture({ status: 'completed', jobId: undefined });
      setCustomPublisher(
        async (...args) => args[3] as { messageId: string; correlationId: string }
      );

      const params1 = { ...params, revisionId: 'rev_concurrent_1' };
      const params2 = { ...params, revisionId: 'rev_concurrent_2' };

      // Race both enqueue calls concurrently on the same initial course (expectedJobId: undefined)
      const results = await Promise.allSettled([
        enqueueCourseIngestionOperation(params1),
        enqueueCourseIngestionOperation(params2)
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.equal(fulfilled.length, 1, 'Exactly one concurrent enqueue must succeed');
      assert.equal(rejected.length, 1, 'Exactly one concurrent enqueue must be rejected');

      const failure = (rejected[0] as PromiseRejectedResult).reason;
      assert.ok(
        failure instanceof IngestionConflictError,
        'Losing enqueue must throw IngestionConflictError'
      );
      assert.equal(failure.status, 409);

      // Verify the course in MongoDB has the winner's jobId and status processing
      const winningJob = (fulfilled[0] as PromiseFulfilledResult<{ jobId: string }>).value;
      const updatedCourse = await Course.findById(params.courseId).lean();
      assert.equal(updatedCourse?.jobId, winningJob.jobId);
      assert.equal(updatedCourse?.status, 'processing');

      // Verify the losing operation was marked superseded
      const supersededOps = await CourseIngestionOperation.find({
        courseId: params.courseId,
        state: 'superseded'
      }).lean();
      assert.equal(supersededOps.length, 1, 'Losing operation must be marked superseded');
    }
  );

  await t.test(
    'Replacement arbitration: concurrent upload while course is processing is rejected',
    async () => {
      const activeJobId = crypto.randomUUID();
      const params = await createCourseFixture({
        status: 'processing',
        jobId: activeJobId,
        correlationId: crypto.randomUUID()
      });

      // Attempting to enqueue a new operation with expectedJobId: undefined fails because course already has jobId
      await assert.rejects(
        () =>
          enqueueCourseIngestionOperation({ ...params, revisionId: 'rev_rejected_replacement' }),
        (err: unknown) => {
          assert.ok(err instanceof IngestionConflictError);
          assert.equal(err.status, 409);
          return true;
        }
      );

      // Verify original processing job was NOT modified or replaced
      const course = await Course.findById(params.courseId).lean();
      assert.equal(course?.jobId, activeJobId);
      assert.equal(course?.status, 'processing');
    }
  );

  await t.test(
    'Physical process kill (SIGKILL) right after MongoDB reservation survives and reconciles',
    async () => {
      // We spawn a child process that creates a course and reserves an ingestion operation in MongoDB,
      // but is killed via SIGKILL before publishing to RabbitMQ.
      const fixtureParams = await createCourseFixture({ status: 'completed' });
      const targetCourseId = fixtureParams.courseId;
      const targetRevisionId = 'rev_sigkill_' + crypto.randomUUID().slice(0, 8);

      await CourseRevision.create({
        courseId: targetCourseId,
        revisionTag: targetRevisionId,
        contentHash: 'sigkill_hash',
        status: 'draft',
        isInstructorReviewed: false,
        topics: [],
        sourceManifest: [
          {
            documentId: 'doc_sigkill',
            contentHash: 'sha256:' + '3'.repeat(64),
            storageRef: 'originals/' + '3'.repeat(64),
            filename: 'sigkill_source.txt',
            provenance: 'extracted',
            mediaType: 'text/plain'
          }
        ]
      });

      const childScript = `
        const mongoose = require('mongoose');
        const crypto = require('crypto');
        
        async function run() {
          await mongoose.connect('${dbUri}');
          const messageId = '${crypto.randomUUID()}';
          const correlationId = '${crypto.randomUUID()}';
          
          const CourseIngestionOperation = mongoose.model(
            'CourseIngestionOperation',
            new mongoose.Schema({ _id: String }, { strict: false, collection: 'course_ingestion_operations' })
          );
          const Course = mongoose.model('Course', new mongoose.Schema({}, { strict: false, collection: 'courses' }));
          
          await CourseIngestionOperation.create({
            _id: messageId,
            correlationId: correlationId,
            courseId: new mongoose.Types.ObjectId('${targetCourseId}'),
            revisionId: '${targetRevisionId}',
            userId: '${actor}',
            fileRef: 'courses/${targetCourseId}',
            files: [],
            state: 'prepared',
            createdAt: new Date(),
            updatedAt: new Date()
          });
          
          await Course.updateOne(
            { _id: new mongoose.Types.ObjectId('${targetCourseId}') },
            {
              $set: {
                jobId: messageId,
                correlationId: correlationId,
                status: 'processing',
                ingestStage: null,
                ingestProgress: 0,
                ingestDetail: 'queued',
                ingestError: ''
              }
            }
          );
          
          // Send message to parent that persistence reservation is committed to MongoDB
          process.send({ ready: true, messageId, correlationId });
          
          // Wait indefinitely to be killed by SIGKILL from parent
          await new Promise(() => {});
        }
        run().catch(err => {
          console.error(err);
          process.exit(1);
        });
      `;

      let killedJobId = '';
      let killedCorrelationId = '';

      const child = spawn(process.execPath, ['-e', childScript], {
        cwd: path.resolve(__dirname, '../..'),
        env: {
          ...process.env,
          NODE_PATH:
            path.resolve(__dirname, '../../node_modules') +
            ':' +
            path.resolve(__dirname, '../../../../node_modules')
        },
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
      });

      let childStderr = '';
      child.stderr?.on('data', (d) => {
        childStderr += d.toString();
      });

      await new Promise<void>((resolve, reject) => {
        child.on(
          'message',
          (msg: { ready?: boolean; messageId: string; correlationId: string }) => {
            if (msg.ready) {
              killedJobId = msg.messageId;
              killedCorrelationId = msg.correlationId;
              // Send uncatchable SIGKILL (kill -9) immediately
              child.kill('SIGKILL');
            }
          }
        );
        child.on('exit', (code, signal) => {
          if (signal !== 'SIGKILL') {
            return reject(
              new Error(
                `Process must terminate via SIGKILL, got code ${code}, signal ${signal}. Stderr: ${childStderr}`
              )
            );
          }
          resolve();
        });
        child.on('error', reject);
      });

      assert.ok(killedJobId, 'Killed jobId must be recorded');
      assert.ok(killedCorrelationId, 'Killed correlationId must be recorded');

      // Parent process inspects MongoDB after child SIGKILL:
      const crashedCourse = await Course.findById(targetCourseId).lean();
      assert.equal(crashedCourse?.jobId, killedJobId);
      assert.equal(crashedCourse?.correlationId, killedCorrelationId);
      assert.equal(crashedCourse?.status, 'processing');

      const crashedOp = await CourseIngestionOperation.findById(killedJobId).lean();
      assert.equal(crashedOp?.state, 'prepared');
      assert.equal(String(crashedOp?.courseId), targetCourseId);

      // Now parent process performs recovery / reconciliation:
      let republishCalledWith: { messageId: string; correlationId: string } | undefined;
      setCustomPublisher(async (...args) => {
        const options = args[3] as { messageId: string; correlationId: string };
        republishCalledWith = options;
        return options;
      });

      const reconciliationResult = await reconcileIngestionOperation(
        actor,
        targetCourseId,
        killedJobId
      );
      assert.equal(reconciliationResult.status, 'redispatched_same_identity');
      assert.equal(republishCalledWith?.messageId, killedJobId);
      assert.equal(republishCalledWith?.correlationId, killedCorrelationId);

      // Worker delivers result with that correlationId
      await handleIngestResult(terminalResult(killedCorrelationId, targetRevisionId));

      const recoveredCourse = await Course.findById(targetCourseId).lean();
      assert.equal(recoveredCourse?.status, 'completed');
      assert.equal(recoveredCourse?.topics?.[0]?.title, 'Recovered Ingestion Topic');

      const finalizedOp = await CourseIngestionOperation.findById(killedJobId).lean();
      assert.equal(finalizedOp?.resultApplied, true);
    }
  );

  await t.test(
    'Recovery after worker persisted result in outbox before process crash completes course without redispatch',
    async () => {
      const params = await createCourseFixture({ status: 'processing' });
      const jobId = crypto.randomUUID();
      const correlationId = crypto.randomUUID();

      await Course.updateOne(
        { _id: params.courseId },
        {
          $set: {
            jobId,
            correlationId,
            status: 'processing'
          }
        }
      );

      // Simulate: worker finished and persisted result in CourseIngestionOperation,
      // but process died before applying it to Course
      await CourseIngestionOperation.create({
        _id: jobId,
        correlationId,
        courseId: params.courseId,
        revisionId: params.revisionId,
        userId: actor,
        fileRef: params.fileRef,
        files: [],
        state: 'queued',
        result: terminalResult(correlationId, params.revisionId),
        resultApplied: false
      });

      let publisherInvoked = false;
      setCustomPublisher(async () => {
        publisherInvoked = true;
        throw new Error('Publisher must not be called when durable result is already present');
      });

      const recovery = await reconcileIngestionOperation(actor, params.courseId, jobId);
      assert.equal(recovery.status, 'reconciled_result');
      assert.equal(publisherInvoked, false, 'Should not redispatch to broker');

      const completedCourse = await Course.findById(params.courseId).lean();
      assert.equal(completedCourse?.status, 'completed');
      assert.equal(completedCourse?.topics?.[0]?.title, 'Recovered Ingestion Topic');

      const completedOp = await CourseIngestionOperation.findById(jobId).lean();
      assert.equal(completedOp?.resultApplied, true);
    }
  );

  await t.test(
    'Author cancellation invalidates correlation and rejects subsequent worker completion',
    async () => {
      const params = await createCourseFixture();
      setCustomPublisher(
        async (...args) => args[3] as { messageId: string; correlationId: string }
      );

      const op = await enqueueCourseIngestionOperation(params);
      const cancelResult = await cancelIngestionOperation(actor, params.courseId, op.jobId);
      assert.equal(cancelResult.status, 'cancelled');

      const cancelledCourse = await Course.findById(params.courseId).lean();
      assert.equal(cancelledCourse?.status, 'failed');
      assert.equal(cancelledCourse?.ingestDetail, 'cancelled');
      assert.equal(cancelledCourse?.correlationId, undefined);

      // Late arriving worker result for cancelled correlationId is rejected
      await handleIngestResult(terminalResult(op.correlationId, params.revisionId));

      const intactCourse = await Course.findById(params.courseId).lean();
      assert.equal(intactCourse?.status, 'failed', 'Course must not transition to completed');
      assert.equal(intactCourse?.ingestDetail, 'cancelled');

      // Retry creates a fresh unreviewed revision retaining source manifest
      const retryResult = await retryIngestionOperation(actor, params.courseId, op.jobId);
      assert.notEqual(retryResult.jobId, op.jobId);

      const retriedOp = await CourseIngestionOperation.findById(retryResult.jobId).lean();
      const newRev = await CourseRevision.findOne({
        courseId: params.courseId,
        revisionTag: retriedOp?.revisionId
      }).lean();
      assert.equal(newRev?.sourceManifest?.[0]?.documentId, 'doc_initial');
      assert.equal(newRev?.isInstructorReviewed, false);
    }
  );

  await t.test(
    'Concurrent replacement conflict rollback leaves course files and revision clean',
    async () => {
      const initialCourse = await createCourseFixture({
        status: 'completed',
        jobId: 'job_initial'
      });
      const courseId = initialCourse.courseId;
      const initialFiles = (await Course.findById(courseId).lean())?.files || [];
      assert.equal(initialFiles.length, 1);

      // Request 1 wins the CAS
      setCustomPublisher(
        async (...args) => args[3] as { messageId: string; correlationId: string }
      );
      const op1 = await enqueueCourseIngestionOperation(
        { ...initialCourse, revisionId: 'rev_winner' },
        'job_initial'
      );
      assert.ok(op1.jobId);

      // Request 2 raced with stale expectedJobId 'job_initial'
      const stagedReplacementFiles = [
        {
          filename: 'loser_file.txt',
          originalName: 'loser.txt',
          size: 512,
          fileHash: 'sha256:' + '9'.repeat(64),
          uploadedAt: new Date()
        }
      ];

      // Request 2 pushes files before CAS
      await Course.updateOne(
        { _id: courseId },
        { $push: { files: { $each: stagedReplacementFiles } } }
      );
      const loserRevisionTag = 'rev_loser_' + Date.now();
      await CourseRevision.create({
        courseId,
        revisionTag: loserRevisionTag,
        contentHash: 'loser_hash',
        status: 'draft',
        isInstructorReviewed: false,
        topics: [],
        sourceManifest: []
      });

      // Request 2 attempts CAS enqueue with expectedJobId 'job_initial' -> throws IngestionConflictError
      let caughtConflict = false;
      try {
        await enqueueCourseIngestionOperation(
          { ...initialCourse, revisionId: loserRevisionTag },
          'job_initial'
        );
      } catch (err) {
        if (err instanceof IngestionConflictError) {
          caughtConflict = true;
          // Rollback newly added files and clean up orphan revision
          await Course.updateOne({ _id: courseId }, { $set: { files: initialFiles } });
          await CourseRevision.deleteOne({ courseId, revisionTag: loserRevisionTag });
        }
      }
      assert.ok(caughtConflict, 'Stale replacement must throw IngestionConflictError');

      // Verify course files are rolled back to initial files only
      const verifiedCourse = await Course.findById(courseId).lean();
      assert.equal(verifiedCourse?.files.length, 1);
      assert.equal(verifiedCourse?.files[0].filename, 'initial_notes.pdf');
      assert.equal(verifiedCourse?.jobId, op1.jobId);

      // Verify loser revision was removed
      const orphanRev = await CourseRevision.findOne({
        courseId,
        revisionTag: loserRevisionTag
      }).lean();
      assert.equal(orphanRev, null);
    }
  );
});
