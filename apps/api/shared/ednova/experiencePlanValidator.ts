/** Independent experience-plan validator (Batch 4, Milestone 4.1).
 *
 * The validator is the only path from an untrusted proposal to a plan the
 * reader may render. It is deliberately pure: it takes the proposal and a
 * *trusted context* built by the application from the pinned published
 * revision, and it consults the Batch 3 capability registry directly. It never
 * reads a database, never calls a model and never trusts a field the planner
 * wrote.
 *
 * Seven stages, in order. A failure at any stage rejects the whole plan: there
 * is no partial acceptance, because a partially validated plan would render a
 * layout the planner chose over content the application did not verify.
 *
 *   1 schema        structure, versions, markup, prototype pollution
 *   2 identity      course/revision/hash/lesson/registry/context binding
 *   3 coverage      every canonical block exactly once, in canonical order
 *   4 component     capability registry: type, version, role, policy, evidence
 *   5 asset         structured-asset existence, binding, provenance, review
 *   6 limits        placement, group and text bounds
 *   7 finalization  mint the branded validated plan
 */

import {
  COMPONENT_CAPABILITIES,
  isComponentType,
  type ComponentCapability,
  type ComponentType,
  type SemanticRole
} from './componentRegistry';
import {
  EXPERIENCE_PLAN_LIMITS,
  EXPERIENCE_PLAN_SCHEMA_VERSION,
  ExperiencePlanRejection,
  finalizeExperiencePlan,
  parseExperiencePlanProposal,
  type ExperiencePlanRejectionCode,
  type ExperiencePlanStage,
  type ExperiencePlanValidationContext,
  type ProposedPlacement,
  type UntrustedExperiencePlanProposal,
  type ValidatedLearningExperiencePlan,
  type ValidatedPlacement
} from './experiencePlan';
import { EXPERIENCE_PLAN_BINDINGS } from './experiencePlan';

const reject = (code: ExperiencePlanRejectionCode, stage: ExperiencePlanStage): never => {
  throw new ExperiencePlanRejection(code, stage);
};

/**
 * Interaction keys a component will actually accept.
 *
 * This is the closed vocabulary the plan may configure. A component absent from
 * this table accepts no interaction configuration at all, which is the safe
 * default: a planner cannot invent a knob and expect the renderer to honour it.
 * Keys here are informational only — they configure disclosure and focus, never
 * data, code or layout.
 */
export const COMPONENT_INTERACTION_KEYS: Partial<Record<ComponentType, readonly string[]>> = {
  ProofBlock: ['defaultOpen', 'showSource'],
  ReviewedFormula: ['showReview', 'showSource'],
  DerivationBlock: ['showSteps', 'showSource'],
  SourceMathFallback: ['showSource'],
  SourceReference: ['defaultOpen'],
  SourceCitation: ['defaultOpen'],
  CodeViewer: ['showLineNumbers', 'wrap'],
  CodeWalkthrough: ['startLine', 'showState'],
  ProcessDiagram: ['showStepIndex'],
  StepSequence: ['showStepIndex'],
  Timeline: ['showDates'],
  AnnotatedDiagram: ['focusFirst'],
  ArchitectureDiagram: ['focusFirst'],
  NetworkTopology: ['focusFirst'],
  EducationalTable: ['compact'],
  ComparisonTable: ['compact'],
  KeyValueTable: ['compact'],
  DataChart: ['showTable'],
  ConceptList: ['collapsed'],
  LessonHeader: ['showObjectives']
};

/** Components whose output is a *derivation of* the source rather than the
 * source itself. These may only be proposed over content the application has
 * already verified, because otherwise the planner would be inventing steps. */
const DERIVATION_COMPONENTS: readonly ComponentType[] = Object.freeze([
  'DerivationBlock',
  'ReviewedFormula',
  'FormulaBlock',
  'MathematicalDefinition',
  'EquationGroup'
]);

/** Components that present a computed visual relationship. A plan may select
 * them only over a structured fixture; the renderer never infers the maths. */
const COMPUTED_VISUAL_COMPONENTS: readonly ComponentType[] = Object.freeze([
  'DataChart',
  'NetworkTopology',
  'ArchitectureDiagram',
  'AnnotatedDiagram'
]);

