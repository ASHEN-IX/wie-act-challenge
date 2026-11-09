/**
 * Small typed wrapper over one Prisma delegate.
 *
 * The study collections were Mongoose models; each is now a table. Rather than
 * rewrite every call site, a model declares its delegate and the mutable
 * columns it persists, and this wrapper keeps the query shape the routes and
 * services already use:
 *
 *   const course = await Course.findById(id).select('title scope').lean();
 *   const rows   = await Course.find({ scope: 'institutional' }).sort({ title: 1 });
 *
 * Rows come back as plain objects with `_id` (the column value, mirrored), which
 * is what every route reads.
 */
import { Prisma } from '../../../../src/generated/prisma/client';
import { prisma, toDocument } from '../../../../shared/database';
import { newId } from '../../../../shared/ids';

type AnyDelegate = {
  findMany(args?: unknown): Promise<unknown[]>;
  findFirst(args?: unknown): Promise<unknown>;
  findUnique(args?: unknown): Promise<unknown>;
  count(args?: unknown): Promise<number>;
  create(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
  updateMany(args: unknown): Promise<{ count: number }>;
  deleteMany(args?: unknown): Promise<{ count: number }>;
  delete(args: unknown): Promise<unknown>;
  createMany(args: unknown): Promise<{ count: number }>;
};

export interface TableOptions<Row> {
  delegate: () => AnyDelegate;
  /** Columns `save()` writes back. Keeps JSON handling in one place. */
  columns: (row: Row) => Record<string, unknown>;
  jsonColumns?: string[];
  /** Postgres array columns; a scalar comparison on them means "contains". */
  arrayColumns?: string[];
  /**
   * Non-nullable columns. Mongo's `$ne`/`$nin` also matched documents where the
   * field was absent; that extra `{ column: null }` branch is invalid Prisma for
   * a required column, so it is only emitted for nullable ones.
   */
  requiredColumns?: string[];
  /** Values a fresh row needs when `findOneAndUpdate` upserts. */
  defaults?: () => Record<string, unknown>;
  /**
   * Fields derived from a write payload, the way the old schema's `pre(save)`
   * hook kept a mirror column in step. Applied on every update.
   */
  derives?: (data: Record<string, unknown>) => Record<string, unknown>;
  /** The same derivation for inserts, where sparse legacy documents differ. */
  derivesOnCreate?: (data: Record<string, unknown>) => Record<string, unknown>;
}

export interface FindOptions {
  orderBy?: Record<string, unknown>;
  take?: number;
  skip?: number;
  select?: Record<string, boolean>;
}

/** Prisma's unique-violation code, surfaced as the driver code call sites check. */
const PRISMA_UNIQUE_VIOLATION = 'P2002';

export function isDuplicateKey(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  return code === PRISMA_UNIQUE_VIOLATION || code === 11000;
}

/** Re-throw Prisma's unique violation with the Mongo driver's code so existing
 * `if (error.code !== 11000) throw` guards keep working. */
export function normalizeWriteError(error: unknown): never {
  if ((error as { code?: unknown })?.code === PRISMA_UNIQUE_VIOLATION) {
    throw Object.assign(error as object, { code: 11000 });
  }
  throw error;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof RegExp)
  );
}

function hasOperatorKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).some((key) => key.startsWith('$'));
}

function translateRegex(value: RegExp): Record<string, unknown> {
  return value.flags.includes('i')
    ? { contains: value.source, mode: 'insensitive' }
    : { contains: value.source };
}

/**
 * `{ jsonColumn: { $elemMatch: {...} } }` has no Prisma/SQL equivalent: jsonb
 * containment is exact, not "an element has these keys". Such predicates are
 * lifted out before the query and applied to hydrated rows, which is how the
 * room routes already treat `participants`.
 */
export interface JsonElemFilter {
  column: string;
  match: Record<string, unknown>;
}

