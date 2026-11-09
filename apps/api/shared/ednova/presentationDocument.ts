/** Published-course presentation contract (Batch 3, Milestone 3.1).
 *
 * A deterministic projection of an authorized published revision into the
 * lesson-level structure a learner surface renders. It is not an authorization
 * grant, never executable markup, and never a semantic-verification claim.
 *
 * Inputs are frozen: CanonicalDocumentV1 (1.0.0) and ReadingDocumentV2 (2.0.0)
 * as recorded in docs/contracts/batch3-consumed-contracts.md. The deterministic
 * source-faithful reader remains the fallback whenever this projection is
 * unavailable or invalid. */

import {
  parseLessonBlock,
  type LessonBlockV2,
} from './learningDocumentV2';
import {
  buildPresentationPlan,
  PRESENTATION_PLAN_VERSION,
  type PresentationPlan,
} from './presentationPlan';
import {
  ASSET_COMPONENTS,
  ASSET_LIMITS,
  STRUCTURED_ASSET_SCHEMA_VERSION,
  parseStructuredAsset,
  projectStructuredAsset,
  type PublishedStructuredAssetV1,
} from './structuredAsset';
import { COMPONENT_REGISTRY_VERSION, COMPONENT_TYPES } from './componentRegistry';

/** Read-mode plan carried by the presentation document. It is built from the
 * same validated blocks, so it cannot introduce content the document lacks. */
export type PublishedPresentationPlanV1 = PresentationPlan;

export const PRESENTATION_SCHEMA_VERSION = '1.0.0' as const;
export const PRESENTATION_READER_SCHEMA_VERSION = '2.0.0' as const;
export const CANONICAL_SCHEMA_VERSION = '1.0.0' as const;

/** `primary` renders the typed block. `source_faithful` explicitly asks the
 * consumer to render the preserved source instead of trusting the projection. */
export type PresentationRenderPolicy = 'primary' | 'source_faithful';
export type PresentationRenderReason =
  | 'reviewed_formula'
  | 'unreviewed_formula'
  | 'missing_source_asset'
  | 'extracted_content';

export type PresentationVerificationStatus =
  | 'no_math'
  | 'unreviewed'
  | 'partially_reviewed'
  | 'reviewed';

export const PRESENTATION_DISCLOSURES: Record<PresentationVerificationStatus, string> = {
  no_math:
    'No display mathematics is present. Content is deterministically extracted from the pinned source revision; no semantic verification is claimed.',
  unreviewed:
    'Mathematical content is structurally extracted and not semantically verified. No formula in this revision has instructor review; formulas render from the original document.',
  partially_reviewed:
    'Mathematical content is structurally extracted and not semantically verified. Instructor-reviewed formulas are typeset; every other formula renders from the original document.',
  reviewed:
    'Every display formula in this revision has instructor review. Instructor review is not independent mathematical verification.',
};

export type PresentationBlockV1 = {
  /** Stable per-lesson presentation identity; equals the projected block id. */
  id: string;
  render: PresentationRenderPolicy;
  reason: PresentationRenderReason;
  block: LessonBlockV2;
};

export type PresentationLessonV1 = {
  id: string;
  title: string;
  summary: string;
  blocks: PresentationBlockV1[];
};

export type PresentationChapterV1 = {
  id: string;
  title: string;
  summary: string;
  lessons: PresentationLessonV1[];
};

