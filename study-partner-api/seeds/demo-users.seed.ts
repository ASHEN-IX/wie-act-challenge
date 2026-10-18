import { MongoClient } from 'mongodb';
import { createAuth } from '../shared/betterAuth';

const users = [
  { email: 'admin@example.test', name: 'Demo Admin', role: 'admin', tier: 'vip_plus' },
  { email: 'student@example.test', name: 'Demo Student', role: 'student', tier: 'trial' },
  { email: 'normal@example.test', name: 'Demo Normal', role: 'student', tier: 'normal' },
  { email: 'vip@example.test', name: 'Demo VIP', role: 'student', tier: 'vip' },
  { email: 'vipplus@example.test', name: 'Demo VIP Plus', role: 'student', tier: 'vip_plus' }
];

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/study_partner';
  const host = new URL(uri).hostname;
  if (!['localhost', '127.0.0.1', 'mongodb'].includes(host)) {
    throw new Error('Demo users can only be seeded into local MongoDB');
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const baseURL = 'http://localhost:8080';
    const auth = await createAuth(db, { baseURL, sendMail: async () => {} });
    for (const user of users) {
      const exists = await db.collection('auth_users').findOne({ email: user.email });
      const domain = await db.collection('users').findOne({ email: user.email });
      if (exists || domain) {
        console.log(`Skipped existing user: ${user.email}`);
        continue;
      }
      await auth.api.signUpEmail({
        body: {
          email: user.email,
          name: user.name,
          password: process.env.DEMO_USER_PASSWORD || 'MindflowDemo!2026'
        }
      });
      const identity = await db.collection('auth_users').findOne({ email: user.email });
      if (!identity) throw new Error(`Missing auth identity for ${user.email}`);
      const now = new Date();
      await db.collection('auth_users').updateOne(
        { _id: identity._id },
        {
          $set: { emailVerified: true, updatedAt: now }
        }
      );
      await db.collection('users').updateOne(
        { _id: identity._id },
        {
          $set: {
            role: user.role,
            isAdmin: user.role === 'admin',
            tier: user.tier,
            isVerified: true,
            isActive: true,
            updatedAt: now,
            onboardingCompletedAt: now,
            ...(user.tier !== 'trial'
              ? {
                  subscriptionStartAt: now,
                  subscriptionEndAt: new Date(now.getTime() + 365 * 86400000),
                  subscriptionDurationMonths: 12,
                  autoRenew: false
                }
              : {})
          }
        }
      );
      console.log(`Created ${user.email} (${user.role}, ${user.tier})`);
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
