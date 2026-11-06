/** Structured learning-asset contract (Batch 3, Milestone 3.6).
 *
 * Seven registered components need structured input that the canonical
 * projection cannot supply: a code walkthrough needs line annotations, a
 * topology needs validated nodes and edges, a timeline needs dated events.
 * Extracting those from a PDF is a Batch 4 concern and is NOT claimed here.
 *
 * This module defines the smallest contract that lets an *authorized*,
 * *provenance-labelled* asset be attached to a published revision and rendered
 * through the existing trusted registry. An asset is never canonical content,
 * never a reinterpretation of the source document, and never executable.
 *
 * Provenance is a first-class, required field. The six categories are mutually
 * exclusive and drive both the UI label and what the asset may claim:
 *
 *   original_source        the preserved source itself (never an asset)
 *   source_derived         deterministically derived FROM the source, with refs
 *   instructor_authored    written by a course instructor
 *   reviewed_supplemental  instructor-authored AND independently reviewed
 *   generated_proposal     model-proposed, not reviewed — never rendered primary
 *   deterministic_demo     authored by the product to demonstrate a component
 */

import {
  COMPONENT_REGISTRY_VERSION,
  isComponentType,
  type ComponentType,
} from './componentRegistry';

export const STRUCTURED_ASSET_SCHEMA_VERSION = '1.0.0' as const;

export const ASSET_PROVENANCE = [
  'source_derived',
  'instructor_authored',
  'reviewed_supplemental',
  'generated_proposal',
  'deterministic_demo',
] as const;
export type AssetProvenance = (typeof ASSET_PROVENANCE)[number];

/** Provenance that may be rendered as part of a lesson. A generated proposal
 * is excluded: it is never shown to a learner as if it were course content. */
export const LEARNER_VISIBLE_PROVENANCE: readonly AssetProvenance[] = [
  'source_derived',
  'instructor_authored',
  'reviewed_supplemental',
  'deterministic_demo',
];

/** Provenance that requires a review record before it can claim review. */
export const REVIEW_REQUIRED_PROVENANCE: readonly AssetProvenance[] = [
  'source_derived',
  'reviewed_supplemental',
];

export type AssetReviewStatus = 'unreviewed' | 'instructor_reviewed' | 'not_applicable';

export type AssetReview = {
  status: Exclude<AssetReviewStatus, 'unreviewed'> | 'unreviewed';
  reviewedBy?: string;
  reviewedAt?: string;
};

/** A source citation. Present iff the asset claims source derivation. */
export type AssetSourceReference = {
  documentId: string;
  pageNumber: number | null;
  /** Bounded line range in the preserved extraction. */
  lineStart: number;
  lineEnd: number;
  chunkId?: string;
};

/** Resource limits. Excess fails validation rather than being truncated
 * silently, so a learner never sees a partial asset presented as complete. */
export const ASSET_LIMITS = Object.freeze({
  maxAssetsPerRevision: 200,
  maxNodes: 80,
  maxLinks: 160,
  maxSteps: 60,
  maxAnnotations: 200,
  maxCodeLength: 20_000,
  maxTextLength: 4_000,
  maxLabelLength: 200,
  maxReferences: 32,
});

// ---------------------------------------------------------------------------
// Component payloads. Only components whose input the canonical projection
// cannot supply appear here; everything else keeps its existing path.
// ---------------------------------------------------------------------------

export type CodeWalkthroughPayload = {
  component: 'CodeWalkthrough';
  language: string;
  code: string;
  annotations: Array<{
    line: number;
    explanation: string;
    state?: Array<{ name: string; value: string }>;
  }>;
};

export type CodeComparisonPayload = {
  component: 'CodeComparison';
  language: string;
  entries: Array<{ label: string; code: string; note?: string }>;
};

export type InputOutputPayload = {
  component: 'InputOutputExample';
  language: string;
  code: string;
  cases: Array<{ input: string; output: string; note?: string }>;
};

export type TopologyNode = {
  id: string;
  label: string;
  /** Percentage position within the canvas, 0–100. */
  x: number;
  y: number;
  detail?: string;
  kind?: 'host' | 'router' | 'switch' | 'service' | 'store' | 'client';
};

export type AnnotatedDiagramPayload = {
  component: 'AnnotatedDiagram';
  imageAlt: string;
  nodes: TopologyNode[];
  links: Array<{ from: string; to: string; label?: string }>;
};

export type ArchitecturePayload = {
  component: 'ArchitectureDiagram';
  nodes: TopologyNode[];
  links: Array<{ from: string; to: string; label?: string }>;
};

