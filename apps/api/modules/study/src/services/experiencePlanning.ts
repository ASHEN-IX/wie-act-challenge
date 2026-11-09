/** Authorized experience planning (Batch 4, Milestone 4.1).
 *
 * The bounded planning workflow:
 *
 *   authorize → pin revision → load presentation → select lesson →
 *   build minimal context → resolve capabilities → resolve eligible assets →
 *   call the mock planner → parse → validate independently → return the plan
 *
 * The service owns the *trusted* half of validation: everything that needs the
 * database. It builds an `ExperiencePlanValidationContext` from the pinned
 * published revision and the stored assets, then hands the proposal and the
 * context to the pure validator. It never mutates a revision, never writes an
 * asset and never calls a model.
 *
 * A failure anywhere returns a typed rejection. The caller renders the
 * deterministic reader instead; a planner failure must never block lesson
 * access.
 */

import {
  ExperiencePlanRejection,
  experienceContextFingerprint,
  isValidatedExperiencePlan,
  type ExperiencePlanValidationContext,
  type ExperiencePlanRejectionCode,
  type ValidatedAssetBinding,
  type ValidatedLearningExperiencePlan
} from '../../../../shared/ednova/experiencePlan';
import {
  tryValidateExperiencePlan,
  type ValidationOutcome
} from '../../../../shared/ednova/experiencePlanValidator';
import {
  MOCK_PLANNER_IMPLEMENTATION,
  MOCK_PLANNER_VERSION,
  isMockPlannerScenario,
  planMockExperience,
  type MockPlannerScenario,
  type PlannerAssetView,
  type PlannerBlockView
} from '../../../../shared/ednova/mockExperiencePlanner';
import {
  parseStructuredAsset,
  type StructuredAssetV1
} from '../../../../shared/ednova/structuredAsset';
import { StructuredAsset } from '../models/StructuredAsset';
import { prisma } from '../../../../shared/database';
import { getPublishedPresentation } from './presentationReader';
import { generateExperiencePlan } from './experiencePlanGeneration';
import { loadAcceptedPlan } from './experiencePlanStore';
import { isLearningMode } from '../../../../shared/ednova/learningModes';
import { configuredPlannerModel } from './experiencePlannerProviders';
import type { ExperiencePlannerProvider } from '../../../../shared/ednova/experiencePlannerProvider';
import { capabilityDigest } from '../../../../shared/ednova/experiencePlanValidator';
import type { PlanningContextInput } from '../../../../shared/ednova/planningContext';
import { verifyReviewProvenance, type ReviewProvenance } from './assetReviewProvenance';

/**
 * Mock planning is a development/QA pathway, never a production feature.
 *
 * The flag must be explicitly enabled. It is read from the environment at call
 * time, not import time, so a test can toggle it and so a misconfigured
 * deployment fails closed rather than open.
 */
export function mockPlanningEnabled(): boolean {
  return process.env.EDNOVA_ENABLE_MOCK_EXPERIENCE_PLANNING === 'true';
}

export class ExperiencePlanningDisabledError extends Error {
  readonly status = 403;
  constructor() {
    super('Mock experience planning is not enabled in this environment.');
    this.name = 'ExperiencePlanningDisabledError';
  }
}

export class ExperiencePlanningUnavailableError extends Error {
  readonly status = 503;
  constructor(
    message = 'The experience planner is unavailable. The deterministic reader remains available.'
  ) {
    super(message);
    this.name = 'ExperiencePlanningUnavailableError';
  }
}

/** Planner implementations this deployment will accept. Today only the mock.
 * Milestone 4.2 adds a provider implementation here — and must add it here,
 * because the validator checks every proposal against this list. */
const ALLOWED_PLANNERS = Object.freeze([
  Object.freeze({ implementation: MOCK_PLANNER_IMPLEMENTATION, version: MOCK_PLANNER_VERSION })
]);

