/** Learning modes (Batch 4, Milestone 4.3).
 *
 * A mode is a **presentation policy**, never a source of truth. It decides which
 * trusted components and eligible assets a plan may prefer; it can never add,
 * remove, reorder or rewrite a canonical block, and it can never make a formula
 * reviewed.
 *
 * Two things are deliberate:
 *
 *   - every mode carries an explicit deterministic policy, so a mode's intent is
 *     checkable rather than implied by a prompt
 *   - a mode with no eligible material produces the *same* validated plan as
 *     Read, and the UI says so instead of manufacturing a difference
 */

import type { ComponentType } from './componentRegistry';

export const LEARNING_MODES = ['read', 'guided', 'explore', 'practice', 'deep_dive'] as const;
export type LearningMode = (typeof LEARNING_MODES)[number];

export function isLearningMode(value: unknown): value is LearningMode {
  return typeof value === 'string' && (LEARNING_MODES as readonly string[]).includes(value);
}

/** The existing Batch 3 reader modes. `read` is shared; the rest map one-to-one
 * onto the deterministic reader's display modes where one exists. */
export const MODE_LABELS: Record<LearningMode, string> = {
  read: 'Read',
  guided: 'Guided',
  explore: 'Explore',
  practice: 'Practice',
  deep_dive: 'Deep Dive'
};

/**
 * What a mode may prefer.
 *
 * `preferredComponents` is an ordering hint the planner may use; it is not an
 * allowlist, because the capability registry already is one. `requiresAsset`
 * means the mode's value depends on a structured asset being present — when
 * none is eligible the mode degrades to the deterministic presentation rather
 * than pretending.
 */
export type ModePolicy = {
  mode: LearningMode;
  /** Objective handed to the planner. Fixed text; document content never alters it. */
  objective: string;
  /** Components this mode prefers, in order. Advisory only. */
  preferredComponents: readonly ComponentType[];
  /** Selection rules this mode favours. */
  prefers: {
    disclosure: 'expanded' | 'collapsed' | 'either';
    interaction: boolean;
    proofs: boolean;
    examples: boolean;
    sourceReferences: boolean;
  };
  /** True when the mode's value depends on an eligible structured asset. */
  requiresAsset: boolean;
  /** Whether this mode can use the AI planner at all. Read never does. */
  usesPlanner: boolean;
};

export const MODE_POLICIES: Readonly<Record<LearningMode, ModePolicy>> = Object.freeze({
  read: Object.freeze({
    mode: 'read',
    objective:
      'Present the lesson exactly as extracted, in source order, with no rearrangement. ' +
      'This mode never uses a planner.',
    preferredComponents: Object.freeze([] as ComponentType[]),
    prefers: Object.freeze({
      disclosure: 'expanded' as const,
      interaction: false,
      proofs: false,
      examples: false,
      sourceReferences: true
    }),
    requiresAsset: false,
    usesPlanner: false
  }),

  guided: Object.freeze({
    mode: 'guided',
    objective:
      'Present the lesson progressively: objectives where present, then definitions, ' +
      'source-backed explanations, worked examples and ordered derivations. Prefer ' +
      'collapsed disclosure for proofs and exercises so the learner reads before revealing. ' +
      'Do not invent steps, explanations or examples; use only what the blocks contain.',
    preferredComponents: Object.freeze([
      'DefinitionCard',
      'TheoremCard',
      'ExampleBlock',
      'ProofBlock',
      'ConceptExplanation',
      'StepSequence'
    ] as ComponentType[]),
    prefers: Object.freeze({
      disclosure: 'collapsed' as const,
      interaction: true,
      proofs: true,
      examples: true,
      sourceReferences: false
    }),
    requiresAsset: false,
    usesPlanner: true
  }),

  explore: Object.freeze({
    mode: 'explore',
    objective:
      'Emphasise interaction the source actually supports: approved interactive or diagram ' +
      'components, structured figures, code walkthroughs and annotated diagrams. Only choose ' +
      'an interactive component for a block that carries a trusted structured fixture; never ' +
      'force an interaction onto a block that lacks the data.',
    preferredComponents: Object.freeze([
      'CodeWalkthrough',
      'AnnotatedDiagram',
      'ArchitectureDiagram',
      'NetworkTopology',
      'ProcessDiagram',
      'DataChart',
      'StepSequence'
    ] as ComponentType[]),
    prefers: Object.freeze({
      disclosure: 'expanded' as const,
      interaction: true,
      proofs: false,
      examples: false,
      sourceReferences: true
    }),
    requiresAsset: true,
    usesPlanner: true
  }),

  practice: Object.freeze({
    mode: 'practice',
    objective:
      'Surface the source exercises and worked examples the lesson already contains, in source ' +
      'order, so the learner can attempt them. Do not generate new questions, do not answer ' +
      'them, and do not imply grading. Existing practice tools live outside this plan.',
    preferredComponents: Object.freeze([
      'ExerciseBlock',
      'ExampleBlock',
      'ProofBlock',
      'ConceptExplanation'
    ] as ComponentType[]),
    prefers: Object.freeze({
      disclosure: 'collapsed' as const,
      interaction: false,
      proofs: true,
      examples: true,
      sourceReferences: false
    }),
    requiresAsset: false,
    usesPlanner: true
  }),

  deep_dive: Object.freeze({
    mode: 'deep_dive',
    objective:
      'Present fullest detail: complete source explanations, proof blocks, extended examples ' +
      'and source references. Expand disclosure rather than collapse it. Do not invent ' +
      'prerequisites or concepts that are not present in the canonical blocks.',
    preferredComponents: Object.freeze([
      'ProofBlock',
      'DerivationBlock',
      'ReviewedFormula',
      'SourceMathFallback',
      'ConceptExplanation',
      'SourceReference',
      'EducationalTable'
    ] as ComponentType[]),
    prefers: Object.freeze({
      disclosure: 'expanded' as const,
      interaction: false,
      proofs: true,
      examples: true,
      sourceReferences: true
    }),
    requiresAsset: false,
    usesPlanner: true
  })
});

export function modePolicy(mode: LearningMode): ModePolicy {
  return MODE_POLICIES[mode];
}

/** The planner objective for a mode, or null when the mode never plans. */
export function modeObjective(mode: LearningMode): string | null {
  const policy = modePolicy(mode);
  return policy.usesPlanner ? policy.objective : null;
}

/** Learner-facing statement of what a mode is, and what it will not do. */
export const MODE_DISCLOSURES: Record<LearningMode, string> = {
  read: 'The lesson exactly as extracted from the source, in source order.',
  guided:
    'A progressive arrangement of this lesson. Content is unchanged; only the presentation order and disclosure are arranged.',
  explore:
    'Source-grounded interactive material where this lesson has it. Blocks without suitable data stay static.',
  practice: 'The exercises and worked examples this lesson contains. Nothing is graded here.',
  deep_dive: 'The fullest presentation of this lesson, with proofs and source references expanded.'
};

/**
 * Modes that could not be distinguished from another for this lesson.
 *
 * The brief is explicit: do not manufacture a difference. If a mode produced the
 * same validated arrangement as Read, the UI says so rather than offering a
 * mode that does nothing.
 */
export function indistinguishableFromRead(
  mode: LearningMode,
  signals: { hasStructuredAsset: boolean; hasInteractiveBlock: boolean }
): boolean {
  if (mode === 'read') return false;
  if (modePolicy(mode).requiresAsset)
    return !signals.hasStructuredAsset && !signals.hasInteractiveBlock;
  return false;
}