/** Version compatibility for a component capability. A proposal may name the
 * current version, or a major-0 minor the registry still serves. It may not
 * name a future major: an unknown version is not a promise. */
function versionCompatible(proposed: string, actual: string): boolean {
  if (proposed === actual) return true;
  const a = proposed.split('.');
  const b = actual.split('.');
  if (a.length !== 3 || b.length !== 3) return false;
  if (![...a, ...b].every((part) => /^\d+$/.test(part))) return false;
  // Same major and minor, differing patch: the contract did not change.
  return a[0] === b[0] && a[1] === b[1];
}

type BlockFact = ExperiencePlanValidationContext['blocks'][number];

/** Stage 4 in isolation: is this component allowed over this block, given the
 * capability registry and the trusted block facts? Returns the reason it is
 * not, or null when it is allowed. */
export function componentRejection(
  component: ComponentType,
  capability: ComponentCapability,
  block: BlockFact,
  policy: 'primary' | 'source_faithful'
): ExperiencePlanRejectionCode | null {
  if (!capability.accepts.includes(block.blockType)) return 'PLAN_COMPONENT_BLOCK_INCOMPATIBLE';
  if (capability.roles && block.role && !capability.roles.includes(block.role as SemanticRole))
    return 'PLAN_COMPONENT_ROLE_INCOMPATIBLE';
  // A source-faithful block may only be rendered by a component that declares
  // the source-faithful policy. This is the guarantee that unreviewed
  // mathematics cannot be relabelled as primary by a planner.
  if (policy === 'source_faithful' && !capability.policies.includes('source_faithful'))
    return 'PLAN_COMPONENT_POLICY_INCOMPATIBLE';
  if (!capability.policies.includes('primary') && policy === 'primary')
    return 'PLAN_COMPONENT_POLICY_INCOMPATIBLE';

  switch (capability.evidence) {
    case 'block_evidence':
      if (!block.hasEvidence) return 'PLAN_COMPONENT_EVIDENCE_MISSING';
      break;
    case 'source_region':
      if (!block.hasSourceRegion) return 'PLAN_COMPONENT_SOURCE_REGION_MISSING';
      break;
    case 'reviewed_formula':
      if (!block.isReviewedFormula) return 'PLAN_COMPONENT_UNREVIEWED_FORMULA';
      break;
    case 'structured_fixture':
      if (!block.hasStructuredFixture) return 'PLAN_COMPONENT_FIXTURE_MISSING';
      break;
    default:
      break;
  }

  // A derivation over unreviewed mathematics would manufacture approved steps.
  if (DERIVATION_COMPONENTS.includes(component) && !block.isReviewedFormula)
    return 'PLAN_COMPONENT_UNREVIEWED_FORMULA';

  // A computed visual over a block with no fixture would infer a relationship.
  if (COMPUTED_VISUAL_COMPONENTS.includes(component) && !block.hasStructuredFixture)
    return 'PLAN_COMPONENT_FIXTURE_MISSING';

  return null;
}

/** Stage 4 interaction check: every configured key must be declared by the
 * component, and no interaction may be configured on a component that offers
 * none. */
function interactionRejection(placement: ProposedPlacement): ExperiencePlanRejectionCode | null {
  if (placement.interaction === undefined) return null;
  const allowed = COMPONENT_INTERACTION_KEYS[placement.component];
  if (!allowed) return 'PLAN_COMPONENT_INTERACTION_INVALID';
  for (const key of Object.keys(placement.interaction))
    if (!allowed.includes(key)) return 'PLAN_COMPONENT_INTERACTION_INVALID';
  return null;
}

/** Deterministic digest of the validated plan. Sorted keys and stable order mean
 * the same accepted plan always yields the same digest. */
