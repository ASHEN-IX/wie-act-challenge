import { config } from 'dotenv';
import path from 'node:path';
import { connectDatabase, disconnectDatabase, prisma, prismaClient } from '../shared/database';
import { createAuth, defaultNotificationPreferences } from '../shared/betterAuth';

config({ path: path.resolve(__dirname, '../.env') });

const users = [
  { email: 'admin@example.test', name: 'Demo Admin', role: 'admin', tier: 'vip_plus' },
  { email: 'student@example.test', name: 'Demo Student', role: 'student', tier: 'trial' },
  { email: 'normal@example.test', name: 'Demo Normal', role: 'student', tier: 'normal' },
  { email: 'vip@example.test', name: 'Demo VIP', role: 'student', tier: 'vip' },
  { email: 'vipplus@example.test', name: 'Demo VIP Plus', role: 'student', tier: 'vip_plus' }
] as const;

const ONBOARDING_DRAFT = {
  studyGoals: [],
  preferredSubjects: [],
  weeklyHours: 0,
  studyLevel: 'beginner',
  studyTime: 'evening',
  timezone: 'UTC',
  language: 'en',
  notificationPreferences: { email: true, push: true }
};

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seeding is development only');
  const url = process.env.DATABASE_URL;
  if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname))
    throw new Error('Demo users can only be seeded into a loopback PostgreSQL database');

  await connectDatabase();
  try {
    const prismaClientInstance = prismaClient();
    const baseURL = 'http://localhost:8080';
    const auth = await createAuth({ baseURL, sendMail: async () => {} });
    for (const user of users) {
      const identity = await prismaClientInstance.authUser.findUnique({
        where: { email: user.email },
        select: { id: true }
      });
      const domain = await prismaClientInstance.user.findUnique({
        where: { email: user.email },
        select: { id: true }
      });
      if (identity || domain) {
        console.log(`Skipped existing user: ${user.email}`);
        continue;
      }
      await auth.api.signUpEmail({
        body: {
          email: user.email,
          name: user.name,
          password: process.env.DEMO_USER_PASSWORD || 'EdNovaDemo!2026'
        }
      });
      const created = await prismaClientInstance.authUser.findUnique({
        where: { email: user.email },
        select: { id: true }
      });
      if (!created) throw new Error(`Missing auth identity for ${user.email}`);
      const now = new Date();
      await prismaClientInstance.authUser.update({
        where: { id: created.id },
        data: { emailVerified: true, updatedAt: now }
      });
      await prisma.user.update({
        where: { id: created.id },
        data: {
          role: user.role,
          isAdmin: user.role === 'admin',
          tier: user.tier,
          isVerified: true,
          isActive: true,
          updatedAt: now,
          onboardingCompletedAt: now,
          notificationPreferences: defaultNotificationPreferences(),
          onboardingDraft: ONBOARDING_DRAFT,
          ...(user.tier !== 'trial'
            ? {
                subscriptionStartAt: now,
                subscriptionEndAt: new Date(now.getTime() + 365 * 86400000),
                subscriptionDurationMonths: 12,
                autoRenew: false
              }
            : {})
        }
      });
      console.log(`Created ${user.email} (${user.role}, ${user.tier})`);
    }
  } finally {
    await disconnectDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
