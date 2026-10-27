import { config } from 'dotenv';
import path from 'node:path';
import { MongoClient } from 'mongodb';
import mongoose from 'mongoose';
import { createAuth } from '../shared/betterAuth';
import { Institution, InstitutionMembership } from '../modules/study/src/models/Institution';
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

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(uri).hostname))
    throw new Error('Learning demo requires an explicitly configured loopback MongoDB URI');
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seeding is development only');
  const password = process.env.DEMO_USER_PASSWORD || 'EdNovaDemo!2026';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    await mongoose.connect(uri);
    const db = client.db();
    const auth = await createAuth(db, { sendMail: async () => {} });
    const ids = new Map<string, string>();
    for (const account of accounts) {
      let identity = await db.collection('auth_users').findOne({ email: account.email });
      if (!identity) {
        if (await db.collection('users').findOne({ email: account.email }))
          throw new Error(`Existing domain account has no auth identity: ${account.email}`);
        await auth.api.signUpEmail({
          body: { email: account.email, name: account.name, password }
        });
        identity = await db.collection('auth_users').findOne({ email: account.email });
        if (!identity) throw new Error(`Missing auth identity: ${account.email}`);
        const now = new Date();
        await db
          .collection('auth_users')
          .updateOne({ _id: identity._id }, { $set: { emailVerified: true, updatedAt: now } });
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
        console.log(`Created ${account.email}`);
      }
      // Existing demo passwords, roles and suspended grants are never overwritten.
      const login = await auth.api.signInEmail({ body: { email: account.email, password } });
      if (login.user.id !== identity._id.toString()) throw new Error('Auth identity mismatch');
      await db.collection('auth_sessions').deleteOne({ token: login.token });
      ids.set(account.email, login.user.id);
      console.log(`Verified login: ${account.email}; user ID: ${login.user.id}`);
    }
    await Institution.init();
    await InstitutionMembership.init();
    const adminId = ids.get(accounts[0].email)!;
    let institution = await Institution.findOne({ slug: 'ednova-learning-demo' });
    if (!institution) {
      const created = await bootstrapInstitution({
        actorUserId: adminId,
        name: 'EdNova Learning Demo',
        slug: 'ednova-learning-demo'
      });
      institution = await Institution.findById(created.institution.id);
    }
    if (!institution || institution.createdByUserId !== adminId || institution.status !== 'active')
      throw new Error('Existing demo institution requires manual review');
    for (const account of accounts) {
      const userId = ids.get(account.email)!;
      const membership = await InstitutionMembership.findOne({
        institutionId: institution._id,
        userId
      });
      if (membership) {
        if (membership.status !== 'active' || membership.role !== account.role)
          throw new Error(`Existing demo membership differs: ${account.email}`);
      } else {
        if (account.role === 'university_admin') throw new Error('Demo admin membership missing');
        const invitation = await issueInstitutionInvitation({
          actorUserId: adminId,
          institutionId: institution._id.toString(),
          role: account.role
        });
        await acceptInstitutionInvitation({ actorUserId: userId, token: invitation.token });
      }
      console.log(`Membership: ${account.email} → ${account.role}`);
    }
    console.log(`Institution ID: ${institution._id}`);
    console.log(
      'Demo ready. Existing courses, attempts, passwords and unrelated users were preserved.'
    );
  } finally {
    await mongoose.disconnect();
    await client.close();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Demo seed failed');
  process.exitCode = 1;
});
