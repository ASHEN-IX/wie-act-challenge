import { MongoClient, type Db, type IndexDescription } from 'mongodb';
import path from 'path';
import dotenv from 'dotenv';

interface MigrateInstitutionIndexesOptions {
  apply?: boolean;
}

interface MigrateInstitutionIndexesResult {
  mode: 'applied' | 'dry-run';
  inspected: string[];
  dropped: string[];
  created: string[];
  retained: string[];
}

const INVITATION_COLLECTION = 'institution_invitations';
const OLD_UNIQUE_KEYS = JSON.stringify({ institutionId: 1, role: 1 });
const REQUIRED_INDEXES: Array<{
  name: string;
  keys: Record<string, 1>;
  options: { unique?: boolean };
}> = [
  { name: 'tokenHash_1', keys: { tokenHash: 1 }, options: { unique: true } },
  {
    name: 'institutionId_1_status_1_expiresAt_1',
    keys: { institutionId: 1, status: 1, expiresAt: 1 },
    options: {}
  }
];

function keysEqual(actual: Record<string, unknown>, expected: Record<string, unknown>): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function hasRequiredDefinition(
  index: IndexDescription,
  required: (typeof REQUIRED_INDEXES)[number]
): boolean {
  return (
    keysEqual(index.key as Record<string, unknown>, required.keys) &&
    (index.unique === true) === (required.options.unique === true) &&
    index.sparse !== true &&
    index.hidden !== true &&
    index.partialFilterExpression === undefined
  );
}

function incompatibleIndexError(
  required: (typeof REQUIRED_INDEXES)[number],
  index: IndexDescription
): Error {
  return new Error(
    `Incompatible existing index "${index.name || '<unnamed>'}" for required index "${required.name}"; ` +
      `expected keys ${JSON.stringify(required.keys)} with ${required.options.unique ? 'unique ' : ''}` +
      `options and no sparse/partial/hidden filter; found keys ${JSON.stringify(index.key)}. ` +
      'Repair the conflicting index manually, then rerun.'
  );
}

function isObsoleteRoleUniqueIndex(index: IndexDescription): boolean {
  return (
    index.unique === true &&
    JSON.stringify(index.key) === OLD_UNIQUE_KEYS &&
    index.partialFilterExpression?.status === 'pending'
  );
}

/**
 * Removes the obsolete one-pending-invitation-per-role index and ensures the
 * token-hash uniqueness and lookup indexes exist. Safe to run repeatedly.
 *
 * Invitations are independent bearer capabilities. Without an approved
 * recipient-binding field, a university legitimately needs several pending
 * student/instructor invitations at once. The raw-token hash remains unique.
 */
export async function migrateInstitutionInvitationIndexes(
  db: Db,
  { apply = false }: MigrateInstitutionIndexesOptions = {}
): Promise<MigrateInstitutionIndexesResult> {
  const collection = db.collection(INVITATION_COLLECTION);
  let indexes: IndexDescription[] = [];
  try {
    indexes = await collection.indexes();
  } catch (error) {
    if ((error as { codeName?: string }).codeName !== 'NamespaceNotFound') throw error;
  }

  const obsolete = indexes.filter(isObsoleteRoleUniqueIndex);
  const conflicts = REQUIRED_INDEXES.flatMap((required) => {
    const named = indexes.find((index) => index.name === required.name);
    if (named && !hasRequiredDefinition(named, required)) {
      return [incompatibleIndexError(required, named)];
    }
    const sameKeys = indexes.find(
      (index) =>
        index.name !== required.name &&
        keysEqual(index.key as Record<string, unknown>, required.keys)
    );
    if (sameKeys) return [incompatibleIndexError(required, sameKeys)];
    return [];
  });
  if (conflicts.length) {
    throw new Error(
      `${conflicts.map((error) => error.message).join(' ')} No migration changes were applied.`
    );
  }

  const missing = REQUIRED_INDEXES.filter(
    (required) =>
      !indexes.some(
        (index) => index.name === required.name && hasRequiredDefinition(index, required)
      )
  );
  const result: MigrateInstitutionIndexesResult = {
    mode: apply ? 'applied' : 'dry-run',
    inspected: indexes.map((index) => index.name || '<unnamed>').sort(),
    dropped: [],
    created: [],
    retained: indexes
      .filter((index) => !isObsoleteRoleUniqueIndex(index))
      .map((index) => index.name || '<unnamed>')
      .sort()
  };

  if (!apply) {
    result.dropped = obsolete.map((index) => index.name || '<unnamed>');
    result.created = missing.map((index) => index.name);
    return result;
  }

  // Validate token-hash uniqueness before adding the unique index. A collision
  // is not expected, but silently failing would leave the upgrade incomplete.
  if (missing.some((index) => index.name === 'tokenHash_1')) {
    const duplicate = await collection
      .aggregate([
        { $group: { _id: '$tokenHash', count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $limit: 1 }
      ])
      .toArray();
    if (duplicate.length) {
      throw new Error('Duplicate invitation token hashes prevent the unique index upgrade');
    }
  }

  for (const index of missing) {
    await collection.createIndex(index.keys, { name: index.name, ...index.options });
    result.created.push(index.name);
  }
  for (const index of obsolete) {
    const name = index.name || '<unnamed>';
    await collection.dropIndex(name);
    result.dropped.push(name);
  }
  return result;
}

if (typeof require !== 'undefined' && require.main === module) {
  dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });
  const mongoUri = process.env.DOCKER_MONGODB_URI || process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MongoDB URI not provided');
  const client = new MongoClient(mongoUri);
  (async () => {
    try {
      await client.connect();
      console.log(
        JSON.stringify(
          await migrateInstitutionInvitationIndexes(client.db(), {
            apply: process.argv.includes('--apply')
          })
        )
      );
    } finally {
      await client.close();
    }
  })().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export default migrateInstitutionInvitationIndexes;
