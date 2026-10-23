import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient, ObjectId, type Db, type IndexDescription } from 'mongodb';
import { migrateInstitutionInvitationIndexes } from '../../scripts/migrate-institution-indexes';

const OLD_INDEX = 'institutionId_1_role_1';
const TOKEN_INDEX = 'tokenHash_1';
const LISTING_INDEX = 'institutionId_1_status_1_expiresAt_1';

function normalized(indexes: IndexDescription[]) {
  return indexes
    .map((index) => ({
      name: index.name,
      key: index.key,
      unique: index.unique === true,
      sparse: index.sparse === true,
      partialFilterExpression: index.partialFilterExpression ?? null
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

function invitation(
  institutionId: ObjectId,
  role: 'instructor' | 'university_student',
  tokenHash: string,
  status = 'pending'
) {
  return {
    institutionId,
    role,
    tokenHash,
    status,
    issuedByUserId: 'synthetic-issuer',
    expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-10-23T00:00:00.000Z'),
    updatedAt: new Date('2026-10-23T00:00:00.000Z')
  };
}

async function seedOldSchema(db: Db) {
  const invitations = db.collection('institution_invitations');
  await invitations.createIndex(
    { institutionId: 1, role: 1 },
    { unique: true, partialFilterExpression: { status: 'pending' } }
  );
  await invitations.createIndex(
    { externalRef: 1 },
    { unique: true, name: 'keep_external_ref_unique' }
  );
  await invitations.createIndex({ createdAt: -1 }, { name: 'keep_created_desc' });
  await invitations.insertMany([
    {
      ...invitation(new ObjectId(), 'university_student', 'a'.repeat(64)),
      externalRef: 'one'
    },
    { ...invitation(new ObjectId(), 'instructor', 'b'.repeat(64)), externalRef: 'two' }
  ]);
}

test('M04-A.2 institution invitation index migration readiness', { timeout: 60000 }, async (t) => {
  const mongoUri = 'mongodb://127.0.0.1:27018';
  const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
  } catch {
    await client.close().catch(() => undefined);
    t.skip('MongoDB test service is unavailable');
    return;
  }

  const prefix = `ednova_m04a2_migration_${process.pid}_${Date.now()}`;
  const databaseNames: string[] = [];
  function database(name: string): Db {
    databaseNames.push(`${prefix}_${name}`);
    return client.db(`${prefix}_${name}`);
  }
  t.after(async () => {
    for (const name of databaseNames) {
      await client
        .db(name)
        .dropDatabase()
        .catch(() => undefined);
    }
    await client.close().catch(() => undefined);
  });

  await t.test('dry run is inert, apply is repeatable and keeps unrelated indexes', async () => {
    const db = database('fresh');
    await seedOldSchema(db);
    const invitations = db.collection('institution_invitations');
    const before = await invitations.indexes();
    const beforeCount = await invitations.countDocuments();

    const dryRun = await migrateInstitutionInvitationIndexes(db);
    assert.equal(dryRun.mode, 'dry-run');
    assert.deepEqual(dryRun.dropped, [OLD_INDEX]);
    assert.deepEqual([...dryRun.created].sort(), [LISTING_INDEX, TOKEN_INDEX].sort());
    assert.deepEqual(normalized(await invitations.indexes()), normalized(before));
    assert.equal(await invitations.countDocuments(), beforeCount);

    const applied = await migrateInstitutionInvitationIndexes(db, { apply: true });
    assert.equal(applied.mode, 'applied');
    assert.deepEqual(applied.dropped, [OLD_INDEX]);
    assert.deepEqual([...applied.created].sort(), [LISTING_INDEX, TOKEN_INDEX].sort());

    const after = await invitations.indexes();
    assert.ok(!after.some((index) => index.name === OLD_INDEX));
    assert.equal(after.find((index) => index.name === TOKEN_INDEX)?.unique, true);
    assert.deepEqual(after.find((index) => index.name === LISTING_INDEX)?.key, {
      institutionId: 1,
      status: 1,
      expiresAt: 1
    });
    assert.ok(after.some((index) => index.name === 'keep_external_ref_unique'));
    assert.ok(after.some((index) => index.name === 'keep_created_desc'));

    const repeat = await migrateInstitutionInvitationIndexes(db, { apply: true });
    assert.deepEqual(repeat.created, []);
    assert.deepEqual(repeat.dropped, []);
    assert.deepEqual(normalized(await invitations.indexes()), normalized(after));

    const institutionId = new ObjectId();
    await invitations.insertMany([
      {
        ...invitation(institutionId, 'university_student', 'c'.repeat(64)),
        externalRef: 'three'
      },
      {
        ...invitation(institutionId, 'university_student', 'd'.repeat(64)),
        externalRef: 'four'
      }
    ]);
    assert.equal(
      await invitations.countDocuments({
        institutionId,
        role: 'university_student',
        status: 'pending'
      }),
      2
    );
  });

  await t.test('already-present required indexes are not recreated', async () => {
    const db = database('already');
    await seedOldSchema(db);
    const invitations = db.collection('institution_invitations');
    await invitations.createIndex({ tokenHash: 1 }, { unique: true, name: TOKEN_INDEX });
    await invitations.createIndex(
      { institutionId: 1, status: 1, expiresAt: 1 },
      { name: LISTING_INDEX }
    );

    const dryRun = await migrateInstitutionInvitationIndexes(db);
    assert.deepEqual(dryRun.created, []);
    assert.deepEqual(dryRun.dropped, [OLD_INDEX]);

    const applied = await migrateInstitutionInvitationIndexes(db, { apply: true });
    assert.deepEqual(applied.created, []);
    assert.deepEqual(applied.dropped, [OLD_INDEX]);
  });

  await t.test('duplicate token hashes reject before destructive changes', async () => {
    const db = database('duplicate');
    const invitations = db.collection('institution_invitations');
    await invitations.createIndex(
      { institutionId: 1, role: 1 },
      { unique: true, partialFilterExpression: { status: 'pending' } }
    );
    await invitations.insertMany([
      invitation(new ObjectId(), 'university_student', 'e'.repeat(64), 'accepted'),
      invitation(new ObjectId(), 'university_student', 'e'.repeat(64), 'accepted')
    ]);
    const before = await invitations.indexes();

    await assert.rejects(
      () => migrateInstitutionInvitationIndexes(db, { apply: true }),
      /Duplicate invitation token hashes/
    );
    assert.deepEqual(normalized(await invitations.indexes()), normalized(before));
  });

  await t.test('incompatible token index fails closed without dropping the old index', async () => {
    const db = database('incompatible');
    await seedOldSchema(db);
    const invitations = db.collection('institution_invitations');
    await invitations.createIndex({ tokenHash: 1 }, { name: TOKEN_INDEX, unique: false });
    const before = await invitations.indexes();

    await assert.rejects(
      () => migrateInstitutionInvitationIndexes(db, { apply: true }),
      /Incompatible existing index/
    );

    const after = await invitations.indexes();
    assert.deepEqual(normalized(after), normalized(before));
    assert.ok(after.some((index) => index.name === OLD_INDEX));
    assert.ok(!after.some((index) => index.name === LISTING_INDEX));
    assert.equal(after.find((index) => index.name === TOKEN_INDEX)?.unique, undefined);
  });

  await t.test('missing collection is created without a destructive drop', async () => {
    const db = database('absent');
    const dryRun = await migrateInstitutionInvitationIndexes(db);
    assert.deepEqual(dryRun.inspected, []);
    assert.deepEqual(dryRun.dropped, []);
    assert.deepEqual([...dryRun.created].sort(), [LISTING_INDEX, TOKEN_INDEX].sort());

    const applied = await migrateInstitutionInvitationIndexes(db, { apply: true });
    assert.deepEqual([...applied.created].sort(), [LISTING_INDEX, TOKEN_INDEX].sort());
    const indexes = await db.collection('institution_invitations').indexes();
    assert.deepEqual(
      indexes.map((index) => index.name).sort(),
      ['_id_', LISTING_INDEX, TOKEN_INDEX].sort()
    );
  });
});
