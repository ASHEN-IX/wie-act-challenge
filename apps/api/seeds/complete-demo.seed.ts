import { config } from 'dotenv';
import path from 'node:path';
import { MongoClient } from 'mongodb';
import mongoose, { Types } from 'mongoose';
import { createAuth } from '../shared/betterAuth';
import { Institution, InstitutionMembership } from '../modules/study/src/models/Institution';
import {
  bootstrapInstitution,
  issueInstitutionInvitation,
  acceptInstitutionInvitation
} from '../modules/study/src/services/institutions';
import { RANK_LADDER } from '../modules/user-profile/src/models/rankingConfig';
import RankBadge from '../modules/user-profile/src/models/RankBadge';
import { Course, Task, StudySession } from '../modules/study/src/models';
import { CourseRevision } from '../modules/study/src/models/CourseRevision';
import { ActivityRecord } from '../modules/study/src/models/ActivityRecord';
import { CourseEnrollment } from '../modules/study/src/models/CourseEnrollment';

config({ path: path.resolve(__dirname, '../.env') });

const accounts = [
  { email: 'admin@ednova.test', name: 'EdNova Admin', role: 'university_admin' },
  { email: 'instructor@ednova.test', name: 'Dr. Habib (Instructor)', role: 'instructor' },
  { email: 'learner@ednova.test', name: 'Tasnim (Learner)', role: 'university_student' },
  { email: 'peer@ednova.test', name: 'Aziz (Peer Student)', role: 'university_student' }
] as const;

const SINGLE_BADGE_TIERS = new Set(['grandmaster', 'legend']);
const DIVISION_TO_BADGE_KEY: Record<string, string> = { III: 'first', II: 'second', I: 'third' };

