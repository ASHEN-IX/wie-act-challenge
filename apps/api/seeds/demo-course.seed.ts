/**
 * Dev-only demo course: a synthetic normalization text, prepared and indexed through the
 * real source pipeline, with reviewed quizzes published for the demo learner.
 *
 * Requires the learning-demo seed first (instructor@ednova.test and learner@ednova.test).
 * Loopback PostgreSQL only. Idempotent: an existing demo course is reported, not duplicated.
 */
import { config } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { Prisma } from '../src/generated/prisma/client';
import { connectDatabase, disconnectDatabase, prisma } from '../shared/database';
import { newId } from '../shared/ids';
import { prepareRevisionSources } from '../modules/study/src/services/revisionSources';
import { sourceRoots, contentHash } from '../modules/study/src/services/revisionSources';
import { generateActivityCandidate } from '../modules/study/src/services/courseStudio';
import { registerActivity } from '../modules/study/src/services/activityAttempt';
import { publishCourseRevision } from '../modules/study/src/services/coursePublication';

config({ path: path.resolve(__dirname, '../.env') });

const COURSE_TITLE = 'Demo: Database normalization basics';
const REVISION_TAG = 'rev_demo_1';
const FILENAME = 'normalization-notes.txt';

// Synthetic teaching text written for this demo. It is not taken from any external source.
const SOURCE_TEXT = [
  'Normalization organizes a relational table so that each fact is stored once.',
  'First normal form (1NF) requires every column to hold atomic values. A column must not contain a list, a set or repeating groups, so a phone list is split into separate rows or a related table.',
  'Second normal form (2NF) applies to tables with a composite primary key. Every non-key column must depend on the whole key, not on part of it. A column that depends only on the student id in an enrollment table breaks 2NF.',
  'Third normal form (3NF) requires that non-key columns depend only on the key. If a city depends on a postal code, and the postal code depends on the student, the city belongs in its own table.',
  'A primary key uniquely identifies each row, but uniqueness alone does not make a table atomic. Atomicity is about the values inside each column, while keys are about row identity.',
  'Normalization can make writes safer because each fact changes in one place. Denormalization is a deliberate trade-off for read speed and must be justified.'
].join('\n');

const OBJECTIVES = [
  {
    id: 'obj-1nf-atomic',
    statement: 'Identify values that break first normal form',
    bloomLevel: 'understand'
  },
  {
    id: 'obj-2nf-dependency',
    statement: 'Explain partial dependency on a composite key',
    bloomLevel: 'understand'
  }
];

// Topic outline on the course record, so course lists show what the course covers.
const COURSE_TOPICS = [
  {
    title: 'Normalization',
    subtopics: [
      {
        id: 'sub-normalization',
        title: 'Normal forms',
        summary: 'First, second and third normal form and why each fact is stored once.',
        key_concepts: ['atomic values', 'composite key', 'transitive dependency'],
        learning_objectives: OBJECTIVES
      }
    ]
  }
];

async function userIdFor(email: string): Promise<string> {
  const identity = await prisma.authUser.findUnique({
    where: { email },
    select: { id: true }
  });
  if (!identity) throw new Error(`Missing demo account ${email}; run seed:learning-demo first`);
  return identity.id;
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
    throw new Error('Demo course seeding requires a loopback PostgreSQL database');
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seeding is development only');

  await connectDatabase();
  try {
    const instructor = await userIdFor('instructor@ednova.test');
    const learners = [await userIdFor('learner@ednova.test'), await userIdFor('peer@ednova.test')];

    // Personal courses are owner-only, so learners need an institutional course:
    // active membership in the demo institution plus an active enrollment.
    const institution = await prisma.institution.findUnique({
      where: { slug: 'ednova-learning-demo' },
      select: { id: true }
    });
    if (!institution) throw new Error('Missing demo institution; run seed:learning-demo first');

    const enrollLearners = async (courseId: string) => {
      for (const userId of learners) {
        await prisma.courseEnrollment.upsert({
          where: { courseId_userId: { courseId, userId } },
          update: {
            institutionId: institution.id,
            status: 'active',
            enrolledByUserId: instructor
          },
          create: {
            id: newId(),
            courseId,
            userId,
            institutionId: institution.id,
            status: 'active',
            enrolledByUserId: instructor,
            enrolledAt: new Date()
          }
        });
      }
    };

    const existing = await prisma.course.findFirst({
      where: { ownerUserId: instructor, title: COURSE_TITLE },
      select: { id: true, topics: true }
    });
    if (existing) {
      await enrollLearners(existing.id);
      const hasObjectives =
        Array.isArray(existing.topics) &&
        (existing.topics as Array<Record<string, unknown>>).some(
          (topic) =>
            Array.isArray(topic.subtopics) &&
            (topic.subtopics as Array<Record<string, unknown>>).some(
              (subtopic) =>
                Array.isArray(subtopic.learning_objectives) && subtopic.learning_objectives.length
            )
        );
      if (!hasObjectives)
        await prisma.course.update({
          where: { id: existing.id },
          data: { topics: COURSE_TOPICS as Prisma.InputJsonValue }
        });
      console.log(`Demo course already exists: ${existing.id}`);
      console.log('Demo learners are enrolled.');
      return;
    }

    const bytes = Buffer.from(SOURCE_TEXT, 'utf8');
    const fileHash = contentHash(bytes).replace(/^sha256:/, '');
    const courseId = newId();
    await prisma.course.create({
      data: {
        id: courseId,
        title: COURSE_TITLE,
        description: 'Synthetic demo course for the learning workspace.',
        subjectId: 'demo',
        userId: instructor,
        ownerUserId: instructor,
        scope: 'institutional',
        institutionId: institution.id,
        assignedInstructorIds: [instructor],
        status: 'completed',
        topics: COURSE_TOPICS as Prisma.InputJsonValue,
        files: [
          {
            filename: FILENAME,
            originalName: FILENAME,
            size: bytes.length,
            fileHash,
            uploadedAt: new Date().toISOString()
          }
        ] as Prisma.InputJsonValue
      }
    });

    // Same bytes-on-disk layout the upload route writes: uploads/courses/<courseId>/<filename>.
    const courseDir = path.join(sourceRoots().uploads, 'courses', courseId);
    await fs.mkdir(courseDir, { recursive: true });
    await fs.writeFile(path.join(courseDir, FILENAME), bytes);

    const topics = [
      {
        title: 'Normalization',
        subtopics: [
          {
            id: 'sub-normalization',
            title: 'Normal forms',
            learning_objectives: OBJECTIVES
          }
        ]
      }
    ];
    await prisma.courseRevision.create({
      data: {
        id: newId(),
        courseId,
        revisionTag: REVISION_TAG,
        contentHash: crypto.createHash('sha256').update(JSON.stringify(topics)).digest('hex'),
        status: 'draft',
        isInstructorReviewed: true,
        topics: topics as Prisma.InputJsonValue
      }
    });

    await prepareRevisionSources(instructor, courseId, REVISION_TAG);
    for (const objective of OBJECTIVES) {
      const candidate = await generateActivityCandidate(instructor, courseId, {
        objectiveId: objective.id,
        activityType: 'InteractiveQuiz'
      });
      await registerActivity(
        instructor,
        courseId,
        candidate.candidateActivity,
        candidate.candidateEvaluation
      );
    }
    await publishCourseRevision(instructor, courseId, REVISION_TAG);

    await enrollLearners(courseId);
    console.log(`Demo course ready: ${courseId}`);
    console.log('Learner and peer demo accounts are enrolled.');
  } finally {
    await disconnectDatabase();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Demo course seed failed');
  process.exitCode = 1;
});