function planDigest(plan: {
  planId: string;
  courseId: string;
  revisionId: string;
  contentHash: string;
  lessonId: string;
  mode: string;
  canonical: readonly ValidatedPlacement[];
  supplemental: readonly ValidatedPlacement[];
}): string {
  const payload = JSON.stringify([
    plan.planId,
    plan.courseId,
    plan.revisionId,
    plan.contentHash,
    plan.lessonId,
    plan.mode,
    plan.canonical.map((entry) => [
      entry.placementId,
      entry.blockId,
      entry.component,
      entry.group,
      entry.disclosure,
      entry.interaction ?? null
    ]),
    plan.supplemental.map((entry) => [
      entry.placementId,
      entry.blockId,
      entry.component,
      entry.assetId,
      entry.group,
      entry.disclosure
    ])
  ]);
  let hash = 0n;
  const prime = 1099511628211n;
  let state = 14695981039346656037n;
  for (let index = 0; index < payload.length; index += 1) {
    state ^= BigInt(payload.charCodeAt(index));
    state = (state * prime) & 0xffffffffffffffffn;
  }
  hash = state;
  return 'fnv1a64:' + hash.toString(16).padStart(16, '0');
}

/**
 * Validate an untrusted proposal against trusted application context.
 *
 * Throws `ExperiencePlanRejection` (a typed, non-leaking error) on any failure.
 * On success returns the branded validated plan — the only shape the reader
 * accepts.
 */
