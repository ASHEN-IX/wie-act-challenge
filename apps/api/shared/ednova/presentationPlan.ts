/** Deterministic learning-presentation plan (Batch 3, Milestone 3.5).
 *
 * Turns validated canonical blocks into an ordered list of trusted component
 * instances. Same input always produces the same plan: no model call, no
 * randomness, no clock, no locale-dependent ordering.
 *
 * The plan is additive to `PublishedPresentationV1`. It never replaces the
 * canonical block, never reorders content, and never widens what a block may
 * claim about the source. Every block yields exactly one instance — either a
 * typed component or an explicit source-faithful fallback — so no source
 * content is silently dropped.
 */

import type { LessonBlockV2 } from './learningDocumentV2';
import {
  COMPONENT_REGISTRY_VERSION,
  resolveComponent,
  semanticRole,
  type CanonicalBlockType,
  type ComponentType,
  type SemanticRole
} from './componentRegistry';
import type { PresentationRenderPolicy, PresentationRenderReason } from './presentationDocument';

export const PRESENTATION_PLAN_VERSION = '1.0.0' as const;

/** Student-selected display mode. These are layout/interaction policies, not
 * AI-generated plans. */
export const READER_MODES = ['read', 'explore', 'practice'] as const;
export type ReaderMode = (typeof READER_MODES)[number];

export function isReaderMode(value: unknown): value is ReaderMode {
  return typeof value === 'string' && (READER_MODES as readonly string[]).includes(value);
}

/** Why a component was chosen. Reproducible and inspectable. */
export type SelectionRule =
  | 'heading'
  | 'prose'
  | 'definition'
  | 'theorem'
  | 'proof'
  | 'example'
  | 'exercise'
  | 'note'
  | 'reviewed_math'
  | 'unreviewed_math'
  | 'multiline_derivation'
  | 'code'
  | 'table'
  | 'figure'
  | 'process'
  | 'chart'
  | 'unsupported_block'
  | 'invalid_props';

export type PlannedInstance = {
  /** Stable identity: lesson id + canonical block id. */
  instanceId: string;
  /** The canonical block this instance renders. Never mutated. */
  blockId: string;
  blockType: CanonicalBlockType;
  component: ComponentType;
  selection: SelectionRule;
  render: PresentationRenderPolicy;
  reason: PresentationRenderReason;
  /** True when the component is offered but the learner must opt in. */
  interactive: boolean;
  /** Set when the engine had to degrade to a fallback. */
  degraded?: {
    from: ComponentType;
    failure: string;
  };
  /** Source region availability, used by the source inspector. */
  hasSourceRegion: boolean;
};

export type LessonPlan = {
  lessonId: string;
  title: string;
  instances: PlannedInstance[];
  counts: {
    total: number;
    primary: number;
    sourceFallback: number;
    interactive: number;
  };
};

export type PresentationPlan = {
  schemaVersion: typeof PRESENTATION_PLAN_VERSION;
  registryVersion: typeof COMPONENT_REGISTRY_VERSION;
  courseId: string;
  revisionId: string;
  contentHash: string;
  mode: ReaderMode;
  lessons: LessonPlan[];
  /** Blocks the engine could not classify. Empty in a healthy revision. */
  unclassified: number;
};

export type PlanLessonInput = {
  id: string;
  title: string;
  blocks: Array<{
    id: string;
    render: PresentationRenderPolicy;
    reason: PresentationRenderReason;
    block: LessonBlockV2;
  }>;
};

export type PlanInput = {
  courseId: string;
  revisionId: string;
  contentHash: string;
  mode: ReaderMode;
  lessons: PlanLessonInput[];
};

const DERIVATION_MARKERS = [
  '\\begin{aligned}',
  '\\begin{align}',
  '\\begin{gather}',
  '\\begin{cases}',
  '\\begin{array}',
  '\\\\'
];

/** A reviewed display expression that is structurally a multiline derivation.
 * Detection is textual on the reviewed LaTeX only — never on unreviewed text. */
function isMultilineDerivation(block: Extract<LessonBlockV2, { type: 'math' }>): boolean {
  if (!block.review || block.notation !== 'latex') return false;
  return DERIVATION_MARKERS.some((marker) => block.expression.includes(marker));
}

/** Media blocks whose source is a raster figure versus a structured diagram. */
function isFigure(block: Extract<LessonBlockV2, { type: 'media' }>): boolean {
  return block.mediaType === 'image';
}

