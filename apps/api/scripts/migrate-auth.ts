import { MongoClient, ObjectId, Db } from 'mongodb';
import path from 'path';
import dotenv from 'dotenv';

interface MigrateAuthOptions {
  apply?: boolean;
}

interface MigrateAuthResult {
  inspected: number;
  mode: 'applied' | 'dry-run';
  identities?: number;
}

export async function migrateAuth(
  db: Db,
  { apply = false }: MigrateAuthOptions = {}
): Promise<MigrateAuthResult> {
  const users = await db.collection('users').find({}).toArray();
  const emails = new Set<string>();
  // Validate every row before writing any row. Never print identities or credential material.
  for (const user of users) {
    const email = String(user.email || '')
      .trim()
      .toLowerCase();
    if (!email || emails.has(email) || !(user._id instanceof ObjectId))
      throw new Error('Invalid or duplicate legacy identity; no migration performed');
    emails.add(email);
    const existing = await db
      .collection('auth_users')
      .findOne({ $or: [{ _id: user._id }, { email }] });
    if (existing && String(existing._id) !== String(user._id))
      throw new Error('Conflicting Better Auth identity; no migration performed');
    const credential = await db
      .collection('auth_accounts')
      .findOne({ userId: user._id, providerId: 'credential' });
    if (!credential && !/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(user.password || ''))
      throw new Error('Unsupported legacy password format; no migration performed');
  }
  if (apply) {
    await db.collection('auth_users').createIndex({ email: 1 }, { unique: true });
    await db.collection('auth_sessions').createIndex({ token: 1 }, { unique: true });
    await db.collection('auth_sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await db
      .collection('auth_accounts')
      .createIndex({ providerId: 1, accountId: 1 }, { unique: true });
    for (const user of users) {
      const now = new Date();
      await db.collection('auth_users').updateOne(
        { _id: user._id },
        {
          $setOnInsert: {
            email: user.email.trim().toLowerCase(),
            name: user.name,
            emailVerified: Boolean(user.isVerified),
            createdAt: user.createdAt || now,
            updatedAt: user.updatedAt || now
          }
        },
        { upsert: true }
      );
      await db.collection('auth_accounts').updateOne(
        { userId: user._id, providerId: 'credential' },
        {
          $setOnInsert: {
            _id: new ObjectId(),
            userId: user._id,
            accountId: String(user._id),
            providerId: 'credential',
            password: user.password,
            createdAt: user.createdAt || now,
            updatedAt: now
          }
        },
        { upsert: true }
      );
    }
  }
  return {
    inspected: users.length,
    mode: apply ? 'applied' : 'dry-run',
    identities: apply ? await db.collection('auth_users').countDocuments() : undefined
  };
}

if (typeof require !== 'undefined' && require.main === module) {
  dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });
  const mongoUri = process.env.DOCKER_MONGODB_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MongoDB URI not provided');
  }
  const client = new MongoClient(mongoUri);
  (async () => {
    try {
      await client.connect();
      console.log(
        JSON.stringify(await migrateAuth(client.db(), { apply: process.argv.includes('--apply') }))
      );
    } finally {
      await client.close();
    }
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export default migrateAuth;