function toBadgeKey(rank: any): string {
  const tier = String(rank?.tier || '').toLowerCase();
  if (SINGLE_BADGE_TIERS.has(tier)) return 'use';
  return DIVISION_TO_BADGE_KEY[String(rank?.division || '').toUpperCase()] || 'use';
}

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ednova_dev';
  const password = process.env.DEMO_USER_PASSWORD || 'EdNovaDemo!2026';

  console.log('🌱 Starting Complete EdNova Demo Seeder...');
  console.log(`Connecting to: ${uri}`);

  const client = new MongoClient(uri);
  await client.connect();
  await mongoose.connect(uri);
  const db = client.db();

  try {
    // 1. Seed Demo Users
    console.log('\n[1/5] Seeding Demo Users...');
    const auth = await createAuth(db, { sendMail: async () => {} });
    const userIds = new Map<string, string>();

    for (const account of accounts) {
      let identity = await db.collection('auth_users').findOne({ email: account.email });
      if (!identity) {
        await auth.api.signUpEmail({
          body: { email: account.email, name: account.name, password }
        });
        identity = await db.collection('auth_users').findOne({ email: account.email });
        if (!identity) throw new Error(`Missing auth identity: ${account.email}`);
        const now = new Date();
        await db.collection('auth_users').updateOne(
          { _id: identity._id },
          { $set: { emailVerified: true, updatedAt: now } }
        );
        await db.collection('users').updateOne(
          { _id: identity._id },
          {
            $set: {
              role: account.role === 'university_admin' ? 'admin' : 'student',
              isAdmin: account.role === 'university_admin',
              isVerified: true,
              isActive: true,
              onboardingCompletedAt: now,
              updatedAt: now
            }
          }
        );
        console.log(`  ✓ Created user: ${account.email}`);
      } else {
        console.log(`  ✓ User exists: ${account.email}`);
      }
      userIds.set(account.email, identity._id.toString());
    }

    // 2. Seed Institution
    console.log('\n[2/5] Seeding Institution & Memberships...');
    await Institution.init();
    await InstitutionMembership.init();
    const adminId = userIds.get('admin@ednova.test')!;
    let institution = await Institution.findOne({ slug: 'ednova-learning-demo' });

    if (!institution) {
      const created = await bootstrapInstitution({
        actorUserId: adminId,
        name: 'EdNova Learning Demo University',
        slug: 'ednova-learning-demo'
      });
      institution = await Institution.findById(created.institution.id);
      console.log('  ✓ Created Institution: EdNova Learning Demo University');
    } else {
      console.log('  ✓ Institution already exists');
    }

    if (institution) {
      for (const account of accounts) {
        const userId = userIds.get(account.email)!;
        const membership = await InstitutionMembership.findOne({
          institutionId: institution._id,
          userId
        });
        if (!membership && account.role !== 'university_admin') {
          const inv = await issueInstitutionInvitation({
            actorUserId: adminId,
            institutionId: institution._id.toString(),
            role: account.role
          });
          await acceptInstitutionInvitation({ actorUserId: userId, token: inv.token });
          console.log(`  ✓ Added ${account.email} as ${account.role}`);
        }
      }
    }

    // 3. Seed Rank Badges
    console.log('\n[3/5] Seeding Rank Badges...');
    let badgeCount = 0;
    for (const rank of RANK_LADDER) {
      const tier = String(rank.tier || 'novice').toLowerCase();
      const badgeKey = toBadgeKey(rank);
      const existing = await RankBadge.findOne({ rankIndex: rank.index });
      if (!existing) {
        await RankBadge.create({
          rankIndex: rank.index,
          rankName: rank.name,
          tier,
          division: rank.division || null,
          badgeKey,
          imagePath: `/ranking-badges/${tier}/${badgeKey}.png`,
          isActive: true
        });
        badgeCount++;
      }
    }
    console.log(`  ✓ Seeded ${badgeCount} new badges (${RANK_LADDER.length} total)`);

    // 4. Seed Demo Course, Published Revision & Learning Activities
    console.log('\n[4/5] Seeding Course & Interactive Learning Activities...');
    const instructorId = userIds.get('instructor@ednova.test')!;
    const learnerId = userIds.get('learner@ednova.test')!;

    let course = await Course.findOne({ title: 'Relational Database Design & Normalization' });
    if (!course) {
      course = await Course.create({
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
        institutionId: institution?._id
      });
      console.log('  ✓ Created Course: Relational Database Design & Normalization');
    }

    const courseId = course._id;
    let revision = await CourseRevision.findOne({ courseId, status: 'published' });
    if (!revision) {
      revision = await CourseRevision.create({
        courseId,
        revisionTag: 'rev_20261018_v1',
        contentHash: 'hash_cs301_demo_relational',
        status: 'published',
        publishedByUserId: instructorId,
        publishedAt: new Date(),
        summary: 'Official published revision for CS301 Normalization.',
        isInstructorReviewed: true,
        topics: [
          {
            id: 'top_1nf',
            title: 'First Normal Form (1NF) & Atomicity',
            description: 'Elimination of repeating groups and ensuring attribute atomicity.',
            objectives: [
              {
                id: 'obj_1nf_def',
                text: 'Identify table definitions that violate 1NF atomic domain constraints',
                bloomLevel: 'analyze'
              },
              {
                id: 'obj_1nf_decompose',
                text: 'Decompose non-atomic attributes into 1NF compliant relations',
                bloomLevel: 'apply'
              }
            ]
          },
          {
            id: 'top_2nf',
            title: 'Second Normal Form (2NF) & Full Functional Dependency',
            description: 'Removal of partial dependencies on candidate keys.',
            objectives: [
              {
                id: 'obj_2nf_identify',
                text: 'Detect partial functional dependencies on composite primary keys',
                bloomLevel: 'analyze'
              }
            ]
          }
        ]
      });
      course.activeRevisionId = revision._id.toString();
      await course.save();
      console.log('  ✓ Created Published Course Revision (v1)');
    }

    // Seed Interactive Learning Activities (Contract 04)
    const quizActivityId = 'act_1nf_quiz_01';
    let quizActivity = await ActivityRecord.findOne({ activityId: quizActivityId });
    if (!quizActivity) {
      quizActivity = await ActivityRecord.create({
        courseId: courseId.toString(),
        revisionId: revision._id.toString(),
        contentHash: 'hash_1nf_quiz_01',
        activityId: quizActivityId,
        activityRevision: '1.0.0',
        activityType: 'InteractiveQuiz',
        objectiveId: 'obj_1nf_def',
        publicDefinition: {
          activityId: quizActivityId,
          activityType: 'InteractiveQuiz',
          schemaVersion: '1.0.0',
          courseId: courseId.toString(),
          revisionId: revision._id.toString(),
          objectiveId: 'obj_1nf_def',
          title: '1NF Decomposition Challenge',
          instructions:
            'Select all attribute sets that violate First Normal Form in the table schema below.',
          timeLimitSeconds: 180,
          presentationData: {
            question: 'Which of the following table column definitions violate 1NF?',
            options: [
              { id: 'opt_a', label: 'Student(StudentID, FullName, CourseCodes[Array])' },
              { id: 'opt_b', label: 'Enrollment(StudentID, CourseCode, Semester)' },
              { id: 'opt_c', label: 'Order(OrderID, CustomerName, ItemsCommaSeparated)' }
            ],
            isMultiSelect: true
          },
          constraints: {
            maxAttempts: 3,
            allowCalculator: false
          }
        },
        serverEvaluation: {
          schemaVersion: '1.0.0',
          visibility: 'server_only',
          activity: {
            courseId: courseId.toString(),
            revisionId: revision._id.toString(),
            contentHash: 'hash_1nf_quiz_01',
            activityId: quizActivityId,
            activityRevision: '1.0.0',
            activityType: 'InteractiveQuiz'
          },
          evaluationRef: 'ref_1nf_eval',
          evaluatorType: 'deterministic_rubric',
          rubricVersion: '1.0.0',
          rubric: 'Options A and C contain multi-valued attributes which violates atomicity.',
          answerKey: ['opt_a', 'opt_c']
        }
      });
      console.log('  ✓ Created Interactive Activity: 1NF Quiz Challenge');
    }

    // 5. Enroll Learner and Seed Tasks & Progress
    console.log('\n[5/5] Enrolling Learner & Creating Study Tasks...');
    let enrollment = await CourseEnrollment.findOne({ courseId, userId: learnerId });
    if (!enrollment) {
      enrollment = await CourseEnrollment.create({
        courseId,
        userId: learnerId,
        enrolledAt: new Date(),
        status: 'active'
      });
      console.log('  ✓ Enrolled Tasnim in Database Normalization course');
    }

    let task = await Task.findOne({ userId: learnerId, title: 'Master 1NF Normalization' });
    if (!task) {
      task = await Task.create({
        userId: learnerId,
        title: 'Master 1NF Normalization',
        description: 'Complete the 1NF challenge and practice Socratic reasoning.',
        courseId: courseId.toString(),
        topicId: 'top_1nf',
        priority: 'high',
        status: 'in-progress',
        dueDate: new Date(Date.now() + 86400000 * 3),
        estimatedMinutes: 45
      });
      console.log('  ✓ Created Study Task for Learner');
    }

    // Update Learner XP and Streak
    await db.collection('users').updateOne(
      { email: 'learner@ednova.test' },
      {
        $set: {
          xp: 450,
          level: 3,
          streak: 5,
          totalStudyMinutes: 180,
          updatedAt: new Date()
        }
      }
    );
    console.log('  ✓ Initialized Learner Gamification: 450 XP, Level 3, 5-Day Streak');

    console.log('\n========================================================');
    console.log('🎉 Complete Demo Seeding Finished Successfully!');
    console.log('========================================================');
    console.log('Demo Credentials Ready:');
    console.log('  • Student / Learner : learner@ednova.test    | EdNovaDemo!2026');
    console.log('  • Instructor        : instructor@ednova.test | EdNovaDemo!2026');
    console.log('  • Admin             : admin@ednova.test      | EdNovaDemo!2026');
    console.log('========================================================');
  } finally {
    await mongoose.disconnect();
    await client.close();
  }
}

main().catch((err) => {
  console.error('❌ Seeder Error:', err);
  process.exit(1);
});
