/** Phase 2 mixed-content demo, prepared and published through the real source
 * artifact and publication paths. Development only; identity is deterministic
 * so a re-run updates the same demo course instead of creating duplicates. */
import { config } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { Prisma } from '../src/generated/prisma/client';
import { connectDatabase, disconnectDatabase, prisma } from '../shared/database';
import { newId } from '../shared/ids';
import {
  contentHash,
  prepareRevisionSources,
  sourceRoots,
  verifyRevisionArtifact
} from '../modules/study/src/services/revisionSources';
import { publishCourseRevision } from '../modules/study/src/services/coursePublication';
import { PHASE2_CORPUS } from '../fixtures/ednova-phase2-corpus';

config({ path: path.resolve(__dirname, '../.env') });

export const PHASE2_COURSE_TITLE = 'Phase 2 Demo: Mathematics, Code and Networks';
const DEMO_REVISION_PREFIX = 'rev_phase2_demo_';

const FILES = [
  { name: '01-mathematics.md', subject: 'mathematics' },
  { name: '02-programming.md', subject: 'programming' },
  { name: '03-networking.md', subject: 'networking' },
  { name: '04-science.md', subject: 'science' },
  { name: '05-mixed.md', subject: 'mixed' }
] as const;

const TOPICS = [
  {
    id: 'mathematics',
    title: 'Mathematics: quadratic equations',
    description: 'Read a quadratic formula and interpret the discriminant.',
    subtopics: [
      {
        id: 'quadratic-equations',
        title: 'Formula and discriminant',
        summary: 'The sign of the discriminant determines the number of real solutions.',
        learning_objectives: [
          {
            id: 'obj-quadratic-discriminant',
            statement: 'Interpret the discriminant of a quadratic equation',
            bloomLevel: 'understand'
          }
        ]
      }
    ]
  },
  {
    id: 'programming',
    title: 'Programming: binary search',
    description: 'Trace a binary search and compare logarithmic growth with linear growth.',
    subtopics: [
      {
        id: 'binary-search',
        title: 'Search by halving the interval',
        summary:
          'Binary search requires sorted input and removes half the remaining range each step.',
        learning_objectives: [
          {
            id: 'obj-binary-search',
            statement: 'Trace the interval used by binary search',
            bloomLevel: 'apply'
          }
        ]
      }
    ]
  },
  {
    id: 'networking',
    title: 'Networking: the TCP handshake',
    description: 'Read the ordered exchange that opens a TCP connection.',
    subtopics: [
      {
        id: 'handshake',
        title: 'Opening a connection',
        summary: 'The client and server exchange SYN, SYN-ACK and ACK before transferring data.',
        learning_objectives: [
          {
            id: 'obj-tcp-handshake',
            statement: 'Order the messages in a TCP connection handshake',
            bloomLevel: 'understand'
          }
        ]
      }
    ]
  },
  {
    id: 'science',
    title: 'Science: photosynthesis',
    description: 'Connect the overall reaction to light intensity and oxygen release.',
    subtopics: [
      {
        id: 'photosynthesis',
        title: 'Converting light into stored energy',
        summary:
          'Photosynthesis consumes carbon dioxide and water and produces glucose and oxygen.',
        learning_objectives: [
          {
            id: 'obj-photosynthesis',
            statement: 'Read the overall equation for photosynthesis',
            bloomLevel: 'understand'
          }
        ]
      }
    ]
  },
  {
    id: 'systems',
    title: 'Mixed systems: trust boundaries',
    description: 'Trace a request across a trusted processing boundary.',
    subtopics: [
      {
        id: 'boundaries',
        title: 'Authenticate before processing',
        summary: 'Structured data and source evidence stay separate from generated experiences.',
        learning_objectives: [
          {
            id: 'obj-system-boundary',
            statement: 'Describe the order of checks at a request boundary',
            bloomLevel: 'analyze'
          }
        ]
      }
    ]
  }
];