export type NetworkTopologyPayload = {
  component: 'NetworkTopology';
  nodes: TopologyNode[];
  links: Array<{ from: string; to: string; label?: string }>;
};

export type TimelinePayload = {
  component: 'Timeline';
  events: Array<{ id: string; label: string; detail?: string; when?: string }>;
};

export type AssetPayload =
  | CodeWalkthroughPayload
  | CodeComparisonPayload
  | InputOutputPayload
  | AnnotatedDiagramPayload
  | ArchitecturePayload
  | NetworkTopologyPayload
  | TimelinePayload;

export type StructuredAssetV1 = {
  schemaVersion: typeof STRUCTURED_ASSET_SCHEMA_VERSION;
  /** Stable identity. Derived from the revision and the component, not random. */
  assetId: string;
  /** Course and revision binding. Both are mandatory: an asset is only valid
   * inside the revision it was written for. */
  courseId: string;
  revisionId: string;
  /** Canonical block this asset annotates, when it is about one block. */
  blockId?: string;
  lessonId: string;
  registryVersion: typeof COMPONENT_REGISTRY_VERSION;
  component: ComponentType;
  payload: AssetPayload;
  provenance: AssetProvenance;
  review: AssetReview;
  /** Present iff provenance is `source_derived`; forbidden otherwise. */
  sourceReferences?: AssetSourceReference[];
  /** Who may see it. `course` = any enrolled reader of this revision. */
  audience: 'course';
  /** What to show when the payload cannot be used. Always a trusted component. */
  fallback: ComponentType;
  /** Human-facing note about the asset's origin, shown to the learner. */
  disclosure: string;
};

/** What the browser receives. It is a projection of the stored asset with the
 * payload validated and the provenance categorised for labelling. */
export type PublishedStructuredAssetV1 = {
  schemaVersion: typeof STRUCTURED_ASSET_SCHEMA_VERSION;
  assetId: string;
  courseId: string;
  revisionId: string;
  lessonId: string;
  blockId: string | null;
  component: ComponentType;
  provenance: AssetProvenance;
  review: AssetReview;
  payload: AssetPayload;
  /** Learner-facing label for the provenance category. */
  label: string;
  fallback: ComponentType;
  disclosure: string;
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const fail = (code: string): never => {
  throw new StructuredAssetError(code);
};

export class StructuredAssetError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

const exact = (value: unknown, keys: string[]): Record<string, unknown> => {
  if (!isRecord(value) || Object.keys(value).some((key) => !keys.includes(key)))
    return fail('INVALID_STRUCTURED_ASSET');
  return value as Record<string, unknown>;
};

const str = (value: unknown, max: number, min = 1): string => {
  if (typeof value !== 'string' || value.length < min || value.length > max)
    return fail('INVALID_STRUCTURED_ASSET');
  return value;
};

const bool = (value: unknown): boolean => {
  if (typeof value !== 'boolean') return fail('INVALID_STRUCTURED_ASSET');
  return value;
};

const int = (value: unknown, min: number, max: number): number => {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max)
    return fail('INVALID_STRUCTURED_ASSET');
  return value as number;
};

const num = (value: unknown, min: number, max: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    return fail('INVALID_STRUCTURED_ASSET');
  return value;
};

const list = <T>(value: unknown, check: (v: unknown) => T, max: number, min = 0): T[] => {
  if (!Array.isArray(value) || value.length > max || value.length < min)
    return fail('INVALID_STRUCTURED_ASSET');
  return (value as unknown[]).map(check);
};

/** No source-derived string may look like markup or a script. Payloads are
 * rendered as text by the trusted components, but rejecting them here keeps a
 * hostile asset from ever reaching the renderer. */
const safeText = (value: unknown, max: number, min = 1): string => {
  const text = str(value, max, min);
  if (/<\s*\/?\s*[a-zA-Z!]/.test(text))
    return fail('STRUCTURED_ASSET_MARKUP_REJECTED');
  return text;
};

const node = (value: unknown): TopologyNode => {
  const v = exact(value, ['id', 'label', 'x', 'y', 'detail', 'kind']);
  if (
    v.kind !== undefined &&
    !['host', 'router', 'switch', 'service', 'store', 'client'].includes(String(v.kind))
  )
    return fail('INVALID_STRUCTURED_ASSET');
  return {
    id: str(v.id, 64),
    label: safeText(v.label, ASSET_LIMITS.maxLabelLength),
    x: num(v.x, 0, 100),
    y: num(v.y, 0, 100),
    ...(v.detail !== undefined ? { detail: safeText(v.detail, ASSET_LIMITS.maxTextLength) } : {}),
    ...(v.kind !== undefined ? { kind: v.kind as TopologyNode['kind'] } : {}),
  };
};

