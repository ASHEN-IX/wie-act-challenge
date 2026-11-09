/**
 * Seed demo analytics events for a user email.
 *
 * Usage:
 *   DATABASE_URL=postgresql://ednova:ednova@127.0.0.1:5433/ednova_test \
 *     npx tsx seeds/analytics-demo.seed.ts kammounaziz12@gmail.com
 */
import { config } from 'dotenv';
import path from 'node:path';
import { Prisma } from '../src/generated/prisma/client';
import { connectDatabase, disconnectDatabase, prisma } from '../shared/database';
import { newId } from '../shared/ids';

config({ path: path.resolve(__dirname, '../.env') });

const DEFAULT_EMAIL = 'kammounaziz12@gmail.com';
const SEED_BATCH = 'analytics-demo-v1';

const email = String(process.argv[2] || DEFAULT_EMAIL)
  .toLowerCase()
  .trim();

interface SessionPlanItem {
  daysAgo: number;
  hour: number;
  duration: number;
  tasks: number;
  focus: number;
  topic: string;
}

const dayStart = (date: Date | string | number): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const daysAgo = (days: number, hour: number, minute = 0): Date => {
  const d = dayStart(new Date());
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
};

const sessionPlan: SessionPlanItem[] = [
  { daysAgo: 29, hour: 19, duration: 42, tasks: 3, focus: 78, topic: 'Linear Algebra' },
  { daysAgo: 27, hour: 20, duration: 36, tasks: 2, focus: 74, topic: 'Calculus Review' },
  { daysAgo: 25, hour: 18, duration: 55, tasks: 4, focus: 83, topic: 'Data Structures' },
  { daysAgo: 23, hour: 21, duration: 28, tasks: 2, focus: 69, topic: 'Algorithms' },
  { daysAgo: 21, hour: 17, duration: 64, tasks: 5, focus: 86, topic: 'Operating Systems' },
  { daysAgo: 19, hour: 20, duration: 33, tasks: 2, focus: 72, topic: 'Networking' },
  { daysAgo: 17, hour: 19, duration: 48, tasks: 3, focus: 81, topic: 'Machine Learning' },
  { daysAgo: 15, hour: 18, duration: 52, tasks: 4, focus: 84, topic: 'Databases' },
  { daysAgo: 13, hour: 22, duration: 31, tasks: 2, focus: 70, topic: 'Security' },
  { daysAgo: 11, hour: 19, duration: 46, tasks: 3, focus: 79, topic: 'Web Development' },
  { daysAgo: 9, hour: 20, duration: 58, tasks: 4, focus: 88, topic: 'System Design' },
  { daysAgo: 7, hour: 17, duration: 37, tasks: 3, focus: 76, topic: 'Probability' },
  { daysAgo: 5, hour: 18, duration: 49, tasks: 4, focus: 82, topic: 'Statistics' },
  { daysAgo: 3, hour: 21, duration: 41, tasks: 3, focus: 80, topic: 'Exam Practice' },
  { daysAgo: 2, hour: 19, duration: 62, tasks: 5, focus: 90, topic: 'Capstone Review' },
  { daysAgo: 1, hour: 20, duration: 44, tasks: 3, focus: 85, topic: 'Flashcards' },
  { daysAgo: 0, hour: 18, duration: 38, tasks: 3, focus: 87, topic: 'Final Review' }
];

