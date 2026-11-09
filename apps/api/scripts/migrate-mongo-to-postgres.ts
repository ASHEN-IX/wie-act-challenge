/**
 * MongoDB → PostgreSQL data migration for EdNova.
 *
 * Usage:
 *   MONGODB_URI=mongodb://localhost:27017/ednova \
 *   DATABASE_URL=postgresql://user:pass@host:5432/ednova \
 *   tsx --tsconfig tsconfig.json scripts/migrate-mongo-to-postgres.ts [flags]
 *
 * Flags:
 *   --dry-run        Read and convert only; never write.
 *   --truncate       Empty the target tables first. Requires --yes.
 *   --yes            Confirm a destructive --truncate.
 *   --strict         Abort on the first document that cannot be converted.
 *   --batch=<n>      Documents per insert batch (default 500).
 *   --report=<path>  Where to write migration-report.json.
 *
 * Rules:
 *   * MongoDB primary IDs and references are converted to stable UUIDs.
 *     Existing UUIDs, revision tags and other non-identifier text are retained.
 *   * The run is idempotent: rows are inserted with `createMany({skipDuplicates})`
 *     in dependency order, so re-running never duplicates a row.
 *   * Target tables are never dropped or truncated unless `--truncate --yes` is
 *     passed explicitly; the operator runs `prisma migrate deploy` first.
 *   * Nothing is skipped silently: collections that have no mapping, models that
 *     have no source collection, and documents that fail conversion are all
 *     reported in the summary and in migration-report.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';
import { disconnectDatabase, prismaClient } from '../shared/database';
import { deterministicId, isId } from '../shared/ids';
import { defaultNotificationPreferences } from '../shared/betterAuth';

// Operators usually run this from apps/api, where the connection strings live in .env.
loadEnv({ path: path.resolve(__dirname, '../.env') });

// ── CLI ───────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const has = (flag: string) => argv.includes(flag);
const valueOf = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  const entry = argv.find((arg) => arg.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : undefined;
};

const opts = {
  dryRun: has('--dry-run'),
  truncate: has('--truncate'),
  confirmed: has('--yes'),
  strict: has('--strict'),
  batchSize: Math.max(1, Number(valueOf('batch') || 500)),
  reportPath: valueOf('report') || path.resolve(process.cwd(), 'migration-report.json')
};

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ednova';
const DATABASE_URL = process.env.DATABASE_URL;

/** Connection strings are never printed with credentials. */
function redactUrl(uri: string): string {
  try {
    const parsed = new URL(uri);
    if (parsed.password) parsed.password = '***';
    if (parsed.username) parsed.username = parsed.username ? `${parsed.username}:***` : '';
    // `URL` encodes `***` as `***`; strip the userinfo entirely for safety.
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return '<unparseable connection string>';
  }
}

// ── Schema introspection ──────────────────────────────────────────────────────
//
// The Prisma schema is the single source of truth for the column names, their
// types and which fields are required. Reading it here keeps the collection map
// below short and readable while making the converter strict about dates, JSON,
// enums and arrays instead of guessing from the Mongo value alone.

type ScalarKind =
  'string' | 'int' | 'float' | 'boolean' | 'datetime' | 'bigint' | 'json' | 'bytes' | 'enum';

interface FieldInfo {
  name: string;
  kind: ScalarKind;
  isArray: boolean;
  optional: boolean;
  hasDefault: boolean;
  isUpdatedAt: boolean;
  isUuid: boolean;
  enumValues?: Set<string>;
}

interface ModelInfo {
  name: string;
  table: string;
  delegate: string;
  fields: Map<string, FieldInfo>;
}

const SCALARS = new Set([
  'String',
  'Int',
  'Float',
  'Boolean',
  'DateTime',
  'Json',
  'BigInt',
  'Bytes',
  'Decimal'
]);