const link = (value: unknown): { from: string; to: string; label?: string } => {
  const v = exact(value, ['from', 'to', 'label']);
  return {
    from: str(v.from, 64),
    to: str(v.to, 64),
    ...(v.label !== undefined ? { label: safeText(v.label, ASSET_LIMITS.maxLabelLength) } : {}),
  };
};

function parseGraphPayload(
  component: 'AnnotatedDiagram' | 'ArchitectureDiagram' | 'NetworkTopology',
  value: unknown,
): AnnotatedDiagramPayload | ArchitecturePayload | NetworkTopologyPayload {
  const keys =
    component === 'AnnotatedDiagram'
      ? ['imageAlt', 'nodes', 'links', 'component']
      : ['nodes', 'links', 'component'];
  const v = exact(value, keys);
  const nodes = list(v.nodes, node, ASSET_LIMITS.maxNodes, 1);
  const links = list(v.links, link, ASSET_LIMITS.maxLinks);
  const ids = new Set(nodes.map((entry) => entry.id));
  if (ids.size !== nodes.length) return fail('STRUCTURED_ASSET_DUPLICATE_NODE');
  // A link must reference declared nodes: connectivity is never inferred.
  for (const entry of links)
    if (!ids.has(entry.from) || !ids.has(entry.to)) return fail('STRUCTURED_ASSET_DANGLING_LINK');
  if (component === 'AnnotatedDiagram')
    return { component, imageAlt: safeText(v.imageAlt, ASSET_LIMITS.maxLabelLength), nodes, links };
  return { component, nodes, links };
}

function parsePayload(component: string, value: unknown): AssetPayload {
  // The payload may repeat its component name for readability; where it does,
  // it must agree with the asset's declared component.
  if (isRecord(value) && value.component !== undefined && value.component !== component)
    return fail('STRUCTURED_ASSET_COMPONENT_MISMATCH');
  switch (component) {
    case 'CodeWalkthrough': {
      const v = exact(value, ['language', 'code', 'annotations', 'component']);
      const code = str(v.code, ASSET_LIMITS.maxCodeLength);
      const lineCount = code.split('\n').length;
      const annotations = list(
        v.annotations,
        (entry) => {
          const a = exact(entry, ['line', 'explanation', 'state']);
          const line = int(a.line, 0, lineCount - 1);
          const state =
            a.state === undefined
              ? undefined
              : list(
                  a.state,
                  (item) => {
                    const s = exact(item, ['name', 'value']);
                    return {
                      name: safeText(s.name, 64),
                      value: safeText(s.value, ASSET_LIMITS.maxLabelLength),
                    };
                  },
                  16,
                );
          return {
            line,
            explanation: safeText(a.explanation, ASSET_LIMITS.maxTextLength),
            ...(state ? { state } : {}),
          };
        },
        ASSET_LIMITS.maxAnnotations,
        1,
      );
      // Annotations must advance: a walkthrough with duplicate lines cannot
      // step forward deterministically.
      for (let index = 1; index < annotations.length; index += 1)
        if (annotations[index].line <= annotations[index - 1].line)
          return fail('STRUCTURED_ASSET_ORDER_INVALID');
      return {
        component: 'CodeWalkthrough',
        language: str(v.language, 24),
        code,
        annotations,
      };
    }
    case 'CodeComparison': {
      const v = exact(value, ['language', 'entries', 'component']);
      const entries = list(
        v.entries,
        (entry) => {
          const e = exact(entry, ['label', 'code', 'note']);
          return {
            label: safeText(e.label, ASSET_LIMITS.maxLabelLength),
            code: str(e.code, ASSET_LIMITS.maxCodeLength),
            ...(e.note !== undefined ? { note: safeText(e.note, ASSET_LIMITS.maxTextLength) } : {}),
          };
        },
        4,
        2,
      );
      return { component: 'CodeComparison', language: str(v.language, 24), entries };
    }
    case 'InputOutputExample': {
      const v = exact(value, ['language', 'code', 'cases', 'component']);
      const cases = list(
        v.cases,
        (entry) => {
          const c = exact(entry, ['input', 'output', 'note']);
          return {
            input: safeText(c.input, ASSET_LIMITS.maxTextLength),
            output: safeText(c.output, ASSET_LIMITS.maxTextLength),
            ...(c.note !== undefined ? { note: safeText(c.note, ASSET_LIMITS.maxTextLength) } : {}),
          };
        },
        16,
        1,
      );
      return {
        component: 'InputOutputExample',
        language: str(v.language, 24),
        code: str(v.code, ASSET_LIMITS.maxCodeLength),
        cases,
      };
    }
    case 'Timeline': {
      const v = exact(value, ['events', 'component']);
      const events = list(
        v.events,
        (entry) => {
          const e = exact(entry, ['id', 'label', 'detail', 'when']);
          return {
            id: str(e.id, 64),
            label: safeText(e.label, ASSET_LIMITS.maxLabelLength),
            ...(e.detail !== undefined
              ? { detail: safeText(e.detail, ASSET_LIMITS.maxTextLength) }
              : {}),
            ...(e.when !== undefined ? { when: safeText(e.when, 64) } : {}),
          };
        },
        ASSET_LIMITS.maxSteps,
        1,
      );
      if (new Set(events.map((event) => event.id)).size !== events.length)
        return fail('STRUCTURED_ASSET_DUPLICATE_NODE');
      return { component: 'Timeline', events };
    }
    case 'AnnotatedDiagram':
    case 'ArchitectureDiagram':
    case 'NetworkTopology':
      return parseGraphPayload(component, value);
    default:
      return fail('STRUCTURED_ASSET_COMPONENT_UNSUPPORTED');
  }
}