/**
 * Load the structured assets for a revision and decide, per asset, whether its
 * review and source claims are backed by trusted records.
 *
 * The stored row is not a trust boundary: it is re-parsed through the same
 * contract the writer used. Review is then verified separately, because an
 * asset claiming `instructor_reviewed` is only meaningful if the persisted
 * review fields are internally consistent *and* the asset is bound to the
 * revision the learner is reading.
 *
 * This milestone does not introduce a separate review-record collection. The
 * minimum trusted verification available today is:
 *
 *   - the row re-parses under the current contract,
 *   - a review claim carries a reviewer and a parseable timestamp,
 *   - the asset is bound to this exact course, revision and lesson,
 *   - source-derived assets carry references that resolve inside the revision.
 *
 * Anything that cannot meet that bar is marked ineligible, and a plan that
 * references it is rejected. A fuller approval workflow is deferred, and the
 * report says so rather than claiming review governance we do not have.
 */
export function verifyAssetBindings(
  assets: StructuredAssetV1[],
  binding: {
    courseId: string;
    revisionId: string;
    lessonId: string;
    authorizedDocumentIds: Set<string>;
  }
): ValidatedAssetBinding[] {
  return assets.map((asset) => {
    const bound =
      asset.courseId === binding.courseId &&
      asset.revisionId === binding.revisionId &&
      asset.lessonId === binding.lessonId;

    const sourceVerified =
      asset.provenance !== 'source_derived'
        ? true
        : Array.isArray(asset.sourceReferences) &&
          asset.sourceReferences.length > 0 &&
          asset.sourceReferences.every((reference) =>
            binding.authorizedDocumentIds.has(reference.documentId)
          );

    return {
      assetId: asset.assetId,
      lessonId: asset.lessonId,
      blockId: asset.blockId ?? null,
      component: asset.component,
      provenance: asset.provenance,
      // Review authority is NOT derived here. M4.1 checked claim shape, which
      // proved nothing about whether a person approved this version; M4.2
      // resolves it from persisted decisions in `verifyReviewProvenance`.
      reviewVerified: false,
      sourceVerified: bound && sourceVerified
    };
  });
}

/**
 * Bind assets to a lesson with review authority taken from persisted decisions.
 *
 * This is the M4.2 replacement for claim-shaped verification (C3). The pure
 * function above still answers "is this asset bound and source-verified?";
 * this one additionally asks the database who approved this exact version.
 */
export async function verifyAssetBindingsWithProvenance(
  assets: StructuredAssetV1[],
  binding: {
    courseId: string;
    revisionId: string;
    lessonId: string;
    authorizedDocumentIds: Set<string>;
  }
): Promise<{ bindings: ValidatedAssetBinding[]; provenance: Map<string, ReviewProvenance> }> {
  const bindings = verifyAssetBindings(assets, binding);
  const provenance = await verifyReviewProvenance(assets, binding);
  const bound = new Set(
    bindings.filter((entry) => entry.lessonId === binding.lessonId).map((e) => e.assetId)
  );
  return {
    bindings: bindings.map((entry) => ({
      ...entry,
      // Only a persisted, unrevoked, version-matching decision from a current
      // course author counts. A proposal cannot influence this value.
      reviewVerified: bound.has(entry.assetId) && provenance.get(entry.assetId)?.verified === true
    })),
    provenance
  };
}

async function loadAssets(courseId: string, revisionId: string): Promise<StructuredAssetV1[]> {
  const rows = await StructuredAsset.find({ courseId, revisionId })
    .sort({ assetId: 1 })
    .limit(200)
    .lean();
  const parsed: StructuredAssetV1[] = [];
  for (const row of rows) {
    try {
      parsed.push(
        parseStructuredAsset({
          schemaVersion: row.schemaVersion,
          assetId: row.assetId,
          courseId: row.courseId,
          revisionId: row.revisionId,
          ...(row.blockId !== undefined ? { blockId: row.blockId } : {}),
          lessonId: row.lessonId,
          registryVersion: row.registryVersion,
          component: row.component,
          payload: row.payload,
          provenance: row.provenance,
          review: {
            status: row.reviewStatus,
            ...(row.reviewedBy !== undefined ? { reviewedBy: row.reviewedBy } : {}),
            ...(row.reviewedAt !== undefined ? { reviewedAt: row.reviewedAt } : {})
          },
          ...(row.sourceReferences !== undefined ? { sourceReferences: row.sourceReferences } : {}),
          audience: row.audience,
          fallback: row.fallback,
          disclosure: row.disclosure
        })
      );
    } catch {
      // A malformed optional asset is skipped, never fatal: the deterministic
      // reader does not depend on it.
    }
  }
  return parsed;
}

