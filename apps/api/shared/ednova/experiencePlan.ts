/** AI experience-plan contract (Batch 4, Milestone 4.1).
 *
 * The planner proposes; the application validates; trusted components render.
 * Canonical content stays authoritative.
 *
 * This module owns the *proposal* and *accepted-plan* shapes plus their strict
 * parsers. It deliberately contains no planner implementation and no database
 * access: those live in the study module, because validation against trusted
 * published data is an application concern, not a contract concern.
 *
 * Two representations, one direction of trust:
 *
 *   UntrustedExperiencePlanProposal   raw planner output; no authority at all
 *   ValidatedLearningExperiencePlan   the only shape the reader may render
 *
 * The validated shape is branded with a runtime-unforgeable symbol, so a
 * proposal that merely sets `validated: true` in JSON is still a proposal. A
 * value can only become validated by passing the application validator.
 *
 * The plan is additive to `PublishedPresentationV1`: it may group, disclose and
 * annotate, but it can never omit, duplicate, reorder or relabel a canonical
 * block. That is enforced by the coverage contract in section "Coverage".
 */

import type { LessonBlockV2 } from './learningDocumentV2';
import {
  COMPONENT_REGISTRY_VERSION,
  isComponentType,
  type ComponentType,
} from './componentRegistry';

export const EXPERIENCE_PLAN_SCHEMA_VERSION = '1.0.0' as const;

/** Versions of the pieces the plan is bound to. A plan made against another
 * registry or presentation schema is stale by definition. */
export const EXPERIENCE_PLAN_BINDINGS = Object.freeze({
  presentationSchemaVersion: '1.0.0',
  registryVersion: COMPONENT_REGISTRY_VERSION,
});

// ---------------------------------------------------------------------------
// Placement vocabulary
// ---------------------------------------------------------------------------

/** The only grouping instructions a planner may issue. This is a closed
 * vocabulary, not free-form layout: no CSS, no nesting, no positioning. */
export const PLACEMENT_GROUPS = ['none', 'concept', 'example', 'practice', 'reference'] as const;
export type PlacementGroup = (typeof PLACEMENT_GROUPS)[number];

/** How much of a placement is visible before the learner opts in. `collapsed`
 * is bounded: a collapsed placement still renders its heading and its
 * "expand" control, so source content is never permanently hidden. */
export const DISCLOSURE_MODES = ['expanded', 'collapsed'] as const;
export type DisclosureMode = (typeof DISCLOSURE_MODES)[number];

// ---------------------------------------------------------------------------
// Resource limits
// ---------------------------------------------------------------------------

/** Hard bounds on a proposal. Exceeding any of them rejects the whole plan;
 * nothing is silently truncated, because a truncated plan would look complete. */
export const EXPERIENCE_PLAN_LIMITS = Object.freeze({
  /** Component placements across the whole lesson. */
  maxPlacements: 120,
  /** Supplemental (non-canonical) placements a planner may add. */
  maxSupplemental: 24,
  /** Distinct grouping labels a plan may open. */
  maxGroups: 8,
  /** Interaction configuration entries per placement. */
  maxInteractionEntries: 8,
  /** Length of any planner-authored label. */
  maxLabelLength: 200,
  /** Total serialized proposal size in bytes. */
  maxProposalBytes: 262_144,
  /** Deepest accepted nesting in any interaction value. */
  maxInteractionDepth: 3,
  /** Characters allowed in any planner-authored string. Bounded alphabet keeps
   * a hostile model from smuggling markup through a label. */
  maxTextLength: 2_000,
});

// ---------------------------------------------------------------------------
// Proposal shape (untrusted)
// ---------------------------------------------------------------------------

/** A reference to one canonical block, by identity only. The planner never
 * carries block *content*: content comes from the pinned revision. */
export type BlockReference = {
  lessonId: string;
  blockId: string;
};

