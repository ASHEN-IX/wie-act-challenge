import { config } from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Prisma } from '../src/generated/prisma/client';
import { connectDatabase, disconnectDatabase, prisma } from '../shared/database';
import { newId } from '../shared/ids';
import { createAuth, defaultNotificationPreferences } from '../shared/betterAuth';
import aiClient from '../shared/aiClient';
import {
  contentHash,
  manifestDigest,
  sourceRoots,
  type SourceDocument
} from '../modules/study/src/services/revisionSources';
import { activityDigest } from '../modules/study/src/services/activityIdentity';
import {
  bootstrapInstitution,
  issueInstitutionInvitation,
  acceptInstitutionInvitation
} from '../modules/study/src/services/institutions';
import { createMissingRankBadges } from './rank-badges.seed';

config({ path: path.resolve(__dirname, '../.env') });

type DemoRole = 'university_admin' | 'instructor' | 'university_student';

/** Optional synthetic class (DEMO_COHORT_SIZE, max 30) so privacy-thresholded
 * instructor insights have a cohort to summarise. Off by default. */
const cohortSize = Math.min(Math.max(Number(process.env.DEMO_COHORT_SIZE) || 0, 0), 30);
const cohort = Array.from({ length: cohortSize }, (_, i) => ({
  email: `class${String(i + 1).padStart(2, '0')}@ednova.test`,
  name: `Class learner ${String(i + 1).padStart(2, '0')}`,
  role: 'university_student' as DemoRole
}));

const accounts: ReadonlyArray<{ email: string; name: string; role: DemoRole }> = [
  { email: 'admin@ednova.test', name: 'Noveris Demo Admin', role: 'university_admin' },
  { email: 'instructor@ednova.test', name: 'Demo Instructor', role: 'instructor' },
  { email: 'learner@ednova.test', name: 'Tasnim', role: 'university_student' },
  { email: 'peer@ednova.test', name: 'Aziz', role: 'university_student' },
  ...cohort
];

/** Synthetic source text backing the demo course. Kept in-repo so the seeded
 * revision can carry a real content hash and a verifiable provenance artifact. */
const DEMO_SOURCE_TEXT = [
  'Noveris demo source: Relational Database Design & Normalization',
  '',
  'First Normal Form (1NF) requires every attribute value to be atomic: a column',
  'must not hold repeating groups or comma-separated lists. A relation such as',
  'Student(StudentID, FullName, CourseCodes[Array]) violates 1NF because CourseCodes',
  'stores several values in one attribute.',
  '',
  'Second Normal Form (2NF) removes partial dependencies on part of a composite',
  'primary key. A relation is in 2NF when it is in 1NF and every non-key attribute',
  'depends on the whole key.',
  ''
].join('\n');

/** Synthetic source text for the second demo course. It describes a weighted
 * graph and shortest paths so the Visual Lab can discover a concept that its
 * registered engine really supports. Labelled as demo content everywhere. */
const DEMO_GRAPH_TEXT = [
  'Noveris demo source: Shortest paths in weighted graphs',
  '',
  'A weighted graph is a set of nodes joined by edges, and each edge carries a',
  'weight such as a distance or a cost. The shortest path between a source node',
  'and a target node is the route whose total edge weight is smallest.',
  '',
  "Dijkstra's algorithm finds the shortest path from a source node to every other",
  'node when all edge weights are positive. It repeatedly settles the unvisited node',
  'with the smallest known distance and relaxes the weights of its neighbouring edges.',
  'Changing one edge weight can change which path is shortest.',
  ''
].join('\n');

/**
 * Writes the original source blob plus a deterministic FAISS artifact for a
 * revision, then pins the manifest on the revision. Mirrors what the ingestion
 * worker produces so published-content gates pass without special-casing seeds.
 */
