/** Trusted educational component registry contract (Batch 3, Milestone 3.2).
 *
 * The registry is the single vocabulary of educational components the learner
 * surface may render. It is a *description* of trusted, statically imported
 * components — never a loader. Component types are literal strings resolved
 * through a frozen lookup table; nothing here can import, evaluate or execute
 * code named by source content or model output.
 *
 * Batch 4's experience planner consumes `COMPONENT_CAPABILITIES` to decide
 * which experiences are available. This module deliberately contains no planner
 * and performs no selection; selection is Milestone 3.5's deterministic
 * policy over canonical blocks.
 */

import type { LessonBlockV2 } from './learningDocumentV2';

export const COMPONENT_REGISTRY_VERSION = '1.0.0' as const;

/** Canonical block kinds a component can consume. Mirrors LessonBlockV2 plus
 * the semantic callout kinds, which are carried inside `callout`. */
export type CanonicalBlockType =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'quote'
  | 'code'
  | 'math'
  | 'table'
  | 'media'
  | 'diagram'
  | 'callout'
  | 'chart';

/** Semantic roles a callout may hold. Only these are treated as structured
 * educational content; an unknown `kind` stays a generic note. */
export const SEMANTIC_ROLES = [
  'definition',
  'theorem',
  'proposition',
  'lemma',
  'corollary',
  'proof',
  'example',
  'exercise',
  'solution',
  'remark',
] as const;
export type SemanticRole = (typeof SEMANTIC_ROLES)[number];

export type ComponentType =
  // core textual
  | 'LessonHeader'
  | 'SectionHeading'
  | 'ConceptExplanation'
  | 'DefinitionCard'
  | 'TheoremCard'
  | 'ProofBlock'
  | 'ExampleBlock'
  | 'ExerciseBlock'
  | 'ImportantNote'
  | 'SourceReference'
  // mathematics
  | 'FormulaBlock'
  | 'ReviewedFormula'
  | 'SourceMathFallback'
  | 'DerivationBlock'
  | 'MathematicalDefinition'
  | 'EquationGroup'
  // programming
  | 'CodeViewer'
  | 'CodeExplanation'
  | 'CodeWalkthrough'
  | 'InputOutputExample'
  | 'CodeComparison'
  // engineering / diagrams
  | 'FigureViewer'
  | 'SourceDiagram'
  | 'AnnotatedDiagram'
  | 'ProcessDiagram'
  | 'ArchitectureDiagram'
  | 'NetworkTopology'
  // structured information
  | 'EducationalTable'
  | 'ComparisonTable'
  | 'KeyValueTable'
  | 'StepSequence'
  | 'Timeline'
  | 'ConceptList'
  | 'SourceCitation'
  | 'DataChart';

/** How much a component may claim about the source. Components never widen
 * this; the projection decides it and the registry only declares support. */
export type EvidenceRequirement =
  | 'none'
  | 'block_evidence'
  | 'source_region'
  | 'reviewed_formula'
  | 'structured_fixture';

export type RenderPolicyCompatibility = 'primary' | 'source_faithful';

/** Interaction a component offers. `none` means static rendering. */
export type InteractionKind =
  | 'none'
  | 'disclosure'
  | 'copy'
  | 'step_through'
  | 'parameter_slider'
  | 'graph'
  | 'pan_zoom'
  | 'annotation_focus'
  | 'sequence_plot';

export type AccessibilityContract = {
  /** Role the component presents to assistive technology. */
  role: 'article' | 'figure' | 'group' | 'note' | 'region';
  /** A textual alternative is always present when true. */
  textAlternative: true;
  /** Keyboard operable when it offers an interaction. */
  keyboardOperable: boolean;
  /** The component supplies a non-visual equivalent for visual output. */
  visualFallback: 'none' | 'data_table' | 'text_summary';
};

