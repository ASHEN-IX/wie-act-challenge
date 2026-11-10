import express from 'express';
import request from 'supertest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import * as reviewModule from '../services/formulaReview';
import aiClient from '../../../../shared/aiClient';
import { connectDatabase } from '../../../../shared/database';
import { Course, CourseRevision } from '../models';
import { prisma } from '../../../../shared/database';

const courses = require('../routes/courses');
const hash = (b: Buffer) => 'sha256:' + crypto.createHash('sha256').update(b).digest('hex');
const documentId = 'doc_' + 'b'.repeat(16),
  regionId = 'region_' + 'c'.repeat(20);
const courses_created: string[] = [];
let root: string,
  course: any,
  draft: any,
  published: any,
  documentHash: string,
  publishedSnapshot: string;
const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  const user = req.header('x-test-user');
  if (user) req.user = { userId: user };
  next();
});
app.use('/courses', courses);

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.FORMULA_MOCK_PROVIDER = '1';
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'ednova-proposal-'));
  process.env.INGEST_UPLOADS_DIR = root;
  await fs.mkdir(path.join(root, 'originals'));
  const bytes = Buffer.from('%PDF-1.4\ntest source\n');
  documentHash = hash(bytes);
  await fs.writeFile(path.join(root, 'originals', documentHash.slice(7)), bytes);
  // Tables and indexes come from the Prisma migrations.
  await connectDatabase();
  course = await Course.create({
    userId: 'owner',
    ownerUserId: 'owner',
    scope: 'personal',
    subjectId: 's',
    title: 'Test'
  });
  courses_created.push(String(course.id));
  const manifest = [
    {
      documentId,
      filename: 'test.pdf',
      contentHash: documentHash,
      provenance: 'extracted',
      storageRef: 'originals/' + documentHash.slice(7),
      mediaType: 'application/pdf'
    }
  ];
  draft = await CourseRevision.create({
    courseId: course.id,
    revisionTag: 'rev_test',
    contentHash: documentHash.slice(7),
    status: 'draft',
    isInstructorReviewed: false,
    topics: [{ id: 't', title: 'T' }],
    sourceManifest: manifest
  });
  published = await CourseRevision.create({
    courseId: course.id,
    revisionTag: 'rev_published',
    contentHash: documentHash.slice(7),
    status: 'published',
    isInstructorReviewed: true
  });
  publishedSnapshot = JSON.stringify(await CourseRevision.findById(published.id));
  jest.spyOn(aiClient, 'post').mockImplementation(async (_url, body: any) => {
    if (body.regionId !== regionId) throw { response: { status: 404 } };
    return {
      data: {
        region: {
          documentId,
          documentHash,
          regionId,
          page: 1,
          bbox: [1, 2, 30, 40],
          text: 'x²',
          cropHash: hash(Buffer.from('crop'))
        },
        proposal: {
          provider: 'mock',
          model: 'mock-v1',
          review_disposition: 'pending',
          response: { status: 'proposed', content: 'x^2' },
          validation: { syntax_warnings: [] }
        }
      }
    } as any;
  });
});
afterAll(async () => {
  jest.restoreAllMocks();
  // Rows are scoped by the fixture owner so a shared test database keeps its data.
  await prisma.formulaProposal.deleteMany({ where: { courseId: { in: courses_created } } });
  await prisma.courseRevision.deleteMany({ where: { courseId: { in: courses_created } } });
  await prisma.course.deleteMany({ where: { id: { in: courses_created } } });
  await fs.rm(root, { recursive: true, force: true });
});