export type PublishedPresentationV1 = {
  schemaVersion: typeof PRESENTATION_SCHEMA_VERSION;
  courseId: string;
  revisionId: string;
  /** Source-revision content hash, identical to the reading projection. */
  contentHash: string;
  /** Hash of the canonical document that was actually verified before projection. */
  canonicalContentHash: string;
  title: string;
  summary: string;
  provenance: {
    policy: 'deterministic_source_faithful';
    canonicalSchemaVersion: typeof CANONICAL_SCHEMA_VERSION;
    readerSchemaVersion: typeof PRESENTATION_READER_SCHEMA_VERSION;
    contentHashVerified: true;
  };
  verification: {
    status: PresentationVerificationStatus;
    math: { total: number; reviewed: number; sourceFallback: number };
    disclosure: string;
  };
  objectives: Array<{ objectiveId: string; statement: string; bloomLevel: string }>;
  chapters: PresentationChapterV1[];
  /** Additive Milestone 3.5 projection. Read-mode component plan for this
   * revision; reproducible from the same canonical inputs. Consumers that do
   * not understand it may ignore it — canonical blocks remain authoritative. */
  plan?: PublishedPresentationPlanV1;
  /** Additive Milestone 3.6 projection. Optional structured supplements bound
   * to this revision, each labelled with its provenance. Absent or empty when
   * the revision has none — never inferred from canonical content. */
  assets?: PublishedStructuredAssetV1[];
  sources: Array<{
    documentId: string;
    contentHash: string;
    pageNumber: number | null;
    href: string;
  }>;
  fallback: {
    readerHref: string;
    schemaVersion: typeof PRESENTATION_READER_SCHEMA_VERSION;
    deterministic: true;
  };
  warnings: string[];
};

export type PresentationBuildInput = {
  courseId: string;
  revisionId: string;
  contentHash: string;
  canonicalContentHash: string;
  title: string;
  summary: string;
  objectives: PublishedPresentationV1['objectives'];
  chapters: Array<{
    id: string;
    title: string;
    summary: string;
    lessons: Array<{ id: string; title: string; summary: string; blocks: LessonBlockV2[] }>;
  }>;
  sources: PublishedPresentationV1['sources'];
  warnings: string[];
};

const fail = (): never => {
  throw new Error('INVALID_PRESENTATION_DOCUMENT');
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;
const exact = (value: unknown, keys: string[]): Record<string, unknown> => {
  if (!isRecord(value) || Object.keys(value).some((key) => !keys.includes(key))) fail();
  return value as Record<string, unknown>;
};
const str = (value: unknown, max: number) => {
  if (typeof value !== 'string' || !value || value.length > max) fail();
  return value as string;
};
const plain = (value: unknown, max: number) => {
  if (typeof value !== 'string' || value.length > max) fail();
  return value as string;
};
const count = (value: unknown) => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail();
  return value as number;
};
const bool = (value: unknown) => {
  if (typeof value !== 'boolean') fail();
  return value as boolean;
};
const list = <T>(value: unknown, check: (v: unknown) => T, max: number): T[] => {
  if (!Array.isArray(value) || value.length > max) fail();
  return (value as unknown[]).map(check);
};
const href = (value: unknown, prefix: string, max = 2048) => {
  const result = str(value, max);
  if (!result.startsWith(prefix) || /[\s\\]/.test(result) || result.includes('..')) fail();
  return result;
};
const nullableInt = (value: unknown) => {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || (value as number) < 1) fail();
  return value as number;
};

const objective = (value: unknown) => {
  const v = exact(value, ['objectiveId', 'statement', 'bloomLevel']);
  return {
    objectiveId: str(v.objectiveId, 128),
    statement: str(v.statement, 2000),
    bloomLevel: str(v.bloomLevel, 40),
  };
};

const presentationBlock = (value: unknown): PresentationBlockV1 => {
  const v = exact(value, ['id', 'render', 'reason', 'block']);
  if (v.render !== 'primary' && v.render !== 'source_faithful') fail();
  if (
    ![
      'reviewed_formula',
      'unreviewed_formula',
      'missing_source_asset',
      'extracted_content',
    ].includes(String(v.reason))
  )
    fail();
  // The block vocabulary is owned by the reading contract; the presentation
  // boundary reports its own failure code so callers cannot mistake a
  // projection failure for a versioned-reading failure.
  const parseBlock = (value: unknown): LessonBlockV2 => {
    try {
      return parseLessonBlock(value);
    } catch {
      return fail();
    }
  };
  const block = parseBlock(v.block);
  if (block.id !== v.id) fail();
  // The policy is derived from the block, never supplied by the caller: an
  // unreviewed formula cannot be relabelled as primary presentation.
  const expected = policyForBlock(block);
  if (v.render !== expected.render || v.reason !== expected.reason) fail();
  return { id: str(v.id, 128), render: expected.render, reason: expected.reason, block };
};