export type PerformanceContract = {
  /** Rendering tier. `static` is server-renderable; `interactive` must be
   * client-only and lazily loaded. */
  tier: 'static' | 'interactive';
  /** Rough payload class for lazy-loading decisions. */
  weight: 'light' | 'medium' | 'heavy';
  /** Hard bounds applied to any user-driven computation. */
  bounds?: {
    maxPoints?: number;
    maxSteps?: number;
    maxNodes?: number;
    maxIterations?: number;
  };
};

export type ComponentCapability = {
  type: ComponentType;
  version: string;
  /** Canonical block types this component accepts. */
  accepts: CanonicalBlockType[];
  /** Semantic callout roles it accepts, when applicable. */
  roles?: SemanticRole[];
  evidence: EvidenceRequirement;
  policies: RenderPolicyCompatibility[];
  interaction: InteractionKind;
  accessibility: AccessibilityContract;
  performance: PerformanceContract;
  /** Component rendered when props fail validation. Always a trusted type. */
  fallback: ComponentType;
  /** One-line description consumed by Batch 4 planning metadata. */
  summary: string;
};

const a11y = (
  role: AccessibilityContract['role'],
  visualFallback: AccessibilityContract['visualFallback'] = 'none',
  keyboardOperable = false,
): AccessibilityContract => ({ role, textAlternative: true, keyboardOperable, visualFallback });

const staticLight: PerformanceContract = { tier: 'static', weight: 'light' };
const staticMedium: PerformanceContract = { tier: 'static', weight: 'medium' };
const interactive: PerformanceContract = {
  tier: 'interactive',
  weight: 'medium',
  bounds: { maxPoints: 4000, maxSteps: 200 },
};