export function validateExperiencePlan(
  rawProposal: unknown,
  context: ExperiencePlanValidationContext
): ValidatedLearningExperiencePlan {
  // -- Stage 1: schema ------------------------------------------------------
  const proposal: UntrustedExperiencePlanProposal = parseExperiencePlanProposal(rawProposal);

  // -- Stage 2: identity ----------------------------------------------------
  const claims = proposal.claims;
  if (claims.courseId !== context.courseId)
    return reject('PLAN_IDENTITY_COURSE_MISMATCH', 'identity');
  if (claims.revisionId !== context.revisionId)
    return reject('PLAN_IDENTITY_REVISION_MISMATCH', 'identity');
  if (claims.contentHash !== context.contentHash)
    return reject('PLAN_IDENTITY_CONTENT_HASH_MISMATCH', 'identity');
  if (claims.lessonId !== context.lessonId)
    return reject('PLAN_IDENTITY_LESSON_MISMATCH', 'identity');
  if (claims.mode !== context.mode)
    return reject('PLAN_IDENTITY_PRESENTATION_MISMATCH', 'identity');
  if (claims.registryVersion !== EXPERIENCE_PLAN_BINDINGS.registryVersion)
    return reject('PLAN_IDENTITY_REGISTRY_MISMATCH', 'identity');
  if (claims.presentationSchemaVersion !== EXPERIENCE_PLAN_BINDINGS.presentationSchemaVersion)
    return reject('PLAN_IDENTITY_PRESENTATION_MISMATCH', 'identity');
  if (claims.contextFingerprint !== context.contextFingerprint)
    return reject('PLAN_IDENTITY_CONTEXT_FINGERPRINT_MISMATCH', 'identity');
  if (
    !context.allowedPlanners.some(
      (entry) =>
        entry.implementation === proposal.planner.implementation &&
        entry.version === proposal.planner.version
    )
  )
    return reject('PLAN_IDENTITY_PLANNER_UNKNOWN', 'identity');

  // -- Stage 6 (pre-check): resource limits --------------------------------
  // Limits are checked before the expensive stages so a hostile payload is
  // bounded as early as possible. They are checked again after grouping.
  const supplementalProposed = proposal.placements.filter((entry) => entry.kind === 'supplemental');
  if (supplementalProposed.length > EXPERIENCE_PLAN_LIMITS.maxSupplemental)
    return reject('PLAN_LIMIT_TOO_MANY_SUPPLEMENTS', 'limits');
  const groups = new Set(proposal.placements.map((entry) => entry.group));
  if (groups.size > EXPERIENCE_PLAN_LIMITS.maxGroups)
    return reject('PLAN_LIMIT_TOO_MANY_GROUPS', 'limits');

  // -- Stage 3: canonical coverage -----------------------------------------
  const blockById = new Map(context.blocks.map((block) => [block.blockId, block] as const));
  const canonicalPlacements = proposal.placements.filter((entry) => entry.kind === 'canonical');

  const seen = new Set<string>();
  for (const placement of canonicalPlacements) {
    // A placement naming a block from another lesson or revision is a
    // cross-boundary reference, not a coverage mistake.
    if (placement.block.lessonId !== context.lessonId)
      return reject('PLAN_COVERAGE_CROSS_LESSON', 'coverage');
    const block = blockById.get(placement.block.blockId);
    if (!block) return reject('PLAN_COVERAGE_BLOCK_UNKNOWN', 'coverage');
    if (seen.has(placement.block.blockId))
      return reject('PLAN_COVERAGE_BLOCK_DUPLICATED', 'coverage');
    seen.add(placement.block.blockId);
  }
  // Every canonical block must appear exactly once. The count check and the
  // order check together are what prevent silent omission and reordering.
  if (seen.size !== context.blocks.length) {
    for (const block of context.blocks)
      if (!seen.has(block.blockId)) return reject('PLAN_COVERAGE_BLOCK_MISSING', 'coverage');
    return reject('PLAN_COVERAGE_BLOCK_MISSING', 'coverage');
  }
  // Canonical order is positional, not sorted: the planner's array order must
  // be the source order, so a proof's steps cannot be shuffled.
  const orderedBlockIds = canonicalPlacements.map((entry) => entry.block.blockId);
  for (let index = 0; index < context.blocks.length; index += 1)
    if (orderedBlockIds[index] !== context.blocks[index].blockId)
      return reject('PLAN_COVERAGE_BLOCK_REORDERED', 'coverage');

  // -- Stage 4: component compatibility ------------------------------------
  const assetsById = new Map(context.assets.map((asset) => [asset.assetId, asset] as const));

  const canonical: ValidatedPlacement[] = canonicalPlacements.map((placement) => {
    const block = blockById.get(placement.block.blockId)!;
    const capability = COMPONENT_CAPABILITIES[placement.component];

    if (!versionCompatible(placement.componentVersion, capability.version))
      return reject('PLAN_COMPONENT_VERSION_UNSUPPORTED', 'component');

    const rejection = componentRejection(placement.component, capability, block, block.render);
    // A source-faithful block may never be upgraded to a primary component,
    // even when the proposed component is otherwise compatible.
    if (rejection) return reject(rejection, 'component');

    const interactionRejectionCode = interactionRejection(placement);
    if (interactionRejectionCode) return reject(interactionRejectionCode, 'component');

    // The declared fallback must be a component the registry actually owns.
    // It is not required to accept this block type: the registry's own
    // fallbacks degrade across kinds (a heading falls back to prose), and the
    // renderer's boundary already handles a mismatched pair safely.
    if (!Object.hasOwn(COMPONENT_CAPABILITIES, placement.fallback))
      return reject('PLAN_COMPONENT_FALLBACK_UNTRUSTED', 'component');

    return {
      placementId: placement.placementId,
      kind: 'canonical' as const,
      blockId: block.blockId,
      blockType: block.blockType,
      component: placement.component,
      componentVersion: capability.version,
      group: placement.group,
      disclosure: placement.disclosure,
      ...(placement.interaction !== undefined ? { interaction: placement.interaction } : {}),
      fallback: placement.fallback
    };
  });

  // -- Stage 5: asset and provenance ---------------------------------------
  const supplemental: ValidatedPlacement[] = [];
  for (const placement of supplementalProposed) {
    if (placement.block.lessonId !== context.lessonId)
      return reject('PLAN_COVERAGE_CROSS_LESSON', 'coverage');
    const asset = assetsById.get(placement.assetId!);
    if (!asset) return reject('PLAN_ASSET_UNKNOWN', 'asset');
    if (asset.lessonId !== context.lessonId) return reject('PLAN_ASSET_LESSON_MISMATCH', 'asset');
    if (asset.blockId !== placement.block.blockId)
      return reject('PLAN_ASSET_BLOCK_MISMATCH', 'asset');
    // An unreviewed generated proposal never becomes learner-visible because a
    // plan named it. This is the governance boundary, enforced here as well as
    // in the asset projection so neither can be bypassed alone.
    if (asset.provenance === 'generated_proposal')
      return reject('PLAN_ASSET_GENERATED_PROPOSAL', 'asset');
    if (!asset.reviewVerified && asset.provenance !== 'deterministic_demo')
      return reject('PLAN_ASSET_REVIEW_UNVERIFIED', 'asset');
    if (!asset.sourceVerified && asset.provenance === 'source_derived')
      return reject('PLAN_ASSET_SOURCE_UNVERIFIED', 'asset');
    if (asset.component !== placement.component)
      return reject('PLAN_ASSET_COMPONENT_MISMATCH', 'asset');
    if (placement.interaction !== undefined)
      return reject('PLAN_COMPONENT_INTERACTION_INVALID', 'component');

    const capability = COMPONENT_CAPABILITIES[placement.component];
    if (!versionCompatible(placement.componentVersion, capability.version))
      return reject('PLAN_COMPONENT_VERSION_UNSUPPORTED', 'component');
    if (!capability.accepts.includes(blockById.get(placement.block.blockId)!.blockType))
      return reject('PLAN_COMPONENT_BLOCK_INCOMPATIBLE', 'component');

    supplemental.push({
      placementId: placement.placementId,
      kind: 'supplemental' as const,
      blockId: placement.block.blockId,
      blockType: blockById.get(placement.block.blockId)!.blockType,
      component: placement.component,
      componentVersion: capability.version,
      assetId: asset.assetId,
      group: placement.group,
      disclosure: placement.disclosure,
      fallback: placement.fallback
    });
  }

  // -- Stage 7: finalization ----------------------------------------------
  if (canonical.length !== context.blocks.length)
    return reject('PLAN_FINALIZATION_INCOMPLETE', 'finalization');

  const digest = planDigest({
    planId: proposal.planId,
    courseId: context.courseId,
    revisionId: context.revisionId,
    contentHash: context.contentHash,
    lessonId: context.lessonId,
    mode: context.mode,
    canonical,
    supplemental
  });

  return finalizeExperiencePlan(
    {
      schemaVersion: EXPERIENCE_PLAN_SCHEMA_VERSION,
      planId: proposal.planId,
      courseId: context.courseId,
      revisionId: context.revisionId,
      contentHash: context.contentHash,
      lessonId: context.lessonId,
      mode: context.mode,
      registryVersion: EXPERIENCE_PLAN_BINDINGS.registryVersion,
      presentationSchemaVersion: EXPERIENCE_PLAN_BINDINGS.presentationSchemaVersion,
      contextFingerprint: context.contextFingerprint,
      planner: proposal.planner,
      canonical: Object.freeze(canonical),
      supplemental: Object.freeze(supplemental)
    },
    digest
  );
}

