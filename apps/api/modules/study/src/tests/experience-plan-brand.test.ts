/** Batch 4 M4.1 closure: the validation brand must not *replace* runtime
 * validation across a serialization boundary.
 *
 * The brand is a module-private symbol. That makes it unforgeable from JSON,
 * but it also means it does not survive `JSON.stringify`. Both facts are
 * intentional, and both must be proven rather than assumed:
 *
 *   - a deserialized plan is never "validated" just because it was once valid
 *   - the browser boundary re-validates structure on its own
 *   - authorization and asset governance are re-derived server-side every call
 */
import {
  finalizeExperiencePlan,
  isValidatedExperiencePlan,
  experienceContextFingerprint,
  type ExperiencePlanValidationContext
} from '../../../../shared/ednova/experiencePlan';
import {
  validateExperiencePlan,
  tryValidateExperiencePlan
} from '../../../../shared/ednova/experiencePlanValidator';
import {
  planMockExperience,
  type MockPlannerContext
} from '../../../../shared/ednova/mockExperiencePlanner';
import { parsePublishedExperiencePlan } from '../../../../shared/ednova/publishedExperiencePlan';
import { projectExperiencePlan } from '../services/experiencePlanning';
import { verifyAssetBindings } from '../services/experiencePlanning';
import type { StructuredAssetV1 } from '../../../../shared/ednova/structuredAsset';

const courseId = 'a57d9f30-21c4-58ff-b48c-1e9e140f4c6d';
const revisionId = 'rev_brand';
const contentHash = 'sha256:' + 'b'.repeat(64);

const facts: ExperiencePlanValidationContext['blocks'] = [
  {
    blockId: 'h1',
    blockType: 'heading',
    render: 'primary',
    hasEvidence: true,
    hasSourceRegion: false,
    isReviewedFormula: false,
    hasStructuredFixture: false
  },
  {
    blockId: 'p1',
    blockType: 'paragraph',
    render: 'primary',
    hasEvidence: true,
    hasSourceRegion: false,
    isReviewedFormula: false,
    hasStructuredFixture: false
  }
];

function context(): ExperiencePlanValidationContext {
  return {
    courseId,
    revisionId,
    contentHash,
    lessonId: 'lesson-1',
    mode: 'read',
    contextFingerprint: experienceContextFingerprint({
      courseId,
      revisionId,
      contentHash,
      lessonId: 'lesson-1',
      mode: 'read',
      blockIds: facts.map((block) => block.blockId)
    }),
    allowedPlanners: [{ implementation: 'mock_experience_planner', version: '1.0.0' }],
    blocks: facts,
    assets: []
  };
}

function plannerContext(ctx: ExperiencePlanValidationContext): MockPlannerContext {
  return {
    courseId: ctx.courseId,
    revisionId: ctx.revisionId,
    contentHash: ctx.contentHash,
    lessonId: ctx.lessonId,
    mode: ctx.mode,
    blocks: ctx.blocks.map((block) => ({
      blockId: block.blockId,
      blockType: block.blockType,
      render: block.render,
      hasEvidence: block.hasEvidence,
      hasSourceRegion: block.hasSourceRegion,
      isReviewedFormula: block.isReviewedFormula,
      hasStructuredFixture: block.hasStructuredFixture
    })),
    assets: []
  };
}

function validPlan() {
  const ctx = context();
  const result = planMockExperience('valid_mathematics', plannerContext(ctx));
  if (!result.ok) throw new Error('planner failed');
  return { ctx, plan: validateExperiencePlan(result.proposal, ctx) };
}