const provenance = (value: unknown): AssetProvenance => {
  if (!ASSET_PROVENANCE.includes(value as AssetProvenance))
    return fail('INVALID_STRUCTURED_ASSET');
  return value as AssetProvenance;
};

const review = (value: unknown): AssetReview => {
  const v = exact(value, ['status', 'reviewedBy', 'reviewedAt']);
  if (!['unreviewed', 'instructor_reviewed', 'not_applicable'].includes(String(v.status)))
    return fail('INVALID_STRUCTURED_ASSET');
  const status = v.status as AssetReview['status'];
  if (status === 'instructor_reviewed') {
    const reviewedBy = safeText(v.reviewedBy, 128);
    const reviewedAt = str(v.reviewedAt, 40);
    if (!Number.isFinite(Date.parse(reviewedAt)))
      return fail('INVALID_STRUCTURED_ASSET');
    return { status, reviewedBy, reviewedAt };
  }
  // A non-reviewed status must not carry a reviewer: that would imply review.
  if (v.reviewedBy !== undefined || v.reviewedAt !== undefined)
    return fail('STRUCTURED_ASSET_FORGED_REVIEW');
  return { status };
};

const sourceReference = (value: unknown): AssetSourceReference => {
  const v = exact(value, ['documentId', 'pageNumber', 'lineStart', 'lineEnd', 'chunkId']);
  if (v.pageNumber !== null && (!Number.isSafeInteger(v.pageNumber) || Number(v.pageNumber) < 1))
    return fail('INVALID_STRUCTURED_ASSET');
  const lineStart = int(v.lineStart, 1, 10_000_000);
  const lineEnd = int(v.lineEnd, lineStart, 10_000_000);
  return {
    documentId: str(v.documentId, 128),
    pageNumber: v.pageNumber as number | null,
    lineStart,
    lineEnd,
    ...(v.chunkId !== undefined ? { chunkId: str(v.chunkId, 128) } : {}),
  };
};

/** Payload components that this contract can carry. */
export const ASSET_COMPONENTS: readonly ComponentType[] = Object.freeze([
  'CodeWalkthrough',
  'CodeComparison',
  'InputOutputExample',
  'AnnotatedDiagram',
  'ArchitectureDiagram',
  'NetworkTopology',
  'Timeline',
]);

/**
 * Strict validation. Deterministic: the same input yields the same result and
 * the same error code, with no clock or locale dependence.
 */