/** The plan the browser receives. It carries no source text and no learner
 * identity; the reader joins it to the presentation it already loaded. */
export type PublishedExperiencePlanV1 = {
  schemaVersion: '1.0.0';
  planId: string;
  courseId: string;
  revisionId: string;
  contentHash: string;
  lessonId: string;
  mode: string;
  registryVersion: string;
  contextFingerprint: string;
  planner: { implementation: string; version: string };
  digest: string;
  canonical: Array<{
    placementId: string;
    blockId: string;
    blockType: string;
    component: string;
    componentVersion: string;
    group: string;
    disclosure: string;
    interaction?: Record<string, string | number | boolean>;
    fallback: string;
  }>;
  supplemental: Array<{
    placementId: string;
    blockId: string;
    blockType: string;
    component: string;
    componentVersion: string;
    assetId: string;
    group: string;
    disclosure: string;
    fallback: string;
  }>;
  /** Learner-facing statement of what this plan is. */
  disclosure: string;
};

export const EXPERIENCE_PLAN_DISCLOSURE =
  'This lesson layout was proposed by a deterministic mock planner and validated against the published revision. ' +
  'Course content is unchanged; every block is rendered by a trusted component.';

/** Project a validated plan into the browser shape. Only a branded validated
 * plan can be projected, so this function cannot be reached with raw JSON. */
export function projectExperiencePlan(
  plan: ValidatedLearningExperiencePlan
): PublishedExperiencePlanV1 {
  if (!isValidatedExperiencePlan(plan))
    throw new ExperiencePlanRejection('PLAN_FINALIZATION_INCOMPLETE', 'finalization');
  return {
    schemaVersion: '1.0.0',
    planId: plan.planId,
    courseId: plan.courseId,
    revisionId: plan.revisionId,
    contentHash: plan.contentHash,
    lessonId: plan.lessonId,
    mode: plan.mode,
    registryVersion: plan.registryVersion,
    contextFingerprint: plan.contextFingerprint,
    planner: plan.planner,
    digest: plan.digest,
    canonical: plan.canonical.map((entry) => ({
      placementId: entry.placementId,
      blockId: entry.blockId,
      blockType: entry.blockType,
      component: entry.component,
      componentVersion: entry.componentVersion,
      group: entry.group,
      disclosure: entry.disclosure,
      ...(entry.interaction !== undefined ? { interaction: entry.interaction } : {}),
      fallback: entry.fallback
    })),
    supplemental: plan.supplemental.map((entry) => ({
      placementId: entry.placementId,
      blockId: entry.blockId,
      blockType: entry.blockType,
      component: entry.component,
      componentVersion: entry.componentVersion,
      assetId: entry.assetId!,
      group: entry.group,
      disclosure: entry.disclosure,
      fallback: entry.fallback
    })),
    disclosure: EXPERIENCE_PLAN_DISCLOSURE
  };
}

export type PlanningOutcome =
  | { status: 'planned'; plan: PublishedExperiencePlanV1 }
  | { status: 'rejected'; code: ExperiencePlanRejectionCode; stage: string }
  | { status: 'planner_unavailable'; failure: 'timeout' | 'malformed' };

/**
 * Run the bounded planning workflow for one lesson.
 *
 * Authorization happens inside `getPublishedPresentation`, which is the single
 * published-reading boundary: it pins the revision, verifies the canonical
 * checksum and enforces course access. This service never re-implements those
 * checks and never widens them.
 */