export function policyForBlock(block: LessonBlockV2): {
  render: PresentationRenderPolicy;
  reason: PresentationRenderReason;
} {
  if (block.type === 'math')
    return block.review
      ? { render: 'primary', reason: 'reviewed_formula' }
      : { render: 'source_faithful', reason: 'unreviewed_formula' };
  if (block.type === 'media' && !block.src)
    return { render: 'source_faithful', reason: 'missing_source_asset' };
  return { render: 'primary', reason: 'extracted_content' };
}

function mathSummary(blocks: PresentationBlockV1[]) {
  const math = blocks.filter((entry) => entry.block.type === 'math');
  const reviewed = math.filter((entry) => entry.reason === 'reviewed_formula').length;
  const total = math.length;
  const status: PresentationVerificationStatus =
    total === 0
      ? 'no_math'
      : reviewed === 0
        ? 'unreviewed'
        : reviewed === total
          ? 'reviewed'
          : 'partially_reviewed';
  return {
    status,
    math: { total, reviewed, sourceFallback: total - reviewed },
    disclosure: PRESENTATION_DISCLOSURES[status],
  };
}

const PLAN_SELECTIONS = [
  'heading',
  'prose',
  'definition',
  'theorem',
  'proof',
  'example',
  'exercise',
  'note',
  'reviewed_math',
  'unreviewed_math',
  'multiline_derivation',
  'code',
  'table',
  'figure',
  'process',
  'chart',
  'unsupported_block',
  'invalid_props',
] as const;

/** Strict plan validation. The plan must describe exactly the blocks the
 * document carries, in the same order, under the same render policy — a plan
 * cannot add, drop, reorder or relabel content. */
function parsePresentationPlan(
  value: unknown,
  chapters: PresentationChapterV1[],
): PublishedPresentationPlanV1 {
  const v = exact(value, [
    'schemaVersion',
    'registryVersion',
    'courseId',
    'revisionId',
    'contentHash',
    'mode',
    'lessons',
    'unclassified',
  ]);
  if (v.schemaVersion !== PRESENTATION_PLAN_VERSION) fail();
  if (v.registryVersion !== COMPONENT_REGISTRY_VERSION) fail();
  if (v.mode !== 'read') fail();
  const lessons = new Map<string, PresentationLessonV1>(
    chapters.flatMap((chapter) => chapter.lessons.map((l) => [l.id, l] as const)),
  );
  const planned = list(
    v.lessons,
    (entry) => {
      const l = exact(entry, ['lessonId', 'title', 'instances', 'counts']);
      const found = lessons.get(String(l.lessonId));
      if (found === undefined) return fail();
      const lesson = found;
      const instances = list(
        l.instances,
        (instanceEntry) => {
          const i = exact(instanceEntry, [
            'instanceId',
            'blockId',
            'blockType',
            'component',
            'selection',
            'render',
            'reason',
            'interactive',
            'degraded',
            'hasSourceRegion',
          ]);
          if (!COMPONENT_TYPES.includes(String(i.component) as never)) fail();
          if (!(PLAN_SELECTIONS as readonly string[]).includes(String(i.selection))) fail();
          if (i.render !== 'primary' && i.render !== 'source_faithful') fail();
          const interactive = bool(i.interactive);
          const hasSourceRegion = bool(i.hasSourceRegion);
          const degraded =
            i.degraded === undefined
              ? undefined
              : (() => {
                  const d = exact(i.degraded, ['from', 'failure']);
                  if (!COMPONENT_TYPES.includes(String(d.from) as never)) fail();
                  return { from: d.from as never, failure: str(d.failure, 64) };
                })();
          return {
            instanceId: str(i.instanceId, 256),
            blockId: str(i.blockId, 128),
            blockType: String(i.blockType) as never,
            component: String(i.component) as never,
            selection: String(i.selection) as never,
            render: i.render as never,
            reason: String(i.reason) as never,
            interactive,
            ...(degraded ? { degraded } : {}),
            hasSourceRegion,
          };
        },
        400,
      );
      if (instances.length !== lesson.blocks.length) fail();
      // Positional binding: the plan is a projection of these exact blocks.
      lesson.blocks.forEach((block, index) => {
        const instance = instances[index];
        if (instance.blockId !== block.id) fail();
        if (instance.render !== block.render || instance.reason !== block.reason) fail();
        if (instance.blockType !== block.block.type) fail();
        if (instance.instanceId !== `${lesson.id}:${block.id}`) fail();
      });
      const counts = exact(l.counts, ['total', 'primary', 'sourceFallback', 'interactive']);
      if (
        count(counts.total) !== instances.length ||
        count(counts.primary) !== instances.filter((x) => x.render === 'primary').length ||
        count(counts.sourceFallback) !== instances.filter((x) => x.render === 'source_faithful').length ||
        count(counts.interactive) !== instances.filter((x) => x.interactive).length
      )
        fail();
      return {
        lessonId: lesson.id,
        title: str(l.title, 500),
        instances,
        counts: {
          total: instances.length,
          primary: counts.primary as number,
          sourceFallback: counts.sourceFallback as number,
          interactive: counts.interactive as number,
        },
      };
    },
    200,
  );
  if (planned.length !== lessons.size) fail();
  const unclassified = count(v.unclassified);
  const expectedUnclassified = planned.reduce(
    (total, lesson) =>
      total + lesson.instances.filter((i) => i.selection === 'unsupported_block').length,
    0,
  );
  if (unclassified !== expectedUnclassified) fail();
  return {
    schemaVersion: PRESENTATION_PLAN_VERSION,
    registryVersion: COMPONENT_REGISTRY_VERSION,
    courseId: str(v.courseId, 36),
    revisionId: str(v.revisionId, 128),
    contentHash: str(v.contentHash, 71),
    mode: 'read',
    lessons: planned,
    unclassified,
  };
}