const definitions: ComponentCapability[] = [
  // ---- core textual -------------------------------------------------------
  {
    type: 'LessonHeader',
    version: '1.0.0',
    accepts: ['heading'],
    evidence: 'none',
    policies: ['primary'],
    interaction: 'none',
    accessibility: a11y('region'),
    performance: staticLight,
    fallback: 'ConceptExplanation',
    summary: 'Lesson title, chapter context and optional validated objectives.',
  },
  {
    type: 'SectionHeading',
    version: '1.0.0',
    accepts: ['heading'],
    evidence: 'none',
    policies: ['primary'],
    interaction: 'none',
    accessibility: a11y('region'),
    performance: staticLight,
    fallback: 'ConceptExplanation',
    summary: 'In-lesson heading, rendered at a level that never skips rank.',
  },
  {
    type: 'ConceptExplanation',
    version: '1.0.0',
    accepts: ['paragraph', 'list', 'quote'],
    evidence: 'block_evidence',
    policies: ['primary'],
    interaction: 'none',
    accessibility: a11y('article'),
    performance: staticLight,
    fallback: 'ConceptExplanation',
    summary: 'Educational prose preserving order, emphasis and line breaks.',
  },
  {
    type: 'DefinitionCard',
    version: '1.0.0',
    accepts: ['callout'],
    roles: ['definition'],
    evidence: 'block_evidence',
    policies: ['primary'],
    interaction: 'none',
    accessibility: a11y('note'),
    performance: staticLight,
    fallback: 'ImportantNote',
    summary: 'A source definition with distinct visual treatment.',
  },
  {
    type: 'TheoremCard',
    version: '1.0.0',
    accepts: ['callout'],
    roles: ['theorem', 'proposition', 'lemma', 'corollary'],
    evidence: 'block_evidence',
    policies: ['primary'],
    interaction: 'none',
    accessibility: a11y('note'),
    performance: staticLight,
    fallback: 'ImportantNote',
    summary: 'Theorem, proposition, lemma or corollary statement.',
  },
  {
    type: 'ProofBlock',
    version: '1.0.0',
    accepts: ['callout'],
    roles: ['proof'],
    evidence: 'block_evidence',
    policies: ['primary'],
    interaction: 'disclosure',
    accessibility: a11y('note', 'none', true),
    performance: staticLight,
    fallback: 'ImportantNote',
    summary: 'Structured proof, collapsible without hiding it from a11y tools.',
  },
  {
    type: 'ExampleBlock',
    version: '1.0.0',
    accepts: ['callout'],
    roles: ['example'],
    evidence: 'block_evidence',
    policies: ['primary'],
    interaction: 'none',
    accessibility: a11y('note'),
    performance: staticLight,
    fallback: 'ImportantNote',
    summary: 'A worked source example with its own hierarchy.',
  },
  {
    type: 'ExerciseBlock',
    version: '1.0.0',
    accepts: ['callout'],
    roles: ['exercise'],
    evidence: 'block_evidence',
    policies: ['primary'],
    interaction: 'none',
    accessibility: a11y('note'),
    performance: staticLight,
    fallback: 'ImportantNote',
    summary: 'An original source exercise. Not auto-converted into a graded assessment.',
  },
  {
    type: 'ImportantNote',
    version: '1.0.0',
    accepts: ['callout'],
    evidence: 'block_evidence',
    policies: ['primary'],
    interaction: 'none',
    accessibility: a11y('note'),
    performance: staticLight,
    fallback: 'ConceptExplanation',
    summary: 'Validated warning, remark or generic source note.',
  },
  {
    type: 'SourceReference',
    version: '1.0.0',
    accepts: ['math', 'paragraph', 'list', 'quote', 'table', 'callout'],
    evidence: 'source_region',
    policies: ['primary', 'source_faithful'],
    interaction: 'disclosure',
    accessibility: a11y('group', 'none', true),
    performance: staticLight,
    fallback: 'ConceptExplanation',
    summary: 'Authorized link to the original document and source location.',
  },

  // ---- mathematics --------------------------------------------------------
  {
    type: 'FormulaBlock',
    version: '1.0.0',
    accepts: ['math'],
    evidence: 'block_evidence',
    policies: ['primary'],
    interaction: 'none',
    accessibility: a11y('figure'),
    performance: { tier: 'static', weight: 'medium' },
    fallback: 'SourceMathFallback',
    summary: 'Safe KaTeX rendering of a reviewed display expression.',
  },
  {
    type: 'ReviewedFormula',
    version: '1.0.0',
    accepts: ['math'],
    evidence: 'reviewed_formula',
    policies: ['primary'],
    interaction: 'disclosure',
    accessibility: a11y('figure', 'none', true),
    performance: { tier: 'static', weight: 'medium' },
    fallback: 'SourceMathFallback',
    summary: 'Instructor-reviewed formula with its review state made explicit.',
  },
  {
    type: 'SourceMathFallback',
    version: '1.0.0',
    accepts: ['math'],
    evidence: 'source_region',
    policies: ['source_faithful'],
    interaction: 'disclosure',
    accessibility: a11y('figure', 'none', true),
    performance: staticMedium,
    fallback: 'SourceMathFallback',
    summary: 'Original crop plus preserved text for unreviewed mathematics.',
  },
  {
    type: 'DerivationBlock',
    version: '1.0.0',
    accepts: ['math'],
    // A derivation renders reviewed LaTeX; its trust comes from the review
    // record, not from a chunk id.
    evidence: 'reviewed_formula',
    policies: ['primary'],
    interaction: 'none',
    accessibility: a11y('figure'),
    performance: { tier: 'static', weight: 'medium' },
    fallback: 'SourceMathFallback',
    summary: 'Multiline derivation in canonical order; no steps are generated.',
  },
  {
    type: 'MathematicalDefinition',
    version: '1.0.0',
    accepts: ['callout', 'math'],
    roles: ['definition'],
    evidence: 'block_evidence',
    policies: ['primary'],
    interaction: 'none',
    accessibility: a11y('note'),
    performance: { tier: 'static', weight: 'medium' },
    fallback: 'DefinitionCard',
    summary: 'Explanatory prose combined with reviewed notation.',
  },
  {
    type: 'EquationGroup',
    version: '1.0.0',
    accepts: ['math'],
    evidence: 'block_evidence',
    policies: ['primary'],
    interaction: 'none',
    accessibility: a11y('figure'),
    performance: { tier: 'static', weight: 'medium' },
    fallback: 'FormulaBlock',
    summary: 'Related expressions displayed without altering source order.',
  },

  // ---- programming --------------------------------------------------------
  {
    type: 'CodeViewer',
    version: '1.0.0',
    accepts: ['code'],
    evidence: 'block_evidence',
    policies: ['primary'],
    interaction: 'copy',
    accessibility: a11y('figure', 'none', true),
    performance: staticMedium,
    fallback: 'ConceptExplanation',
    summary: 'Syntax-highlighted source with exact whitespace. Never executed.',
  },
  {
    type: 'CodeExplanation',
    version: '1.0.0',
    accepts: ['code', 'paragraph'],
    evidence: 'block_evidence',
    policies: ['primary'],
    interaction: 'none',
    accessibility: a11y('article'),
    performance: staticMedium,
    fallback: 'ConceptExplanation',
    summary: 'Source-backed explanation presented beside code.',
  },
  {
    type: 'CodeWalkthrough',
    version: '1.0.0',
    accepts: ['code'],
    evidence: 'structured_fixture',
    policies: ['primary'],
    interaction: 'step_through',
    accessibility: a11y('group', 'text_summary', true),
    performance: interactive,
    fallback: 'CodeViewer',
    summary: 'Guided line-by-line progression over annotated source.',
  },
  {
    type: 'InputOutputExample',
    version: '1.0.0',
    accepts: ['code'],
    evidence: 'structured_fixture',
    policies: ['primary'],
    interaction: 'none',
    accessibility: a11y('figure'),
    performance: staticMedium,
    fallback: 'CodeViewer',
    summary: 'Trusted example inputs and outputs. No output is fabricated.',
  },
  {
    type: 'CodeComparison',
    version: '1.0.0',
    accepts: ['code'],
    evidence: 'structured_fixture',
    policies: ['primary'],
    interaction: 'none',
    accessibility: a11y('figure'),
    performance: staticMedium,
    fallback: 'CodeViewer',
    summary: 'Source-backed before/after or alternative implementations.',
  },

  // ---- engineering and diagrams -------------------------------------------
  {
    type: 'FigureViewer',
    version: '1.0.0',
    accepts: ['media'],
    evidence: 'source_region',
    policies: ['primary'],
    interaction: 'none',
    accessibility: a11y('figure'),
    performance: staticMedium,
    fallback: 'SourceDiagram',
    summary: 'Captioned source image with reserved dimensions.',
  },
  {
    type: 'SourceDiagram',
    version: '1.0.0',
    accepts: ['media', 'diagram'],
    // A source diagram without a crop must still render its faithful
    // "asset not attached" state rather than disappear.
    evidence: 'none',
    policies: ['primary', 'source_faithful'],
    interaction: 'none',
    accessibility: a11y('figure'),
    performance: staticMedium,
    fallback: 'FigureViewer',
    summary: 'Original technical diagram rendered safely as an image.',
  },
  {
    type: 'AnnotatedDiagram',
    version: '1.0.0',
    accepts: ['media', 'diagram'],
    evidence: 'structured_fixture',
    policies: ['primary'],
    interaction: 'annotation_focus',
    accessibility: a11y('figure', 'text_summary', true),
    performance: { tier: 'interactive', weight: 'medium', bounds: { maxNodes: 60 } },
    fallback: 'SourceDiagram',
    summary: 'Trusted hotspots over a source diagram with keyboard focus.',
  },
  {
    type: 'ProcessDiagram',
    version: '1.0.0',
    accepts: ['diagram'],
    // The step list is validated structure carried by the block itself, so it
    // needs no separate chunk evidence to be faithful.
    evidence: 'none',
    policies: ['primary'],
    interaction: 'step_through',
    accessibility: a11y('group', 'text_summary', true),
    performance: { tier: 'interactive', weight: 'medium', bounds: { maxSteps: 60 } },
    fallback: 'SourceDiagram',
    summary: 'Validated process steps with guided progression.',
  },
  {
    type: 'ArchitectureDiagram',
    version: '1.0.0',
    accepts: ['diagram'],
    evidence: 'structured_fixture',
    policies: ['primary'],
    interaction: 'annotation_focus',
    accessibility: a11y('figure', 'text_summary', true),
    performance: { tier: 'interactive', weight: 'medium', bounds: { maxNodes: 80 } },
    fallback: 'ProcessDiagram',
    summary: 'System-component relationships from validated structured data.',
  },
  {
    type: 'NetworkTopology',
    version: '1.0.0',
    accepts: ['diagram'],
    evidence: 'structured_fixture',
    policies: ['primary'],
    interaction: 'annotation_focus',
    accessibility: a11y('figure', 'text_summary', true),
    performance: { tier: 'interactive', weight: 'medium', bounds: { maxNodes: 80 } },
    fallback: 'ProcessDiagram',
    summary: 'Validated nodes, links and labels. Connectivity is never inferred.',
  },

  // ---- structured information ---------------------------------------------
  {
    type: 'EducationalTable',
    version: '1.0.0',
    accepts: ['table'],
    evidence: 'block_evidence',
    policies: ['primary'],
    interaction: 'none',
    accessibility: a11y('figure'),
    performance: staticLight,
    fallback: 'ConceptExplanation',
    summary: 'Source table preserving real rows and cells.',
  },
  {
    type: 'ComparisonTable',
    version: '1.0.0',
    accepts: ['table'],
    evidence: 'block_evidence',
    policies: ['primary'],
    interaction: 'none',
    accessibility: a11y('figure'),
    performance: staticLight,
    fallback: 'EducationalTable',
    summary: 'Side-by-side comparison table from structured source data.',
  },
  {
    type: 'KeyValueTable',
    version: '1.0.0',
    accepts: ['table'],
    evidence: 'block_evidence',
    policies: ['primary'],
    interaction: 'none',
    accessibility: a11y('figure'),
    performance: staticLight,
    fallback: 'EducationalTable',
    summary: 'Two-column reference table from structured source data.',
  },
  {
    type: 'StepSequence',
    version: '1.0.0',
    accepts: ['diagram'],
    evidence: 'none',
    policies: ['primary'],
    interaction: 'step_through',
    accessibility: a11y('group', 'text_summary', true),
    performance: { tier: 'interactive', weight: 'light', bounds: { maxSteps: 60 } },
    fallback: 'ProcessDiagram',
    summary: 'Numbered sequence of validated steps.',
  },
  {
    type: 'Timeline',
    version: '1.0.0',
    accepts: ['diagram'],
    evidence: 'structured_fixture',
    policies: ['primary'],
    interaction: 'step_through',
    accessibility: a11y('group', 'text_summary', true),
    performance: { tier: 'interactive', weight: 'light', bounds: { maxSteps: 60 } },
    fallback: 'StepSequence',
    summary: 'Ordered events where the source supplies dated structure.',
  },
  {
    type: 'ConceptList',
    version: '1.0.0',
    accepts: ['list'],
    evidence: 'block_evidence',
    policies: ['primary'],
    interaction: 'none',
    accessibility: a11y('article'),
    performance: staticLight,
    fallback: 'ConceptExplanation',
    summary: 'Ordered or unordered concept list.',
  },
  {
    type: 'SourceCitation',
    version: '1.0.0',
    accepts: ['paragraph', 'quote', 'table', 'callout', 'math'],
    evidence: 'source_region',
    policies: ['primary', 'source_faithful'],
    interaction: 'disclosure',
    accessibility: a11y('note', 'none', true),
    performance: staticLight,
    fallback: 'SourceReference',
    summary: 'Inline citation for a source-backed statement.',
  },
  {
    type: 'DataChart',
    version: '1.0.0',
    accepts: ['chart'],
    evidence: 'block_evidence',
    policies: ['primary'],
    interaction: 'none',
    accessibility: a11y('figure', 'data_table'),
    performance: staticMedium,
    fallback: 'ConceptExplanation',
    summary: 'Validated series with an always-present data-table alternative.',
  },
];

