/** Browser-safe universal learning document contract. This is a reading
 * projection, never a source or authorization grant. Unknown versions and
 * fields are rejected so a stale client cannot silently mis-render content. */

type Check<T> = (value: unknown) => T;
type Output<C> = C extends Check<infer T> ? T : never;

const fail = (): never => {
  throw new Error('INVALID_LEARNING_DOCUMENT');
};
const text =
  (max: number, min = 0): Check<string> =>
  (value) => {
    if (typeof value !== 'string' || value.length < min || Array.from(value).length > max)
      return fail();
    return value;
  };
const optionalText =
  (max: number): Check<string | undefined> =>
  (value) =>
    value === undefined ? undefined : text(max)(value);
const integer =
  (min: number, max: number): Check<number> =>
  (value) =>
    typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
      ? value
      : fail();
const oneOf =
  <T extends string>(...values: T[]): Check<T> =>
  (value) =>
    typeof value === 'string' && values.includes(value as T) ? (value as T) : fail();
const array =
  <T>(check: Check<T>, min: number, max: number): Check<T[]> =>
  (value) => {
    if (!Array.isArray(value) || value.length < min || value.length > max) return fail();
    return value.map(check);
  };
const optionalArray =
  <T>(check: Check<T>, max: number): Check<T[] | undefined> =>
  (value) =>
    value === undefined ? undefined : array(check, 0, max)(value);
const nullable =
  <T>(check: Check<T>): Check<T | null> =>
  (value) =>
    value === null ? null : check(value);
const union =
  <A, B>(a: Check<A>, b: Check<B>): Check<A | B> =>
  (value) => {
    try {
      return a(value);
    } catch {
      return b(value);
    }
  };
const object =
  <S extends Record<string, Check<unknown>>>(
    shape: S,
  ): Check<{ [K in keyof S]: Output<S[K]> }> =>
  (value) => {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    )
      return fail();
    const data = value as Record<string, unknown>;
    if (Object.keys(data).some((key) => !Object.hasOwn(shape, key)))
      return fail();
    return Object.fromEntries(
      Object.entries(shape).flatMap(([key, check]) => {
        const value = check(data[key]);
        return value === undefined ? [] : [[key, value]];
      }),
    ) as { [K in keyof S]: Output<S[K]> };
  };

const id = text(128, 1);
const courseId = (value: unknown) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(36, 36)(value)) ? (value as string) : fail();
const hash = (value: unknown) =>
  /^sha256:[a-f0-9]{64}$/.test(text(71, 71)(value)) ? (value as string) : fail();
const evidenceIds = array(id, 0, 128);
const sourceEvidence = object({
  chunkId: id,
  documentId: id,
  pageNumber: nullable(integer(1, 100000)),
});
const sourceReference = object({
  documentId: id,
  contentHash: hash,
  pageNumber: nullable(integer(1, 100000)),
  href: text(2048, 1),
});
const objective = object({
  objectiveId: id,
  statement: text(2000, 1),
  bloomLevel: text(40, 1),
});
const textMark = object({
  type: oneOf('bold', 'italic', 'code'),
  start: integer(0, 8000),
  end: integer(0, 8000),
});
const linkMark = object({
  type: oneOf('link'),
  start: integer(0, 8000),
  end: integer(0, 8000),
  href: text(2048, 1),
});
const marks = union(textMark, linkMark);