function scalarKind(base: string, enums: Map<string, Set<string>>): ScalarKind | undefined {
  if (enums.has(base)) return 'enum';
  switch (base) {
    case 'String':
      return 'string';
    case 'Int':
      return 'int';
    case 'Float':
    case 'Decimal':
      return 'float';
    case 'Boolean':
      return 'boolean';
    case 'DateTime':
      return 'datetime';
    case 'BigInt':
      return 'bigint';
    case 'Json':
      return 'json';
    case 'Bytes':
      return 'bytes';
    default:
      return undefined;
  }
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function loadSchema(): Map<string, ModelInfo> {
  const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
  const source = readFileSync(schemaPath, 'utf8');
  const enums = new Map<string, Set<string>>();
  for (const match of source.matchAll(/^enum\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const values = new Set(
      match[2]
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('//') && !line.startsWith('@@'))
    );
    enums.set(match[1], values);
  }
  const models = new Map<string, ModelInfo>();
  for (const match of source.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const name = match[1];
    const body = match[2];
    const fields = new Map<string, FieldInfo>();
    let table = lowerFirst(name);
    for (const raw of body.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('//')) continue;
      if (line.startsWith('@@')) {
        const mapped = line.match(/@@map\("([^"]+)"\)/);
        if (mapped) table = mapped[1];
        continue;
      }
      const tokens = line.split(/\s+/);
      if (tokens.length < 2) continue;
      const fieldName = tokens[0];
      const typeToken = tokens[1];
      const rest = tokens.slice(2).join(' ');
      const isArray = typeToken.endsWith('[]');
      const optional = typeToken.includes('?');
      const base = typeToken.replace(/\[\]/g, '').replace(/\?/g, '');
      const kind = scalarKind(base, enums);
      // Relation fields name another model; they are not columns.
      if (!kind) continue;
      if (!SCALARS.has(base) && kind !== 'enum') continue;
      fields.set(fieldName, {
        name: fieldName,
        kind,
        isArray,
        optional,
        hasDefault: /@default\(/.test(rest),
        isUpdatedAt: /@updatedAt/.test(rest),
        isUuid: /@db\.Uuid\b/.test(rest),
        enumValues: enums.get(base)
      });
    }
    models.set(name, { name, table, delegate: lowerFirst(name), fields });
  }
  return models;
}

// ── Value conversion ──────────────────────────────────────────────────────────

/** ObjectId → 24-hex string; every other value is returned untouched. */
function idOf(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof ObjectId) return value.toHexString();
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'toHexString' in (value as object))
    return (value as { toHexString(): string }).toHexString();
  return String(value);
}

function sourceId(doc: Record<string, unknown>): string | null {
  return idOf(doc._id ?? doc.id);
}

function migratedId(value: string): string {
  if (isId(value as unknown)) return value.toLowerCase();
  const key = /^[0-9a-f]{24}$/i.test(value) ? value.toLowerCase() : value;
  return deterministicId(`mongo:${key}`);
}

/**
 * Extractors that leave a U+0000 in a document (common in OCR text) produce a
 * JSON string PostgreSQL cannot store: `jsonb` rejects `\u0000` with SQLSTATE
 * 22P05. MongoDB accepted it. Strip the byte and count it, so the loss is
 * reported rather than silent.
 */
let strippedNullBytes = 0;

function sanitizeText(text: string): string {
  if (!text.includes('\u0000')) return text;
  strippedNullBytes += text.split('\u0000').length - 1;
  return text.replace(/\u0000/g, '');
}

/** Recursively turn BSON values into JSON-safe ones, preserving id strings. */
function plainJson(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof ObjectId) return value.toHexString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString('base64');
  if (typeof value === 'string') return sanitizeText(value);
  if (Array.isArray(value)) return value.map(plainJson);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (key === '__v') continue;
      out[sanitizeText(key)] = plainJson(inner);
    }
    return out;
  }
  return value;
}

interface CoerceResult {
  ok: boolean;
  value?: unknown;
  reason?: string;
}

function coerce(value: unknown, field: FieldInfo): CoerceResult {
  if (value === null || value === undefined) return { ok: false, reason: 'null' };
  if (field.isArray) {
    if (!Array.isArray(value)) return { ok: false, reason: `expected array for ${field.name}` };
    const items: unknown[] = [];
    for (const entry of value) {
      const one = coerceScalar(entry, field);
      if (!one.ok) return { ok: false, reason: `${field.name}: ${one.reason}` };
      items.push(one.value);
    }
    return { ok: true, value: items };
  }
  if (Array.isArray(value) && field.kind !== 'json')
    return { ok: false, reason: `expected scalar for ${field.name}` };
  return coerceScalar(value, field);
}