export async function planLessonExperience(
  actor: string,
  courseId: string,
  lessonId: string,
  scenario: MockPlannerScenario,
  mode = 'read'
): Promise<PlanningOutcome> {
  if (!mockPlanningEnabled()) throw new ExperiencePlanningDisabledError();
  if (!isMockPlannerScenario(scenario))
    throw Object.assign(new Error('Unknown planning scenario'), { status: 400 });

  // One authorized load: revision pinning, checksum verification and access
  // control all happen here.
  const presentation = await getPublishedPresentation(actor, courseId);
  const lesson = presentation.chapters
    .flatMap((chapter) => chapter.lessons)
    .find((entry) => entry.id === lessonId);
  if (!lesson) throw Object.assign(new Error('Lesson not found in this revision'), { status: 404 });

  // Canonical facts, derived from the validated presentation. The planner sees
  // identity and kind; it never sees source text.
  const blocks: PlannerBlockView[] = lesson.blocks.map((entry) => {
    const block = entry.block;
    return {
      blockId: block.id,
      blockType: block.type,
      ...(block.type === 'callout' ? { role: block.kind } : {}),
      render: entry.render,
      hasEvidence:
        ('evidence' in block && Array.isArray(block.evidence) && block.evidence.length > 0) ||
        (block.provenance?.length ?? 0) > 0,
      hasSourceRegion: block.type !== 'chart' && Boolean(block.sourceMeta?.regionId),
      isReviewedFormula: block.type === 'math' && Boolean(block.review),
      hasStructuredFixture: false
    };
  });

  const storedAssets = await loadAssets(presentation.courseId, presentation.revisionId);
  const authorizedDocumentIds = new Set(presentation.sources.map((source) => source.documentId));
  // Review authority is resolved from persisted decisions on both paths, so the
  // mock planner cannot select an asset the real planner could not either.
  const { bindings: assetBindings } = await verifyAssetBindingsWithProvenance(storedAssets, {
    courseId: presentation.courseId,
    revisionId: presentation.revisionId,
    lessonId,
    authorizedDocumentIds
  });

  const context: ExperiencePlanValidationContext = {
    courseId: presentation.courseId,
    revisionId: presentation.revisionId,
    contentHash: presentation.contentHash,
    lessonId,
    mode,
    contextFingerprint: experienceContextFingerprint({
      courseId: presentation.courseId,
      revisionId: presentation.revisionId,
      contentHash: presentation.contentHash,
      lessonId,
      mode,
      blockIds: blocks.map((block) => block.blockId)
    }),
    allowedPlanners: ALLOWED_PLANNERS,
    blocks: blocks.map((block) => ({
      blockId: block.blockId,
      blockType: block.blockType as never,
      ...(block.role !== undefined ? { role: block.role } : {}),
      render: block.render,
      hasEvidence: block.hasEvidence,
      hasSourceRegion: block.hasSourceRegion,
      isReviewedFormula: block.isReviewedFormula,
      hasStructuredFixture: block.hasStructuredFixture
    })),
    assets: assetBindings
  };

  // The planner receives the minimal context and nothing else: no actor id, no
  // token, no unrelated course, no raw source prose.
  const plannerAssets: PlannerAssetView[] = assetBindings.map((asset) => ({
    assetId: asset.assetId,
    blockId: asset.blockId,
    component: asset.component,
    provenance: asset.provenance
  }));
  const result = planMockExperience(scenario, {
    courseId: context.courseId,
    revisionId: context.revisionId,
    contentHash: context.contentHash,
    lessonId,
    mode,
    blocks,
    assets: plannerAssets
  });
  if (!result.ok) return { status: 'planner_unavailable', failure: result.failure };

  const outcome: ValidationOutcome = tryValidateExperiencePlan(result.proposal, context);
  if (!outcome.ok) {
    // The code and stage only: never the proposal, source text or actor.
    console.warn(
      `[experience-plan] rejected ${outcome.code} at ${outcome.stage} ` +
        `(lesson=${lessonId} blocks=${context.blocks.length})`
    );
    return { status: 'rejected', code: outcome.code, stage: outcome.stage };
  }
  return { status: 'planned', plan: projectExperiencePlan(outcome.plan) };
}

/**
 * The trusted context both planners share.
 *
 * Built once, from the pinned published revision and persisted assets, so the
 * mock path and the real-provider path can never drift in what they consider
 * authoritative. Nothing here comes from a provider.
 */
