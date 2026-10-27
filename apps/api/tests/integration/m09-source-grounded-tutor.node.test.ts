import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sourceRoots } from '../../modules/study/src/services/revisionSources';
import { materializeRevisionFixture } from '../helpers/revisionArtifactFixture';
import { cleanupCourseFixtures, prepareCourseFixture } from '../helpers/reviewedActivityFixture';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import express, { type Response, type NextFunction } from 'express';
import request from 'supertest';
import mongoose from 'mongoose';

import {
  Course,
  CourseEnrollment,
  CourseRevision,
  InstitutionMembership
} from '../../modules/study/src/models';
import coursesRouter from '../../modules/study/src/routes/courses';
import { updateCourseDraft } from '../../modules/study/src/services/courseDraft';
import { publishCourseRevision } from '../../modules/study/src/services/coursePublication';
import type { DomainRequest } from '../../src/framework/contracts';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27018/mindflow-test';

test('M09 / ED-10: Source-Grounded Tutor with Verifiable Citations Integration', async (t) => {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;

  const testPrefix = `m09_${Date.now()}`;
  const ownerUserId = `${testPrefix}_owner`;
  const instructorId = `${testPrefix}_instructor`;
  const studentId = `${testPrefix}_enrolled_student`;
  const foreignUserId = `${testPrefix}_foreign_user`;
  const institutionId = new mongoose.Types.ObjectId();

  let courseId: string;
  let unpublishedCourseId: string;
  let publishedRevisionTag: string;
  let mockPort: number;

  const originalAiUrl = process.env.AI_SERVICE_URL;
  const originalAiKey = process.env.AI_SERVICE_API_KEY;

  // Track mock requests received by the simulated AI service
  const receivedAiRequests: Array<{
    url?: string;
    method?: string;
    headers: http.IncomingHttpHeaders;
    body: Record<string, unknown>;
  }> = [];

  // Configurable mock response behavior for AI service
  let mockAiResponseMode: 'verified' | 'insufficient_evidence' | 'fabricated_citation' = 'verified';

  // Start in-process mock AI service server
  const mockServer = http.createServer((req, res) => {
    let bodyData = '';
    req.on('data', (chunk) => {
      bodyData += chunk;
    });
    req.on('end', () => {
      let parsedBody: Record<string, unknown> = {};
      try {
        parsedBody = bodyData ? JSON.parse(bodyData) : {};
      } catch {
        parsedBody = {};
      }

      receivedAiRequests.push({
        url: req.url,
        method: req.method,
        headers: req.headers,
        body: parsedBody
      });

      if (req.url === '/api/ai/tutor/ask' && req.method === 'POST') {
        const authHeader = req.headers.authorization || '';
        if (!authHeader.startsWith('Bearer ')) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ detail: 'Service authentication required' }));
          return;
        }

        const cid = String(parsedBody.courseId || '');
        const revId = String(parsedBody.revisionId || '');
        const cHash = String(parsedBody.contentHash || '');
        const artifact = JSON.parse(
          readFileSync(path.join(sourceRoots().indexes, cid, revId + '.meta.json'), 'utf8')
        );
        const meta = artifact.metas[0],
          text = artifact.chunks[0],
          pin = { courseId: cid, revisionId: revId, contentHash: cHash };
        const passage = {
          documentId: meta.document_id,
          contentHash: meta.content_hash,
          pageNumber: meta.page_number,
          chunkId: meta.chunk_id,
          textHash: meta.text_hash,
          sectionId: meta.section_id,
          text
        };
        const insufficient = mockAiResponseMode === 'insufficient_evidence';
        const citation = {
          documentId: passage.documentId,
          pageNumber: passage.pageNumber,
          chunkId: passage.chunkId,
          textHash: passage.textHash,
          quote: text,
          verified: true
        };
        if (mockAiResponseMode === 'fabricated_citation') citation.documentId = 'doc_foreign';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            schemaVersion: '1.0.0',
            answer: insufficient
              ? 'Insufficient evidence'
              : text + ' [doc:' + passage.documentId + ', chunk:' + passage.chunkId + ']',
            hasSufficientEvidence: !insufficient,
            citationsValid: !insufficient,
            status: insufficient ? 'insufficient_evidence' : 'verified',
            pin,
            citations: insufficient ? [] : [citation],
            groundingContext: insufficient
              ? null
              : {
                  schemaVersion: '1.0.0',
                  visibility: 'service_only',
                  pin,
                  sources: [
                    {
                      documentId: passage.documentId,
                      contentHash: passage.contentHash,
                      pageNumber: null,
                      locationKnown: false,
                      provenance: 'extracted'
                    }
                  ],
                  excerpts: [{ documentId: passage.documentId, text }]
                },
            retrievedEvidence: insufficient ? [] : [passage],
            executionMode: 'MOCK_TEST'
          })
        );
        return;
      }

      res.writeHead(404);
      res.end();
    });
  });

  await new Promise<void>((resolve) => {
    mockServer.listen(0, '127.0.0.1', () => {
      const address = mockServer.address() as AddressInfo;
      mockPort = address.port;
      process.env.AI_SERVICE_URL = `http://127.0.0.1:${mockPort}`;
      process.env.AI_SERVICE_API_KEY = 'test_secret_token_at_least_32_characters_long_for_auth';
      resolve();
    });
  });

  // Setup Express test app mounting courses router
  const app = express();
  app.use(express.json());
  app.use((req: DomainRequest, _res: Response, next: NextFunction) => {
    const actorHeader = req.headers['x-test-actor'];
    if (actorHeader) {
      req.user = {
        userId: String(actorHeader),
        email: `${actorHeader}@test.edu`,
        role: 'user'
      };
    }
    next();
  });
  app.use('/api/v1/study/courses', coursesRouter);

  t.after(async () => {
    await cleanupCourseFixtures();
    try {
      if (courseId) {
        await db
          .collection('course_revisions')
          .deleteMany({ courseId: new mongoose.Types.ObjectId(courseId) });
      }
      if (unpublishedCourseId) {
        await db
          .collection('course_revisions')
          .deleteMany({ courseId: new mongoose.Types.ObjectId(unpublishedCourseId) });
      }
      await db.collection('courses').deleteMany({ userId: { $regex: testPrefix } });
      await db.collection('course_enrollments').deleteMany({ userId: { $regex: testPrefix } });
      await db.collection('institution_memberships').deleteMany({ userId: { $regex: testPrefix } });
    } catch {
      // ignore
    } finally {
      process.env.AI_SERVICE_URL = originalAiUrl;
      process.env.AI_SERVICE_API_KEY = originalAiKey;
      mockServer.close();
      await mongoose.disconnect().catch(() => {});
    }
  });

  await t.test(
    '1. Setup: Create published course with reviewed objectives and enroll student',
    async () => {
      // 1. Add instructor membership
      await InstitutionMembership.create({
        institutionId,
        userId: instructorId,
        role: 'instructor',
        status: 'active'
      });

      const initialTopics = [
        {
          id: 'topic_calc_1',
          title: 'Limits',
          subtopics: [
            {
              id: 'sub_1',
              title: 'Introduction to Limits',
              learning_objectives: [
                {
                  id: 'obj_1',
                  statement: 'Calculate one-sided limits algebraically',
                  bloomLevel: 'apply'
                }
              ]
            }
          ]
        }
      ];

      // 2. Create institutional course
      const courseDoc = await Course.create({
        title: 'Advanced Calculus',
        scope: 'institutional',
        institutionId,
        ownerUserId,
        userId: ownerUserId,
        subjectId: 'sub_math',
        assignedInstructorIds: [instructorId],
        status: 'completed',
        files: [
          {
            filename: 'calculus.pdf',
            originalName: 'calculus.pdf',
            size: 10240,
            fileHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
            uploadedAt: new Date()
          }
        ]
      });
      courseId = courseDoc._id.toString();
      await prepareCourseFixture(courseId, t);

      // 3. Create initial draft revision
      const initialDraftTag = `rev_${Date.now()}`;
      await CourseRevision.create({
        courseId: courseDoc._id,
        revisionTag: initialDraftTag,
        contentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        status: 'draft',
        isInstructorReviewed: false,
        topics: initialTopics,
        vectorIndexRef: `faiss/${courseId}/${initialDraftTag}.faiss`
      });

      // 4. Review draft with instructor
      const reviewUpdate = await updateCourseDraft(instructorId, courseId, {
        expectedRevisionTag: initialDraftTag,
        topics: initialTopics,
        isInstructorReviewed: true
      });

      // 5. Publish reviewed revision
      await materializeRevisionFixture(courseId, reviewUpdate.revisionTag);
      const pubResult = await publishCourseRevision(
        instructorId,
        courseId,
        reviewUpdate.revisionTag
      );
      publishedRevisionTag = pubResult.publishedRevisionTag;
      assert.ok(publishedRevisionTag, 'Published revision tag must exist');

      // 6. Enroll student
      await CourseEnrollment.create({
        courseId: courseDoc._id,
        institutionId,
        userId: studentId,
        status: 'active'
      });

      // 7. Create an unpublished course for unpublished test
      const unpubDoc = await Course.create({
        title: 'Draft Only Course',
        scope: 'personal',
        ownerUserId,
        userId: ownerUserId,
        subjectId: 'sub_math'
      });
      unpublishedCourseId = unpubDoc._id.toString();

      await prepareCourseFixture(courseId, t);
    }
  );

  await t.test('2. Enrolled student asks tutor and receives verified citations', async () => {
    mockAiResponseMode = 'verified';

    const res = await request(app)
      .post(`/api/v1/study/courses/${courseId}/tutor/ask`)
      .set('x-test-actor', studentId)
      .send({
        question: 'How do one-sided limits work?'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.hasSufficientEvidence, true);
    assert.equal(res.body.citationsValid, true);
    assert.equal(res.body.status, 'verified');
    assert.equal(res.body.pin.courseId, courseId);
    assert.equal(res.body.pin.revisionId, publishedRevisionTag);
    assert.ok(res.body.citations.length > 0, 'Must have at least one citation');
    assert.equal(res.body.citations[0].verified, true);

    assert.equal(
      res.body.groundingContext,
      undefined,
      'Service-only grounding must not reach browsers'
    );

    // Verify AI request boundary: transmitted authorizedDocumentIds and Bearer token
    const lastReq = receivedAiRequests[receivedAiRequests.length - 1];
    assert.ok(lastReq.headers.authorization?.startsWith('Bearer '));
    assert.equal(lastReq.body.courseId, courseId);
    assert.equal(lastReq.body.revisionId, publishedRevisionTag);
    assert.ok(Array.isArray(lastReq.body.authorizedDocumentIds));
  });

  await t.test('3. Unassigned institutional creator cannot ask tutor', async () => {
    const res = await request(app)
      .post(`/api/v1/study/courses/${courseId}/tutor/ask`)
      .set('x-test-actor', ownerUserId)
      .send({
        question: 'What is covered in topic 1?'
      });

    assert.equal(res.status, 403);
  });

  await t.test('4. Non-enrolled foreign user is rejected with 403 FORBIDDEN', async () => {
    const res = await request(app)
      .post(`/api/v1/study/courses/${courseId}/tutor/ask`)
      .set('x-test-actor', foreignUserId)
      .send({
        question: 'Give me the answers to the exam'
      });

    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'FORBIDDEN');
  });

  await t.test('5. Tutor ask on unpublished course fails with 404 UNPUBLISHED', async () => {
    const res = await request(app)
      .post(`/api/v1/study/courses/${unpublishedCourseId}/tutor/ask`)
      .set('x-test-actor', ownerUserId)
      .send({
        question: 'What is in this draft?'
      });

    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'UNPUBLISHED');
  });

  await t.test(
    '6. Input validation: empty or invalid question returns 400 INVALID_QUESTION',
    async () => {
      const resEmpty = await request(app)
        .post(`/api/v1/study/courses/${courseId}/tutor/ask`)
        .set('x-test-actor', studentId)
        .send({
          question: '   '
        });

      assert.equal(resEmpty.status, 400);
      assert.equal(resEmpty.body.error, 'INVALID_QUESTION');

      const resTooLong = await request(app)
        .post(`/api/v1/study/courses/${courseId}/tutor/ask`)
        .set('x-test-actor', studentId)
        .send({
          question: 'a'.repeat(4001)
        });

      assert.equal(resTooLong.status, 400);
      assert.equal(resTooLong.body.error, 'INVALID_QUESTION');
    }
  );

  await t.test('7. Insufficient evidence marks response as insufficient_evidence', async () => {
    mockAiResponseMode = 'insufficient_evidence';

    const res = await request(app)
      .post(`/api/v1/study/courses/${courseId}/tutor/ask`)
      .set('x-test-actor', studentId)
      .send({
        question: 'Explain quantum mechanics'
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.hasSufficientEvidence, false);
    assert.equal(res.body.status, 'insufficient_evidence');
  });

  await t.test('8. Fabricated citation is rejected as unavailable', async () => {
    mockAiResponseMode = 'fabricated_citation';

    const res = await request(app)
      .post(`/api/v1/study/courses/${courseId}/tutor/ask`)
      .set('x-test-actor', studentId)
      .send({
        question: 'What is the theorem?'
      });

    assert.equal(res.status, 503);
    assert.equal(res.body.error, 'AI_SERVICE_UNAVAILABLE');
  });
});