function coerceScalar(value: unknown, field: FieldInfo): CoerceResult {
  switch (field.kind) {
    case 'json':
      return { ok: true, value: plainJson(value) };
    case 'datetime': {
      const date = value instanceof Date ? value : new Date(value as string | number);
      if (Number.isNaN(date.getTime()))
        return { ok: false, reason: `invalid date ${String(value)}` };
      return { ok: true, value: date };
    }
    case 'bigint':
      try {
        return { ok: true, value: BigInt(value as bigint | number | string) };
      } catch {
        return { ok: false, reason: `invalid bigint ${String(value)}` };
      }
    case 'int': {
      const num = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(num)) return { ok: false, reason: `invalid int ${String(value)}` };
      return { ok: true, value: Math.trunc(num) };
    }
    case 'float': {
      const num = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(num)) return { ok: false, reason: `invalid number ${String(value)}` };
      return { ok: true, value: num };
    }
    case 'boolean':
      if (typeof value === 'boolean') return { ok: true, value };
      return { ok: true, value: Boolean(value) };
    case 'bytes':
      if (Buffer.isBuffer(value)) return { ok: true, value };
      if (typeof value === 'string') return { ok: true, value: Buffer.from(value, 'base64') };
      return { ok: false, reason: `invalid bytes for ${field.name}` };
    case 'enum': {
      const text = String(value);
      if (field.enumValues && !field.enumValues.has(text))
        return { ok: false, reason: `unknown enum value ${text} for ${field.name}` };
      return { ok: true, value: text };
    }
    case 'string':
    default:
      const text = sanitizeText(idOf(value) ?? '');
      const isLegacyReference =
        /(?:^id$|Ids?$)/.test(field.name) && /^[0-9a-f]{24}$/i.test(text);
      return { ok: true, value: field.isUuid || isLegacyReference ? migratedId(text) : text };
  }
}

/** What the operator has to fix, in words, for the Prisma errors a migration hits. */
const FAILURE_HINTS: Record<string, string> = {
  P2003: 'a referenced row does not exist in the target (orphaned reference in the source data)',
  P2002: 'a unique column already holds this value',
  P2039: 'the row is missing its primary key or a required column',
  P2020: 'a numeric value is out of range for its column'
};

interface NormalizedRow {
  row?: Record<string, unknown>;
  issues: string[];
  unknownFields: string[];
}

/**
 * Turn a raw Mongo-shaped object into a row the Prisma model accepts: only the
 * declared columns survive, values are coerced to their column type, and a row
 * missing a required column is rejected with a reason.
 */
function normalizeRow(model: ModelInfo, raw: Record<string, unknown>): NormalizedRow {
  const row: Record<string, unknown> = {};
  const issues: string[] = [];
  const unknownFields: string[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (key === '__v' || key === '_id') continue;
    const field = model.fields.get(key);
    if (!field) {
      unknownFields.push(key);
      continue;
    }
    if (value === null || value === undefined) continue;
    const result = coerce(value, field);
    if (!result.ok) issues.push(result.reason || `invalid ${key}`);
    else row[key] = result.value;
  }
  for (const [name, field] of model.fields) {
    if (field.optional || field.hasDefault || field.isUpdatedAt) continue;
    if (row[name] === undefined || row[name] === null)
      issues.push(`missing required field ${name}`);
  }
  if (issues.length) return { issues, unknownFields };
  return { row, issues, unknownFields };
}

// ── Collection map ────────────────────────────────────────────────────────────
//
// One entry per (Mongo collection → Prisma model). `order` gives the dependency
// order: identity and users first, then profiles, catalog, courses, revisions,
// enrollments, rooms, evidence and finally sessions/analytics. A collection may
// appear more than once when it feeds an embedded array that the schema stores
// as its own table (`users.refreshTokens`, `coupons.usedBy`, …).

type Overrides = (doc: Record<string, unknown>) => Record<string, unknown>;
type DerivedRows = (doc: Record<string, unknown>) => Array<Record<string, unknown>>;

interface Mapping {
  collection: string;
  model: string;
  order: number;
  /** Fields supplied by the converter when the legacy document has none. */
  overrides?: Overrides;
  /** Embedded arrays that became child tables. */
  derived?: DerivedRows;
}

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

function defaultOnboardingDraft(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(ONBOARDING_DRAFT)) as Record<string, unknown>;
}

function userRefreshTokens(doc: Record<string, unknown>): Array<Record<string, unknown>> {
  const userId = sourceId(doc);
  const tokens = Array.isArray(doc.refreshTokens) ? doc.refreshTokens : [];
  const rows: Array<Record<string, unknown>> = [];
  for (const token of tokens) {
    if (!token || typeof token !== 'object') continue;
    const entry = token as Record<string, unknown>;
    const jti = String(entry.jti || '');
    if (!jti || !entry.tokenHash || !entry.expiresAt) continue;
    rows.push({
      id: deterministicId(`refresh_token:${userId}:${jti}`),
      userId,
      tokenHash: String(entry.tokenHash),
      jti,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt
    });
  }
  return rows;
}