export async function loadTrustedPlanningContext(
  actor: string,
  courseId: string,
  lessonId: string,
  mode: string
): Promise<{
  presentation: Awaited<ReturnType<typeof getPublishedPresentation>>;
  lessonId: string;
  mode: string;
  validationContext: ExperiencePlanValidationContext;
  contextInput: PlanningContextInput;
  keySha256: string | null;
}> {
  const presentation = await getPublishedPresentation(actor, courseId);
  const lesson = presentation.chapters
    .flatMap((chapter) => chapter.lessons)
    .find((entry) => entry.id === lessonId);
  if (!lesson) throw Object.assign(new Error('Lesson not found in this revision'), { status: 404 });

  const storedAssets = await loadAssets(presentation.courseId, presentation.revisionId);
  const authorizedDocumentIds = new Set(presentation.sources.map((source) => source.documentId));
  // Review authority comes from persisted decisions (M4.2, closes C3).
  const { bindings, provenance } = await verifyAssetBindingsWithProvenance(storedAssets, {
    courseId: presentation.courseId,
    revisionId: presentation.revisionId,
    lessonId,
    authorizedDocumentIds
  });
  const lessonAssets = storedAssets.filter((asset) => asset.lessonId === lessonId);
  const bindingByAsset = new Map(bindings.map((entry) => [entry.assetId, entry] as const));

  const blocks = lesson.blocks.map((entry) => {
    const block = entry.block;
    return {
      blockId: block.id,
      block,
      render: entry.render,
      ...(block.type === 'callout' ? { role: block.kind } : {}),
      hasSourceRegion: block.type !== 'chart' && Boolean(block.sourceMeta?.regionId),
      isReviewedFormula: block.type === 'math' && Boolean(block.review),
      hasStructuredFixture: false
    };
  });

  const validationContext: ExperiencePlanValidationContext = {
    courseId: presentation.courseId,
    revisionId: presentation.revisionId,
    contentHash: presentation.contentHash,
    lessonId,
    mode,
    contextFingerprint: experienceContextFingerprint({
      courseId: presentation.courseId,
      revisionId: presentation.revisionId,
      contentHash: presentation.contentHash,
      lessonId,
      mode,
      blockIds: blocks.map((block) => block.blockId)
    }),
    // Both implementations are permitted; the provider is chosen by config and
    // the proposal's own `planner` field must match one of these.
    allowedPlanners: ALLOWED_PLANNERS,
    blocks: blocks.map((entry) => ({
      blockId: entry.blockId,
      blockType: entry.block.type,
      ...(entry.role !== undefined ? { role: entry.role } : {}),
      render: entry.render,
      hasEvidence:
        ('evidence' in entry.block &&
          Array.isArray(entry.block.evidence) &&
          entry.block.evidence.length > 0) ||
        (entry.block.provenance?.length ?? 0) > 0,
      hasSourceRegion: entry.hasSourceRegion,
      isReviewedFormula: entry.isReviewedFormula,
      hasStructuredFixture: entry.hasStructuredFixture
    })),
    assets: bindings
  };

  const contextInput: PlanningContextInput = {
    courseTitle: presentation.title,
    courseId: presentation.courseId,
    revisionId: presentation.revisionId,
    lessonId,
    lessonTitle: lesson.title,
    mode,
    blocks,
    // Only assets whose review is verified by a persisted decision are offered
    // to the planner. An unverified asset is not merely hidden; it is never
    // named, so the model cannot select it.
    assets: lessonAssets
      .filter((asset) => bindingByAsset.get(asset.assetId)?.reviewVerified === true)
      .map((asset) => ({
        assetId: asset.assetId,
        blockId: asset.blockId ?? '',
        component: asset.component,
        provenance: asset.provenance,
        reviewVerified: true
      })),
    capabilities: capabilityDigest()
  };

  // Eligibility carries the key fingerprint the operator verified; governance
  // compares it again before dispatch.
  const keySha256 = await loadEligibilityKeySha(presentation.courseId, mode);

  void provenance;
  return { presentation, lessonId, mode, validationContext, contextInput, keySha256 };
}

/** The operator-verified credential fingerprint for this provider/model, or
 * null when none is recorded. Null means "no dispatch", never "trust anything". */
async function loadEligibilityKeySha(courseId: string, mode: string): Promise<string | null> {
  void courseId;
  void mode;
  const model = configuredPlannerModel();
  const rows = await prisma.experiencePlannerEligibility.findMany({
    where: { provider: 'gemini', model }
  });
  for (const row of rows) {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    if (payload.revoked === true) continue;
    const keySha = payload.keySha256;
    if (typeof keySha === 'string' && /^[a-f0-9]{64}$/.test(keySha)) return keySha;
  }
  return null;
}

export type RealPlanningOutcome =
  | {
      status: 'planned';
      plan: PublishedExperiencePlanV1;
      requestId: string;
      usageReported: boolean;
    }
  | { status: 'rejected'; code: string; stage: string; requestId: string }
  | { status: 'refused'; code: string }
  | { status: 'failed'; code: string; uncertain: boolean; requestId: string }
  | { status: 'duplicate'; requestId: string };

