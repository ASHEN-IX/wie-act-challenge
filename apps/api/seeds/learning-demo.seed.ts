import { config } from 'dotenv';
import path from 'node:path';
import { connectDatabase, disconnectDatabase, prisma } from '../shared/database';
import { createAuth, defaultNotificationPreferences } from '../shared/betterAuth';
import {
  bootstrapInstitution,
  issueInstitutionInvitation,
  acceptInstitutionInvitation
} from '../modules/study/src/services/institutions';

config({ path: path.resolve(__dirname, '../.env') });
const accounts = [
  { email: 'admin@ednova.test', name: 'EdNova Demo Admin', role: 'university_admin' },
  { email: 'instructor@ednova.test', name: 'EdNova Demo Instructor', role: 'instructor' },
  { email: 'learner@ednova.test', name: 'EdNova Demo Learner', role: 'university_student' },
  { email: 'peer@ednova.test', name: 'EdNova Demo Peer', role: 'university_student' }
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
    throw new Error('Learning demo requires an explicitly configured loopback PostgreSQL database');
  const password = process.env.DEMO_USER_PASSWORD || 'EdNovaDemo!2026';

  await connectDatabase();
  try {
    const auth = await createAuth({ sendMail: async () => {} });
    const ids = new Map<string, string>();
    for (const account of accounts) {
      let identity = await prisma.authUser.findUnique({
        where: { email: account.email },
        select: { id: true }
      });
      if (!identity) {
        if (await prisma.user.findUnique({ where: { email: account.email }, select: { id: true } }))
          throw new Error(`Existing domain account has no auth identity: ${account.email}`);
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
            onboardingDraft: ONBOARDING_DRAFT,
            updatedAt: now
          }
        });
        console.log(`Created ${account.email}`);
      }
      // Existing demo passwords, roles and suspended grants are never overwritten.
      const login = await auth.api.signInEmail({ body: { email: account.email, password } });
      if (login.user.id !== identity.id) throw new Error('Auth identity mismatch');
      await prisma.authSession.deleteMany({ where: { token: login.token } });
      ids.set(account.email, login.user.id);
      console.log(`Verified login: ${account.email}; user ID: ${login.user.id}`);
    }

    const adminId = ids.get(accounts[0].email)!;
    let institution = await prisma.institution.findUnique({
      where: { slug: 'ednova-learning-demo' }
    });
    if (!institution) {
      const created = await bootstrapInstitution({
        actorUserId: adminId,
        name: 'EdNova Learning Demo',
        slug: 'ednova-learning-demo'
      });
      institution = await prisma.institution.findUnique({ where: { id: created.institution.id } });
    }
    if (!institution || institution.createdByUserId !== adminId || institution.status !== 'active')
      throw new Error('Existing demo institution requires manual review');
    for (const account of accounts) {
      const userId = ids.get(account.email)!;
      const membership = await prisma.institutionMembership.findFirst({
        where: { institutionId: institution.id, userId }
      });
      if (membership) {
        if (membership.status !== 'active' || membership.role !== account.role)
          throw new Error(`Existing demo membership differs: ${account.email}`);
      } else {
        if (account.role === 'university_admin') throw new Error('Demo admin membership missing');
        const invitation = await issueInstitutionInvitation({
          actorUserId: adminId,
          institutionId: institution.id,
          role: account.role
        });
        await acceptInstitutionInvitation({ actorUserId: userId, token: invitation.token });
      }
      console.log(`Membership: ${account.email} → ${account.role}`);
    }
    console.log(`Institution ID: ${institution.id}`);
    console.log(
      'Demo ready. Existing courses, attempts, passwords and unrelated users were preserved.'
    );
  } finally {
    await disconnectDatabase();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Demo seed failed');
  process.exitCode = 1;
});