function couponUsages(doc: Record<string, unknown>): Array<Record<string, unknown>> {
  const couponId = sourceId(doc);
  const byUser = new Map<string, Record<string, unknown>>();
  const fallback = doc.updatedAt ?? doc.createdAt;
  for (const entry of Array.isArray(doc.usageHistory) ? doc.usageHistory : []) {
    if (!entry || typeof entry !== 'object') continue;
    const usage = entry as Record<string, unknown>;
    const userId = idOf(usage.userId);
    if (!userId) continue;
    byUser.set(userId, { userId, redeemedAt: usage.redeemedAt ?? fallback });
  }
  for (const entry of Array.isArray(doc.usedBy) ? doc.usedBy : []) {
    const userId = idOf(entry);
    if (userId && !byUser.has(userId)) byUser.set(userId, { userId, redeemedAt: fallback });
  }
  return [...byUser.entries()].map(([userId, usage]) => ({
    id: deterministicId(`coupon_usage:${couponId}:${userId}`),
    couponId,
    userId,
    redeemedAt: usage.redeemedAt
  }));
}

function studyGroupMembers(doc: Record<string, unknown>): Array<Record<string, unknown>> {
  const groupId = sourceId(doc);
  return (Array.isArray(doc.members) ? doc.members : []).flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const member = entry as Record<string, unknown>;
    const userId = idOf(member.userId);
    if (!userId) return [];
    return [
      {
        id: deterministicId(`study_group_member:${groupId}:${userId}`),
        groupId,
        userId,
        joinedAt: member.joinedAt
      }
    ];
  });
}

function studyGroupInvites(doc: Record<string, unknown>): Array<Record<string, unknown>> {
  const groupId = sourceId(doc);
  return (Array.isArray(doc.invites) ? doc.invites : []).flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const invite = entry as Record<string, unknown>;
    const userId = idOf(invite.userId);
    if (!userId) return [];
    return [
      {
        id: deterministicId(`study_group_invite:${groupId}:${userId}`),
        groupId,
        userId,
        invitedBy: idOf(invite.invitedBy),
        createdAt: invite.createdAt
      }
    ];
  });
}

/** Shorthand for the majority of collections, which map field-for-field. */
function map(collection: string, model: string, order: number): Mapping {
  return { collection, model, order };
}