async function materializeSourceArtifact(
  courseId: string,
  revisionTag: string,
  storedContentHash: string,
  sourceText: string = DEMO_SOURCE_TEXT,
  filename = 'relational-normalization.txt'
): Promise<SourceDocument> {
  const roots = sourceRoots();
  const hash = contentHash(sourceText);
  const pinHash = 'sha256:' + storedContentHash.replace(/^sha256:/, '');
  if (pinHash !== hash) throw new Error('Existing demo revision has different source content');
  const document: SourceDocument = {
    documentId: 'doc_' + hash.slice(7, 23),
    filename,
    contentHash: hash,
    storageRef: 'originals/' + hash.slice(7),
    mediaType: 'text/plain',
    provenance: 'extracted'
  };
  await fs.mkdir(path.join(roots.uploads, 'originals'), { recursive: true });
  const blobPath = path.join(roots.uploads, document.storageRef);
  try {
    await fs.writeFile(blobPath, sourceText, { mode: 0o444, flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    if (contentHash(await fs.readFile(blobPath)) !== hash)
      throw new Error('Existing demo source does not match its content hash');
  }
  const digest = manifestDigest(courseId, revisionTag, pinHash, [document]);

  const base = path.join(roots.indexes, courseId, revisionTag);
  await fs.mkdir(path.dirname(base), { recursive: true });
  const placeholder = Buffer.from('FAISS_DEMO_INDEX_V1\x00' + courseId + '\x00' + revisionTag);
  const existingIndex = await fs.readFile(base + '.faiss').catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
    return null;
  });
  // Only a placeholder created by this seed may be replaced.
  if (existingIndex?.equals(placeholder)) {
    await fs.rm(base + '.faiss', { force: true });
    await fs.rm(base + '.meta.json', { force: true });
  }

  // Prefer a real index built by the AI service through the same endpoint the
  // ingestion worker uses, so the grounded tutor can actually retrieve from the
  // demo course. The AI service must share FAISS_INDEX_DIR and INGEST_UPLOADS_DIR
  // with this process (pnpm dev:doctor checks that).
  let realIndex = false;
  try {
    await aiClient.post(
      '/api/ai/sources/index',
      {
        schemaVersion: '1.0.0',
        courseId,
        revisionId: revisionTag,
        contentHash: pinHash,
        documents: [document],
        manifestDigest: digest
      },
      { timeout: 120_000 }
    );
    realIndex = true;
    console.log('  ✓ Built a real source index through the AI service');
  } catch (error) {
    if (existingIndex && !existingIndex.equals(placeholder)) {
      console.log('  ✓ Kept the existing demo source index');
      return document;
    }
    console.warn(
      '  ! AI service could not index the demo source (' +
        (error instanceof Error ? error.message : String(error)) +
        '); writing a placeholder index. The grounded tutor will be unavailable on this course.'
    );
  }

  if (!realIndex) {
    // Placeholder so the revision still passes local integrity checks; it cannot
    // serve semantic search.
    await fs.writeFile(base + '.faiss', placeholder, { mode: 0o444, flag: 'wx' });
    await fs.writeFile(
      base + '.meta.json',
      JSON.stringify({
        schemaVersion: '1.0.0',
        courseId,
        revisionId: revisionTag,
        contentHash: pinHash,
        documents: [document],
        manifestDigest: digest,
        indexHash: contentHash(placeholder),
        chunks: [sourceText],
        metas: [
          {
            course_id: courseId,
            revision_id: revisionTag,
            document_id: document.documentId,
            content_hash: hash,
            text_hash: hash,
            chunk_id: 'chk_' + hash.slice(7),
            page_number: null,
            section_id: 'section_1',
            provenance: 'extracted'
          }
        ]
      })
    );
  }
  await prisma.courseRevision.updateMany({
    where: { courseId, revisionTag },
    data: {
      sourceManifest: [document] as unknown as Prisma.InputJsonValue,
      sourceManifestDigest: digest,
      vectorIndexRef: 'faiss/' + courseId + '/' + revisionTag + '.faiss'
    }
  });
  return document;
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
    throw new Error('Complete demo seeding requires a loopback PostgreSQL database');
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seeding is development only');
  const password = process.env.DEMO_USER_PASSWORD || 'EdNovaDemo!2026';

  console.log('🌱 Starting Noveris demo seeder...');
  console.log('Connecting to: configured PostgreSQL target (credentials redacted)');

  await connectDatabase();
  try {
    // 1. Seed Demo Users
    console.log('\n[1/6] Seeding Demo Users...');
    const auth = await createAuth({ sendMail: async () => {} });
    const userIds = new Map<string, string>();

    for (const account of accounts) {
      let identity = await prisma.authUser.findUnique({
        where: { email: account.email },
        select: { id: true }
      });
      if (!identity) {
        await auth.api.signUpEmail({
          body: { email: account.email, name: account.name, password }
        });
        identity = await prisma.authUser.findUnique({
          where: { email: account.email },
          select: { id: true }
        });
        if (!identity) throw new Error(`Missing auth identity: ${account.email}`);
        const now = new Date();
        await prisma.authUser.update({
          where: { id: identity.id },
          data: { emailVerified: true, updatedAt: now }
        });
        await prisma.user.update({
          where: { id: identity.id },
          data: {
            role: account.role === 'university_admin' ? 'admin' : 'student',
            isAdmin: account.role === 'university_admin',
            isVerified: true,
            isActive: true,
            onboardingCompletedAt: now,
            notificationPreferences: defaultNotificationPreferences(),
            onboardingDraft: {
              studyGoals: [],
              preferredSubjects: [],
              weeklyHours: 0,
              studyLevel: 'beginner',
              studyTime: 'evening',
              timezone: 'UTC',
              language: 'en',
              notificationPreferences: { email: true, push: true }
            },
            updatedAt: now
          }
        });
        console.log(`  ✓ Created user: ${account.email}`);
      } else {
        console.log(`  ✓ User exists: ${account.email}`);
      }
      userIds.set(account.email, identity.id);
    }

    // 2. Seed Institution
    console.log('\n[2/6] Seeding Institution & Memberships...');
    const adminId = userIds.get('admin@ednova.test')!;
    let institution = await prisma.institution.findUnique({
      where: { slug: 'ednova-learning-demo' }
    });

    if (!institution) {
      const created = await bootstrapInstitution({
        actorUserId: adminId,
        name: 'Noveris Demo University',
        slug: 'ednova-learning-demo'
      });
      institution = await prisma.institution.findUnique({
        where: { id: created.institution.id }
      });
      console.log('  ✓ Created Institution: Noveris Demo University');
    } else {
      console.log('  ✓ Institution already exists');
    }

    if (institution) {
      for (const account of accounts) {
        const userId = userIds.get(account.email)!;
        const membership = await prisma.institutionMembership.findFirst({
          where: { institutionId: institution.id, userId }
        });
        if (!membership && account.role !== 'university_admin') {
          const inv = await issueInstitutionInvitation({
            actorUserId: adminId,
            institutionId: institution.id,
            role: account.role
          });
          await acceptInstitutionInvitation({ actorUserId: userId, token: inv.token });
          console.log(`  ✓ Added ${account.email} as ${account.role}`);
        }
      }
    }

    // 3. Seed Rank Badges
    console.log('\n[3/6] Seeding Rank Badges...');
    const badgeCount = await createMissingRankBadges();
    console.log(`  ✓ Seeded ${badgeCount} new badges`);

    // 4. Seed Demo Course, Published Revision & Learning Activities
    console.log('\n[4/6] Seeding Course & Interactive Learning Activities...');
    const instructorId = userIds.get('instructor@ednova.test')!;
    const learnerId = userIds.get('learner@ednova.test')!;

    let course = await prisma.course.findFirst({
      where: { title: 'Relational Database Design & Normalization' }
    });
    if (!course) {
      course = await prisma.course.create({
        data: {
          id: newId(),
          userId: instructorId,
          ownerUserId: instructorId,
          assignedInstructorIds: [instructorId],
          subjectId: 'computer-science',
          title: 'Relational Database Design & Normalization',
          description:
            'Comprehensive course covering First Normal Form (1NF), Second Normal Form (2NF), Third Normal Form (3NF), Boyce-Codd Normal Form, and relational dependency decomposition.',
          status: 'completed',
          ingestProgress: 1,
          ingestDetail: 'Published and reviewed by instructor',
          scope: 'institutional',
          institutionId: institution?.id
        }
      });
      console.log('  ✓ Created Course: Relational Database Design & Normalization');
    }

    const courseId = course.id;
    let revision = await prisma.courseRevision.findFirst({
      where: { courseId, status: 'published' }
    });
    if (!revision) {
      // Content hash is derived from the same source bytes that get indexed, so the
      // seeded revision satisfies the same integrity checks production does.
      const revisionTag = 'rev_20261018_v1';
      const sourceText = DEMO_SOURCE_TEXT;
      const revisionHash = contentHash(sourceText);
      revision = await prisma.courseRevision.create({
        data: {
          id: newId(),
          courseId,
          revisionTag,
          contentHash: revisionHash.replace(/^sha256:/, ''),
          status: 'published',
          // Publication gates require committed activation plus no revocation;
          // see getPublishedCourseContext in coursePublication.ts.
          activationState: 'committed',
          publishedByUserId: instructorId,
          publishedAt: new Date(),
          summary: 'Official published revision for CS301 Normalization.',
          isInstructorReviewed: true,
          // Objectives live under subtopics[].learning_objectives: that is the shape
          // ingestion produces and the one the published context projects.
          topics: [
            {
              id: 'top_1nf',
              title: 'First Normal Form (1NF) & Atomicity',
              description: 'Elimination of repeating groups and ensuring attribute atomicity.',
              subtopics: [
                {
                  id: 'sub_1nf_def',
                  title: 'Atomic domains',
                  learning_objectives: [
                    {
                      id: 'obj_1nf_def',
                      statement:
                        'Identify table definitions that violate 1NF atomic domain constraints',
                      bloomLevel: 'analyze'
                    },
                    {
                      id: 'obj_1nf_decompose',
                      statement: 'Decompose non-atomic attributes into 1NF compliant relations',
                      bloomLevel: 'apply'
                    }
                  ]
                }
              ]
            },
            {
              id: 'top_2nf',
              title: 'Second Normal Form (2NF) & Full Functional Dependency',
              description: 'Removal of partial dependencies on candidate keys.',
              subtopics: [
                {
                  id: 'sub_2nf_identify',
                  title: 'Partial dependencies',
                  learning_objectives: [
                    {
                      id: 'obj_2nf_identify',
                      statement: 'Detect partial functional dependencies on composite primary keys',
                      bloomLevel: 'analyze'
                    }
                  ]
                }
              ]
            }
          ] as Prisma.InputJsonValue
        }
      });
      await prisma.course.update({
        where: { id: courseId },
        data: { activeRevisionId: revision.revisionTag }
      });
      console.log('  ✓ Created Published Course Revision (v1)');
    }

    // Materialize genuine source provenance (blob + FAISS artifact + manifest) so
    // the seeded revision passes verifyRevisionArtifact exactly like a published one.
    const sourceDocument = await materializeSourceArtifact(
      courseId,
      revision.revisionTag,
      revision.contentHash
    );
    const resolvedRevision = await prisma.courseRevision.findUnique({
      where: { id: revision.id }
    });
    if (!resolvedRevision) throw new Error('Seeded revision disappeared');

    // The published revision is the curriculum source of truth, but several read
    // paths (competency projection, planner targeting) resolve subject names and
    // objective topics through these records. Seed them from the same hierarchy.
    // Course.subjectId historically held a free-form slug, which no Subject could
    // ever match, so subject names resolved to null. Point it at a real Subject.
    let subject = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(course.subjectId)
      ? await prisma.subject.findUnique({ where: { id: course.subjectId } })
      : null;
    if (!subject) {
      subject = await prisma.subject.create({
        data: {
          id: newId(),
          userId: instructorId,
          name: 'Computer Science',
          description: 'Relational data modelling and database design'
        }
      });
      console.log('  ✓ Created Subject: Computer Science');
    }
    const revisionTopics = (resolvedRevision.topics ?? []) as Array<{
      id: string;
      subtopics?: Array<{
        learning_objectives?: Array<{
          id: string;
          statement?: string;
          text?: string;
          bloomLevel: string;
        }>;
      }>;
    }>;
    for (const topic of revisionTopics) {
      for (const sub of topic.subtopics || []) {
        for (const objective of sub.learning_objectives || []) {
          const statement = objective.statement || objective.text;
          if (!statement) continue;
          // Each objective has a natural key (document + topic + text hash), so a
          // re-run inserts nothing new.
          await prisma.learningObjective.createMany({
            data: [
              {
                id: newId(),
                userId: instructorId,
                documentId: sourceDocument.documentId,
                objectiveId: objective.id,
                topicId: topic.id,
                knowledgeType: 'procedural',
                bloomLevel: objective.bloomLevel,
                verb: objective.bloomLevel,
                text: statement,
                textHash: contentHash(statement),
                version: 1,
                isActive: true
              }
            ],
            skipDuplicates: true
          });
        }
      }
    }
    // Keep the legacy editable projection aligned with the revision so studio and
    // planner surfaces that still read Course.topics resolve the same hierarchy.
    await prisma.course.update({
      where: { id: courseId },
      data: {
        topics: (resolvedRevision.topics ?? []) as Prisma.InputJsonValue,
        subjectId: subject.id
      }
    });
    console.log('  ✓ Seeded Subject & LearningObjectives');

    // Seed Interactive Learning Activities (Contract 04). The definition must carry
    // the same pin as the published revision, and the revision must list it as an
    // approved activity, exactly as publishCourseRevision records it.
    const revisionTag = resolvedRevision.revisionTag;
    const pinnedHash = 'sha256:' + resolvedRevision.contentHash.replace(/^sha256:/, '');
    const sourceRefs = [
      {
        documentId: sourceDocument.documentId,
        contentHash: sourceDocument.contentHash,
        pageNumber: null,
        locationKnown: false,
        provenance: 'extracted' as const
      }
    ];
    const pinFor = (activityId: string, activityType: 'InteractiveQuiz' | 'GuidedProblem') => ({
      courseId,
      revisionId: revisionTag,
      contentHash: pinnedHash,
      activityId,
      activityRevision: 'ar_1',
      activityType
    });
    const baseDefinition = {
      schemaVersion: '1.0.0',
      activityRevision: 'ar_1',
      componentVersion: '1.0.0',
      courseId,
      revisionId: revisionTag,
      contentHash: pinnedHash,
      visibility: 'public',
      language: 'en',
      sourceRefs
    };
    // One reviewed activity per objective so the adaptive path, the diagnostic
    // (which needs at least two) and the next-objective flow can all be exercised.
    const seededActivities = [
      {
        publicDefinition: {
          ...baseDefinition,
          activityId: 'act_1nf_quiz_01',
          activityType: 'InteractiveQuiz',
          objectiveId: 'obj_1nf_def',
          title: '1NF Decomposition Challenge',
          instructions:
            'Select all attribute sets that violate First Normal Form in the table schema below.',
          timeLimitSeconds: 180,
          constraints: { maxAttempts: 3, allowCalculator: false },
          presentationData: {
            question: 'Which of the following table column definitions violate 1NF?',
            options: [
              { id: 'opt_a', label: 'Student(StudentID, FullName, CourseCodes[Array])' },
              { id: 'opt_b', label: 'Enrollment(StudentID, CourseCode, Semester)' },
              { id: 'opt_c', label: 'Order(OrderID, CustomerName, ItemsCommaSeparated)' }
            ],
            isMultiSelect: true
          }
        },
        serverEvaluation: {
          schemaVersion: '1.0.0',
          visibility: 'server_only',
          activity: pinFor('act_1nf_quiz_01', 'InteractiveQuiz'),
          evaluationRef: 'ref_1nf_eval',
          evaluatorType: 'deterministic_rubric',
          rubricVersion: 'exact-options-v1',
          rubric: 'Options A and C contain multi-valued attributes which violates atomicity.',
          answerKey: ['opt_a', 'opt_c']
        }
      },
      {
        publicDefinition: {
          ...baseDefinition,
          activityId: 'act_1nf_decompose_01',
          activityType: 'GuidedProblem',
          objectiveId: 'obj_1nf_decompose',
          title: 'Decompose a non-atomic table',
          instructions:
            'Work through the steps. Type each answer exactly as written in the schema.',
          timeLimitSeconds: 240,
          constraints: { maxAttempts: 3, allowCalculator: false },
          presentationData: {
            problem: 'Student(StudentID, FullName, CourseCodes[Array]) must be brought into 1NF.',
            steps: [
              {
                stepId: 'step_attribute',
                prompt: 'Which attribute holds more than one value in a single row?'
              },
              {
                stepId: 'step_atomic',
                prompt:
                  'After decomposition, how many values may one cell of an atomic column hold? (a number)'
              }
            ]
          }
        },
        serverEvaluation: {
          schemaVersion: '1.0.0',
          visibility: 'server_only',
          activity: pinFor('act_1nf_decompose_01', 'GuidedProblem'),
          evaluationRef: 'ref_1nf_decompose_eval',
          evaluatorType: 'deterministic_rubric',
          rubricVersion: 'exact-answer-v1',
          rubric:
            'CourseCodes is the repeating attribute; atomic columns hold exactly one value per cell.',
          answerKey: ['CourseCodes', '1']
        }
      },
      {
        publicDefinition: {
          ...baseDefinition,
          activityId: 'act_2nf_quiz_01',
          activityType: 'InteractiveQuiz',
          objectiveId: 'obj_2nf_identify',
          title: 'Spot the partial dependency',
          instructions:
            'The key of Enrollment is (StudentID, CourseCode). Choose the attribute that depends on only part of the key.',
          timeLimitSeconds: 180,
          constraints: { maxAttempts: 3, allowCalculator: false },
          presentationData: {
            question:
              'In Enrollment(StudentID, CourseCode, StudentName, Grade), which attribute is a partial dependency?',
            options: [
              { id: 'opt_a', label: 'Grade' },
              { id: 'opt_b', label: 'StudentName' },
              { id: 'opt_c', label: 'CourseCode' }
            ],
            isMultiSelect: false
          }
        },
        serverEvaluation: {
          schemaVersion: '1.0.0',
          visibility: 'server_only',
          activity: pinFor('act_2nf_quiz_01', 'InteractiveQuiz'),
          evaluationRef: 'ref_2nf_eval',
          evaluatorType: 'deterministic_rubric',
          rubricVersion: 'exact-options-v1',
          rubric:
            'StudentName depends only on StudentID, which is part of the composite key, so it violates 2NF.',
          answerKey: ['opt_b']
        }
      }
    ];
    for (const { publicDefinition, serverEvaluation } of seededActivities) {
      const exists = await prisma.activityRecord.findFirst({
        where: { activityId: publicDefinition.activityId, courseId },
        select: { id: true }
      });
      if (exists) continue;
      await prisma.activityRecord.create({
        data: {
          id: newId(),
          courseId,
          revisionId: revisionTag,
          contentHash: pinnedHash,
          activityId: publicDefinition.activityId,
          activityRevision: 'ar_1',
          activityType: publicDefinition.activityType,
          objectiveId: publicDefinition.objectiveId,
          publicDefinition: publicDefinition as Prisma.InputJsonValue,
          serverEvaluation: serverEvaluation as Prisma.InputJsonValue
        }
      });
      console.log('  ✓ Created Interactive Activity: ' + publicDefinition.title);
    }
    await prisma.courseRevision.update({
      where: { id: resolvedRevision.id },
      data: {
        approvedActivities: seededActivities.map(({ publicDefinition, serverEvaluation }) => ({
          activityId: publicDefinition.activityId,
          activityRevision: 'ar_1',
          definitionHash: activityDigest(publicDefinition),
          evaluationHash: activityDigest(serverEvaluation)
        })) as Prisma.InputJsonValue
      }
    });

    // 5. Enroll Learner and Seed Tasks & Progress
    console.log('\n[5/6] Enrolling Learner & Creating Study Tasks...');
    for (const email of ['learner@ednova.test', 'peer@ednova.test', ...cohort.map((c) => c.email)]) {
      const userId = userIds.get(email)!;
      const enrollment = await prisma.courseEnrollment.findFirst({
        where: { courseId, userId },
        select: { id: true }
      });
      if (enrollment) continue;
      await prisma.courseEnrollment.create({
        data: {
          id: newId(),
          courseId,
          // Institutional course access requires the enrollment to carry the same
          // institution as the course; see courseGrant in resourceAccess.ts.
          institutionId: course.institutionId,
          userId,
          enrolledAt: new Date(),
          status: 'active'
        }
      });
      console.log(`  ✓ Enrolled ${email} in the Database Normalization course`);
    }

    const task = await prisma.taskRecord.findFirst({
      where: { userId: learnerId, title: 'Master 1NF Normalization' },
      select: { id: true }
    });
    if (!task) {
      await prisma.taskRecord.create({
        data: {
          id: newId(),
          userId: learnerId,
          title: 'Master 1NF Normalization',
          description:
            'Demo task (synthetic): complete the 1NF challenge and practice Socratic reasoning.',
          priority: 'high',
          status: 'in-progress',
          dueDate: new Date(Date.now() + 86400000 * 3),
          estimatedTime: 45
        }
      });
      console.log('  ✓ Created Study Task for Learner');
    }

    // Progress, XP and streaks are never seeded: they must come from accepted
    // learner activity so the Progress page reflects real evidence only.

    // 6. Second demo course whose material the Visual Lab can actually render.
    console.log('\n[6/6] Seeding the visual-ready demo course (shortest paths)...');
    const GRAPH_TITLE = 'Demo: Shortest paths in weighted graphs';
    let graphCourse = await prisma.course.findFirst({ where: { title: GRAPH_TITLE } });
    const graphCourseExists = !!graphCourse;
    if (
      graphCourse &&
      (String(graphCourse.ownerUserId) !== String(instructorId) ||
        !graphCourse.description?.startsWith('Synthetic demo course (not real course material):'))
    ) {
      throw new Error(
        'A course with the demo title already exists and is not the seed-owned demo; refusing to modify it.'
      );
    }
    if (!graphCourse) {
      graphCourse = await prisma.course.create({
        data: {
          id: newId(),
          userId: instructorId,
          ownerUserId: instructorId,
          assignedInstructorIds: [instructorId],
          subjectId: 'computer-science',
          title: GRAPH_TITLE,
          description:
            'Synthetic demo course (not real course material): weighted graphs and Dijkstra, written so the Visual Lab can build a matching experiment.',
          status: 'completed',
          ingestProgress: 1,
          ingestDetail: 'Published and reviewed by instructor',
          scope: 'institutional',
          institutionId: institution?.id
        }
      });
    }
    const graphCourseId = graphCourse.id;
    let graphRevision = await prisma.courseRevision.findFirst({
      where: { courseId: graphCourseId, revisionTag: 'rev_demo_graph_v1' }
    });
    const graphRevisionExists = !!graphRevision;
    if (graphCourseExists && !graphRevisionExists) {
      throw new Error(
        'The existing demo course has no seed revision; refusing to replace its published content.'
      );
    }
    if (
      graphRevision &&
      (graphRevision.status !== 'published' ||
        graphRevision.contentHash !== contentHash(DEMO_GRAPH_TEXT).replace(/^sha256:/, ''))
    ) {
      throw new Error(
        'The demo graph revision already exists with different content or status; refusing to overwrite it.'
      );
    }
    if (!graphRevision) {
      graphRevision = await prisma.courseRevision.create({
        data: {
          id: newId(),
          courseId: graphCourseId,
          revisionTag: 'rev_demo_graph_v1',
          contentHash: contentHash(DEMO_GRAPH_TEXT).replace(/^sha256:/, ''),
          status: 'published',
          activationState: 'committed',
          publishedByUserId: instructorId,
          publishedAt: new Date(),
          summary: 'Synthetic demo revision: shortest paths in weighted graphs.',
          isInstructorReviewed: true,
          topics: [
            {
              id: 'top_shortest_path',
              title: 'Weighted graphs and shortest paths',
              description: 'Edge weights, path cost and how Dijkstra settles nodes.',
              subtopics: [
                {
                  id: 'sub_dijkstra',
                  title: "Dijkstra's algorithm",
                  learning_objectives: [
                    {
                      id: 'obj_shortest_path',
                      statement: 'Find the shortest path between two nodes of a weighted graph',
                      bloomLevel: 'apply'
                    }
                  ]
                }
              ]
            }
          ] as Prisma.InputJsonValue
        }
      });
      await prisma.course.update({
        where: { id: graphCourseId },
        data: { activeRevisionId: graphRevision.revisionTag }
      });
    }
    const graphSource = await materializeSourceArtifact(
      graphCourseId,
      graphRevision.revisionTag,
      graphRevision.contentHash,
      DEMO_GRAPH_TEXT,
      'shortest-paths.txt'
    );
    if (!graphRevisionExists) {
      const graphPin = 'sha256:' + graphRevision.contentHash.replace(/^sha256:/, '');
      const graphActivityBase = {
        schemaVersion: '1.0.0',
        activityRevision: 'ar_1',
        componentVersion: '1.0.0',
        courseId: graphCourseId,
        revisionId: graphRevision.revisionTag,
        contentHash: graphPin,
        visibility: 'public',
        language: 'en',
        sourceRefs: [
          {
            documentId: graphSource.documentId,
            contentHash: graphSource.contentHash,
            pageNumber: null,
            locationKnown: false,
            provenance: 'extracted' as const
          }
        ]
      };
      const graphPublic = {
        ...graphActivityBase,
        activityId: 'act_graph_quiz_01',
        activityType: 'InteractiveQuiz',
        objectiveId: 'obj_shortest_path',
        title: 'Pick the shortest route',
        instructions: 'Add up the edge weights along each route and choose the smallest total.',
        timeLimitSeconds: 180,
        constraints: { maxAttempts: 3, allowCalculator: false },
        presentationData: {
          question:
            'Edges: A-B weight 4, A-C weight 1, C-B weight 2. Which route from A to B has the smallest total weight?',
          options: [
            { id: 'opt_a', label: 'A to B directly (total 4)' },
            { id: 'opt_b', label: 'A to C to B (total 3)' }
          ],
          isMultiSelect: false
        }
      };
      const graphServer = {
        schemaVersion: '1.0.0',
        visibility: 'server_only',
        activity: {
          courseId: graphCourseId,
          revisionId: graphRevision.revisionTag,
          contentHash: graphPin,
          activityId: 'act_graph_quiz_01',
          activityRevision: 'ar_1',
          activityType: 'InteractiveQuiz'
        },
        evaluationRef: 'ref_graph_eval',
        evaluatorType: 'deterministic_rubric',
        rubricVersion: 'exact-options-v1',
        rubric: 'The route through C costs 1 + 2 = 3, which is less than the direct edge of 4.',
        answerKey: ['opt_b']
      };
      if (
        !(await prisma.activityRecord.findFirst({
          where: { activityId: graphPublic.activityId, courseId: graphCourseId },
          select: { id: true }
        }))
      ) {
        await prisma.activityRecord.create({
          data: {
            id: newId(),
            courseId: graphCourseId,
            revisionId: graphRevision.revisionTag,
            contentHash: graphPin,
            activityId: graphPublic.activityId,
            activityRevision: 'ar_1',
            activityType: graphPublic.activityType,
            objectiveId: graphPublic.objectiveId,
            publicDefinition: graphPublic as Prisma.InputJsonValue,
            serverEvaluation: graphServer as Prisma.InputJsonValue
          }
        });
      }
      await prisma.courseRevision.update({
        where: { id: graphRevision.id },
        data: {
          approvedActivities: [
            {
              activityId: graphPublic.activityId,
              activityRevision: 'ar_1',
              definitionHash: activityDigest(graphPublic),
              evaluationHash: activityDigest(graphServer)
            }
          ] as Prisma.InputJsonValue
        }
      });
      const graphObjective = 'Find the shortest path between two nodes of a weighted graph';
      await prisma.learningObjective.createMany({
        data: [
          {
            id: newId(),
            userId: instructorId,
            documentId: graphSource.documentId,
            objectiveId: 'obj_shortest_path',
            topicId: 'top_shortest_path',
            knowledgeType: 'procedural',
            bloomLevel: 'apply',
            verb: 'apply',
            text: graphObjective,
            textHash: contentHash(graphObjective),
            version: 1,
            isActive: true
          }
        ],
        skipDuplicates: true
      });
      const storedGraphRevision = await prisma.courseRevision.findUnique({
        where: { id: graphRevision.id }
      });
      await prisma.course.update({
        where: { id: graphCourseId },
        data: { topics: (storedGraphRevision?.topics ?? []) as Prisma.InputJsonValue }
      });
    }
    for (const learner of ['learner@ednova.test', 'peer@ednova.test']) {
      const uid = userIds.get(learner)!;
      const exists = await prisma.courseEnrollment.findFirst({
        where: { courseId: graphCourseId, userId: uid },
        select: { id: true }
      });
      if (!exists) {
        await prisma.courseEnrollment.create({
          data: {
            id: newId(),
            courseId: graphCourseId,
            institutionId: graphCourse.institutionId,
            userId: uid,
            enrolledAt: new Date(),
            status: 'active'
          }
        });
      }
    }
    console.log('  ✓ Seeded ' + GRAPH_TITLE + ' (labelled demo content, no learner activity)');

    console.log('\n========================================================');
    console.log('🎉 Complete Demo Seeding Finished Successfully!');
    console.log('========================================================');
    console.log('Demo Credentials Ready:');
    console.log('  • Student / Learner : learner@ednova.test    | EdNovaDemo!2026');
    console.log('  • Instructor        : instructor@ednova.test | EdNovaDemo!2026');
    console.log('  • Admin             : admin@ednova.test      | EdNovaDemo!2026');
    console.log('========================================================');
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error('❌ Seeder Error:', err);
  process.exit(1);
});