/**
 * One proposed component placement.
 *
 * `kind: 'canonical'` places the existing projection of a canonical block. The
 * planner may choose the component and the disclosure, but the block itself and
 * its source-faithful policy are fixed by the presentation document.
 *
 * `kind: 'supplemental'` attaches an approved structured asset. It must name an
 * asset that already exists, is bound to this revision, and is learner-visible
 * by provenance. A supplement never stands in for a canonical block.
 */
export type ProposedPlacement = {
  placementId: string;
  kind: 'canonical' | 'supplemental';
  block: BlockReference;
  component: ComponentType;
  componentVersion: string;
  /** Present iff kind is `supplemental`. */
  assetId?: string;
  group: PlacementGroup;
  disclosure: DisclosureMode;
  /** Interaction configuration from a closed, component-declared vocabulary.
   * Values are primitives only; nothing here is executable. */
  interaction?: Record<string, string | number | boolean>;
  /** What to render when this placement cannot be used. Must be a trusted type. */
  fallback: ComponentType;
};

/**
 * Raw planner output. Nothing in this shape carries authority: not the chosen
 * component, not the disclosure, and certainly not any review claim. The
 * validator re-derives every one of them from trusted data.
 */
export type UntrustedExperiencePlanProposal = {
  schemaVersion: typeof EXPERIENCE_PLAN_SCHEMA_VERSION;
  planId: string;
  /** Identity the proposal claims. The validator checks each one against the
   * pinned revision and rejects on any mismatch; a claim is not a grant. */
  claims: {
    courseId: string;
    revisionId: string;
    contentHash: string;
    lessonId: string;
    mode: string;
    registryVersion: string;
    presentationSchemaVersion: string;
    contextFingerprint: string;
  };
  planner: {
    implementation: string;
    version: string;
  };
  placements: ProposedPlacement[];
  /** Planner-authored notes. Data only, never rendered as course material. */
  notes?: string[];
};

// ---------------------------------------------------------------------------
// Validated shape
// ---------------------------------------------------------------------------

const VALIDATED = Symbol('ednova.validated-experience-plan');

/** A placement that survived validation. `component`, `disclosure` and
 * `fallback` here are the *validated* values, which may differ from the
 * proposal when a documented fallback policy applied. */
export type ValidatedPlacement = {
  placementId: string;
  kind: 'canonical' | 'supplemental';
  blockId: string;
  blockType: LessonBlockV2['type'];
  component: ComponentType;
  componentVersion: string;
  assetId?: string;
  group: PlacementGroup;
  disclosure: DisclosureMode;
  interaction?: Record<string, string | number | boolean>;
  fallback: ComponentType;
  /** True when validation replaced the proposed component with its fallback. */
  degraded?: { from: ComponentType; reason: ExperiencePlanRejectionCode };
};

export type ValidatedLearningExperiencePlan = {
  readonly schemaVersion: typeof EXPERIENCE_PLAN_SCHEMA_VERSION;
  readonly planId: string;
  readonly courseId: string;
  readonly revisionId: string;
  readonly contentHash: string;
  readonly lessonId: string;
  readonly mode: string;
  readonly registryVersion: string;
  readonly presentationSchemaVersion: string;
  readonly contextFingerprint: string;
  readonly planner: { implementation: string; version: string };
  /** Every canonical block, in canonical order, exactly once. */
  readonly canonical: readonly ValidatedPlacement[];
  /** Approved supplements, in canonical block order then asset order. */
  readonly supplemental: readonly ValidatedPlacement[];
  /** Deterministic digest of the validated plan, for audit and equality. */
  readonly digest: string;
  /** Runtime brand. Not serializable, not settable from JSON. */
  readonly [VALIDATED]: true;
};

/** Type guard. Only values minted by `finalizeExperiencePlan` pass. */
export function isValidatedExperiencePlan(
  value: unknown,
): value is ValidatedLearningExperiencePlan {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { [VALIDATED]?: unknown })[VALIDATED] === true
  );
}

/** Mint a validated plan. The only constructor. Kept in this module so the
 * brand symbol never leaves it; the validator imports this function. */