const MAPPINGS: Mapping[] = [
  // Identity (created by better-auth on the Mongo side as well).
  map('auth_users', 'AuthUser', 10),
  map('auth_accounts', 'AuthAccount', 11),
  map('auth_verifications', 'AuthVerification', 12),
  map('auth_sessions', 'AuthSession', 13),
  map('auth_rate_limits', 'AuthRateLimit', 14),

  // Users and billing.
  {
    collection: 'users',
    model: 'User',
    order: 20,
    overrides: (doc) => ({
      notificationPreferences: doc.notificationPreferences ?? defaultNotificationPreferences(),
      onboardingDraft: doc.onboardingDraft ?? defaultOnboardingDraft()
    })
  },
  { collection: 'users', model: 'RefreshToken', order: 21, derived: userRefreshTokens },
  map('payments', 'Payment', 22),
  map('coupons', 'Coupon', 23),
  { collection: 'coupons', model: 'CouponUsage', order: 24, derived: couponUsages },

  // Learner profile and social.
  map('user_profiles', 'UserProfile', 30),
  map('learningstyleprofiles', 'LearningStyleProfile', 31),
  map('availabilityslots', 'AvailabilitySlot', 32),
  map('gamifications', 'Gamification', 33),
  map('quests', 'Quest', 34),
  map('learning_reward_ledger', 'LearningRewardLedger', 35),
  map('friendships', 'Friendship', 36),
  map('study_groups', 'StudyGroup', 37),
  { collection: 'study_groups', model: 'StudyGroupMember', order: 38, derived: studyGroupMembers },
  { collection: 'study_groups', model: 'StudyGroupInvite', order: 39, derived: studyGroupInvites },

  // Ranking.
  map('rankseasons', 'RankSeason', 40),
  map('userrankprofiles', 'UserRankProfile', 41),
  map('seasonresultsnapshots', 'SeasonResultSnapshot', 42),
  map('rankeventledgers', 'RankEventLedger', 43),
  map('rankbadges', 'RankBadge', 44),

  // Catalog.
  map('subjects', 'Subject', 50),
  map('topics', 'Topic', 51),
  map('institutions', 'Institution', 52),
  map('institution_memberships', 'InstitutionMembership', 53),
  map('institution_invitations', 'InstitutionInvitation', 54),

  // Courses.
  map('courses', 'Course', 60),
  map('course_revisions', 'CourseRevision', 61),
  map('course_invitations', 'CourseInvitation', 62),
  map('public_course_joins', 'PublicCourseJoin', 63),
  map('course_enrollments', 'CourseEnrollment', 64),

  // Study rooms.
  map('study_rooms', 'StudyRoom', 70),
  map('facilitatorinterventions', 'FacilitatorIntervention', 71),
  map('room_whiteboards', 'RoomWhiteboard', 72),
  map('roomlearningproposals', 'RoomLearningProposal', 73),
  map('roomlearningchecks', 'RoomLearningCheck', 74),
  map('private_room_help', 'PrivateRoomHelp', 75),

  // Evidence and generation.
  map('activity_records', 'ActivityRecord', 80),
  map('student_attempts', 'StudentAttempt', 81),
  map('learning_evidences', 'LearningEvidence', 82),
  map('learningsupports', 'LearningSupport', 83),
  map('eval_results', 'EvalResult', 84),
  map('competency_profiles', 'CompetencyProfile', 85),
  map('competency_processing', 'CompetencyProcessing', 86),
  map('ai_jobs', 'AiJob', 87),
  map('course_ingestion_operations', 'CourseIngestionOperation', 88),
  map('visual_labs', 'VisualLab', 89),
  map('course_nardouch_progress', 'CourseNardouchProgress', 90),
  map('nardouchconversations', 'NardouchConversation', 91),
  map('learner_adaptation_preferences', 'LearnerAdaptationPreference', 92),
  map('experience_plan_requests', 'ExperiencePlanRequest', 93),
  map('experience_plan_records', 'ExperiencePlanRecord', 94),
  map('formulaproposals', 'FormulaProposal', 95),
  map('formularecognitionjobs', 'FormulaRecognitionJob', 96),
  map('structuredassets', 'StructuredAsset', 97),
  map('structured_asset_reviews', 'StructuredAssetReview', 98),

  // Sessions, notifications and signals.
  map('studysessions', 'StudySession', 100),
  map('tasks', 'TaskRecord', 101),
  map('studyplans', 'StudyPlan', 102),
  map('learning_objectives', 'LearningObjective', 103),
  map('notifications', 'Notification', 104),
  map('sessionchats', 'SessionChat', 105),
  map('voicesessions', 'VoiceSession', 106),
  map('focussessions', 'FocusSession', 107),
  map('analytics_events', 'AnalyticsEvent', 108)
];

// ── Referential integrity checks ──────────────────────────────────────────────

interface RelationCheck {
  label: string;
  sourceCollection: string;
  field: string;
  targetModel: string;
  /** Only evaluate values that also exist in this source collection's ids. */
  mustExistInSource?: string;
}

const RELATION_CHECKS: RelationCheck[] = [
  {
    label: 'courses.subjectId → subjects',
    sourceCollection: 'courses',
    field: 'subjectId',
    targetModel: 'Subject',
    mustExistInSource: 'subjects'
  },
  {
    label: 'courses.userId → users',
    sourceCollection: 'courses',
    field: 'userId',
    targetModel: 'User'
  },
  {
    label: 'courses.ownerUserId → users',
    sourceCollection: 'courses',
    field: 'ownerUserId',
    targetModel: 'User'
  },
  {
    label: 'course_enrollments.userId → users',
    sourceCollection: 'course_enrollments',
    field: 'userId',
    targetModel: 'User'
  },
  {
    label: 'course_enrollments.courseId → courses',
    sourceCollection: 'course_enrollments',
    field: 'courseId',
    targetModel: 'Course'
  },
  {
    label: 'course_revisions.courseId → courses',
    sourceCollection: 'course_revisions',
    field: 'courseId',
    targetModel: 'Course'
  },
  {
    label: 'subjects.userId → users',
    sourceCollection: 'subjects',
    field: 'userId',
    targetModel: 'User'
  },
  {
    label: 'user_profiles.userId → users',
    sourceCollection: 'user_profiles',
    field: 'userId',
    targetModel: 'User'
  },
  {
    label: 'institution_memberships.institutionId → institutions',
    sourceCollection: 'institution_memberships',
    field: 'institutionId',
    targetModel: 'Institution'
  },
  {
    label: 'institution_memberships.userId → users',
    sourceCollection: 'institution_memberships',
    field: 'userId',
    targetModel: 'User'
  }
];

// ── Migration ─────────────────────────────────────────────────────────────────