describe('validation brand across a serialization boundary', () => {
  it('is present on a freshly validated plan', () => {
    const { plan } = validPlan();
    expect(isValidatedExperiencePlan(plan)).toBe(true);
  });

  it('does not survive JSON serialization', () => {
    const { plan } = validPlan();
    const roundTripped = JSON.parse(JSON.stringify(plan));
    // The symbol key is dropped by JSON. A deserialized plan is therefore NOT
    // a validated plan: callers must re-validate rather than trust the shape.
    expect(isValidatedExperiencePlan(roundTripped)).toBe(false);
  });

  it('cannot be forged by adding a validated flag to serialized JSON', () => {
    const { plan } = validPlan();
    const forged = { ...JSON.parse(JSON.stringify(plan)), validated: true };
    expect(isValidatedExperiencePlan(forged)).toBe(false);
  });

  it('refuses to project a deserialized plan', () => {
    const { plan } = validPlan();
    const roundTripped = JSON.parse(JSON.stringify(plan));
    // Projection is the step that hands a plan to the browser. It must refuse
    // anything the brand does not vouch for.
    expect(() => projectExperiencePlan(roundTripped)).toThrow();
  });

  it('projects a plan that is still branded', () => {
    const { plan } = validPlan();
    const projected = projectExperiencePlan(plan);
    expect(projected.canonical.map((entry) => entry.blockId)).toEqual(['h1', 'p1']);
  });

  it('re-validates structure at the browser boundary independently of the brand', () => {
    const { plan } = validPlan();
    const projected = projectExperiencePlan(plan);
    const blockIds = ['h1', 'p1'];

    // The browser parser accepts the honest projection...
    expect(parsePublishedExperiencePlan(projected, blockIds).canonical).toHaveLength(2);

    // ...and rejects a tampered one even though it is well-formed JSON that a
    // server could have produced.
    const tampered = JSON.parse(JSON.stringify(projected));
    tampered.canonical[0].component = 'RemoteScriptRunner';
    expect(() => parsePublishedExperiencePlan(tampered, blockIds)).toThrow();

    const reordered = JSON.parse(JSON.stringify(projected));
    reordered.canonical.reverse();
    expect(() => parsePublishedExperiencePlan(reordered, blockIds)).toThrow();
  });

  it('finalizeExperiencePlan is the only mint and it freezes the result', () => {
    const plan = finalizeExperiencePlan(
      {
        schemaVersion: '1.0.0',
        planId: 'p',
        courseId,
        revisionId,
        contentHash,
        lessonId: 'lesson-1',
        mode: 'read',
        registryVersion: '1.0.0',
        presentationSchemaVersion: '1.0.0',
        contextFingerprint: 'fnv1a64:0000000000000000',
        planner: { implementation: 'mock_experience_planner', version: '1.0.0' },
        canonical: [],
        supplemental: []
      },
      'fnv1a64:0000000000000000'
    );
    expect(Object.isFrozen(plan)).toBe(true);
    expect(() => {
      (plan as unknown as Record<string, unknown>).courseId = 'other';
    }).toThrow();
  });
});

describe('governance is re-derived per call, not carried by the brand', () => {
  it('rejects a proposal whose claims do not match the live context', () => {
    const ctx = context();
    const result = planMockExperience('valid_mathematics', plannerContext(ctx));
    if (!result.ok) throw new Error('planner failed');
    // Same shape, different revision: identity is checked against trusted
    // context on every validation, never inherited from a previous run.
    const stale = {
      ...result.proposal,
      claims: { ...result.proposal.claims, revisionId: 'rev_other' }
    };
    const outcome = tryValidateExperiencePlan(stale, ctx);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe('PLAN_IDENTITY_REVISION_MISMATCH');
  });

  it('never derives review authority from an asset claim alone', () => {
    // M4.1 checked that a review claim *looked* consistent. M4.2 replaced that
    // with persisted decisions (C3), so this pure binding step now reports
    // reviewVerified: false for everything. Only
    // `verifyAssetBindingsWithProvenance` can set it true, and only from a row.
    const claimed = {
      assetId: 'asset_1',
      courseId,
      revisionId,
      lessonId: 'lesson-1',
      component: 'CodeWalkthrough',
      provenance: 'instructor_authored',
      review: { status: 'instructor_reviewed', reviewedBy: 'x', reviewedAt: '2026-01-01T00:00:00Z' }
    } as unknown as StructuredAssetV1;

    const [verified] = verifyAssetBindings([claimed], {
      courseId,
      revisionId,
      lessonId: 'lesson-1',
      authorizedDocumentIds: new Set()
    });
    expect(verified.reviewVerified).toBe(false);
  });

  it('rejects a generated proposal regardless of a valid plan elsewhere', () => {
    const generated = {
      assetId: 'asset_gen',
      courseId,
      revisionId,
      lessonId: 'lesson-1',
      component: 'CodeWalkthrough',
      provenance: 'generated_proposal',
      review: { status: 'unreviewed' }
    } as unknown as StructuredAssetV1;
    const [verified] = verifyAssetBindings([generated], {
      courseId,
      revisionId,
      lessonId: 'lesson-1',
      authorizedDocumentIds: new Set()
    });
    // Never review-verified, and the asset projection would hide it anyway.
    expect(verified.reviewVerified).toBe(false);
  });
});