export function finalizeExperiencePlan(
  plan: Omit<ValidatedLearningExperiencePlan, typeof VALIDATED | 'digest'>,
  digest: string,
): ValidatedLearningExperiencePlan {
  return Object.freeze({
    ...plan,
    digest,
    [VALIDATED]: true as const,
  }) as ValidatedLearningExperiencePlan;
}

// ---------------------------------------------------------------------------
// Rejection codes
// ---------------------------------------------------------------------------

/**
 * Every failure has a stable code. Codes are safe to log and safe to show as a
 * development diagnostic; they never carry source text, credentials or paths.
 */
export const EXPERIENCE_PLAN_REJECTIONS = [
  // Stage 1 — schema
  'PLAN_SCHEMA_UNSUPPORTED_VERSION',
  'PLAN_SCHEMA_INVALID',
  'PLAN_SCHEMA_UNKNOWN_FIELD',
  'PLAN_SCHEMA_OVERSIZED',
  'PLAN_SCHEMA_UNSAFE_MARKUP',
  'PLAN_SCHEMA_PROTOTYPE_POLLUTION',
  'PLAN_SCHEMA_DUPLICATE_ID',
  'PLAN_SCHEMA_NESTED_TOO_DEEP',
  // Stage 2 — identity
  'PLAN_IDENTITY_COURSE_MISMATCH',
  'PLAN_IDENTITY_REVISION_MISMATCH',
  'PLAN_IDENTITY_CONTENT_HASH_MISMATCH',
  'PLAN_IDENTITY_LESSON_MISMATCH',
  'PLAN_IDENTITY_REGISTRY_MISMATCH',
  'PLAN_IDENTITY_PRESENTATION_MISMATCH',
  'PLAN_IDENTITY_CONTEXT_FINGERPRINT_MISMATCH',
  'PLAN_IDENTITY_PLANNER_UNKNOWN',
  // Stage 3 — canonical coverage
  'PLAN_COVERAGE_BLOCK_UNKNOWN',
  'PLAN_COVERAGE_BLOCK_MISSING',
  'PLAN_COVERAGE_BLOCK_DUPLICATED',
  'PLAN_COVERAGE_BLOCK_REORDERED',
  'PLAN_COVERAGE_CROSS_LESSON',
  'PLAN_COVERAGE_SUPPLEMENTAL_MISPLACED',
  // Stage 4 — component compatibility
  'PLAN_COMPONENT_UNKNOWN',
  'PLAN_COMPONENT_VERSION_UNSUPPORTED',
  'PLAN_COMPONENT_BLOCK_INCOMPATIBLE',
  'PLAN_COMPONENT_ROLE_INCOMPATIBLE',
  'PLAN_COMPONENT_POLICY_INCOMPATIBLE',
  'PLAN_COMPONENT_EVIDENCE_MISSING',
  'PLAN_COMPONENT_SOURCE_REGION_MISSING',
  'PLAN_COMPONENT_FIXTURE_MISSING',
  'PLAN_COMPONENT_UNREVIEWED_FORMULA',
  'PLAN_COMPONENT_FALLBACK_UNTRUSTED',
  'PLAN_COMPONENT_INTERACTION_INVALID',
  'PLAN_COMPONENT_PROPS_UNSAFE',
  // Stage 5 — asset and provenance
  'PLAN_ASSET_UNKNOWN',
  'PLAN_ASSET_REVISION_MISMATCH',
  'PLAN_ASSET_LESSON_MISMATCH',
  'PLAN_ASSET_BLOCK_MISMATCH',
  'PLAN_ASSET_COMPONENT_MISMATCH',
  'PLAN_ASSET_NOT_LEARNER_VISIBLE',
  'PLAN_ASSET_GENERATED_PROPOSAL',
  'PLAN_ASSET_REVIEW_UNVERIFIED',
  'PLAN_ASSET_SOURCE_UNVERIFIED',
  // Stage 6 — resource limits
  'PLAN_LIMIT_TOO_MANY_PLACEMENTS',
  'PLAN_LIMIT_TOO_MANY_SUPPLEMENTS',
  'PLAN_LIMIT_TOO_MANY_GROUPS',
  'PLAN_LIMIT_TEXT_TOO_LONG',
  // Stage 7 — finalization
  'PLAN_FINALIZATION_INCOMPLETE',
] as const;