export function extractJsonElemFilters(
  where: Record<string, unknown> = {},
  jsonColumns: string[] = []
): { where: Record<string, unknown>; elemFilters: JsonElemFilter[] } {
  const elemFilters: JsonElemFilter[] = [];
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(where)) {
    if (key === '$or' || key === '$and' || key === '$nor') {
      const rewritten = Array.isArray(value)
        ? value.map((item) => {
            if (!isPlainObject(item)) return item;
            const inner = extractJsonElemFilters(item, jsonColumns);
            elemFilters.push(...inner.elemFilters);
            return inner.where;
          })
        : value;
      rest[key] = rewritten;
      continue;
    }
    const column = key.split('.')[0];
    if (
      jsonColumns.includes(column) &&
      isPlainObject(value) &&
      Object.prototype.hasOwnProperty.call(value, '$elemMatch')
    ) {
      elemFilters.push({
        column,
        match: (value as { $elemMatch: Record<string, unknown> }).$elemMatch
      });
      continue;
    }
    rest[key] = value;
  }
  return { where: rest, elemFilters };
}

/** One element matches when every predicate field matches (Mongo `$elemMatch`). */
function elementMatches(element: unknown, match: Record<string, unknown>): boolean {
  if (!isPlainObject(element)) return false;
  return Object.entries(match).every(([field, expected]) => {
    const actual = element[field];
    if (isPlainObject(expected) && hasOperatorKeys(expected)) {
      const ops = expected as Record<string, unknown>;
      if ('$exists' in ops) {
        const present = actual !== undefined && actual !== null;
        if (present !== Boolean(ops.$exists)) return false;
      }
      if ('$in' in ops && !(ops.$in as unknown[]).includes(actual)) return false;
      if ('$nin' in ops && (ops.$nin as unknown[]).includes(actual)) return false;
      if ('$ne' in ops && actual === ops.$ne) return false;
      if ('$eq' in ops && actual !== ops.$eq) return false;
      return true;
    }
    return actual === expected;
  });
}

export function matchesJsonElemFilters(row: Record<string, unknown>, filters: JsonElemFilter[]) {
  return filters.every((filter) => {
    const value = row[filter.column];
    if (!Array.isArray(value)) return false;
    return value.some((element) => elementMatches(element, filter.match));
  });
}

/** A date-shaped string becomes a Date so Prisma receives the column type. */
function asDate(value: unknown): unknown {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return value;
}

function translateOperators(
  value: Record<string, unknown>,
  isJsonColumn = false
): Record<string, unknown> {
  // NOTE: `requiredColumns` is applied by `translateWhere`, which knows the
  // column name; operator translation only decides the filter shape.
  const out: Record<string, unknown> = {};
  for (const [operator, operand] of Object.entries(value)) {
    switch (operator) {
      case '$in':
        out.in = Array.isArray(operand) ? operand.map(asDate) : operand;
        break;
      case '$nin':
        out.notIn = operand;
        break;
      case '$ne':
        out.not = operand instanceof RegExp ? translateRegex(operand) : operand;
        break;
      case '$eq':
        out.equals = operand;
        break;
      case '$gte':
        out.gte = asDate(operand);
        break;
      case '$lte':
        out.lte = asDate(operand);
        break;
      case '$gt':
        out.gt = asDate(operand);
        break;
      case '$lt':
        out.lt = asDate(operand);
        break;
      case '$exists':
        // Mongo's `$exists: true` is "not null" in SQL; `false` is "is null".
        // A JSON column distinguishes SQL NULL from the JSON `null` value, so
        // absence there is `JsonNull`.
        if (operand) out.not = Prisma.DbNull;
        // `JsonNull` is the JSON `null` literal; an unwritten column is SQL
        // NULL, which Prisma calls `DbNull`. Match either, like Mongo did.
        else out.equals = isJsonColumn ? Prisma.DbNull : null;
        break;
      case '$regex':
        out.contains =
          typeof operand === 'string' ? operand.replace(/^\^/, '').replace(/\$$/, '') : operand;
        break;
      case '$options':
        if (String(operand).includes('i')) out.mode = 'insensitive';
        break;
      case '$not':
        out.not = isPlainObject(operand) ? translateOperators(operand) : operand;
        break;
      default:
        out[operator] = operand;
    }
  }
  return out;
}