/** Deterministic canonical → presentation mapping. No content is added,
 * reordered or extrapolated; each projected block is validated by the reader
 * block parser before entering the presentation document. */
export function buildPublishedPresentation(input: PresentationBuildInput): PublishedPresentationV1 {
  const chapters = input.chapters.map((chapter) => ({
    id: str(chapter.id, 128),
    title: str(chapter.title, 500),
    summary: plain(chapter.summary, 2000),
    lessons: chapter.lessons.map((lesson) => ({
      id: str(lesson.id, 128),
      title: str(lesson.title, 500),
      summary: plain(lesson.summary, 2000),
      blocks: lesson.blocks.map((block) => {
        const policy = policyForBlock(block);
        return { id: block.id, ...policy, block: parseLessonBlock(block) };
      }),
    })),
  }));
  if (!chapters.length) fail();
  const allBlocks = chapters.flatMap((chapter) =>
    chapter.lessons.flatMap((lesson) => lesson.blocks),
  );
  const verification = mathSummary(allBlocks);
  const document: PublishedPresentationV1 = {
    schemaVersion: PRESENTATION_SCHEMA_VERSION,
    courseId: input.courseId,
    revisionId: input.revisionId,
    contentHash: input.contentHash,
    canonicalContentHash: input.canonicalContentHash,
    title: str(input.title, 200),
    summary: plain(input.summary, 2000),
    provenance: {
      policy: 'deterministic_source_faithful',
      canonicalSchemaVersion: CANONICAL_SCHEMA_VERSION,
      readerSchemaVersion: PRESENTATION_READER_SCHEMA_VERSION,
      contentHashVerified: true,
    },
    verification,
    objectives: input.objectives.map(objective),
    chapters,
    plan: buildPresentationPlan({
      courseId: input.courseId,
      revisionId: input.revisionId,
      contentHash: input.contentHash,
      mode: 'read',
      lessons: chapters.flatMap((chapter) =>
        chapter.lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          blocks: lesson.blocks,
        })),
      ),
    }),
    sources: input.sources.map((source) => ({
      documentId: str(source.documentId, 128),
      contentHash: source.contentHash,
      pageNumber: nullableInt(source.pageNumber),
      href: href(source.href, '/api/v1/study/'),
    })),
    fallback: {
      readerHref: `/courses/${input.courseId}/learn?revisionId=${encodeURIComponent(input.revisionId)}`,
      schemaVersion: PRESENTATION_READER_SCHEMA_VERSION,
      deterministic: true,
    },
    warnings: input.warnings.map((warning) => plain(warning, 2000)),
  };
  return parsePublishedPresentation(document);
}