export function parseStructuredAsset(value: unknown): StructuredAssetV1 {
  const v = exact(value, [
    'schemaVersion',
    'assetId',
    'courseId',
    'revisionId',
    'blockId',
    'lessonId',
    'registryVersion',
    'component',
    'payload',
    'provenance',
    'review',
    'sourceReferences',
    'audience',
    'fallback',
    'disclosure',
  ]);
  if (v.schemaVersion !== STRUCTURED_ASSET_SCHEMA_VERSION)
    return fail('STRUCTURED_ASSET_VERSION_UNSUPPORTED');
  if (v.registryVersion !== COMPONENT_REGISTRY_VERSION)
    return fail('STRUCTURED_ASSET_VERSION_UNSUPPORTED');
  const courseId = str(v.courseId, 24);
  if (!/^[a-f0-9]{24}$/.test(courseId)) return fail('INVALID_STRUCTURED_ASSET');
  const component = String(v.component);
  if (!ASSET_COMPONENTS.includes(component as ComponentType))
    return fail('STRUCTURED_ASSET_COMPONENT_UNSUPPORTED');

  const payload = parsePayload(component, v.payload);
  // The payload's own component must match the declared component exactly.
  if (payload.component !== component) return fail('STRUCTURED_ASSET_COMPONENT_MISMATCH');

  const assetProvenance = provenance(v.provenance);
  const assetReview = review(v.review);

  // Review status and provenance must agree. `reviewed_supplemental` claims
  // review, so it must carry a review record; `generated_proposal` must not.
  if (assetProvenance === 'reviewed_supplemental' && assetReview.status !== 'instructor_reviewed')
    return fail('STRUCTURED_ASSET_REVIEW_MISMATCH');
  if (assetProvenance === 'generated_proposal' && assetReview.status === 'instructor_reviewed')
    return fail('STRUCTURED_ASSET_REVIEW_MISMATCH');

  // Source references are required for a source-derived claim, and forbidden
  // for anything else: an authored demo may not imply it came from the PDF.
  const references =
    v.sourceReferences === undefined
      ? undefined
      : list(v.sourceReferences, sourceReference, ASSET_LIMITS.maxReferences, 1);
  if (assetProvenance === 'source_derived' && !references)
    return fail('STRUCTURED_ASSET_SOURCE_REFERENCES_REQUIRED');
  if (assetProvenance !== 'source_derived' && references)
    return fail('STRUCTURED_ASSET_SOURCE_REFERENCES_FORBIDDEN');

  if (v.audience !== 'course') return fail('INVALID_STRUCTURED_ASSET');
  // The fallback must be any component the trusted registry actually knows,
  // not merely one this contract can carry: a topology degrades to a process
  // diagram, which is a static component the registry owns.
  const fallback = String(v.fallback);
  if (!isComponentType(fallback)) return fail('STRUCTURED_ASSET_FALLBACK_UNTRUSTED');

  return {
    schemaVersion: STRUCTURED_ASSET_SCHEMA_VERSION,
    assetId: str(v.assetId, 128),
    courseId,
    revisionId: str(v.revisionId, 128),
    ...(v.blockId !== undefined ? { blockId: str(v.blockId, 128) } : {}),
    lessonId: str(v.lessonId, 128),
    registryVersion: COMPONENT_REGISTRY_VERSION,
    component: component as ComponentType,
    payload,
    provenance: assetProvenance,
    review: assetReview,
    ...(references ? { sourceReferences: references } : {}),
    audience: 'course',
    fallback: fallback as ComponentType,
    disclosure: safeText(v.disclosure, 300),
  };
}

const PROVENANCE_LABELS: Record<AssetProvenance, string> = {
  source_derived: 'Derived from the source document',
  instructor_authored: 'Instructor-authored material',
  reviewed_supplemental: 'Instructor-authored and reviewed',
  generated_proposal: 'Unreviewed generated proposal',
  deterministic_demo: 'Demonstration content',
};

/**
 * Project a stored asset into what the browser may render. Returns null for a
 * provenance a learner must never see (an unreviewed generated proposal), so
 * the caller keeps the static fallback rather than showing it.
 */
export function projectStructuredAsset(
  asset: StructuredAssetV1,
  binding: { courseId: string; revisionId: string },
): PublishedStructuredAssetV1 | null {
  if (asset.courseId !== binding.courseId) return null;
  if (asset.revisionId !== binding.revisionId) return null;
  if (!LEARNER_VISIBLE_PROVENANCE.includes(asset.provenance)) return null;
  return {
    schemaVersion: STRUCTURED_ASSET_SCHEMA_VERSION,
    assetId: asset.assetId,
    courseId: asset.courseId,
    revisionId: asset.revisionId,
    lessonId: asset.lessonId,
    blockId: asset.blockId ?? null,
    component: asset.component,
    provenance: asset.provenance,
    review: asset.review,
    payload: asset.payload,
    label: PROVENANCE_LABELS[asset.provenance],
    fallback: asset.fallback,
    disclosure: asset.disclosure,
  };
}

/** Bound a set of assets for one revision, keeping deterministic order. */
export function projectStructuredAssets(
  assets: StructuredAssetV1[],
  binding: { courseId: string; revisionId: string },
): PublishedStructuredAssetV1[] {
  return assets
    .slice(0, ASSET_LIMITS.maxAssetsPerRevision)
    .map((asset) => projectStructuredAsset(asset, binding))
    .filter((asset): asset is PublishedStructuredAssetV1 => asset !== null)
    .sort((a, b) => a.assetId.localeCompare(b.assetId));
}