const buildEvents = (userId: string) => {
  const events: Array<{
    id: string;
    userId: string;
    eventType: string;
    metadata: Prisma.InputJsonValue;
    timestamp: Date;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  sessionPlan.forEach((session, sessionIndex) => {
    const sessionId = `seed-session-${SEED_BATCH}-${session.daysAgo}`;
    const startedAt = daysAgo(session.daysAgo, session.hour, 0);
    const completedAt = daysAgo(session.daysAgo, session.hour, Math.min(55, session.duration));

    events.push({
      id: newId(),
      userId,
      eventType: 'study_session_started',
      metadata: {
        seedBatch: SEED_BATCH,
        sessionId,
        topic: session.topic
      },
      timestamp: startedAt,
      createdAt: startedAt,
      updatedAt: startedAt
    });

    for (let taskIndex = 0; taskIndex < session.tasks; taskIndex += 1) {
      const taskTimestamp = daysAgo(session.daysAgo, session.hour, Math.min(55, 8 + taskIndex * 7));

      events.push({
        id: newId(),
        userId,
        eventType: 'task_completed',
        metadata: {
          seedBatch: SEED_BATCH,
          sessionId,
          taskId: `seed-task-${sessionIndex}-${taskIndex}`,
          taskIndex,
          taskTitle: `${session.topic} task ${taskIndex + 1}`,
          xpEarned: 15 + (taskIndex % 2) * 5
        },
        timestamp: taskTimestamp,
        createdAt: taskTimestamp,
        updatedAt: taskTimestamp
      });
    }

    if (sessionIndex % 3 === 0) {
      const focusTimestamp = daysAgo(session.daysAgo, session.hour, 15);
      events.push({
        id: newId(),
        userId,
        eventType: 'focus_tracked',
        metadata: {
          seedBatch: SEED_BATCH,
          sessionId,
          focusScore: session.focus
        },
        timestamp: focusTimestamp,
        createdAt: focusTimestamp,
        updatedAt: focusTimestamp
      });
    }

    events.push({
      id: newId(),
      userId,
      eventType: 'study_session_completed',
      metadata: {
        seedBatch: SEED_BATCH,
        sessionId,
        duration: session.duration,
        focusScore: session.focus,
        completedTasks: session.tasks,
        totalTasks: session.tasks,
        topic: session.topic
      },
      timestamp: completedAt,
      createdAt: completedAt,
      updatedAt: completedAt
    });
  });

  const planGeneratedAt = daysAgo(16, 12, 20);
  const courseIngestedAt = daysAgo(18, 11, 45);

  events.push(
    {
      id: newId(),
      userId,
      eventType: 'course_ingested',
      metadata: {
        seedBatch: SEED_BATCH,
        courseTitle: 'Demo Analytics Course'
      },
      timestamp: courseIngestedAt,
      createdAt: courseIngestedAt,
      updatedAt: courseIngestedAt
    },
    {
      id: newId(),
      userId,
      eventType: 'plan_generated',
      metadata: {
        seedBatch: SEED_BATCH,
        courseTitle: 'Demo Analytics Course'
      },
      timestamp: planGeneratedAt,
      createdAt: planGeneratedAt,
      updatedAt: planGeneratedAt
    }
  );

  return events;
};

async function run(): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seeding is development only');
  const url = process.env.DATABASE_URL;
  if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname))
    throw new Error('Analytics demo seeding requires a loopback PostgreSQL database');

  await connectDatabase();
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) {
      throw new Error(`No user found with email ${email}`);
    }

    const userId = user.id;
    const events = buildEvents(userId);

    // The seed batch marker is stored inside `metadata`; delete the previous batch
    // so a re-run replaces its own events instead of duplicating them.
    const existing = await prisma.analyticsEvent.findMany({
      where: { userId },
      select: { id: true, metadata: true }
    });
    const stale = existing
      .filter(
        (row) =>
          row.metadata &&
          typeof row.metadata === 'object' &&
          (row.metadata as Record<string, unknown>).seedBatch === SEED_BATCH
      )
      .map((row) => row.id);
    if (stale.length) await prisma.analyticsEvent.deleteMany({ where: { id: { in: stale } } });
    await prisma.analyticsEvent.createMany({ data: events, skipDuplicates: true });

    console.log(`Seeded ${events.length} analytics events for ${email} (${userId}).`);
    console.log('Seed batch:', SEED_BATCH);
    console.log('Summary shape:', {
      studySessions: sessionPlan.length,
      completedTasks: sessionPlan.reduce((sum, session) => sum + session.tasks, 0),
      totalStudyMinutes: sessionPlan.reduce((sum, session) => sum + session.duration, 0)
    });
  } finally {
    await disconnectDatabase();
  }
}

run().catch(async (error: Error) => {
  console.error('Analytics seed failed:', error.message);
  try {
    await disconnectDatabase();
  } catch {
    // Ignore disconnect failures.
  }
  process.exit(1);
});