export type ExperiencePlanRejectionCode = (typeof EXPERIENCE_PLAN_REJECTIONS)[number];

export class ExperiencePlanRejection extends Error {
  readonly status = 422;
  readonly code: ExperiencePlanRejectionCode;
  /** The validation stage that produced this code. Safe for diagnostics. */
  readonly stage: ExperiencePlanStage;
  constructor(code: ExperiencePlanRejectionCode, stage: ExperiencePlanStage) {
    // The message is the code, never interpolated source or proposal text: an
    // error must not echo untrusted content back to a caller or a log reader.
    super(code);
    this.name = 'ExperiencePlanRejection';
    this.code = code;
    this.stage = stage;
  }
}

export const EXPERIENCE_PLAN_STAGES = [
  'schema',
  'identity',
  'coverage',
  'component',
  'asset',
  'limits',
  'finalization',
] as const;
export type ExperiencePlanStage = (typeof EXPERIENCE_PLAN_STAGES)[number];

// ---------------------------------------------------------------------------
// Strict parsing of the untrusted proposal
// ---------------------------------------------------------------------------

const PROPOSAL_KEYS = [
  'schemaVersion',
  'planId',
  'claims',
  'planner',
  'placements',
  'notes',
] as const;
const CLAIM_KEYS = [
  'courseId',
  'revisionId',
  'contentHash',
  'lessonId',
  'mode',
  'registryVersion',
  'presentationSchemaVersion',
  'contextFingerprint',
] as const;
const PLANNER_KEYS = ['implementation', 'version'] as const;
const PLACEMENT_KEYS = [
  'placementId',
  'kind',
  'block',
  'component',
  'componentVersion',
  'assetId',
  'group',
  'disclosure',
  'interaction',
  'fallback',
] as const;
const BLOCK_KEYS = ['lessonId', 'blockId'] as const;

/** Keys that indicate prototype tampering. Their presence is an attack. */
const POLLUTION_KEYS = ['__proto__', 'constructor', 'prototype'] as const;

/** Keys that would name executable or navigable content. A planner has no
 * legitimate use for any of them: components receive data, never code, markup
 * or a destination. They are rejected as unsafe props, not as pollution. */
const UNSAFE_PROP_KEYS = [
  'html',
  'script',
  'jsx',
  'javascript',
  'css',
  'style',
  'import',
  'require',
  'eval',
  'function',
  'onclick',
  'onerror',
  'onload',
  'url',
  'href',
  'src',
  'code',
  'query',
  'collection',
  'sql',
  'path',
] as const;