/** Translate a `{ _id, __v }`-style filter to its Prisma shape. */
export function translateWhere(
  where: Record<string, unknown> = {},
  jsonColumns: string[] = [],
  arrayColumns: string[] = [],
  requiredColumns: string[] = []
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let impossible = false;
  for (const [rawKey, rawValue] of Object.entries(where)) {
    let key = rawKey;
    if (key === '_id') key = 'id';
    else if (key === '__v') key = 'version';
    if (key === '$or' || key === '$and' || key === '$nor') {
      const target = key === '$or' ? 'OR' : key === '$and' ? 'AND' : 'NOT';
      if (Array.isArray(rawValue)) {
        // Drop branches that can never match (`{ id: null }`, an empty object).
        const branches = rawValue
          .map((item) =>
            isPlainObject(item)
              ? translateWhere(item, jsonColumns, arrayColumns, requiredColumns)
              : item
          )
          .filter((item) => !(isPlainObject(item) && Object.keys(item).length === 0));
        out[target] = branches;
        if (branches.length === 0) impossible = true;
      } else out[target] = rawValue;
      continue;
    }
    if (key.startsWith('$')) {
      // Unknown top-level operator: keep it so Prisma rejects it loudly.
      out[key] = rawValue;
      continue;
    }
    // A dotted key addressed a field inside an embedded document. For a JSON
    // column, Prisma's `path` filter expresses the same predicate (and, unlike
    // a Mongo path, only when the leaf is actually compared — see below).
    if (key.includes('.') && jsonColumns.includes(key.split('.')[0])) {
      const [column, ...path] = key.split('.');
      const leaf = isPlainObject(rawValue) ? translateOperators(rawValue) : { equals: rawValue };
      out.AND = [...(Array.isArray(out.AND) ? out.AND : []), { [column]: { path, ...leaf } }];
      continue;
    }
    // A plain object against a JSON column addressed fields inside the stored
    // document (an array's elements, in practice). Prisma expresses that as a
    // `path` filter, so build one leaf per field.
    if (jsonColumns.includes(key) && isPlainObject(rawValue) && !hasOperatorKeys(rawValue)) {
      for (const [innerKey, innerValue] of Object.entries(rawValue)) {
        const leaf = isPlainObject(innerValue)
          ? translateOperators(innerValue)
          : { equals: innerValue };
        out.AND = [
          ...(Array.isArray(out.AND) ? out.AND : []),
          { [key]: { path: [innerKey], ...leaf } }
        ];
      }
      continue;
    }
    // `{ id: null }` / `{ required: null }` came from the old
    // "this branch does not apply" idiom. It never matched in SQL either, so
    // the branch is dropped rather than sent to Prisma, which rejects it.
    if (rawValue === null && (key === 'id' || requiredColumns.includes(key))) {
      impossible = true;
      continue;
    }
    if (rawValue instanceof RegExp) {
      out[key] = translateRegex(rawValue);
      continue;
    }
    if (isPlainObject(rawValue) && hasOperatorKeys(rawValue)) {
      const operators = translateOperators(rawValue, jsonColumns.includes(key));
      // SQL `x NOT IN (...)`/`x <> v` excludes NULL rows, Mongo's `$ne`/`$nin`
      // include them. Keep Mongo's meaning so a filter that excluded a value
      // still matches rows where the column is unset.
      if ('not' in operators || 'notIn' in operators) {
        const negative = Object.fromEntries(
          Object.entries(operators).filter(([name]) => name === 'not' || name === 'notIn')
        );
        const rest = Object.fromEntries(
          Object.entries(operators).filter(([name]) => name !== 'not' && name !== 'notIn')
        );
        if (requiredColumns.includes(key)) {
          // A required column cannot hold NULL, so the negative filter alone is
          // the whole predicate.
          out[key] = negative;
        } else {
          out.OR = [...(Array.isArray(out.OR) ? out.OR : []), { [key]: negative }, { [key]: null }];
        }
        if (Object.keys(rest).length) out[key] = rest;
        continue;
      }
      out[key] = operators;
      continue;
    }
    // A scalar compared against an array column means membership, the way
    // Mongo matched a value inside an array field.
    if (arrayColumns.includes(key) && !isPlainObject(rawValue)) {
      out[key] = { has: rawValue };
      continue;
    }
    out[key] = rawValue;
  }
  // A branch that can never match must match nothing, not everything.
  return impossible ? { AND: [{ id: { in: [] } }] } : out;
}

/** The JSON-column array appends an update requests (`$push` on a Json column). */
export function jsonArrayPushes(
  update: Record<string, unknown>,
  jsonColumns: string[]
): Array<{ field: string; values: unknown[] }> {
  const out: Array<{ field: string; values: unknown[] }> = [];
  const pushed = update.$push;
  if (!isPlainObject(pushed)) return out;
  for (const [field, value] of Object.entries(pushed)) {
    if (!jsonColumns.includes(field)) continue;
    if (isPlainObject(value) && Array.isArray((value as { $each?: unknown[] }).$each)) {
      out.push({ field, values: (value as { $each: unknown[] }).$each });
    } else {
      out.push({ field, values: [value] });
    }
  }
  return out;
}