it('persists and retrieves authenticated source-bound proposals with idempotency and rejects invalid access', async () => {
  const base = `/courses/${course.id}/drafts/rev_test/formula-proposals`;
  const body = { documentId, regionId, draftVersion: 0 };
  const create = await request(app)
    .post(base + '/test')
    .set('x-test-user', 'owner')
    .send(body);
  expect(create.status).toBe(200);
  expect(create.body.proposal.state).toBe('pending');
  const id = create.body.proposal.id;
  const workspace = await request(app)
    .get(`/courses/${course.id}/drafts/rev_test/formula-workspace`)
    .set('x-test-user', 'owner');
  expect(workspace.status).toBe(200);
  expect(workspace.body.draftVersion).toBe(0);
  expect(workspace.body.canConsent).toBe(true);
  expect(workspace.body.proposals[0].id).toBe(id);
  expect(
    (
      await request(app)
        .get(`/courses/${course.id}/drafts/rev_test/formula-workspace`)
        .set('x-test-user', 'intruder')
    ).status
  ).toBe(403);
  expect(
    (
      await request(app)
        .get(`/courses/${course.id}/drafts/rev_wrong/formula-workspace`)
        .set('x-test-user', 'owner')
    ).status
  ).toBe(409);
  const duplicate = await request(app)
    .post(base + '/test')
    .set('x-test-user', 'owner')
    .send(body);
  expect(duplicate.status).toBe(200);
  expect(duplicate.body.proposal.id).toBe(id);
  const other = await Course.create({
    userId: 'owner',
    ownerUserId: 'owner',
    scope: 'personal',
    subjectId: 's',
    title: 'Other'
  });
  courses_created.push(String(other.id));
  await CourseRevision.create({
    courseId: other.id,
    revisionTag: 'rev_other',
    contentHash: documentHash.slice(7),
    status: 'draft',
    isInstructorReviewed: false,
    topics: [{ id: 't', title: 'T' }],
    sourceManifest: []
  });
  expect(
    (
      await request(app)
        .post(`/courses/${other.id}/drafts/rev_other/formula-proposals/test`)
        .set('x-test-user', 'owner')
        .send(body)
    ).status
  ).toBe(503);
  expect(
    (
      await request(app)
        .get(`/courses/${other.id}/drafts/rev_other/formula-proposals/${id}`)
        .set('x-test-user', 'owner')
    ).status
  ).toBe(404);
  const read = await request(app)
    .get(base + '/' + id)
    .set('x-test-user', 'owner');
  expect(read.status).toBe(200);
  expect(read.body.proposal.documentHash).toBe(documentHash);
  expect(await prisma.formulaProposal.count({ where: { courseId: String(course.id) } })).toBe(1);
  expect((await request(app).get(base + '/' + id)).status).toBe(401);
  expect(
    (
      await request(app)
        .get(base + '/' + id)
        .set('x-test-user', 'intruder')
    ).status
  ).toBe(403);
  expect(
    (
      await request(app)
        .post(base + '/test')
        .set('x-test-user', 'owner')
        .send({ ...body, documentId: 'doc_' + 'd'.repeat(16) })
    ).status
  ).toBe(404);
  expect(
    (
      await request(app)
        .post(base + '/test')
        .set('x-test-user', 'owner')
        .send({ ...body, regionId: 'region_' + 'd'.repeat(20) })
    ).status
  ).toBe(404);
  expect(
    (
      await request(app)
        .post(base + '/test')
        .set('x-test-user', 'owner')
        .send({ ...body, draftVersion: 1 })
    ).status
  ).toBe(409);
  expect(
    (
      await request(app)
        .post(base + '/test')
        .set('x-test-user', 'owner')
        .send({ ...body, latex: 'evil' })
    ).status
  ).toBe(422);
  process.env.FORMULA_MOCK_PROVIDER = '0';
  expect(
    (
      await request(app)
        .post(base + '/test')
        .set('x-test-user', 'owner')
        .send(body)
    ).status
  ).toBe(404);
  process.env.FORMULA_MOCK_PROVIDER = '1';
  await CourseRevision.updateOne({ id: draft.id }, { $inc: { __v: 1 } });
  expect(
    (
      await request(app)
        .get(base + '/' + id)
        .set('x-test-user', 'owner')
    ).status
  ).toBe(409);
  expect((await CourseRevision.findById(published.id))?.__v).toBe(0);
});

