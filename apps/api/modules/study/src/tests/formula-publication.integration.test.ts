import mongoose from 'mongoose';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import aiClient from '../../../../shared/aiClient';
import { Course, CourseRevision } from '../models';
import { FormulaProposal } from '../models/FormulaProposal';
import { getCourseDraft } from '../services/courseDraft';
import { getLearningDocument } from '../services/courseReader';
import { getPublishedPresentation } from '../services/presentationReader';
import { publishCourseRevision } from '../services/coursePublication';
import { activityDigest } from '../services/activityIdentity';
import {
  verifyRevisionArtifact,
  canonicalUnitsForIndex,
  prepareRevisionSources
} from '../services/revisionSources';
const hash = (b: Buffer | string) =>
  'sha256:' + crypto.createHash('sha256').update(b).digest('hex');
let root: string, course: any, draft: any, doc: any;
const rids = Array.from({ length: 4 }, (_, i) => 'region_' + String(i + 1).repeat(20));
const canonical = (courseId: string) => ({
  schemaVersion: '1.0.0',
  courseId,
  title: 'Math',
  provenance: { content: 'extracted', structure: 'deterministic' },
  verification: 'source_text_unverified',
  chapters: [
    {
      id: 'chapter',
      title: 'Chapter',
      lessons: [
        {
          id: 'lesson',
          title: 'Lesson',
          summary: '',
          source_spans: [
            {
              chunkId: 'chunk',
              documentId: doc.documentId,
              pageNumber: 1,
              lineStart: 1,
              lineEnd: 1
            }
          ],
          blocks: [
            {
              id: 'source',
              type: 'source_lesson',
              text: 'Original x1 x2 x3 x4',
              evidence: [
                {
                  chunkId: 'chunk',
                  documentId: doc.documentId,
                  pageNumber: 1,
                  lineStart: 1,
                  lineEnd: 1
                }
              ]
            },
            ...rids.map((id, i) => ({
              id: 'block' + i,
              type: 'math',
              regionId: id,
              page: 1,
              bbox: [1, 2, 30, 40],
              expression: 'x' + (i + 1),
              notation: 'plain',
              evidence: [
                {
                  chunkId: 'chunk',
                  documentId: doc.documentId,
                  pageNumber: 1,
                  lineStart: 1,
                  lineEnd: 1
                }
              ]
            }))
          ]
        }
      ]
    }
  ]
});
beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'formula-pub-'));
  process.env.INGEST_UPLOADS_DIR = root;
  process.env.FAISS_INDEX_DIR = path.join(root, 'indexes');
  await fs.mkdir(path.join(root, 'originals'));
  const bytes = Buffer.from('%PDF-1.4\nfixture');
  const h = hash(bytes);
  doc = {
    documentId: 'doc_' + h.slice(7, 23),
    filename: 'math.pdf',
    contentHash: h,
    provenance: 'extracted',
    storageRef: 'originals/' + h.slice(7),
    mediaType: 'application/pdf'
  };
  await fs.writeFile(path.join(root, doc.storageRef), bytes);
  await mongoose.connect('mongodb://127.0.0.1:27017/test_formula_pub_' + process.pid);
  jest.spyOn(aiClient, 'post').mockImplementation(async (url, body: any) => {
    if (url.endsWith('region-inspect'))
      return {
        data: {
          documentHash: doc.contentHash,
          cropHash: 'sha256:' + 'c'.repeat(64),
          regionId: body.regionId,
          page: 1,
          bbox: [1, 2, 30, 40]
        }
      } as any;
    if (!url.endsWith('/index')) throw Error('Unexpected outbound operation');
    const chunks = body.units.map((u: any) => u.text);
    const index = await fs.readFile(
      path.resolve(
        chunks.length === 1
          ? 'tests/fixtures/p0r2-one-vector.faiss'
          : 'tests/fixtures/formula-three-vectors.faiss'
      )
    );
    const meta = {
      schemaVersion: '1.0.0',
      courseId: body.courseId,
      revisionId: body.revisionId,
      contentHash: body.contentHash,
      documents: body.documents,
      manifestDigest: body.manifestDigest,
      indexHash: hash(index),
      chunks,
      metas: chunks.map((text: string, i: number) => ({
        representation: body.units[i].formulaReview ? 'instructor_reviewed' : 'source_extraction',
        formula_review: body.units[i].formulaReview,
        course_id: body.courseId,
        revision_id: body.revisionId,
        document_id: doc.documentId,
        content_hash: doc.contentHash,
        text_hash: hash(text),
        chunk_id: 'chk_' + hash(text).slice(7),
        page_number: 1,
        section_id: 'lesson',
        provenance: 'extracted'
      }))
    };
    expect([1, 3]).toContain(chunks.length);
    const dest = path.join(process.env.FAISS_INDEX_DIR!, body.courseId, body.revisionId);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest + '.faiss', index, { flag: 'wx' });
    await fs.writeFile(dest + '.meta.json', JSON.stringify(meta), { flag: 'wx' });
    return { data: { ready: true } } as any;
  });
});
afterAll(async () => {
  jest.restoreAllMocks();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await fs.rm(root, { recursive: true, force: true });
});
beforeEach(async () => {
  course = await Course.create({
    userId: 'owner',
    subjectId: 'math',
    title: 'Math',
    files: [{ filename: 'math.pdf', fileHash: doc.contentHash.slice(7), size: 16 }]
  });
  const c = canonical(String(course._id));
  draft = await CourseRevision.create({
    courseId: course._id,
    revisionTag: 'rev_source',
    status: 'draft',
    contentHash: 'a'.repeat(64),
    topics: [{ id: 'chapter', title: 'Chapter' }],
    isInstructorReviewed: true,
    contentDocument: c,
    contentDocumentHash: activityDigest(c),
    sourceManifest: [doc]
  });
  for (let i = 0; i < 4; i++) {
    const state = ['accepted', 'corrected', 'rejected', 'pending'][i];
    await FormulaProposal.create({
      courseId: course._id,
      revisionId: draft._id,
      revisionTag: draft.revisionTag,
      draftVersion: 0,
      documentId: doc.documentId,
      documentHash: doc.contentHash,
      regionId: rids[i],
      page: 1,
      bbox: [1, 2, 30, 40],
      sourceText: 'x' + (i + 1),
      cropHash: 'sha256:' + 'c'.repeat(64),
      provider: 'mock',
      model: 'mock-v1',
      latex: 's_' + (i + 1),
      reviewedLatex: i === 1 ? 's_2^{2}' : i === 0 ? 's_1' : undefined,
      state,
      reviewVersion: state === 'pending' ? 0 : 1,
      identity: String(course._id) + '-' + i,
      history:
        state === 'pending'
          ? []
          : [
              {
                reviewer: 'owner',
                action: state,
                previous: 'pending',
                next: state,
                expression: i === 1 ? 's_2^{2}' : undefined,
                draftVersion: 0,
                revisionTag: draft.revisionTag,
                revisionId: String(draft._id),
                reviewVersion: 1,
                at: new Date()
              }
            ]
    });
  }
});
it('freezes accepted/corrected expressions, leaves rejected/pending source, and indexes the same snapshot', async () => {
  const result = await publishCourseRevision('owner', String(course._id), 'rev_source');
  expect(result.publishedRevisionTag).toMatch(/^rev_formula_/);
  const published: any = await CourseRevision.findOne({
    courseId: course._id,
    revisionTag: result.publishedRevisionTag
  }).lean();
  const blocks = published.contentDocument.chapters[0].lessons[0].blocks;
  expect(blocks[1].expression).toBe('x1');
  expect(blocks[1].reviewedFormula.expression).toBe('s_1');
  expect(blocks[2].reviewedFormula.expression).toBe('s_2^{2}');
  expect(blocks[3].reviewedFormula).toBeUndefined();
  expect(blocks[4].reviewedFormula).toBeUndefined();
  const artifact = await verifyRevisionArtifact(published);
  expect(artifact.metadata.revisionId).toBe(published.revisionTag);
  expect(artifact.metadata.chunks.join('\n')).toContain('s_2^{2}');
  expect(artifact.metadata.chunks.join('\n')).not.toContain('s_4');
  expect(
    artifact.metadata.metas.filter((m: any) => m.representation === 'instructor_reviewed')
  ).toHaveLength(2);
  const reader = await getLearningDocument('owner', String(course._id), published.revisionTag);
  const math: any[] = reader.sections.flatMap((s) => s.blocks).filter((b) => b.type === 'math');
  expect(math.map((b) => b.expression)).toEqual(['s_1', 's_2^{2}', 'x3', 'x4']);
  expect(math[0].review.state).toBe('accepted');

  const presentation = await getPublishedPresentation(
    'owner',
    String(course._id),
    published.revisionTag
  );
  expect(presentation.courseId).toBe(String(course._id));
  expect(presentation.revisionId).toBe(published.revisionTag);
  // The context formats the stored source hash; the canonical hash is the
  // checksum actually re-verified before projection.
  expect(presentation.contentHash).toBe('sha256:' + published.contentHash);
  expect(presentation.canonicalContentHash).toBe(published.contentDocumentHash);
  expect(presentation.chapters[0].lessons[0].title).toBe('Lesson');
  const projected = presentation.chapters
    .flatMap((chapter) => chapter.lessons)
    .flatMap((lesson) => lesson.blocks);
  expect(projected.map((entry) => entry.block.id)).toEqual(['block0', 'block1', 'block2', 'block3']);
  expect(projected.map((entry) => entry.reason)).toEqual([
    'reviewed_formula',
    'reviewed_formula',
    'unreviewed_formula',
    'unreviewed_formula'
  ]);
  expect(projected.map((entry) => entry.render)).toEqual([
    'primary',
    'primary',
    'source_faithful',
    'source_faithful'
  ]);
  expect(presentation.verification).toEqual({
    status: 'partially_reviewed',
    math: { total: 4, reviewed: 2, sourceFallback: 2 },
    disclosure: expect.stringContaining('not semantically verified')
  });
  // No internal review payload or server path leaks through the projection.
  expect(JSON.stringify(presentation)).not.toMatch(/reviewedFormula|sourceDraftId|\/tmp\//);
  const original = JSON.stringify(published);
  await FormulaProposal.updateMany(
    { courseId: course._id },
    { $set: { reviewedLatex: 'tamper', state: 'rejected' } }
  );
  expect(JSON.stringify(await CourseRevision.findById(published._id).lean())).toBe(original);
  const again = await publishCourseRevision('owner', String(course._id), 'rev_source');
  expect(again.publishedRevisionTag).toBe(published.revisionTag);
  expect((await CourseRevision.findById(draft._id).lean())!.contentDocument).toEqual(
    draft.contentDocument
  );
});
it('rejects unauthorized publication and changed crop identity', async () => {
  await expect(
    publishCourseRevision('other', String(course._id), 'rev_source')
  ).rejects.toMatchObject({ status: 403 });
  await FormulaProposal.updateOne(
    { courseId: course._id, state: 'accepted' },
    { $set: { cropHash: 'sha256:' + 'd'.repeat(64) } }
  );
  await expect(
    publishCourseRevision('owner', String(course._id), 'rev_source')
  ).rejects.toMatchObject({ status: 409 });
});
it('excludes old snapshots and refuses unsafe reviewed expressions', async () => {
  await FormulaProposal.updateMany({ courseId: course._id }, { $set: { draftVersion: 99 } });
  expect(
    (
      await FormulaProposal.find({
        courseId: course._id,
        draftVersion: 0,
        state: { $in: ['accepted', 'corrected'] }
      })
    ).length
  ).toBe(0);
  await FormulaProposal.updateOne(
    { courseId: course._id, state: 'accepted' },
    { $set: { draftVersion: 0, reviewedLatex: '\\input{bad}', latex: '\\input{bad}' } }
  );
  await expect(
    publishCourseRevision('owner', String(course._id), 'rev_source')
  ).rejects.toMatchObject({ status: 422 });
});
it('a concurrent draft edit cannot enter the frozen publication snapshot', async () => {
  const originalPost = aiClient.post;
  const implementation = jest.mocked(originalPost).getMockImplementation()!;
  let changed = false;
  jest.mocked(aiClient.post).mockImplementation(async (...args: any[]) => {
    const result = await (implementation as any)(...args);
    if (!changed && args[0].endsWith('region-inspect')) {
      changed = true;
      await CourseRevision.updateOne(
        { _id: draft._id },
        { $inc: { __v: 1 }, $set: { revisionTag: 'rev_changed' } }
      );
    }
    return result;
  });
  try {
    await expect(
      publishCourseRevision('owner', String(course._id), 'rev_source')
    ).rejects.toMatchObject({ status: 409 });
    expect(await CourseRevision.countDocuments({ courseId: course._id, status: 'published' })).toBe(
      0
    );
  } finally {
    jest.mocked(aiClient.post).mockImplementation(implementation);
  }
});

it('fresh drafts do not inherit old formula approvals and old published content/indexes remain unchanged', async () => {
  const first = await publishCourseRevision('owner', String(course._id), 'rev_source');
  const old: any = await CourseRevision.findOne({
    courseId: course._id,
    revisionTag: first.publishedRevisionTag
  }).lean();
  const oldCanonical = JSON.stringify(old.contentDocument);
  const indexPath = path.join(
    process.env.FAISS_INDEX_DIR!,
    String(course._id),
    first.publishedRevisionTag
  );
  const oldIndex = await fs.readFile(indexPath + '.faiss'),
    oldMeta = await fs.readFile(indexPath + '.meta.json');
  const fresh = await getCourseDraft('owner', String(course._id));
  const row: any = await CourseRevision.findOne({
    courseId: course._id,
    revisionTag: fresh.revisionTag
  }).lean();
  expect(
    row.contentDocument.chapters[0].lessons[0].blocks.every((b: any) => !b.reviewedFormula)
  ).toBe(true);
  await CourseRevision.updateOne({ _id: row._id }, { $set: { isInstructorReviewed: true } });
  await prepareRevisionSources('owner', String(course._id), fresh.revisionTag);
  const second = await publishCourseRevision('owner', String(course._id), fresh.revisionTag);
  expect(second.publishedRevisionTag).toBe(fresh.revisionTag);
  const older: any = await CourseRevision.findById(old._id).lean();
  expect(JSON.stringify(older.contentDocument)).toBe(oldCanonical);
  expect((await fs.readFile(indexPath + '.faiss')).equals(oldIndex)).toBe(true);
  expect((await fs.readFile(indexPath + '.meta.json')).equals(oldMeta)).toBe(true);
  const reader = await getLearningDocument(
    'owner',
    String(course._id),
    second.publishedRevisionTag
  );
  expect(
    reader.sections
      .flatMap((s) => s.blocks)
      .filter((b) => b.type === 'math')
      .every((b: any) => !b.review && b.notation === 'plain')
  ).toBe(true);
});
it('concurrent publish commands cannot create two publication snapshots for the same frozen source', async () => {
  const results = await Promise.allSettled([
    publishCourseRevision('owner', String(course._id), 'rev_source'),
    publishCourseRevision('owner', String(course._id), 'rev_source')
  ]);
  expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
  expect(await CourseRevision.countDocuments({ courseId: course._id, status: 'published' })).toBe(
    1
  );
});

it('recovers exact publication receipt after indexing fails without changing source or selecting later proposals', async () => {
  const post = aiClient.post as jest.Mock;
  const original = post.getMockImplementation()!;
  let failIndex = true;
  post.mockImplementation(async (url: string, body: any, ...rest: any[]) => {
    if (failIndex && url.endsWith('/index')) { failIndex = false; throw new Error('isolated index outage'); }
    return original(url, body, ...rest);
  });
  await expect(publishCourseRevision('owner', String(course._id), 'rev_source')).rejects.toBeDefined();
  const frozen: any = await CourseRevision.findById(draft._id).lean();
  expect(frozen.activationState).toBe('prepared');
  expect(frozen.contentDocument).toEqual(draft.contentDocument);
  const targetTag = frozen.formulaPublication.targetTag;
  // Later mutable records cannot replace the already captured review set.
  await FormulaProposal.updateMany({ courseId: course._id }, { $set: { reviewedLatex: 'late mutation' } });
  const result = await publishCourseRevision('owner', String(course._id), 'rev_source');
  expect(result.publishedRevisionTag).toBe(targetTag);
  const published: any = await CourseRevision.findOne({ courseId: course._id, revisionTag: targetTag }).lean();
  expect(published.contentDocument.chapters[0].lessons[0].blocks[1].reviewedFormula.expression).toBe('s_1');
  expect((await verifyRevisionArtifact(published)).metadata.revisionId).toBe(targetTag);
});