/** Merge a field's requested array appends into a candidate data payload. */
export function applyJsonArrayPushes(
  data: Record<string, unknown>,
  pushes: Array<{ field: string; values: unknown[] }>,
  current: Record<string, unknown>
): Record<string, unknown> {
  if (!pushes.length) return data;
  const merged = { ...data };
  for (const { field, values } of pushes) {
    const base = Array.isArray(merged[field])
      ? (merged[field] as unknown[])
      : Array.isArray(current[field])
        ? (current[field] as unknown[])
        : [];
    merged[field] = [...base, ...values];
  }
  return merged;
}

/** Split a Mongo update document into Prisma `data` and create-time fields. */
export function translateUpdate(
  update: Record<string, unknown>,
  jsonColumns: string[] = []
): { data: Record<string, unknown>; insert: Record<string, unknown> } {
  const data: Record<string, unknown> = {};
  const insert: Record<string, unknown> = {};
  let sawOperator = false;
  for (const [operator, operand] of Object.entries(update)) {
    if (!operator.startsWith('$')) continue;
    sawOperator = true;
    const fields = isPlainObject(operand) ? operand : {};
    for (const [rawField, value] of Object.entries(fields)) {
      const field = rawField === '__v' ? 'version' : rawField;
      if (operator === '$inc') data[field] = { increment: Number(value) };
      else if (operator === '$unset') {
        data[field] = jsonColumns.includes(field) ? Prisma.DbNull : null;
      } else if (operator === '$setOnInsert') insert[field] = value;
      else if (operator === '$addToSet') data[field] = { push: value };
      else if (operator === '$push') {
        // `{ $push: { list: x } }` appends one element; `$each` appends many.
        // JSON columns cannot use a Prisma list `push`; those are applied by
        // `updateJsonArrayFields` on the read-modify-write path.
        if (jsonColumns.includes(field)) continue;
        if (isPlainObject(value) && Array.isArray((value as { $each?: unknown[] }).$each)) {
          const each = (value as { $each: unknown[]; $slice?: number }).$each;
          data[field] = { push: each };
        } else data[field] = { push: value };
      } else data[field] = value;
    }
  }
  if (!sawOperator) {
    for (const [rawField, value] of Object.entries(update)) {
      const field = rawField === '__v' ? 'version' : rawField;
      data[field] = value;
    }
  }
  return { data, insert };
}

/** Prisma accepts a single sort object or a list; the models are typed per call. */
function asOrderBy(value: Record<string, unknown> | undefined) {
  if (!value || Array.isArray(value)) return value as never;
  return [value] as never;
}

function translateSort(spec: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [rawKey, direction] of Object.entries(spec)) {
    const key = rawKey === '_id' ? 'id' : rawKey === '__v' ? 'version' : rawKey;
    // `findFirst`/`findUnique` reject sorting on the primary key; a scanned
    // single row has no order anyway, so a tiebreaker on `id` is a no-op there.
    if (key === 'id') continue;
    out[key] =
      direction === -1 || direction === 'desc' || direction === 'descending' ? 'desc' : 'asc';
  }
  return out;
}

function translateSelect(spec: unknown): Record<string, boolean> | undefined {
  if (spec === undefined || spec === null) return undefined;
  const out: Record<string, boolean> = { id: true };
  if (typeof spec === 'string') {
    for (const field of spec.split(/\s+/).filter(Boolean)) {
      if (field.startsWith('+')) continue;
      out[field === '_id' ? 'id' : field] = true;
    }
    return out;
  }
  if (isPlainObject(spec)) {
    let inclusive = false;
    for (const value of Object.values(spec)) {
      if (Number(value) === 1 || value === true) inclusive = true;
    }
    for (const [rawKey, value] of Object.entries(spec)) {
      const key = rawKey === '_id' ? 'id' : rawKey;
      if (inclusive) {
        if (Number(value) === 1 || value === true) out[key] = true;
      } else if (Number(value) === 0 || value === false) {
        out[key] = false;
      }
    }
    return out;
  }
  return undefined;
}

/**
 * Promise-like chain so `await Model.find(x).sort(y).limit(n).lean()` keeps
 * working. Awaiting the cursor resolves the underlying query.
 */