const reject = (code: ExperiencePlanRejectionCode, stage: ExperiencePlanStage): never => {
  throw new ExperiencePlanRejection(code, stage);
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/** Markup, script schemes and template syntax have no legitimate place in a
 * label, id or grouping name. */
const UNSAFE_TEXT = /<\s*\/?\s*[a-zA-Z!]|\{\{|\$\{|\bjavascript:|\bdata:|\bvbscript:/i;

function safeString(
  value: unknown,
  max: number,
  code: ExperiencePlanRejectionCode = 'PLAN_SCHEMA_INVALID',
  stage: ExperiencePlanStage = 'schema',
  min = 1,
): string {
  if (typeof value !== 'string' || value.length < min || value.length > max)
    return reject(code, stage);
  if (UNSAFE_TEXT.test(value)) return reject('PLAN_SCHEMA_UNSAFE_MARKUP', stage);
  return value;
}

/** Strict key check. An unknown field is a schema failure, never ignored: a
 * planner that invents a field is either out of date or probing the boundary. */
function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  code: ExperiencePlanRejectionCode = 'PLAN_SCHEMA_UNKNOWN_FIELD',
): void {
  for (const key of Object.keys(value)) {
    if ((POLLUTION_KEYS as readonly string[]).includes(key))
      reject('PLAN_SCHEMA_PROTOTYPE_POLLUTION', 'schema');
    if ((UNSAFE_PROP_KEYS as readonly string[]).includes(key))
      reject('PLAN_COMPONENT_PROPS_UNSAFE', 'component');
    if (!allowed.includes(key)) reject(code, 'schema');
  }
}

/** Depth-bounded scan for pollution keys and unsafe props. Runs before the
 * shape parser so a hostile structure cannot be walked by anything else. */
function assertSafeStructure(value: unknown, depth = 0): void {
  if (depth > EXPERIENCE_PLAN_LIMITS.maxInteractionDepth + 4)
    reject('PLAN_SCHEMA_NESTED_TOO_DEEP', 'schema');
  if (Array.isArray(value)) {
    for (const entry of value) assertSafeStructure(entry, depth + 1);
    return;
  }
  if (!isPlainObject(value)) return;
  for (const key of Object.keys(value)) {
    if ((POLLUTION_KEYS as readonly string[]).includes(key))
      reject('PLAN_SCHEMA_PROTOTYPE_POLLUTION', 'schema');
    if ((UNSAFE_PROP_KEYS as readonly string[]).includes(key))
      reject('PLAN_COMPONENT_PROPS_UNSAFE', 'component');
    assertSafeStructure(value[key], depth + 1);
  }
}

function boundedBytes(value: unknown): void {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return reject('PLAN_SCHEMA_INVALID', 'schema');
  }
  if (typeof serialized !== 'string') return reject('PLAN_SCHEMA_INVALID', 'schema');
  if (serialized.length > EXPERIENCE_PLAN_LIMITS.maxProposalBytes)
    reject('PLAN_SCHEMA_OVERSIZED', 'schema');
}

function parseInteraction(
  value: unknown,
): Record<string, string | number | boolean> | undefined {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) return reject('PLAN_COMPONENT_INTERACTION_INVALID', 'component');
  const keys = Object.keys(value);
  if (keys.length > EXPERIENCE_PLAN_LIMITS.maxInteractionEntries)
    return reject('PLAN_COMPONENT_INTERACTION_INVALID', 'component');
  const parsed: Record<string, string | number | boolean> = {};
  for (const key of keys) {
    if (!/^[a-z][a-zA-Z0-9_]{0,39}$/.test(key))
      return reject('PLAN_COMPONENT_INTERACTION_INVALID', 'component');
    const entry = value[key];
    if (typeof entry === 'boolean') parsed[key] = entry;
    else if (typeof entry === 'number' && Number.isFinite(entry) && Math.abs(entry) <= 1e9)
      parsed[key] = entry;
    else if (typeof entry === 'string' && entry.length <= 200 && !UNSAFE_TEXT.test(entry))
      parsed[key] = entry;
    else return reject('PLAN_COMPONENT_INTERACTION_INVALID', 'component');
  }
  return parsed;
}

function parsePlacement(value: unknown): ProposedPlacement {
  if (!isPlainObject(value)) return reject('PLAN_SCHEMA_INVALID', 'schema');
  exactKeys(value, PLACEMENT_KEYS);
  const placementId = safeString(value.placementId, 128, 'PLAN_SCHEMA_INVALID', 'schema');
  if (value.kind !== 'canonical' && value.kind !== 'supplemental')
    return reject('PLAN_SCHEMA_INVALID', 'schema');
  const kind = value.kind;

  if (!isPlainObject(value.block)) return reject('PLAN_SCHEMA_INVALID', 'schema');
  exactKeys(value.block, BLOCK_KEYS);
  const block: BlockReference = {
    lessonId: safeString(value.block.lessonId, 128, 'PLAN_SCHEMA_INVALID', 'schema'),
    blockId: safeString(value.block.blockId, 128, 'PLAN_SCHEMA_INVALID', 'schema'),
  };

  // An unknown component name is a rejection, not a fallback: the proposal is
  // out of contract, and silently degrading would hide a broken planner.
  if (!isComponentType(value.component))
    return reject('PLAN_COMPONENT_UNKNOWN', 'component');
  const component = value.component;

  const componentVersion = safeString(
    value.componentVersion,
    32,
    'PLAN_COMPONENT_VERSION_UNSUPPORTED',
    'component',
  );

  if (!(PLACEMENT_GROUPS as readonly unknown[]).includes(value.group))
    return reject('PLAN_SCHEMA_INVALID', 'schema');
  if (!(DISCLOSURE_MODES as readonly unknown[]).includes(value.disclosure))
    return reject('PLAN_SCHEMA_INVALID', 'schema');

  if (!isComponentType(value.fallback))
    return reject('PLAN_COMPONENT_FALLBACK_UNTRUSTED', 'component');

  const assetId =
    value.assetId === undefined
      ? undefined
      : safeString(value.assetId, 128, 'PLAN_SCHEMA_INVALID', 'schema');
  // The two kinds are distinguished by exactly one field. A canonical
  // placement that names an asset, or a supplement that names none, is a
  // contract violation rather than a style choice.
  if (kind === 'canonical' && assetId !== undefined)
    return reject('PLAN_COVERAGE_SUPPLEMENTAL_MISPLACED', 'coverage');
  if (kind === 'supplemental' && assetId === undefined)
    return reject('PLAN_ASSET_UNKNOWN', 'asset');

  const interaction = parseInteraction(value.interaction);

  return {
    placementId,
    kind,
    block,
    component,
    componentVersion,
    ...(assetId !== undefined ? { assetId } : {}),
    group: value.group as PlacementGroup,
    disclosure: value.disclosure as DisclosureMode,
    ...(interaction !== undefined ? { interaction } : {}),
    fallback: value.fallback,
  };
}

/**
 * Parse raw planner output into the untrusted proposal type.
 *
 * This is *only* a structural gate. It proves the payload is within contract;
 * it proves nothing about authorization, coverage, component fitness or asset
 * provenance. Those are the validator's job, against trusted data.
 */
export function parseExperiencePlanProposal(value: unknown): UntrustedExperiencePlanProposal {
  boundedBytes(value);
  assertSafeStructure(value);
  if (!isPlainObject(value)) return reject('PLAN_SCHEMA_INVALID', 'schema');
  exactKeys(value, PROPOSAL_KEYS);
  if (value.schemaVersion !== EXPERIENCE_PLAN_SCHEMA_VERSION)
    return reject('PLAN_SCHEMA_UNSUPPORTED_VERSION', 'schema');

  const planId = safeString(value.planId, 128, 'PLAN_SCHEMA_INVALID', 'schema');

  if (!isPlainObject(value.claims)) return reject('PLAN_SCHEMA_INVALID', 'schema');
  exactKeys(value.claims, CLAIM_KEYS);
  const claims = {
    courseId: safeString(value.claims.courseId, 64, 'PLAN_SCHEMA_INVALID', 'schema'),
    revisionId: safeString(value.claims.revisionId, 128, 'PLAN_SCHEMA_INVALID', 'schema'),
    contentHash: safeString(value.claims.contentHash, 71, 'PLAN_SCHEMA_INVALID', 'schema'),
    lessonId: safeString(value.claims.lessonId, 128, 'PLAN_SCHEMA_INVALID', 'schema'),
    mode: safeString(value.claims.mode, 32, 'PLAN_SCHEMA_INVALID', 'schema'),
    registryVersion: safeString(value.claims.registryVersion, 32, 'PLAN_SCHEMA_INVALID', 'schema'),
    presentationSchemaVersion: safeString(
      value.claims.presentationSchemaVersion,
      32,
      'PLAN_SCHEMA_INVALID',
      'schema',
    ),
    contextFingerprint: safeString(
      value.claims.contextFingerprint,
      71,
      'PLAN_SCHEMA_INVALID',
      'schema',
    ),
  };

  if (!isPlainObject(value.planner)) return reject('PLAN_SCHEMA_INVALID', 'schema');
  exactKeys(value.planner, PLANNER_KEYS);
  const planner = {
    implementation: safeString(value.planner.implementation, 64, 'PLAN_SCHEMA_INVALID', 'schema'),
    version: safeString(value.planner.version, 32, 'PLAN_SCHEMA_INVALID', 'schema'),
  };

  if (!Array.isArray(value.placements)) return reject('PLAN_SCHEMA_INVALID', 'schema');
  if (value.placements.length > EXPERIENCE_PLAN_LIMITS.maxPlacements)
    return reject('PLAN_LIMIT_TOO_MANY_PLACEMENTS', 'limits');
  const placements = value.placements.map(parsePlacement);

  // Duplicate placement ids would let one instance shadow another in a keyed
  // renderer. They are rejected, never de-duplicated.
  const ids = new Set<string>();
  for (const placement of placements) {
    if (ids.has(placement.placementId))
      return reject('PLAN_SCHEMA_DUPLICATE_ID', 'schema');
    ids.add(placement.placementId);
  }

  let notes: string[] | undefined;
  if (value.notes !== undefined) {
    if (!Array.isArray(value.notes) || value.notes.length > 16)
      return reject('PLAN_SCHEMA_INVALID', 'schema');
    notes = value.notes.map((note) =>
      safeString(note, EXPERIENCE_PLAN_LIMITS.maxTextLength, 'PLAN_LIMIT_TEXT_TOO_LONG', 'limits', 0),
    );
  }

  return {
    schemaVersion: EXPERIENCE_PLAN_SCHEMA_VERSION,
    planId,
    claims,
    planner,
    placements,
    ...(notes !== undefined ? { notes } : {}),
  };
}

// ---------------------------------------------------------------------------
// Context the validator checks the proposal against
// ---------------------------------------------------------------------------

/** The trusted side of validation. Built by the application from the pinned
 * published revision — never from the proposal. */
export type ExperiencePlanValidationContext = {
  courseId: string;
  revisionId: string;
  contentHash: string;
  lessonId: string;
  mode: string;
  contextFingerprint: string;
  /** Trusted planner implementations permitted in this deployment. */
  allowedPlanners: readonly { implementation: string; version: string }[];
  /** Canonical blocks of the selected lesson, in canonical order. */
  blocks: Array<{
    blockId: string;
    blockType: LessonBlockV2['type'];
    /** Semantic callout role, when the block has one. */
    role?: string;
    /** Render policy already decided by the presentation projection. */
    render: 'primary' | 'source_faithful';
    hasEvidence: boolean;
    hasSourceRegion: boolean;
    isReviewedFormula: boolean;
    /** A trusted, validated structured fixture is attached to this block. */
    hasStructuredFixture: boolean;
  }>;
  /** Learner-visible structured assets bound to this revision. */
  assets: readonly ValidatedAssetBinding[];
};

/** An asset as the validator sees it: already parsed by `parseStructuredAsset`
 * and already proven learner-visible by provenance. Review state is *not* taken
 * from the asset row alone; `reviewVerified` is set by the trusted lookup. */
export type ValidatedAssetBinding = {
  assetId: string;
  lessonId: string;
  blockId: string | null;
  component: ComponentType;
  provenance: string;
  reviewVerified: boolean;
  sourceVerified: boolean;
};

/** Deterministic fingerprint of the trusted context. Binds a plan to the exact
 * course, revision, lesson, mode and block set it was validated against, without
 * embedding learner identity or private context in an identifier. */
export function experienceContextFingerprint(input: {
  courseId: string;
  revisionId: string;
  contentHash: string;
  lessonId: string;
  mode: string;
  blockIds: readonly string[];
}): string {
  // Local import keeps the contract free of a node:crypto dependency at module
  // load, so the same file can be bundled for the browser if needed.
  const payload = JSON.stringify([
    input.courseId,
    input.revisionId,
    input.contentHash,
    input.lessonId,
    input.mode,
    input.blockIds,
  ]);
  let hash = 0n;
  const prime = 1099511628211n;
  const offset = 14695981039346656037n;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= BigInt(payload.charCodeAt(index));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  return 'fnv1a64:' + hash.toString(16).padStart(16, '0');
}
