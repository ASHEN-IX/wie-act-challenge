import test from 'node:test';
import assert from 'node:assert/strict';
import { connectDatabase, disconnectDatabase, prisma } from '../../shared/database';
import { newId } from '../../shared/ids';

/**
 * M04-A.2 — institution invitation index readiness.
 *
 * The Mongo suite drove `scripts/migrate-institution-indexes.ts` through
 * dry-run / apply / repeat and inspected `db.collection(...).indexes()`.
 * PostgreSQL indexes are declared in the Prisma schema and applied by
 * `prisma migrate deploy`, so there is no runtime migration to drive. The
 * properties that migration guaranteed are asserted against the live schema
 * instead, plus the duplicate-token and multiple-pending-invitation behaviour
 * the old script protected.
 */

const TOKEN_INDEX = 'institution_invitations_tokenHash_key';
const LISTING_INDEX = 'institution_invitations_institutionId_status_expiresAt_idx';

interface IndexRow {
  indexname: string;
  columns: string;
  isunique: boolean;
}

async function invitationIndexes() {
  const rows = (await prisma.$queryRaw<IndexRow[]>`
    SELECT i.relname AS indexname,
           string_agg(a.attname, ',' ORDER BY k.ord) AS columns,
           ix.indisunique AS isunique
    FROM pg_index ix
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
    WHERE t.relname = 'institution_invitations' AND t.relnamespace = 'public'::regnamespace
    GROUP BY i.relname, ix.indisunique
    ORDER BY i.relname
  `) as IndexRow[];
  return rows.map((row) => ({
    name: row.indexname,
    columns: row.columns.split(','),
    unique: row.isunique
  }));
}

test('M04-A.2 institution invitation index readiness', { timeout: 60000 }, async (t) => {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || 'postgresql://ednova:ednova@127.0.0.1:5433/ednova_test';
  await connectDatabase();

  const institutionIds: string[] = [];
  t.after(async () => {
    await prisma.institutionInvitation.deleteMany({
      where: { institutionId: { in: institutionIds } }
    });
    await prisma.institution.deleteMany({ where: { id: { in: institutionIds } } });
    await disconnectDatabase().catch(() => undefined);
  });

  async function institution(slugSuffix: string) {
    const id = newId();
    institutionIds.push(id);
    await prisma.institution.create({
      data: {
        id,
        name: `M04A2 ${slugSuffix}`,
        slug: `m04a2-${slugSuffix}-${id}`,
        createdByUserId: 'synthetic-issuer',
        status: 'active'
      }
    });
    return id;
  }

  function invitation(
    institutionId: string,
    role: 'instructor' | 'university_student',
    tokenHash: string
  ) {
    return {
      institutionId,
      role,
      tokenHash,
      status: 'pending' as const,
      issuedByUserId: 'synthetic-issuer',
      expiresAt: new Date('2030-01-01T00:00:00.000Z')
    };
  }

  await t.test('required indexes exist with stable definitions and no drift', async () => {
    // The schema has been migrated; inspecting it twice must describe the same
    // durable state, and the obsolete per-role unique index must not exist.
    const first = await invitationIndexes();
    assert.deepEqual(await invitationIndexes(), first);

    assert.ok(
      !first.some(
        (index) =>
          index.unique &&
          JSON.stringify(index.columns) === JSON.stringify(['institutionId', 'role'])
      ),
      'role uniqueness must not survive the migration'
    );
    const tokenIndex = first.find((index) => index.name === TOKEN_INDEX);
    assert.equal(tokenIndex?.unique, true, 'token hash must be unique');
    assert.deepEqual(tokenIndex?.columns, ['tokenHash']);

    const listing = first.find((index) => index.name === LISTING_INDEX);
    assert.ok(listing, 'institution/status/expiry index must exist');
    assert.deepEqual(listing.columns, ['institutionId', 'status', 'expiresAt']);
    assert.equal(listing.unique, false);
  });

  await t.test('each required index is present exactly once', async () => {
    // The Mongo script skipped indexes that already matched. The Postgres
    // equivalent is that the schema holds one definition per required name and
    // key set — never a duplicate index over the same columns.
    const indexes = await invitationIndexes();
    assert.equal(indexes.filter((index) => index.name === TOKEN_INDEX).length, 1);
    assert.equal(indexes.filter((index) => index.name === LISTING_INDEX).length, 1);
    const tokenKeyed = indexes.filter(
      (index) => JSON.stringify(index.columns) === JSON.stringify(['tokenHash'])
    );
    assert.equal(tokenKeyed.length, 1, 'only one index may cover tokenHash');
    assert.equal(tokenKeyed[0].unique, true);
  });

  await t.test('duplicate token hashes are rejected before any state change', async () => {
    const institutionId = await institution('duplicate');
    const tokenHash = 'e'.repeat(64);
    const before = await invitationIndexes();

    await prisma.institutionInvitation.create({
      data: { id: newId(), ...invitation(institutionId, 'university_student', tokenHash) }
    });
    await assert.rejects(
      () =>
        prisma.institutionInvitation.create({
          data: { id: newId(), ...invitation(institutionId, 'university_student', tokenHash) }
        }),
      (error: unknown) => (error as { code?: string }).code === 'P2002'
    );

    assert.equal(
      await prisma.institutionInvitation.count({ where: { institutionId, tokenHash } }),
      1,
      'the duplicate must not have been stored'
    );
    assert.deepEqual(await invitationIndexes(), before);
  });

  await t.test('token uniqueness fails closed while the listing index is retained', async () => {
    // The old script refused to proceed when an existing token index was not
    // unique. In the migrated schema that guard is the unique constraint itself:
    // a colliding token cannot be written, and the listing index still serves
    // the pending-invitation lookup.
    const institutionId = await institution('incompatible');
    const tokenHash = 'f'.repeat(64);
    await prisma.institutionInvitation.create({
      data: { id: newId(), ...invitation(institutionId, 'instructor', tokenHash) }
    });

    await assert.rejects(
      () =>
        prisma.institutionInvitation.create({
          data: { id: newId(), ...invitation(institutionId, 'university_student', tokenHash) }
        }),
      (error: unknown) => (error as { code?: string }).code === 'P2002'
    );

    const indexes = await invitationIndexes();
    assert.ok(indexes.some((index) => index.name === LISTING_INDEX));
    assert.equal(indexes.find((index) => index.name === TOKEN_INDEX)?.unique, true);
  });

  await t.test('a fresh table accepts multiple pending invitations per role', async () => {
    // No collection has to be created at runtime; the empty-table behaviour the
    // old script covered is that independent pending invitations - the reason
    // the obsolete unique index was dropped - are accepted.
    const institutionId = await institution('fresh');
    await prisma.institutionInvitation.createMany({
      data: [
        { id: newId(), ...invitation(institutionId, 'university_student', 'c'.repeat(64)) },
        { id: newId(), ...invitation(institutionId, 'university_student', 'd'.repeat(64)) }
      ]
    });
    assert.equal(
      await prisma.institutionInvitation.count({
        where: { institutionId, role: 'university_student', status: 'pending' }
      }),
      2
    );
  });
});