export class Cursor<T> implements PromiseLike<T> {
  constructor(protected readonly loader: () => Promise<T>) {}

  /** `.lean()` was a Mongoose projection hint; rows are already plain objects. */
  lean(): Promise<T> {
    return this.loader();
  }

  exec(): Promise<T> {
    return this.loader();
  }

  then<R1 = T, R2 = never>(
    onfulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): Promise<R1 | R2> {
    return this.loader().then(onfulfilled, onrejected);
  }

  catch<R = never>(onrejected?: ((reason: unknown) => R | PromiseLike<R>) | null): Promise<T | R> {
    return this.loader().catch(onrejected as (reason: unknown) => R | PromiseLike<R>);
  }

  finally(onfinally?: (() => void) | null): Promise<T> {
    return this.loader().finally(onfinally);
  }
}

/**
 * Awaitable result for single-document writes. Keeps `.lean()` valid on
 * `Model.findOneAndUpdate(...).lean()` without a second query.
 */
export class Resolved<T> implements PromiseLike<T> {
  constructor(private readonly loader: () => Promise<T>) {}

  lean(): Promise<T> {
    return this.loader();
  }

  exec(): Promise<T> {
    return this.loader();
  }

  then<R1 = T, R2 = never>(
    onfulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): Promise<R1 | R2> {
    return this.loader().then(onfulfilled, onrejected);
  }

  catch<R = never>(onrejected?: ((reason: unknown) => R | PromiseLike<R>) | null): Promise<T | R> {
    return this.loader().catch(onrejected as (reason: unknown) => R | PromiseLike<R>);
  }

  finally(onfinally?: (() => void) | null): Promise<T> {
    return this.loader().finally(onfinally);
  }
}

export class ListCursor<Row> extends Cursor<Row[]> {
  private readonly find: FindOptions = {};

  constructor(
    private readonly fetch: (find: FindOptions) => Promise<Row[]>,
    private readonly distinctLoader?: (field: string) => Promise<unknown[]>
  ) {
    super(() => fetch(this.find));
  }

  sort(spec: Record<string, unknown>): this {
    this.find.orderBy = translateSort(spec);
    return this;
  }

  limit(count: number): this {
    this.find.take = count;
    return this;
  }

  skip(count: number): this {
    this.find.skip = count;
    return this;
  }

  select(spec?: unknown): this {
    this.find.select = translateSelect(spec);
    return this;
  }

  async distinct(field: string): Promise<unknown[]> {
    if (!this.distinctLoader) throw new Error(`distinct is not supported for ${field}`);
    return this.distinctLoader(field);
  }
}

export class SingleCursor<Row> extends Cursor<Row | null> {
  private selectSpec: unknown;
  private orderBy: Record<string, unknown> | undefined;

  constructor(
    private readonly fetch: (
      select?: Record<string, boolean>,
      orderBy?: Record<string, unknown>
    ) => Promise<Row | null>
  ) {
    super(() => fetch(translateSelect(this.selectSpec), this.orderBy));
  }

  select(spec?: unknown): this {
    this.selectSpec = spec;
    return this;
  }

  sort(spec: Record<string, unknown>): this {
    this.orderBy = translateSort(spec);
    return this;
  }

  /** Mongoose's `.lean<T>()` narrowed the row type; rows are already plain. */
  lean(): Promise<Row | null> {
    return this.loader();
  }
}

export type Hydrated<Row> = Row & { _id: string; __v?: number };