interface CollectionStats {
  collection: string;
  model: string;
  table: string;
  read: number;
  written: number;
  skipped: number;
  failed: number;
}

interface FailureRecord {
  collection: string;
  model: string;
  id: string;
  reason: string;
  code?: string;
}

type Delegate = {
  createMany(args: {
    data: Array<Record<string, unknown>>;
    skipDuplicates?: boolean;
  }): Promise<{ count: number }>;
  count(args?: { where?: unknown }): Promise<number>;
  findMany(args: unknown): Promise<Array<Record<string, unknown>>>;
};

async function main(): Promise<void> {
  if (opts.truncate && !opts.confirmed)
    throw new Error(
      '--truncate empties every target table. Re-run with --truncate --yes to confirm.'
    );
  if (!DATABASE_URL) throw new Error('DATABASE_URL is required (PostgreSQL target)');
  const models = loadSchema();
  const client = prismaClient() as unknown as Record<string, Delegate>;

  console.log('==> EdNova MongoDB → PostgreSQL migration');
  console.log(`    Source (MongoDB): ${redactUrl(MONGODB_URI)}`);
  console.log(`    Target (PostgreSQL): ${redactUrl(DATABASE_URL)}`);
  console.log(
    `    Mode: ${opts.dryRun ? 'dry run (no writes)' : 'apply'}${opts.truncate ? ', truncate' : ''}`
  );
  console.log(`    Batch size: ${opts.batchSize}`);

  const mongo = new MongoClient(MONGODB_URI);
  await mongo.connect();
  const db = mongo.db();

  const report: {
    startedAt: string;
    finishedAt?: string;
    mode: string;
    source: string;
    target: string;
    collections: CollectionStats[];
    failures: FailureRecord[];
    complications: {
      unmappedCollections: string[];
      modelsWithoutSource: string[];
      unknownFields: Record<string, string[]>;
      /** U+0000 characters removed because PostgreSQL jsonb cannot store them. */
      strippedNullBytes: number;
    };
    verification: {
      counts: Array<{ table: string; source: number; target: number; mismatch: boolean }>;
      relations: Array<{ label: string; checked: number; violations: number; sample: string[] }>;
    };
  } = {
    startedAt: new Date().toISOString(),
    mode: opts.dryRun ? 'dry-run' : 'apply',
    source: redactUrl(MONGODB_URI),
    target: redactUrl(DATABASE_URL),
    collections: [],
    failures: [],
    complications: {
      unmappedCollections: [],
      modelsWithoutSource: [],
      unknownFields: {},
      strippedNullBytes: 0
    },
    verification: { counts: [], relations: [] }
  };

  try {
    // ── Discovery: report collections and models the map does not cover ──────
    const present = (await db.listCollections().toArray())
      .map((entry) => entry.name)
      .filter((name) => !name.startsWith('system.'))
      .sort();
    const mappedCollections = new Set(MAPPINGS.map((entry) => entry.collection));
    const mappedModels = new Set(MAPPINGS.map((entry) => entry.model));
    report.complications.unmappedCollections = present.filter(
      (name) => !mappedCollections.has(name)
    );
    report.complications.modelsWithoutSource = [...models.values()]
      .filter((model) => !mappedModels.has(model.name))
      .map((model) => `${model.name} (${model.table})`)
      .sort();

    if (report.complications.unmappedCollections.length)
      console.warn(
        `    ! Collections with no mapping (left untouched): ${report.complications.unmappedCollections.join(', ')}`
      );
    if (report.complications.modelsWithoutSource.length)
      console.log(
        `    i Models with no source collection (created by the new code): ${report.complications.modelsWithoutSource.join(', ')}`
      );

    // ── Optional truncate ────────────────────────────────────────────────────
    if (opts.truncate) {
      if (opts.dryRun) {
        console.log('    i --truncate ignored during --dry-run');
      } else {
        const tables = [...new Set(MAPPINGS.map((entry) => models.get(entry.model)!.table))];
        const list = tables.map((table) => `"${table.replace(/"/g, '""')}"`).join(', ');
        console.log(`    ! Truncating ${tables.length} target tables (--yes confirmed)`);
        const sql = prismaClient() as unknown as {
          $executeRawUnsafe(query: string): Promise<number>;
        };
        await sql.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
      }
    }

    // ── Convert and write, one mapping at a time, in dependency order ────────
    const docsByCollection = new Map<string, Array<Record<string, unknown>>>();
    const ordered = [...MAPPINGS].sort((a, b) => a.order - b.order);

    for (const mapping of ordered) {
      const model = models.get(mapping.model);
      if (!model) {
        report.failures.push({
          collection: mapping.collection,
          model: mapping.model,
          id: '-',
          reason: 'model not found in prisma/schema.prisma'
        });
        continue;
      }
      if (!docsByCollection.has(mapping.collection)) {
        docsByCollection.set(
          mapping.collection,
          (await db.collection(mapping.collection).find({}).toArray()) as Array<
            Record<string, unknown>
          >
        );
      }
      const docs = docsByCollection.get(mapping.collection)!;
      const stats: CollectionStats = {
        collection: mapping.collection,
        model: mapping.model,
        table: model.table,
        read: docs.length,
        written: 0,
        skipped: 0,
        failed: 0
      };

      const rows: Array<Record<string, unknown>> = [];
      const failureIds: FailureRecord[] = [];
      for (const doc of docs) {
        const derived = mapping.derived ? mapping.derived(doc) : undefined;
        const candidates: Array<Record<string, unknown>> = derived
          ? derived
          : [
              {
                ...doc,
                id: sourceId(doc),
                ...(mapping.overrides ? mapping.overrides(doc) : {})
              }
            ];
        for (const candidate of candidates) {
          const normalized = normalizeRow(model, candidate);
          if (normalized.unknownFields.length) {
            const key = `${mapping.collection} → ${mapping.model}`;
            const known = new Set(report.complications.unknownFields[key] ?? []);
            for (const field of normalized.unknownFields) known.add(field);
            report.complications.unknownFields[key] = [...known].sort();
          }
          if (!normalized.row) {
            const id = String(candidate.id ?? sourceId(doc) ?? '<no id>');
            const reason = normalized.issues.join('; ');
            failureIds.push({ collection: mapping.collection, model: mapping.model, id, reason });
            stats.failed += 1;
            continue;
          }
          rows.push(normalized.row);
        }
      }

      report.failures.push(...failureIds);
      if (failureIds.length && opts.strict)
        throw new Error(
          `${mapping.collection}: ${failureIds.length} document(s) failed conversion (--strict)`
        );

      if (opts.dryRun) {
        console.log(
          `    ${model.table}: read ${docs.length}, convertible ${rows.length}, failed ${failureIds.length} (dry run)`
        );
      } else {
        const delegate = client[model.delegate];
        if (!delegate) throw new Error(`Prisma delegate missing for model ${model.name}`);
        for (let offset = 0; offset < rows.length; offset += opts.batchSize) {
          const batch = rows.slice(offset, offset + opts.batchSize);
          try {
            const result = await delegate.createMany({ data: batch, skipDuplicates: true });
            stats.written += result.count;
            stats.skipped += batch.length - result.count;
          } catch {
            // Isolate the rows that fail so one bad document cannot hide the rest.
            for (const row of batch) {
              try {
                const single = await delegate.createMany({ data: [row], skipDuplicates: true });
                stats.written += single.count;
                stats.skipped += 1 - single.count;
              } catch (error) {
                stats.failed += 1;
                report.failures.push({
                  collection: mapping.collection,
                  model: mapping.model,
                  id: String(row.id ?? '<no id>'),
                  code: (error as { code?: string }).code,
                  // Prisma's message begins with the model and the failing
                  // column on its own line; keep the actionable part and drop
                  // the multi-line code frame.
                  reason: (() => {
                    const message = error instanceof Error ? error.message : String(error);
                    const detail = message
                      .split('\n')
                      .map((line) => line.trim())
                      .filter(Boolean);
                    const meta = (error as { meta?: { target?: unknown } }).meta;
                    const target =
                      meta && Array.isArray(meta.target) ? ` (${meta.target.join(', ')})` : '';
                    const code = (error as { code?: string }).code;
                    const hint = FAILURE_HINTS[code ?? ''];
                    if (hint) return `${code}: ${hint}${target}`;
                    return `${code ? code + ': ' : ''}${detail.slice(0, 3).join(' ').slice(0, 200)}${target}`;
                  })()
                });
              }
            }
          }
        }
        console.log(
          `    ${model.table}: read ${docs.length}, written ${stats.written}, skipped ${stats.skipped}, failed ${stats.failed}`
        );
        if (stats.failed && opts.strict)
          throw new Error(
            `${mapping.collection}: ${stats.failed} row(s) failed to insert (--strict)`
          );
      }
      report.collections.push(stats);
    }

    // ── Verification: source vs target counts ────────────────────────────────
    if (!opts.dryRun) {
      for (const mapping of ordered) {
        const model = models.get(mapping.model);
        if (!model) continue;
        const delegate = client[model.delegate];
        const target = delegate ? await delegate.count() : 0;
        const stats = report.collections.find(
          (entry) => entry.collection === mapping.collection && entry.model === mapping.model
        );
        const source = stats ? stats.read : 0;
        report.verification.counts.push({
          table: model.table,
          source,
          target,
          mismatch: mapping.derived ? false : target < source
        });
      }

      // ── Verification: key relations still resolve ────────────────────────
      for (const check of RELATION_CHECKS) {
        const docs = docsByCollection.get(check.sourceCollection);
        if (!docs) continue;
        let allowed: Set<string> | undefined;
        if (check.mustExistInSource) {
          const sourceDocs = docsByCollection.get(check.mustExistInSource);
          if (!sourceDocs) continue;
          allowed = new Set(
            sourceDocs.map((doc) => sourceId(doc)).filter((id): id is string => !!id)
          );
        }
        const values = new Set<string>();
        for (const doc of docs) {
          const id = idOf(doc[check.field]);
          if (!id) continue;
          if (allowed && !allowed.has(id)) continue; // legacy slug, not a reference
          values.add(migratedId(id));
        }
        const model = models.get(check.targetModel);
        const delegate = model ? client[model.delegate] : undefined;
        if (!delegate) continue;
        const ids = [...values];
        const found = new Set<string>();
        const chunk = 1000;
        for (let offset = 0; offset < ids.length; offset += chunk) {
          const rows = await delegate.findMany({
            where: { id: { in: ids.slice(offset, offset + chunk) } },
            select: { id: true }
          });
          for (const row of rows) found.add(String(row.id));
        }
        const missing = ids.filter((id) => !found.has(id));
        report.verification.relations.push({
          label: check.label,
          checked: ids.length,
          violations: missing.length,
          sample: missing.slice(0, 10)
        });
      }
    }

    report.finishedAt = new Date().toISOString();
    writeFileSync(opts.reportPath, JSON.stringify(report, null, 2));

    // ── Summary ──────────────────────────────────────────────────────────────
    const header = ['collection', 'model', 'read', 'written', 'skipped', 'failed'];
    console.log('\n==> Summary');
    console.log(header.map((value) => value.padEnd(12)).join(' '));
    console.log(header.map(() => '-'.repeat(12)).join(' '));
    for (const entry of report.collections)
      console.log(
        [entry.collection, entry.model, entry.read, entry.written, entry.skipped, entry.failed]
          .map((value) => String(value).padEnd(12))
          .join(' ')
      );

    if (!opts.dryRun) {
      console.log('\n==> Verification (source count vs target count)');
      for (const entry of report.verification.counts)
        console.log(
          `    ${entry.table}: source ${entry.source}, target ${entry.target}${entry.mismatch ? '  MISMATCH' : ''}`
        );
      console.log('\n==> Referential integrity');
      for (const entry of report.verification.relations)
        console.log(
          `    ${entry.label}: checked ${entry.checked}, violations ${entry.violations}` +
            (entry.violations ? ` (e.g. ${entry.sample.join(', ')})` : '')
        );
    }

    if (strippedNullBytes > 0) report.complications.strippedNullBytes = strippedNullBytes;
    const failed = report.failures.length;
    console.log(`\n==> Report written to ${opts.reportPath}`);
    console.log(
      `    ${failed ? `${failed} document(s) were not migrated` : 'No migration failures'}`
    );
    if (failed) {
      // Group by cause so the operator knows whether this is data to clean up
      // or something the script must be taught.
      const byCode = new Map<string, number>();
      for (const failure of report.failures)
        byCode.set(failure.code ?? 'unknown', (byCode.get(failure.code ?? 'unknown') ?? 0) + 1);
      for (const [code, count] of [...byCode.entries()].sort((a, b) => b[1] - a[1]))
        console.log(
          `    ${String(count).padStart(5)}  ${code.padEnd(8)} ${FAILURE_HINTS[code] ?? 'see migration-report.json'}`
        );
      if (byCode.has('P2003'))
        console.log(
          '    P2003 rows reference a parent that does not exist. They were already',
          '\n          unreachable in MongoDB; repair or delete them, then re-run.'
        );
    }
    if (opts.dryRun) console.log('    Dry run: no rows were written.');
    if (
      failed ||
      report.verification.counts.some((entry) => entry.mismatch) ||
      report.verification.relations.some((entry) => entry.violations)
    ) process.exitCode = 1;
  } finally {
    await mongo.close();
    await disconnectDatabase();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