/**
 * Plan one lesson with the configured real provider.
 *
 * The deterministic reader remains the fallback for every non-`planned` outcome.
 * A learner never sees a provider error: the caller renders the reader instead.
 */
export async function planLessonWithProvider(
  actor: string,
  courseId: string,
  lessonId: string,
  provider: ExperiencePlannerProvider,
  mode = 'read'
): Promise<RealPlanningOutcome> {
  const trusted = await loadTrustedPlanningContext(actor, courseId, lessonId, mode);
  const outcome = await generateExperiencePlan({
    actor,
    provider,
    courseId: trusted.validationContext.courseId,
    revisionId: trusted.validationContext.revisionId,
    lessonId,
    mode,
    keySha256: trusted.keySha256 ?? '',
    contextInput: trusted.contextInput,
    validationContext: trusted.validationContext
  });

  // An accepted plan already exists for this exact scope: reuse it rather than
  // paying for a second inference. The read path revalidates it against live
  // records, so reuse is not a shortcut around validation.
  if (outcome.status === 'already_accepted') {
    const reused = await loadAcceptedPlan({
      courseId: trusted.validationContext.courseId,
      revisionId: trusted.validationContext.revisionId,
      lessonId,
      mode: isLearningMode(mode) ? mode : 'guided',
      contentHash: trusted.validationContext.contentHash,
      contextFingerprint: trusted.validationContext.contextFingerprint,
      validationContext: trusted.validationContext
    });
    if (reused.status === 'available')
      return {
        status: 'planned',
        plan: reused.plan,
        requestId: outcome.requestId,
        usageReported: false
      };
    // The stored record no longer passes validation; report it plainly rather
    // than pretending a plan is available.
    return {
      status: 'failed',
      code:
        reused.status === 'rejected'
          ? reused.code
          : String((reused as { reason?: string }).reason ?? 'PLAN_UNAVAILABLE'),
      uncertain: false,
      requestId: outcome.requestId
    };
  }

  if (outcome.status !== 'validated') return outcome;

  // The validated plan is handed straight to the projection. It is never
  // re-read from storage and never rebuilt from browser input.
  return {
    status: 'planned',
    plan: projectExperiencePlan(outcome.plan),
    requestId: outcome.requestId,
    usageReported: outcome.usageReported
  };
}

export type StoredPlanOutcome =
  | { status: 'available'; plan: PublishedExperiencePlanV1 }
  | { status: 'absent' }
  | { status: 'stale'; reason: string }
  | { status: 'rejected'; code: string };

/**
 * The student read path.
 *
 * Deliberately separate from generation: an enrolled reader may *view* an
 * accepted plan, but nothing here can dispatch to a provider. Authorization
 * goes through the same published-reading boundary as every other learner
 * surface, and the stored plan is revalidated against current trusted records
 * before it is returned.
 *
 * A learner never sees an internal code. Every non-available outcome becomes
 * `undefined` at the route, and the deterministic reader renders.
 */
export async function readStoredPlan(input: {
  actor: string;
  courseId: string;
  lessonId: string;
  mode: string;
}): Promise<StoredPlanOutcome> {
  if (!isLearningMode(input.mode) || input.mode === 'read') return { status: 'absent' };

  // Building the live context is what re-checks authorization, revision pinning
  // and persisted review decisions. It throws for an unauthorized actor.
  const trusted = await loadTrustedPlanningContext(
    input.actor,
    input.courseId,
    input.lessonId,
    input.mode
  );

  const outcome = await loadAcceptedPlan({
    courseId: trusted.validationContext.courseId,
    revisionId: trusted.validationContext.revisionId,
    lessonId: input.lessonId,
    mode: input.mode,
    contentHash: trusted.validationContext.contentHash,
    contextFingerprint: trusted.validationContext.contextFingerprint,
    validationContext: trusted.validationContext
  });

  if (outcome.status === 'available') return { status: 'available', plan: outcome.plan };
  if (outcome.status === 'rejected') return { status: 'rejected', code: outcome.code };
  if (outcome.status === 'stale') return { status: 'stale', reason: outcome.reason };
  return { status: 'absent' };
}