export function parsePublishedPresentation(value: unknown): PublishedPresentationV1 {
  const v = exact(value, [
    'schemaVersion',
    'courseId',
    'revisionId',
    'contentHash',
    'canonicalContentHash',
    'title',
    'summary',
    'provenance',
    'verification',
    'objectives',
    'chapters',
    'plan',
    'assets',
    'sources',
    'fallback',
    'warnings',
  ]);
  if (v.schemaVersion !== PRESENTATION_SCHEMA_VERSION) fail();
  const courseId = str(v.courseId, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(courseId)) fail();
  const contentHash = str(v.contentHash, 71);
  if (!/^sha256:[a-f0-9]{64}$/.test(contentHash)) fail();
  const canonicalContentHash = str(v.canonicalContentHash, 71);
  if (!/^sha256:[a-f0-9]{64}$/.test(canonicalContentHash)) fail();

  const provenance = exact(v.provenance, [
    'policy',
    'canonicalSchemaVersion',
    'readerSchemaVersion',
    'contentHashVerified',
  ]);
  if (
    provenance.policy !== 'deterministic_source_faithful' ||
    provenance.canonicalSchemaVersion !== CANONICAL_SCHEMA_VERSION ||
    provenance.readerSchemaVersion !== PRESENTATION_READER_SCHEMA_VERSION ||
    provenance.contentHashVerified !== true
  )
    fail();

  const verification = exact(v.verification, ['status', 'math', 'disclosure']);
  const math = exact(verification.math, ['total', 'reviewed', 'sourceFallback']);
  const total = count(math.total);
  const reviewed = count(math.reviewed);
  const sourceFallback = count(math.sourceFallback);
  if (reviewed + sourceFallback !== total) fail();
  const status = String(verification.status) as PresentationVerificationStatus;
  if (!Object.hasOwn(PRESENTATION_DISCLOSURES, status)) fail();
  const expectedStatus: PresentationVerificationStatus =
    total === 0
      ? 'no_math'
      : reviewed === 0
        ? 'unreviewed'
        : reviewed === total
          ? 'reviewed'
          : 'partially_reviewed';
  if (status !== expectedStatus) fail();
  if (verification.disclosure !== PRESENTATION_DISCLOSURES[status]) fail();

  const chapters = list(
    v.chapters,
    (entry): PresentationChapterV1 => {
      const c = exact(entry, ['id', 'title', 'summary', 'lessons']);
      return {
        id: str(c.id, 128),
        title: str(c.title, 500),
        summary: plain(c.summary, 2000),
        lessons: list(
          c.lessons,
          (lessonEntry): PresentationLessonV1 => {
            const l = exact(lessonEntry, ['id', 'title', 'summary', 'blocks']);
            return {
              id: str(l.id, 128),
              title: str(l.title, 500),
              summary: plain(l.summary, 2000),
              blocks: list(l.blocks, presentationBlock, 400),
            };
          },
          200,
        ),
      };
    },
    500,
  );
  if (!chapters.length) fail();

  // The plan is optional for forward compatibility with a 1.0.0 consumer that
  // predates it, but when present it must describe this document's blocks.
  const plan =
    v.plan === undefined ? undefined : parsePresentationPlan(v.plan, chapters);
  if (plan && (plan.courseId !== courseId || plan.contentHash !== contentHash)) fail();
  if (plan && plan.revisionId !== String(v.revisionId)) fail();

  // Assets are optional supplements. Every one is re-validated against the
  // full asset contract and re-bound to this document's course and revision;
  // a cross-revision or malformed asset fails the whole parse rather than
  // arriving in the browser next to the wrong lesson.
  const assets =
    v.assets === undefined
      ? undefined
      : list(
          v.assets,
          (entry) => {
            const raw = exact(entry, [
              'schemaVersion',
              'assetId',
              'courseId',
              'revisionId',
              'lessonId',
              'blockId',
              'component',
              'provenance',
              'review',
              'payload',
              'label',
              'fallback',
              'disclosure',
            ]);
            if (raw.schemaVersion !== STRUCTURED_ASSET_SCHEMA_VERSION) fail();
            if (!ASSET_COMPONENTS.includes(String(raw.component) as never)) fail();
            const parsed = (() => {
              try {
                return parseStructuredAsset({
                  schemaVersion: raw.schemaVersion,
                  assetId: raw.assetId,
                  courseId: raw.courseId,
                  revisionId: raw.revisionId,
                  ...(raw.blockId !== null && raw.blockId !== undefined
                    ? { blockId: raw.blockId }
                    : {}),
                  lessonId: raw.lessonId,
                  registryVersion: COMPONENT_REGISTRY_VERSION,
                  component: raw.component,
                  payload: raw.payload,
                  provenance: raw.provenance,
                  review: raw.review,
                  audience: 'course',
                  fallback: raw.fallback,
                  disclosure: raw.disclosure,
                });
              } catch {
                return fail();
              }
            })();
            const projected = projectStructuredAsset(parsed, {
              courseId: String(v.courseId),
              revisionId: String(v.revisionId),
            });
            // A null projection means the asset must not be shown to a learner.
            if (projected === null) return fail();
            if (projected.label !== raw.label) fail();
            return projected;
          },
          ASSET_LIMITS.maxAssetsPerRevision,
        );
  if (assets) {
    const lessonIds = new Set(
      chapters.flatMap((chapter) => chapter.lessons.map((lesson) => lesson.id)),
    );
    // An asset must point at a lesson that exists in this document.
    for (const asset of assets) if (!lessonIds.has(asset.lessonId)) fail();
  }

  const sources = list(
    v.sources,
    (entry) => {
      const s = exact(entry, ['documentId', 'contentHash', 'pageNumber', 'href']);
      const sourceHash = str(s.contentHash, 71);
      if (!/^sha256:[a-f0-9]{64}$/.test(sourceHash)) fail();
      return {
        documentId: str(s.documentId, 128),
        contentHash: sourceHash,
        pageNumber: nullableInt(s.pageNumber),
        href: href(s.href, '/api/v1/study/'),
      };
    },
    32,
  );

  const fallback = exact(v.fallback, ['readerHref', 'schemaVersion', 'deterministic']);
  if (
    fallback.schemaVersion !== PRESENTATION_READER_SCHEMA_VERSION ||
    fallback.deterministic !== true
  )
    fail();
  const readerHref = str(fallback.readerHref, 2048);
  if (
    !new RegExp(
      `^/courses/${courseId}/learn(\\?revisionId=[A-Za-z0-9_-]{1,128})?$`,
    ).test(readerHref)
  )
    fail();

  return {
    schemaVersion: PRESENTATION_SCHEMA_VERSION,
    courseId,
    revisionId: str(v.revisionId, 128),
    contentHash,
    canonicalContentHash,
    title: str(v.title, 200),
    summary: plain(v.summary, 2000),
    provenance: {
      policy: 'deterministic_source_faithful',
      canonicalSchemaVersion: CANONICAL_SCHEMA_VERSION,
      readerSchemaVersion: PRESENTATION_READER_SCHEMA_VERSION,
      contentHashVerified: true,
    },
    verification: {
      status,
      math: { total, reviewed, sourceFallback },
      disclosure: PRESENTATION_DISCLOSURES[status],
    },
    objectives: list(v.objectives, objective, 500),
    chapters,
    ...(plan ? { plan } : {}),
    ...(assets ? { assets } : {}),
    sources,
    fallback: {
      readerHref,
      schemaVersion: PRESENTATION_READER_SCHEMA_VERSION,
      deterministic: true,
    },
    warnings: list(v.warnings, (warning) => plain(warning, 2000), 20),
  };
}