/** Frozen capability table. Keyed by type so resolution is a dictionary
 * lookup, never a dynamic import. */
export const COMPONENT_CAPABILITIES: Readonly<Record<ComponentType, ComponentCapability>> =
  Object.freeze(
    Object.fromEntries(definitions.map((entry) => [entry.type, Object.freeze(entry)])),
  ) as Record<ComponentType, ComponentCapability>;

export const COMPONENT_TYPES = Object.freeze(
  definitions.map((entry) => entry.type),
) as readonly ComponentType[];

export function isComponentType(value: unknown): value is ComponentType {
  return typeof value === 'string' && Object.hasOwn(COMPONENT_CAPABILITIES, value);
}

/** A resolution request produced by the deterministic presentation engine. */
export type ComponentResolutionRequest = {
  component: ComponentType;
  blockType: CanonicalBlockType;
  role?: SemanticRole;
  policy: RenderPolicyCompatibility;
  hasEvidence: boolean;
  hasSourceRegion: boolean;
  isReviewedFormula: boolean;
  /** A trusted, validated structured fixture is attached (diagram topology,
   * code walkthrough annotations). Canonical projection carries none yet, so
   * a fixture-only component degrades instead of inventing structure. */
  hasStructuredFixture: boolean;
};

export type ComponentResolution =
  | { ok: true; capability: ComponentCapability }
  | { ok: false; reason: ResolutionFailure; fallback: ComponentCapability };