it.each(['accept', 'correct', 'reject'])(
  'reviews pending proposal: %s and persists immutable audit history',
  async (action) => {
    const current = await CourseRevision.findOneAndUpdate(
      { id: draft.id },
      { $inc: { __v: 1 } },
      { new: true }
    );
    const version = current!.__v;
    const base = `/courses/${course.id}/drafts/rev_test/formula-proposals`;
    const body = { documentId, regionId, draftVersion: version };
    const [a, b] = await Promise.all([
      request(app)
        .post(base + '/test')
        .set('x-test-user', 'owner')
        .send(body),
      request(app)
        .post(base + '/test')
        .set('x-test-user', 'owner')
        .send(body)
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.proposal.id).toBe(b.body.proposal.id);
    const id = a.body.proposal.id;
    const review = {
      action,
      reviewVersion: 0,
      draftVersion: version,
      ...(action === 'correct' ? { latex: '\\frac{x}{2}' } : {})
    };
    expect(
      (
        await request(app)
          .post(base + '/' + id + '/review')
          .send(review)
      ).status
    ).toBe(401);
    expect(
      (
        await request(app)
          .post(base + '/' + id + '/review')
          .set('x-test-user', 'intruder')
          .send(review)
      ).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .post(base.replace('rev_test', 'rev_wrong') + '/' + id + '/review')
          .set('x-test-user', 'owner')
          .send(review)
      ).status
    ).toBe(409);
    expect(
      (
        await request(app)
          .post(base + '/' + id + '/review')
          .set('x-test-user', 'owner')
          .send({ ...review, draftVersion: (version ?? 0) - 1 })
      ).status
    ).toBe(409);
    for (const latex of [
      '\\frac{',
      '<script>x</script>',
      '\\href{javascript:alert(1)}{x}',
      'x'.repeat(8001)
    ]) {
      expect(
        (
          await request(app)
            .post(base + '/' + id + '/review')
            .set('x-test-user', 'owner')
            .send({ ...review, action: 'correct', latex })
        ).status
      ).toBe(422);
    }
    const results = await Promise.all([
      request(app)
        .post(base + '/' + id + '/review')
        .set('x-test-user', 'owner')
        .send(review),
      request(app)
        .post(base + '/' + id + '/review')
        .set('x-test-user', 'owner')
        .send(review)
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const accepted = results.find((r) => r.status === 200)!.body.proposal;
    expect(accepted.latex).toBe('x^2');
    expect(accepted.sourceText).toBe('x²');
    expect(accepted.cropHash).toBe(a.body.proposal.cropHash);
    expect(accepted.reviewVersion).toBe(1);
    expect(accepted.history).toHaveLength(1);
    expect(accepted.history[0].reviewer).toBe('owner');
    expect(accepted.history[0].previous).toBe('pending');
    expect(accepted.history[0].reviewVersion).toBe(1);
    expect(accepted.history[0].revisionTag).toBe('rev_test');
    if (action === 'correct') expect(accepted.reviewedLatex).toBe('\\frac{x}{2}');
    expect(
      (
        await request(app)
          .post(base + '/' + id + '/review')
          .set('x-test-user', 'owner')
          .send({ ...review, reviewVersion: 1 })
      ).status
    ).toBe(409);
    expect(
      (
        await request(app)
          .get(base + '/' + id + '/history')
          .set('x-test-user', 'intruder')
      ).status
    ).toBe(403);
    const other = await Course.findOne({ title: 'Other' });
    expect(
      (
        await request(app)
          .post(`/courses/${other!.id}/drafts/rev_other/formula-proposals/${id}/review`)
          .set('x-test-user', 'owner')
          .send(review)
      ).status
    ).toBe(404);
    const history = await request(app)
      .get(base + '/' + id + '/history')
      .set('x-test-user', 'owner');
    expect(history.status).toBe(200);
    expect(history.body.history).toEqual(accepted.history);
    const saved = await prisma.formulaProposal.findFirst({
      where: { identity: accepted.identity }
    });
    expect((saved!.history as unknown[]).length).toBe(1);
    expect(saved!.state).toBe(accepted.state);
    const before = await CourseRevision.findById(published.id);
    expect(JSON.stringify(before)).toBe(publishedSnapshot);
    expect(before!.__v).toBe(0);
    expect(before!.status).toBe('published');
  }
);

it('returns conflict if draft changes after the atomic decision; stale record stays inaccessible', async () => {
  const current = await CourseRevision.findOneAndUpdate(
    { id: draft.id },
    { $inc: { __v: 1 } },
    { new: true }
  );
  const base = `/courses/${course.id}/drafts/rev_test/formula-proposals`;
  const created = await request(app)
    .post(base + '/test')
    .set('x-test-user', 'owner')
    .send({ documentId, regionId, draftVersion: current!.__v });
  expect(created.status).toBe(200);
  const original = reviewModule.ensureSnapshot;
  let checks = 0;
  const spy = jest
    .spyOn(reviewModule, 'ensureSnapshot')
    .mockImplementation(async (actor, snapshot) => {
      if (++checks === 2) await CourseRevision.updateOne({ id: draft.id }, { $inc: { __v: 1 } });
      await original(actor, snapshot);
    });
  try {
    const response = await request(app)
      .post(base + '/' + created.body.proposal.id + '/review')
      .set('x-test-user', 'owner')
      .send({ action: 'accept', reviewVersion: 0, draftVersion: current!.__v });
    expect(response.status).toBe(409);
    expect(
      (
        await request(app)
          .get(base + '/' + created.body.proposal.id)
          .set('x-test-user', 'owner')
      ).status
    ).toBe(409);
  } finally {
    spy.mockRestore();
  }
});