/** Non-throwing wrapper for callers that branch on the outcome (the planning
 * workflow, the QA endpoint). Returns the same typed codes. */
export type ValidationOutcome =
  | { ok: true; plan: ValidatedLearningExperiencePlan }
  | { ok: false; code: ExperiencePlanRejectionCode; stage: ExperiencePlanStage };

export function tryValidateExperiencePlan(
  rawProposal: unknown,
  context: ExperiencePlanValidationContext
): ValidationOutcome {
  try {
    return { ok: true, plan: validateExperiencePlan(rawProposal, context) };
  } catch (error) {
    if (error instanceof ExperiencePlanRejection)
      return { ok: false, code: error.code, stage: error.stage };
    // An unexpected throw is still a rejection; the code says so without
    // echoing the underlying message.
    return { ok: false, code: 'PLAN_SCHEMA_INVALID', stage: 'schema' };
  }
}

/** Every component a plan may name, for building planner context. Derived from
 * the registry, never a second hand-maintained list. */
export function eligibleComponents(): ComponentType[] {
  return Object.freeze(
    Object.keys(COMPONENT_CAPABILITIES).filter((key) => isComponentType(key)) as ComponentType[]
  ) as ComponentType[];
}

/** A compact capability digest for planner context and for the browser. It
 * carries no source content and no learner data. */
export function capabilityDigest(): Array<{
  type: ComponentType;
  version: string;
  accepts: readonly string[];
  evidence: string;
  interaction: string;
}> {
  return Object.values(COMPONENT_CAPABILITIES).map((capability) => ({
    type: capability.type,
    version: capability.version,
    accepts: capability.accepts,
    evidence: capability.evidence,
    interaction: capability.interaction
  }));
}