export type ResolutionFailure =
  | 'unknown_component'
  | 'incompatible_block'
  | 'incompatible_role'
  | 'incompatible_policy'
  | 'missing_evidence'
  | 'missing_source_region'
  | 'unreviewed_formula'
  | 'missing_structured_fixture';

/** Deterministic capability check. Returns the fallback capability on failure
 * rather than throwing, so a bad projection degrades to a trusted component
 * instead of an empty page. Unknown types fall back to ConceptExplanation. */
export function resolveComponent(
  request: ComponentResolutionRequest,
): ComponentResolution {
  if (!isComponentType(request.component))
    return { ok: false, reason: 'unknown_component', fallback: COMPONENT_CAPABILITIES.ConceptExplanation };
  const capability = COMPONENT_CAPABILITIES[request.component];
  const fallback = COMPONENT_CAPABILITIES[capability.fallback];
  if (!capability.accepts.includes(request.blockType))
    return { ok: false, reason: 'incompatible_block', fallback };
  if (capability.roles && request.role && !capability.roles.includes(request.role))
    return { ok: false, reason: 'incompatible_role', fallback };
  if (!capability.policies.includes(request.policy))
    return { ok: false, reason: 'incompatible_policy', fallback };
  if (capability.evidence === 'block_evidence' && !request.hasEvidence)
    return { ok: false, reason: 'missing_evidence', fallback };
  if (capability.evidence === 'source_region' && !request.hasSourceRegion)
    return { ok: false, reason: 'missing_source_region', fallback };
  if (capability.evidence === 'reviewed_formula' && !request.isReviewedFormula)
    return { ok: false, reason: 'unreviewed_formula', fallback };
  if (capability.evidence === 'structured_fixture' && !request.hasStructuredFixture)
    return { ok: false, reason: 'missing_structured_fixture', fallback };
  return { ok: true, capability };
}

/** Semantic callout role, or undefined when the kind is not a known role. */
export function semanticRole(kind: string | undefined): SemanticRole | undefined {
  return kind && (SEMANTIC_ROLES as readonly string[]).includes(kind)
    ? (kind as SemanticRole)
    : undefined;
}

/** Block-type classifier used by the presentation engine. */
export function canonicalBlockType(block: LessonBlockV2): CanonicalBlockType {
  return block.type;
}