function select(
  entry: PlanLessonInput['blocks'][number],
  mode: ReaderMode
): { component: ComponentType; selection: SelectionRule } {
  const block = entry.block;
  // A source-faithful policy always wins: unreviewed or unattributable content
  // is rendered from the source, never through a primary component.
  if (entry.render === 'source_faithful') {
    if (block.type === 'math')
      return { component: 'SourceMathFallback', selection: 'unreviewed_math' };
    if (block.type === 'media') return { component: 'SourceDiagram', selection: 'figure' };
    return { component: 'ConceptExplanation', selection: 'unsupported_block' };
  }
  switch (block.type) {
    case 'heading':
      return { component: 'SectionHeading', selection: 'heading' };
    case 'paragraph':
    case 'quote':
      return { component: 'ConceptExplanation', selection: 'prose' };
    case 'list':
      return { component: 'ConceptList', selection: 'prose' };
    case 'callout': {
      const role = semanticRole(block.kind);
      if (role === 'definition') return { component: 'DefinitionCard', selection: 'definition' };
      if (role === 'theorem' || role === 'proposition' || role === 'lemma' || role === 'corollary')
        return { component: 'TheoremCard', selection: 'theorem' };
      if (role === 'proof') return { component: 'ProofBlock', selection: 'proof' };
      if (role === 'example' || role === 'solution')
        return { component: 'ExampleBlock', selection: 'example' };
      if (role === 'exercise') return { component: 'ExerciseBlock', selection: 'exercise' };
      return { component: 'ImportantNote', selection: 'note' };
    }
    case 'math':
      if (isMultilineDerivation(block))
        return { component: 'DerivationBlock', selection: 'multiline_derivation' };
      return { component: 'ReviewedFormula', selection: 'reviewed_math' };
    case 'code':
      // A code walkthrough needs structured annotations that the canonical
      // block does not carry; Explore mode offers the viewer, not a fake plan.
      return { component: 'CodeViewer', selection: 'code' };
    case 'table':
      return { component: 'EducationalTable', selection: 'table' };
    case 'media':
      return isFigure(block)
        ? { component: 'FigureViewer', selection: 'figure' }
        : { component: 'SourceDiagram', selection: 'figure' };
    case 'diagram':
      return { component: 'ProcessDiagram', selection: 'process' };
    case 'chart':
      return { component: 'DataChart', selection: 'chart' };
    default:
      return { component: 'ConceptExplanation', selection: 'unsupported_block' };
  }
}

/** In Read mode no component is interactive: the plan is a pure reading
 * projection. Explore keeps source-faithful blocks static (there is nothing
 * trustworthy to interact with) and offers interactions elsewhere. */
function interactiveFor(
  component: ComponentType,
  selection: SelectionRule,
  mode: ReaderMode
): boolean {
  if (mode !== 'explore') return false;
  if (selection === 'unreviewed_math' || selection === 'unsupported_block') return false;
  return (
    component === 'ProofBlock' ||
    component === 'ProcessDiagram' ||
    component === 'DataChart' ||
    component === 'DerivationBlock'
  );
}

function planBlock(
  entry: PlanLessonInput['blocks'][number],
  lessonId: string,
  mode: ReaderMode
): PlannedInstance {
  const { component, selection } = select(entry, mode);
  const block = entry.block;
  const role: SemanticRole | undefined =
    block.type === 'callout' ? semanticRole(block.kind) : undefined;
  // Charts carry no source geometry; every other block may.
  const hasSourceRegion = block.type !== 'chart' && Boolean(block.sourceMeta?.regionId);
  const hasEvidence =
    ('evidence' in block && Array.isArray(block.evidence) && block.evidence.length > 0) ||
    (block.provenance?.length ?? 0) > 0;

  const resolution = resolveComponent({
    component,
    blockType: block.type,
    ...(role ? { role } : {}),
    policy: entry.render,
    hasEvidence,
    hasSourceRegion,
    isReviewedFormula: block.type === 'math' && Boolean(block.review),
    // The canonical projection carries no trusted structured fixtures
    // (topologies, code annotations), so fixture-only components degrade.
    hasStructuredFixture: false
  });

  const resolvedComponent = resolution.ok ? resolution.capability.type : resolution.fallback.type;
  return {
    instanceId: `${lessonId}:${entry.id}`,
    blockId: entry.id,
    blockType: block.type,
    component: resolvedComponent,
    selection,
    render: entry.render,
    reason: entry.reason,
    interactive: interactiveFor(resolvedComponent, selection, mode),
    ...(resolution.ok ? {} : { degraded: { from: component, failure: resolution.reason } }),
    hasSourceRegion
  };
}

/** Deterministic plan construction. Order is the canonical order; nothing is
 * sorted, deduplicated or dropped. */
export function buildPresentationPlan(input: PlanInput): PresentationPlan {
  const lessons = input.lessons.map((lesson): LessonPlan => {
    const instances = lesson.blocks.map((entry) => planBlock(entry, lesson.id, input.mode));
    return {
      lessonId: lesson.id,
      title: lesson.title,
      instances,
      counts: {
        total: instances.length,
        primary: instances.filter((instance) => instance.render === 'primary').length,
        sourceFallback: instances.filter((instance) => instance.render === 'source_faithful')
          .length,
        interactive: instances.filter((instance) => instance.interactive).length
      }
    };
  });
  return {
    schemaVersion: PRESENTATION_PLAN_VERSION,
    registryVersion: COMPONENT_REGISTRY_VERSION,
    courseId: input.courseId,
    revisionId: input.revisionId,
    contentHash: input.contentHash,
    mode: input.mode,
    lessons,
    unclassified: lessons.reduce(
      (total, lesson) =>
        total +
        lesson.instances.filter((instance) => instance.selection === 'unsupported_block').length,
      0
    )
  };
}

/** Plans are reproducible from identical inputs; this is the equality check
 * used by tests and by the API boundary. */
export function plansEqual(a: PresentationPlan, b: PresentationPlan): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