export function table<Row extends { id: string }>(options: TableOptions<Row>) {
  const hydrate = (row: unknown): Hydrated<Row> => {
    const doc = toDocument(row) as Hydrated<Row> & { version?: number };
    if ('version' in (doc as object)) doc.__v = (doc as { version?: number }).version;
    return doc;
  };

  const prismaValue = (key: string, value: unknown) =>
    options.jsonColumns?.includes(key) && value !== undefined && value !== null
      ? (value as Prisma.InputJsonValue)
      : value;

  /**
   * Coerce write values to what Prisma accepts: dates as Date, JSON as JSON,
   * and iso date strings converted (a `$set` payload can still carry strings).
   */
  const derive = (data: Record<string, unknown>, create = false) => {
    const deriveFn = create ? (options.derivesOnCreate ?? options.derives) : options.derives;
    return deriveFn ? { ...data, ...deriveFn(data) } : data;
  };

  const prepare = (data: Record<string, unknown>) => {
    const payload: Record<string, unknown> = { ...derive(data) };
    for (const key of Object.keys(payload)) {
      const value = payload[key];
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
          payload[key] = date;
          continue;
        }
      }
      payload[key] = prismaValue(key, value);
    }
    return payload;
  };

  const paginate = async (
    where: Record<string, unknown>,
    find: FindOptions
  ): Promise<Hydrated<Row>[]> => {
    const { where: sqlWhere, elemFilters } = extractJsonElemFilters(where, options.jsonColumns);
    const rows = await options.delegate().findMany({
      where: translateWhere(
        sqlWhere,
        options.jsonColumns,
        options.arrayColumns,
        options.requiredColumns
      ),
      orderBy: asOrderBy(find.orderBy),
      take: find.take,
      skip: find.skip,
      select: find.select
    });
    const hydrated = rows.map(hydrate);
    return elemFilters.length
      ? hydrated.filter((row) =>
          matchesJsonElemFilters(row as Record<string, unknown>, elemFilters)
        )
      : hydrated;
  };

  const fetchOne = async (
    where: Record<string, unknown>,
    select?: Record<string, boolean>,
    orderBy?: Record<string, unknown>
  ): Promise<Hydrated<Row> | null> => {
    const { where: sqlWhere, elemFilters } = extractJsonElemFilters(where, options.jsonColumns);
    const sqlArgs = {
      where: translateWhere(
        sqlWhere,
        options.jsonColumns,
        options.arrayColumns,
        options.requiredColumns
      ),
      select,
      orderBy: asOrderBy(orderBy)
    };
    if (elemFilters.length === 0) {
      const row = await options.delegate().findFirst(sqlArgs);
      return row ? hydrate(row) : null;
    }
    // The element predicate runs in this process, so page through candidates.
    const rows = await options.delegate().findMany({ ...sqlArgs, take: 200 });
    const match = rows
      .map(hydrate)
      .find((row) => matchesJsonElemFilters(row as Record<string, unknown>, elemFilters));
    return match ?? null;
  };

  const updateById = async (id: string, data: Record<string, unknown>) =>
    hydrate(await options.delegate().update({ where: { id }, data: prepare(data) }));

  const findFirstId = async (where: Record<string, unknown>) => {
    const { where: sqlWhere, elemFilters } = extractJsonElemFilters(where, options.jsonColumns);
    if (elemFilters.length) {
      // Element predicates run on hydrated rows, so pick the id here.
      const rows = await options.delegate().findMany({
        where: translateWhere(
          sqlWhere,
          options.jsonColumns,
          options.arrayColumns,
          options.requiredColumns
        ),
        take: 200
      });
      const match = rows
        .map(hydrate)
        .find((row) => matchesJsonElemFilters(row as Record<string, unknown>, elemFilters));
      return match ? { id: (match as { id: string }).id } : null;
    }
    return (await options.delegate().findFirst({
      where: translateWhere(
        sqlWhere,
        options.jsonColumns,
        options.arrayColumns,
        options.requiredColumns
      ),
      select: { id: true }
    })) as { id: string } | null;
  };

  /** Prisma refuses relation/operator objects on create; keep scalar values only. */
  const asCreateData = (fields: Record<string, unknown>) => {
    const created: Record<string, unknown> = { ...fields };
    // A document created with an explicit `_id` keeps that id.
    if (created._id !== undefined && created.id === undefined) created.id = created._id;
    delete created._id;
    delete created.__v;
    for (const key of Object.keys(created)) {
      const value = created[key];
      if (isPlainObject(value) && 'increment' in value) {
        created[key] = Number((value as { increment: number }).increment);
      } else if (isPlainObject(value) && hasOperatorKeys(value)) {
        delete created[key];
      }
    }
    return created;
  };

  const scalarWhere = (translated: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(translated).filter(
        ([key, value]) =>
          !['OR', 'AND', 'NOT'].includes(key) &&
          (value === null || typeof value !== 'object' || value instanceof Date)
      )
    );

  // Row objects are plain data at runtime; the public generics keep the call
  // sites typed without requiring an index signature on every row model.

  const createOne = async (data: Record<string, unknown>) => {
    const payload = prepare({
      ...options.defaults?.(),
      ...data,
      id: (data.id as string) ?? newId()
    });
    try {
      return hydrate(await options.delegate().create({ data: payload }));
    } catch (error) {
      normalizeWriteError(error);
    }
  };

  const updateOrCreate = async (
    translated: Record<string, unknown>,
    data: Record<string, unknown>,
    insert: Record<string, unknown>
  ) => {
    const existing = await findFirstId(translated);
    if (existing) return updateById(existing.id, data);
    try {
      return await createOne(asCreateData({ ...scalarWhere(translated), ...insert, ...data }));
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      const raced = await findFirstId(translated);
      return raced ? updateById(raced.id, data) : null;
    }
  };

  const model = {
    /** Hydrate raw rows the model filtered itself (e.g. JSON predicates). */
    hydrateRow(row: unknown): Hydrated<Row> {
      return hydrate(row);
    },

    find(where: Record<string, unknown> = {}) {
      const field = (raw: string) => (raw === '_id' ? 'id' : raw);
      return new ListCursor<Hydrated<Row>>(
        (find) => paginate(where, find),
        async (requested) => {
          const rows = await options.delegate().findMany({
            where: translateWhere(
              where,
              options.jsonColumns,
              options.arrayColumns,
              options.requiredColumns
            ),
            select: { [field(requested)]: true },
            distinct: [field(requested)] as never
          });
          return rows.map((row) => (row as Record<string, unknown>)[field(requested)]);
        }
      );
    },

    findOne(where: Record<string, unknown>) {
      return new SingleCursor<Hydrated<Row>>((select, orderBy) => fetchOne(where, select, orderBy));
    },

    findById(id: string) {
      return new SingleCursor<Hydrated<Row>>(async (select) => {
        const row = await options.delegate().findUnique({ where: { id }, select });
        return row ? hydrate(row) : null;
      });
    },

    async exists(where: Record<string, unknown>) {
      return (await findFirstId(where)) !== null;
    },

    async countDocuments(where: Record<string, unknown> = {}) {
      return options.delegate().count({
        where: translateWhere(
          where,
          options.jsonColumns,
          options.arrayColumns,
          options.requiredColumns
        )
      });
    },

    async create(data: Record<string, unknown>) {
      return createOne(asCreateData(data));
    },

    async createMany(data: Array<Record<string, unknown>>) {
      return options.delegate().createMany({
        data: data.map((row) =>
          prepare({
            ...options.defaults?.(),
            ...asCreateData(row),
            id: (row.id as string) ?? newId()
          })
        )
      });
    },

    async updateOne(
      where: Record<string, unknown>,
      update: Record<string, unknown>,
      find: { upsert?: boolean } = {}
    ): Promise<{ matchedCount: number; modifiedCount: number; upserted?: Hydrated<Row> | null }> {
      const { data, insert } = translateUpdate(update, options.jsonColumns);
      if (find.upsert) {
        const upserted = await updateOrCreate(
          translateWhere(where, options.jsonColumns, options.arrayColumns, options.requiredColumns),
          data,
          insert
        );
        return upserted
          ? { matchedCount: 1, modifiedCount: 1, upserted }
          : { matchedCount: 0, modifiedCount: 0, upserted: null };
      }
      const result = await options.delegate().updateMany({
        where: translateWhere(
          where,
          options.jsonColumns,
          options.arrayColumns,
          options.requiredColumns
        ),
        data: prepare(data)
      });
      return { matchedCount: result.count, modifiedCount: result.count };
    },

    async updateMany(
      where: Record<string, unknown>,
      update: Record<string, unknown>
    ): Promise<{ matchedCount: number; modifiedCount: number }> {
      const { data } = translateUpdate(update, options.jsonColumns);
      const result = await options.delegate().updateMany({
        where: translateWhere(
          where,
          options.jsonColumns,
          options.arrayColumns,
          options.requiredColumns
        ),
        data: prepare(data)
      });
      return { matchedCount: result.count, modifiedCount: result.count };
    },

    findOneAndUpdate(
      where: Record<string, unknown>,
      update: Record<string, unknown>,
      find: {
        upsert?: boolean;
        new?: boolean;
        lean?: boolean;
        setDefaultsOnInsert?: boolean;
        runValidators?: boolean;
      } = {}
    ) {
      const { where: jsonWhere, elemFilters } = extractJsonElemFilters(where, options.jsonColumns);
      const translated = translateWhere(
        jsonWhere,
        options.jsonColumns,
        options.arrayColumns,
        options.requiredColumns
      );
      const { data, insert } = translateUpdate(update, options.jsonColumns);
      const pushes = jsonArrayPushes(update, options.jsonColumns ?? []);
      return new Resolved(async () => {
        if (find.upsert) {
          return updateOrCreate(translated, applyJsonArrayPushes(data, pushes, insert), insert);
        }
        const writeData = pushes.length
          ? applyJsonArrayPushes(
              data,
              pushes,
              ((await options.delegate().findFirst({ where: translated })) ?? {}) as Record<
                string,
                unknown
              >
            )
          : data;
        // Atomic compare-and-set: the whole predicate is part of the `UPDATE
        // ... WHERE`, evaluated against the row as it is at write time. A
        // concurrent writer that already moved the guard (a changed state, a
        // newer review version, a lease no longer expired) makes this match
        // zero rows, and the caller sees `null` — exactly the Mongo
        // `findOneAndUpdate` guarantee.
        // An element predicate is evaluated on the hydrated row; only its id
        // joins the SQL predicate below.
        let target: { id: string } | null;
        if (elemFilters.length === 0) {
          target = (await options.delegate().findFirst({
            where: translated,
            select: { id: true }
          })) as { id: string } | null;
        } else {
          const candidates = await options.delegate().findMany({ where: translated, take: 200 });
          const match = candidates
            .map(hydrate)
            .find((row) => matchesJsonElemFilters(row as Record<string, unknown>, elemFilters));
          target = match ? { id: (match as { id: string }).id } : null;
        }
        if (!target) return null;
        const result = await options.delegate().updateMany({
          where: { ...translated, id: target.id },
          data: prepare(writeData)
        });
        if (result.count !== 1) return null;
        const row = await options.delegate().findUnique({ where: { id: target.id } });
        return row ? hydrate(row) : null;
      });
    },

    findByIdAndUpdate(
      id: string,
      update: Record<string, unknown>,
      find: {
        new?: boolean;
        upsert?: boolean;
        lean?: boolean;
        setDefaultsOnInsert?: boolean;
        runValidators?: boolean;
      } = {}
    ) {
      const { data, insert } = translateUpdate(update, options.jsonColumns);
      return new Resolved(async () => {
        const existing = (await options.delegate().findUnique({
          where: { id },
          select: { id: true }
        })) as { id: string } | null;
        if (!existing) {
          if (!find.upsert) return null;
          return createOne(asCreateData({ ...insert, ...data, id: (insert.id as string) ?? id }));
        }
        return updateById(id, data);
      });
    },

    async findByIdAndDelete(id: string) {
      const row = await options.delegate().findUnique({ where: { id } });
      if (!row) return null;
      await options.delegate().delete({ where: { id } });
      return hydrate(row);
    },

    async findOneAndDelete(where: Record<string, unknown>) {
      const existing = (await options.delegate().findFirst({
        where: translateWhere(
          where,
          options.jsonColumns,
          options.arrayColumns,
          options.requiredColumns
        )
      })) as Hydrated<Row> | null;
      if (!existing) return null;
      await options.delegate().delete({ where: { id: existing.id } });
      return hydrate(existing);
    },

    async deleteOne(where: Record<string, unknown>) {
      const result = await options.delegate().deleteMany({
        where: translateWhere(
          where,
          options.jsonColumns,
          options.arrayColumns,
          options.requiredColumns
        )
      });
      return { deletedCount: result.count };
    },

    async deleteMany(where: Record<string, unknown> = {}) {
      return model.deleteOne(where);
    },

    /**
     * Append one value to a scalar-list column only when absent, atomically.
     *
     * This is the Prisma equivalent of Mongo's `$addToSet`: `NOT: { has }`
     * guards the write so two concurrent completions cannot store a duplicate.
     */
    async addToSet(where: Record<string, unknown>, field: string, value: unknown) {
      const result = await options.delegate().updateMany({
        where: {
          ...translateWhere(
            where,
            options.jsonColumns,
            options.arrayColumns,
            options.requiredColumns
          ),
          NOT: { [field]: { has: value } }
        },
        data: { [field]: { push: value } }
      });
      return { matchedCount: result.count, modifiedCount: result.count };
    },

    async save(row: Row) {
      const data: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(options.columns(row))) {
        data[key] = prismaValue(key, value);
      }
      return updateById(row.id, data);
    }
  };

  return model;
}

export { prisma, newId, toDocument };