async function userFor(email: string): Promise<string> {
  const user = await prisma.authUser.findUnique({ where: { email }, select: { id: true } });
  if (!user) throw new Error(`Missing ${email}; run seed:learning-demo first`);
  return user.id;
}

async function main() {
  if (process.env.ALLOW_DEMO_COURSES !== '1') {
    console.log(
      'Demo data is disabled. Upload your own course, or explicitly set ALLOW_DEMO_COURSES=1 in a disposable development database.'
    );
    return;
  }
  const url = process.env.DATABASE_URL;
  if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname))
    throw new Error('Phase 2 demo requires a loopback PostgreSQL database');
  if (process.env.NODE_ENV === 'production')
    throw new Error('Phase 2 demo seeding is development only');
  await connectDatabase();
  try {
    const instructor = await userFor('instructor@ednova.test');
    const learner = await userFor('learner@ednova.test');
    const institution = await prisma.institution.findUnique({
      where: { slug: 'ednova-learning-demo' },
      select: { id: true }
    });
    if (!institution) throw new Error('Missing demo institution; run seed:learning-demo first');

    let subject = await prisma.subject.findFirst({
      where: { userId: instructor, name: 'Applied Systems' },
      select: { id: true }
    });
    if (!subject) {
      subject = await prisma.subject.create({
        data: {
          id: newId(),
          userId: instructor,
          name: 'Applied Systems',
          description: 'Mathematics, programming, networking and science in one lesson.',
          color: '#2563eb'
        },
        select: { id: true }
      });
    }

    let course = await prisma.course.findFirst({
      where: { ownerUserId: instructor, title: PHASE2_COURSE_TITLE }
    });
    if (!course) {
      course = await prisma.course.create({
        data: {
          id: newId(),
          title: PHASE2_COURSE_TITLE,
          description:
            'Representative mixed-content course: formulas, source tables, code highlighting, an evidence-backed chart, a walkthrough diagram and a safe media fallback.',
          subjectId: subject.id,
          userId: instructor,
          ownerUserId: instructor,
          assignedInstructorIds: [instructor],
          institutionId: institution.id,
          scope: 'institutional',
          status: 'processing',
          topics: TOPICS as Prisma.InputJsonValue
        }
      });
    }

    const courseId = course.id;
    const uploadDir = path.join(sourceRoots().uploads, 'courses', courseId);
    await fs.mkdir(uploadDir, { recursive: true });
    const files = [];
    for (const [index, entry] of FILES.entries()) {
      const text = PHASE2_CORPUS[entry.subject];
      const bytes = Buffer.from(text, 'utf8');
      const extension = path.extname(entry.name);
      const filename = `${String(index + 1).padStart(2, '0')}-${contentHash(bytes).slice(7, 23)}${extension}`;
      await fs.writeFile(path.join(uploadDir, filename), bytes);
      files.push({
        filename,
        originalName: entry.name,
        size: bytes.length,
        fileHash: contentHash(bytes).replace(/^sha256:/, ''),
        uploadedAt: new Date().toISOString()
      });
    }
    await prisma.course.update({
      where: { id: courseId },
      data: { files: files as unknown as Prisma.InputJsonValue }
    });

    // Revision identity is content-derived. Re-running unchanged sources reuses
    // the same published revision; changing bytes creates a new draft rather
    // than replacing a prepared artifact or its index.
    const sourceDigest = crypto
      .createHash('sha256')
      .update(
        files
          .map((file) => file.fileHash)
          .sort()
          .join(':')
      )
      .digest('hex');
    const revisionTag = DEMO_REVISION_PREFIX + sourceDigest.slice(0, 20);

    let revision = await prisma.courseRevision.findFirst({
      where: { courseId, revisionTag }
    });
    if (!revision) {
      revision = await prisma.courseRevision.create({
        data: {
          id: newId(),
          courseId,
          revisionTag,
          contentHash: sourceDigest,
          status: 'draft',
          isInstructorReviewed: true,
          summary:
            'A mixed-subject demonstration of deterministic source extraction and the trusted EdNova reader.',
          topics: TOPICS as Prisma.InputJsonValue
        }
      });
    } else if (revision.status === 'draft') {
      revision = await prisma.courseRevision.update({
        where: { id: revision.id },
        data: { isInstructorReviewed: true, topics: TOPICS as Prisma.InputJsonValue }
      });
    }

    if (revision.status === 'draft' && revision.activationState !== 'prepared') {
      await prepareRevisionSources(instructor, courseId, revisionTag);
    }
    const stored = await prisma.courseRevision.findFirst({ where: { courseId, revisionTag } });
    if (!stored) throw new Error('Published demo revision disappeared');
    const verified = await verifyRevisionArtifact(stored as never);
    let storedTopics = (stored.topics ?? []) as Array<Record<string, unknown>>;
    if (revision.status === 'draft') {
      // Bind evidence while the revision is still a reviewable draft. The
      // published artifact and its source hashes remain untouched afterward.
      const courseFiles = (course.files ?? []) as Array<{
        filename?: string;
        originalName?: string;
      }>;
      const byOriginalName = new Map(
        courseFiles.flatMap((file) =>
          file.filename && file.originalName ? [[file.originalName, file.filename] as const] : []
        )
      );
      const byDocument = new Map(
        verified.metadata.documents.map((doc) => [doc.filename, doc.documentId] as const)
      );
      const withSpans = TOPICS.map((topic) => {
        const sourceSubject = topic.id === 'systems' ? 'mixed' : topic.id;
        const entry = FILES.find((file) => sourceSubject === file.subject);
        if (!entry) throw new Error(`Missing demo topic source ${topic.id}`);
        const storedFilename = byOriginalName.get(entry.name);
        const documentId = storedFilename ? byDocument.get(storedFilename) : undefined;
        if (!documentId) throw new Error(`Missing verified demo document ${entry.name}`);
        const passage = verified.passages.find((item) => item.documentId === documentId);
        if (!passage) throw new Error(`Missing verified passage for ${entry.name}`);
        return {
          ...topic,
          subtopics: topic.subtopics.map((subtopic) => ({
            ...subtopic,
            source_spans: [
              {
                chunkId: passage.chunkId,
                documentId: passage.documentId,
                pageNumber: passage.pageNumber,
                lineStart: 1,
                lineEnd: passage.text.split(/\r?\n/).length
              }
            ]
          }))
        };
      });
      // Source preparation freezes the manifest/index, not the reviewable
      // curriculum. Attach spans while the reviewed draft is still draft.
      const changed = await prisma.courseRevision.updateMany({
        where: { id: stored.id, status: 'draft' },
        data: { topics: withSpans as unknown as Prisma.InputJsonValue }
      });
      if (!changed.count)
        throw new Error('Demo draft changed while attaching verified source spans');
      storedTopics = withSpans;
    }
    const published = await publishCourseRevision(instructor, courseId, revisionTag);
    await prisma.course.update({
      where: { id: courseId },
      data: {
        topics: storedTopics as unknown as Prisma.InputJsonValue,
        status: 'completed',
        ingestProgress: 1,
        ingestDetail: 'Published from verified Phase 2 demo sources',
        activeRevisionId: revisionTag
      }
    });
    await prisma.courseEnrollment.upsert({
      where: { courseId_userId: { courseId, userId: learner } },
      update: {
        institutionId: institution.id,
        status: 'active',
        enrolledByUserId: instructor
      },
      create: {
        id: newId(),
        courseId,
        userId: learner,
        institutionId: institution.id,
        status: 'active',
        enrolledByUserId: instructor,
        enrolledAt: new Date()
      }
    });
    console.log(`Phase 2 demo ready: ${courseId}`);
    console.log(`Revision: ${published.publishedRevisionTag}`);
    console.log(`Learner enrolled: learner@ednova.test`);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Phase 2 demo seed failed');
  process.exitCode = 1;
});