const blockShapes: Record<string, Check<unknown>> = {
  heading: object({ type: oneOf('heading'), id, level: integer(1, 4), text: text(500, 1) }),
  paragraph: object({
    type: oneOf('paragraph'),
    id,
    text: text(8000, 1),
    evidence: evidenceIds,
    marks: optionalArray(marks, 50),
  }),
  list: object({
    type: oneOf('list'),
    id,
    ordered: (value) => (typeof value === 'boolean' ? value : fail()),
    items: array(text(1200, 1), 1, 80),
    evidence: evidenceIds,
  }),
  quote: object({ type: oneOf('quote'), id, text: text(4000, 1), evidence: evidenceIds }),
  code: object({
    type: oneOf('code'),
    id,
    language: text(24),
    code: text(20000, 1),
    caption: optionalText(500),
  }),
  math: object({
    type: oneOf('math'),
    id,
    expression: text(600, 1),
    notation: oneOf('latex', 'plain'),
    caption: optionalText(500),
  }),
  table: object({
    type: oneOf('table'),
    id,
    caption: optionalText(500),
    columns: array(text(300, 1), 1, 20),
    rows: array(array(text(1200), 0, 20), 0, 100),
    evidence: evidenceIds,
  }),
  media: object({
    type: oneOf('media'),
    id,
    mediaType: oneOf('image', 'audio', 'video'),
    src: optionalText(2048),
    alt: text(500),
    caption: optionalText(500),
  }),
  diagram: object({
    type: oneOf('diagram'),
    id,
    title: text(500, 1),
    description: text(2000),
    steps: array(object({ id, label: text(300, 1), detail: optionalText(1000) }), 1, 60),
  }),
  callout: object({
    type: oneOf('callout'),
    id,
    kind: oneOf('definition', 'theorem', 'example', 'proof', 'exercise', 'note'),
    title: optionalText(500),
    text: text(4000, 1),
    evidence: evidenceIds,
  }),
};
export type LearningBlockShape =
  | { type: 'heading'; id: string; level: 1 | 2 | 3 | 4; text: string }
  | {
      type: 'paragraph';
      id: string;
      text: string;
      evidence: string[];
      marks?: Array<
        | { type: 'bold' | 'italic' | 'code'; start: number; end: number }
        | { type: 'link'; start: number; end: number; href: string }
      >;
    }
  | { type: 'list'; id: string; ordered: boolean; items: string[]; evidence: string[] }
  | { type: 'quote'; id: string; text: string; evidence: string[] }
  | { type: 'code'; id: string; language: string; code: string; caption?: string }
  | { type: 'math'; id: string; expression: string; notation: 'latex' | 'plain'; caption?: string }
  | {
      type: 'table';
      id: string;
      caption?: string;
      columns: string[];
      rows: string[][];
      evidence: string[];
    }
  | {
      type: 'media';
      id: string;
      mediaType: 'image' | 'audio' | 'video';
      src?: string;
      alt: string;
      caption?: string;
    }
  | {
      type: 'diagram';
      id: string;
      title: string;
      description: string;
      steps: Array<{ id: string; label: string; detail?: string }>;
    }
  | {
      type: 'callout';
      id: string;
      kind: 'definition' | 'theorem' | 'example' | 'proof' | 'exercise' | 'note';
      title?: string;
      text: string;
      evidence: string[];
    };

const block: Check<LearningBlockShape> = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  const type = (value as Record<string, unknown>).type;
  if (typeof type !== 'string' || !Object.hasOwn(blockShapes, type)) return fail();
  return blockShapes[type](value) as LearningBlockShape;
};

export const learningDocument = object({
  schemaVersion: oneOf('1.0.0'),
  courseId,
  revisionId: id,
  contentHash: hash,
  title: text(200, 1),
  generated: object({
    summary: text(2000),
    objectives: array(objective, 0, 500),
    outline: array(
      object({
        id,
        title: text(500, 1),
        summary: text(2000),
        objectives: array(objective, 0, 100),
      }),
      0,
      100,
    ),
  }),
  sections: array(
    object({
      id,
      title: text(500, 1),
      summary: text(700),
      blocks: array(block, 1, 400),
      evidence: array(sourceEvidence, 0, 128),
    }),
    1,
    500,
  ),
  sources: array(sourceReference, 0, 32),
  warnings: array(text(2000), 0, 20),
});

export type LearningDocument = Output<typeof learningDocument>;
export type LearningBlock = LearningBlockShape;

/** Strict parser: error details are deliberately not exposed to the browser. */
export function parseLearningDocument(value: unknown): LearningDocument {
  return learningDocument(value);
}
