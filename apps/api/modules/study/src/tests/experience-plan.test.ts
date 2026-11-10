import type { LessonBlockV2 } from '../../../../shared/ednova/learningDocumentV2';
import {
  EXPERIENCE_PLAN_LIMITS,
  EXPERIENCE_PLAN_SCHEMA_VERSION,
  ExperiencePlanRejection,
  experienceContextFingerprint,
  isValidatedExperiencePlan,
  parseExperiencePlanProposal,
  type ExperiencePlanValidationContext,
  type UntrustedExperiencePlanProposal,
  type ValidatedAssetBinding
} from '../../../../shared/ednova/experiencePlan';
import {
  validateExperiencePlan,
  tryValidateExperiencePlan
} from '../../../../shared/ednova/experiencePlanValidator';
import {
  MOCK_PLANNER_IMPLEMENTATION,
  MOCK_PLANNER_VERSION,
  planMockExperience,
  type MockPlannerContext
} from '../../../../shared/ednova/mockExperiencePlanner';
import { COMPONENT_REGISTRY_VERSION } from '../../../../shared/ednova/componentRegistry';

const courseId = 'a57d9f30-21c4-58ff-b48c-1e9e140f4c6d';
const revisionId = 'rev_m41';
const contentHash = 'sha256:' + 'b'.repeat(64);
const lessonId = 'lesson-math';

type Fact = ExperiencePlanValidationContext['blocks'][number];

const fact = (overrides: Partial<Fact> & { blockId: string }): Fact => ({
  blockType: 'paragraph',
  render: 'primary',
  hasEvidence: true,
  hasSourceRegion: false,
  isReviewedFormula: false,
  hasStructuredFixture: false,
  ...overrides
});

/** A small mathematics lesson: heading, prose, reviewed formula, unreviewed
 * formula, proof. Enough to exercise every policy branch. */
const facts: Fact[] = [
  fact({ blockId: 'h1', blockType: 'heading' }),
  fact({ blockId: 'p1' }),
  fact({
    blockId: 'm-reviewed',
    blockType: 'math',
    isReviewedFormula: true
  }),
  fact({
    blockId: 'm-unreviewed',
    blockType: 'math',
    render: 'source_faithful',
    hasSourceRegion: true
  }),
  fact({ blockId: 'proof1', blockType: 'callout', role: 'proof' })
];

const assets: ValidatedAssetBinding[] = [];

function context(
  overrides: Partial<ExperiencePlanValidationContext> = {}
): ExperiencePlanValidationContext {
  const blocks = overrides.blocks ?? facts;
  return {
    courseId,
    revisionId,
    contentHash,
    lessonId,
    mode: 'read',
    contextFingerprint: experienceContextFingerprint({
      courseId,
      revisionId,
      contentHash,
      lessonId,
      mode: 'read',
      blockIds: blocks.map((block) => block.blockId)
    }),
    allowedPlanners: [
      { implementation: MOCK_PLANNER_IMPLEMENTATION, version: MOCK_PLANNER_VERSION }
    ],
    blocks,
    assets: overrides.assets ?? assets,
    ...overrides
  };
}

/** The planner context the mock consumes. Derived from the same facts so a
 * "valid" scenario and the validator agree by construction. */
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
      ...(block.role !== undefined ? { role: block.role } : {}),
      render: block.render,
      hasEvidence: block.hasEvidence,
      hasSourceRegion: block.hasSourceRegion,
      isReviewedFormula: block.isReviewedFormula,
      hasStructuredFixture: block.hasStructuredFixture
    })),
    assets: ctx.assets.map((asset) => ({
      assetId: asset.assetId,
      blockId: asset.blockId,
      component: asset.component,
      provenance: asset.provenance
    }))
  };
}

function validProposal(ctx = context()): UntrustedExperiencePlanProposal {
  const result = planMockExperience('valid_mathematics', plannerContext(ctx));
  if (!result.ok) throw new Error('mock planner unexpectedly failed');
  return result.proposal;
}

function expectCode(run: () => unknown, code: string) {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ExperiencePlanRejection);
    expect((error as ExperiencePlanRejection).code).toBe(code);
    return;
  }
  throw new Error(`expected rejection ${code}, but validation succeeded`);
}

describe('LearningExperiencePlanV1 contract', () => {
  it('accepts a well-formed proposal and mints a branded validated plan', () => {
    const plan = validateExperiencePlan(validProposal(), context());
    expect(plan.schemaVersion).toBe(EXPERIENCE_PLAN_SCHEMA_VERSION);
    expect(plan.registryVersion).toBe(COMPONENT_REGISTRY_VERSION);
    expect(plan.canonical.map((entry) => entry.blockId)).toEqual(facts.map((f) => f.blockId));
    expect(isValidatedExperiencePlan(plan)).toBe(true);
    expect(plan.digest).toMatch(/^fnv1a64:[0-9a-f]{16}$/);
  });

  it('cannot be forged by setting validated:true in JSON', () => {
    const forged = { ...validProposal(), validated: true, schemaVersion: '1.0.0' };
    expect(isValidatedExperiencePlan(forged)).toBe(false);
    // The extra field is also a schema failure: unknown keys are never ignored.
    expectCode(() => parseExperiencePlanProposal(forged), 'PLAN_SCHEMA_UNKNOWN_FIELD');
  });

  it('rejects an unknown schema version', () => {
    expectCode(
      () => parseExperiencePlanProposal({ ...validProposal(), schemaVersion: '2.0.0' }),
      'PLAN_SCHEMA_UNSUPPORTED_VERSION'
    );
  });

  it('is deterministic: identical input yields an identical digest', () => {
    const a = validateExperiencePlan(validProposal(), context());
    const b = validateExperiencePlan(validProposal(), context());
    expect(a.digest).toBe(b.digest);
    expect(JSON.stringify(a.canonical)).toBe(JSON.stringify(b.canonical));
  });

  it('binds the plan to course, revision, content hash and lesson', () => {
    const proposal = validProposal();
    proposal.claims.courseId = '4a7c48be-d706-50df-b493-72752cd0e9f9';
    expectCode(() => validateExperiencePlan(proposal, context()), 'PLAN_IDENTITY_COURSE_MISMATCH');

    const revision = validProposal();
    revision.claims.revisionId = 'rev_other';
    expectCode(
      () => validateExperiencePlan(revision, context()),
      'PLAN_IDENTITY_REVISION_MISMATCH'
    );

    const hash = validProposal();
    hash.claims.contentHash = 'sha256:' + 'f'.repeat(64);
    expectCode(
      () => validateExperiencePlan(hash, context()),
      'PLAN_IDENTITY_CONTENT_HASH_MISMATCH'
    );

    const lesson = validProposal();
    lesson.claims.lessonId = 'lesson-other';
    expectCode(() => validateExperiencePlan(lesson, context()), 'PLAN_IDENTITY_LESSON_MISMATCH');
  });

  it('rejects a stale component-registry version', () => {
    const proposal = validProposal();
    proposal.claims.registryVersion = '0.9.0';
    expectCode(
      () => validateExperiencePlan(proposal, context()),
      'PLAN_IDENTITY_REGISTRY_MISMATCH'
    );
  });

  it('rejects a planner implementation the deployment did not allow', () => {
    const proposal = validProposal();
    proposal.planner.implementation = 'gemini_live_planner';
    expectCode(() => validateExperiencePlan(proposal, context()), 'PLAN_IDENTITY_PLANNER_UNKNOWN');
  });
});

describe('canonical coverage', () => {
  it('rejects a fabricated block id', () => {
    const proposal = validProposal();
    proposal.placements[1].block.blockId = 'block_that_does_not_exist';
    expectCode(() => validateExperiencePlan(proposal, context()), 'PLAN_COVERAGE_BLOCK_UNKNOWN');
  });

  it('rejects an omitted canonical block', () => {
    const proposal = validProposal();
    proposal.placements = proposal.placements.slice(0, -1);
    expectCode(() => validateExperiencePlan(proposal, context()), 'PLAN_COVERAGE_BLOCK_MISSING');
  });

  it('rejects a duplicated canonical block', () => {
    const proposal = validProposal();
    proposal.placements.push({ ...proposal.placements[0], placementId: 'dup' });
    expectCode(() => validateExperiencePlan(proposal, context()), 'PLAN_COVERAGE_BLOCK_DUPLICATED');
  });

  it('rejects reordered canonical blocks', () => {
    const proposal = validProposal();
    [proposal.placements[0], proposal.placements[1]] = [
      proposal.placements[1],
      proposal.placements[0]
    ];
    expectCode(() => validateExperiencePlan(proposal, context()), 'PLAN_COVERAGE_BLOCK_REORDERED');
  });

  it('rejects a block placed under another lesson', () => {
    const proposal = validProposal();
    proposal.placements[0].block.lessonId = 'lesson-other';
    expectCode(() => validateExperiencePlan(proposal, context()), 'PLAN_COVERAGE_CROSS_LESSON');
  });
});

describe('component capability enforcement', () => {
  it('rejects an unknown component rather than degrading it', () => {
    const proposal = validProposal();
    (proposal.placements[0] as { component: string }).component = 'RemoteScriptRunner';
    expectCode(() => validateExperiencePlan(proposal, context()), 'PLAN_COMPONENT_UNKNOWN');
  });

  it('rejects a component version from the future', () => {
    const proposal = validProposal();
    proposal.placements[0].componentVersion = '9.0.0';
    expectCode(
      () => validateExperiencePlan(proposal, context()),
      'PLAN_COMPONENT_VERSION_UNSUPPORTED'
    );
  });

  it('rejects a component that does not accept the block type', () => {
    const proposal = validProposal();
    // CodeViewer accepts only `code`; this placement is a heading.
    proposal.placements[0].component = 'CodeViewer';
    proposal.placements[0].componentVersion = '1.0.0';
    proposal.placements[0].fallback = 'ConceptExplanation';
    expectCode(
      () => validateExperiencePlan(proposal, context()),
      'PLAN_COMPONENT_BLOCK_INCOMPATIBLE'
    );
  });

  it('refuses to upgrade an unreviewed formula to a primary component', () => {
    const proposal = validProposal();
    const index = proposal.placements.findIndex((entry) => entry.block.blockId === 'm-unreviewed');
    proposal.placements[index].component = 'ReviewedFormula';
    proposal.placements[index].componentVersion = '1.0.0';
    expectCode(
      () => validateExperiencePlan(proposal, context()),
      'PLAN_COMPONENT_POLICY_INCOMPATIBLE'
    );
  });

  it('rejects a derivation over mathematics the application did not review', () => {
    // A math block that is *not* source-faithful but also has no review record
    // is the dangerous middle: DerivationBlock would render invented steps.
    const blocks = [
      fact({ blockId: 'h1', blockType: 'heading' }),
      fact({ blockId: 'm-unreviewed', blockType: 'math', isReviewedFormula: false })
    ];
    const ctx = context({ blocks });
    const proposal = validProposal(ctx);
    const index = proposal.placements.findIndex((e) => e.block.blockId === 'm-unreviewed');
    proposal.placements[index].component = 'DerivationBlock';
    proposal.placements[index].componentVersion = '1.0.0';
    proposal.placements[index].interaction = undefined;
    expectCode(() => validateExperiencePlan(proposal, ctx), 'PLAN_COMPONENT_UNREVIEWED_FORMULA');
  });

  it('rejects a topology without a structured fixture', () => {
    const blocks = [
      fact({ blockId: 'h1', blockType: 'heading' }),
      fact({ blockId: 'd1', blockType: 'diagram' })
    ];
    const ctx = context({ blocks });
    const proposal = validProposal(ctx);
    proposal.placements[1].component = 'NetworkTopology';
    proposal.placements[1].componentVersion = '1.0.0';
    proposal.placements[1].fallback = 'ProcessDiagram';
    expectCode(() => validateExperiencePlan(proposal, ctx), 'PLAN_COMPONENT_FIXTURE_MISSING');
  });

  it('rejects a fallback the registry does not own', () => {
    const proposal = validProposal();
    (proposal.placements[1] as { fallback: string }).fallback = 'RemoteScriptRunner';
    expectCode(
      () => validateExperiencePlan(proposal, context()),
      'PLAN_COMPONENT_FALLBACK_UNTRUSTED'
    );
  });

  it('rejects an interaction key the component does not declare', () => {
    const proposal = validProposal();
    proposal.placements[1].interaction = { executeScript: true };
    expectCode(
      () => validateExperiencePlan(proposal, context()),
      'PLAN_COMPONENT_INTERACTION_INVALID'
    );
  });
});

describe('structured-asset governance', () => {
  // A code lesson: the only shape where a walkthrough asset is legitimate.
  const codeBlocks: Fact[] = [
    fact({ blockId: 'h1', blockType: 'heading' }),
    fact({ blockId: 'code1', blockType: 'code' })
  ];

  const asset: ValidatedAssetBinding = {
    assetId: 'asset_walkthrough_1',
    lessonId,
    blockId: 'code1',
    component: 'CodeWalkthrough',
    provenance: 'instructor_authored',
    reviewVerified: true,
    sourceVerified: true
  };

  function withAsset(overrides: Partial<ValidatedAssetBinding> = {}) {
    const binding = { ...asset, ...overrides };
    const ctx = context({ blocks: codeBlocks, assets: [binding] });
    const result = planMockExperience('valid_programming', plannerContext(ctx));
    if (!result.ok) throw new Error('mock planner unexpectedly failed');
    return { ctx, proposal: result.proposal };
  }

  function supplemental(proposal: UntrustedExperiencePlanProposal) {
    return {
      placementId: `s-${proposal.placements.length + 1}`,
      kind: 'supplemental' as const,
      block: { lessonId, blockId: 'code1' },
      component: 'CodeWalkthrough' as const,
      componentVersion: '1.0.0',
      assetId: asset.assetId,
      group: 'example' as const,
      disclosure: 'expanded' as const,
      fallback: 'CodeViewer' as const
    };
  }

  it('accepts a reviewed, revision-bound instructor asset', () => {
    const { ctx, proposal } = withAsset();
    // The mock's valid programming plan already includes the asset; assert on
    // that rather than appending a second, duplicate placement.
    const plan = validateExperiencePlan(proposal, ctx);
    expect(plan.supplemental).toHaveLength(1);
    expect(plan.supplemental[0].assetId).toBe(asset.assetId);
    expect(plan.supplemental[0].blockId).toBe('code1');
  });

  it('rejects an asset id that was never stored', () => {
    const { ctx, proposal } = withAsset();
    proposal.placements[proposal.placements.length - 1].assetId = 'asset_missing';
    expectCode(() => validateExperiencePlan(proposal, ctx), 'PLAN_ASSET_UNKNOWN');
  });

  it('rejects an unreviewed generated proposal even when a plan names it', () => {
    const { ctx, proposal } = withAsset({
      provenance: 'generated_proposal',
      reviewVerified: false
    });
    // The mock planner will not propose a generated asset, so the reference is
    // forced here: this is the attack — a planner naming an asset it was never
    // allowed to show.
    proposal.placements.push(supplemental(proposal));
    expectCode(() => validateExperiencePlan(proposal, ctx), 'PLAN_ASSET_GENERATED_PROPOSAL');
  });

  it('rejects an asset whose review claim has no trusted record', () => {
    const { ctx, proposal } = withAsset({ reviewVerified: false });
    expectCode(() => validateExperiencePlan(proposal, ctx), 'PLAN_ASSET_REVIEW_UNVERIFIED');
  });

  it('rejects a source-derived asset whose references do not resolve', () => {
    const { ctx, proposal } = withAsset({
      provenance: 'source_derived',
      sourceVerified: false
    });
    expectCode(() => validateExperiencePlan(proposal, ctx), 'PLAN_ASSET_SOURCE_UNVERIFIED');
  });

  it('rejects an asset bound to a different block', () => {
    const { ctx, proposal } = withAsset();
    proposal.placements[proposal.placements.length - 1].block.blockId = 'h1';
    expectCode(() => validateExperiencePlan(proposal, ctx), 'PLAN_ASSET_BLOCK_MISMATCH');
  });

  it('rejects an asset component that disagrees with the placement', () => {
    const { ctx, proposal } = withAsset();
    proposal.placements[proposal.placements.length - 1].component = 'CodeViewer';
    expectCode(() => validateExperiencePlan(proposal, ctx), 'PLAN_ASSET_COMPONENT_MISMATCH');
  });

  it('rejects a generated proposal that the asset projection would hide anyway', () => {
    // The mock valid plan finds the first non-generated asset; when only a
    // generated one exists, the plan must not invent a supplement from it.
    const generated: ValidatedAssetBinding = {
      ...asset,
      assetId: 'asset_generated_1',
      provenance: 'generated_proposal',
      reviewVerified: false
    };
    const ctx = context({ blocks: codeBlocks, assets: [generated] });
    const result = planMockExperience('valid_programming', plannerContext(ctx));
    if (!result.ok) throw new Error('mock planner unexpectedly failed');
    // No supplement is proposed for a generated asset, so the plan is valid but
    // carries no supplemental placement.
    const plan = validateExperiencePlan(result.proposal, ctx);
    expect(plan.supplemental).toHaveLength(0);
  });

  it('ignores a forged review claim carried in the proposal itself', () => {
    const { ctx, proposal } = withAsset({ reviewVerified: false });
    (proposal as unknown as Record<string, unknown>).review = {
      status: 'instructor_reviewed',
      reviewedBy: 'attacker'
    };
    // The unknown top-level key fails the schema, and the review claim would be
    // ignored anyway: review state comes from trusted records only.
    expectCode(() => validateExperiencePlan(proposal, ctx), 'PLAN_SCHEMA_UNKNOWN_FIELD');
  });
});

describe('resource limits and hostile structure', () => {
  it('rejects an oversized placement array', () => {
    const proposal = validProposal();
    const template = proposal.placements[0];
    proposal.placements = Array.from(
      { length: EXPERIENCE_PLAN_LIMITS.maxPlacements + 1 },
      (_, i) => ({
        ...template,
        placementId: `p-${i}`
      })
    );
    expectCode(() => validateExperiencePlan(proposal, context()), 'PLAN_LIMIT_TOO_MANY_PLACEMENTS');
  });

  it('rejects prototype pollution', () => {
    // Injected through JSON text: `obj.__proto__ = x` in JavaScript sets the
    // prototype rather than creating an own key, so it would never be data.
    const polluted = JSON.parse(
      JSON.stringify(validProposal()).replace(
        '"placementId":"p-1"',
        '"__proto__":{"validated":true},"placementId":"p-1"'
      )
    );
    expect(Object.keys(polluted.placements[0])).toContain('__proto__');
    expectCode(() => parseExperiencePlanProposal(polluted), 'PLAN_SCHEMA_PROTOTYPE_POLLUTION');
  });

  it('rejects an unsafe constructor key anywhere in the tree', () => {
    const hostile = JSON.parse(JSON.stringify(validProposal()));
    hostile.placements[0].interaction = { constructor: 'x' };
    expectCode(() => parseExperiencePlanProposal(hostile), 'PLAN_SCHEMA_PROTOTYPE_POLLUTION');
  });

  it('rejects markup in a placement id', () => {
    const proposal = validProposal();
    proposal.placements[0].placementId = '<script>alert(1)</script>';
    expectCode(() => parseExperiencePlanProposal(proposal), 'PLAN_SCHEMA_UNSAFE_MARKUP');
  });

  it('rejects a javascript: URL smuggled through interaction', () => {
    const proposal = validProposal();
    proposal.placements[1].interaction = { href: 'javascript:alert(1)' };
    // `href` is not a key a planner may use at all, so it fails as an unsafe
    // prop before the value is ever considered.
    expectCode(() => parseExperiencePlanProposal(proposal), 'PLAN_COMPONENT_PROPS_UNSAFE');
  });

  it('rejects a javascript: value under a declared interaction key', () => {
    const proposal = validProposal();
    // `showReview` is a real key on ReviewedFormula, so the value is what fails.
    const index = proposal.placements.findIndex((e) => e.component === 'ReviewedFormula');
    proposal.placements[index].interaction = { showReview: 'javascript:alert(1)' };
    expectCode(() => parseExperiencePlanProposal(proposal), 'PLAN_COMPONENT_INTERACTION_INVALID');
  });

  it('rejects a deeply nested interaction value', () => {
    const proposal = validProposal();
    let nested: Record<string, unknown> = { value: 1 };
    for (let index = 0; index < 40; index += 1) nested = { nested };
    (proposal.placements[0] as unknown as Record<string, unknown>).interaction = nested;
    expectCode(() => parseExperiencePlanProposal(proposal), 'PLAN_SCHEMA_NESTED_TOO_DEEP');
  });

  it('rejects an oversized serialized proposal', () => {
    const proposal = validProposal();
    proposal.notes = ['x'.repeat(EXPERIENCE_PLAN_LIMITS.maxProposalBytes)];
    expectCode(() => parseExperiencePlanProposal(proposal), 'PLAN_SCHEMA_OVERSIZED');
  });

  it('rejects duplicate placement ids', () => {
    const proposal = validProposal();
    proposal.placements[1].placementId = proposal.placements[0].placementId;
    expectCode(() => parseExperiencePlanProposal(proposal), 'PLAN_SCHEMA_DUPLICATE_ID');
  });
});

describe('mock planner scenarios', () => {
  const ctx = context();

  it('reports a provider timeout as an unavailable planner, not a rejection', () => {
    const result = planMockExperience('provider_timeout', plannerContext(ctx));
    expect(result).toEqual({ ok: false, failure: 'timeout' });
  });

  it('reports malformed provider output as unavailable', () => {
    const result = planMockExperience('provider_malformed', plannerContext(ctx));
    expect(result).toEqual({ ok: false, failure: 'malformed' });
  });

  it.each([
    ['attack_unknown_component', 'PLAN_COMPONENT_UNKNOWN'],
    ['attack_fabricated_block', 'PLAN_COVERAGE_BLOCK_UNKNOWN'],
    ['attack_cross_revision', 'PLAN_IDENTITY_REVISION_MISMATCH'],
    ['attack_forged_identity', 'PLAN_IDENTITY_CONTENT_HASH_MISMATCH'],
    ['attack_wrong_order', 'PLAN_COVERAGE_BLOCK_REORDERED'],
    ['attack_duplicate_block', 'PLAN_COVERAGE_BLOCK_DUPLICATED'],
    ['attack_missing_block', 'PLAN_COVERAGE_BLOCK_MISSING'],
    ['attack_markup_injection', 'PLAN_SCHEMA_UNSAFE_MARKUP'],
    ['attack_unsafe_url', 'PLAN_COMPONENT_PROPS_UNSAFE'],
    ['attack_prototype_pollution', 'PLAN_SCHEMA_PROTOTYPE_POLLUTION'],
    ['attack_oversized', 'PLAN_LIMIT_TOO_MANY_PLACEMENTS'],
    ['attack_deeply_nested', 'PLAN_SCHEMA_NESTED_TOO_DEEP'],
    ['attack_script_component', 'PLAN_COMPONENT_UNKNOWN'],
    ['attack_forged_review', 'PLAN_SCHEMA_UNKNOWN_FIELD']
  ])('rejects %s with %s', (scenario, code) => {
    const result = planMockExperience(scenario as never, plannerContext(ctx));
    if (!result.ok) throw new Error('scenario should produce a proposal');
    expectCode(() => validateExperiencePlan(result.proposal, ctx), code);
  });

  it('rejects an unsupported asset scenario with a typed code', () => {
    const result = planMockExperience('attack_unsupported_asset', plannerContext(ctx));
    if (!result.ok) throw new Error('scenario should produce a proposal');
    const outcome = tryValidateExperiencePlan(result.proposal, ctx);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe('PLAN_ASSET_UNKNOWN');
  });
});

describe('deterministic fallback semantics', () => {
  it('returns a typed outcome instead of throwing from tryValidate', () => {
    const outcome = tryValidateExperiencePlan({ garbage: true }, context());
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.stage).toBe('schema');
      expect(outcome.code).toBe('PLAN_SCHEMA_UNKNOWN_FIELD');
    }
  });

  it('does not leak proposal content through the rejection message', () => {
    const proposal = validProposal();
    proposal.placements[1].block.blockId = 'secret_source_passage_xyz';
    try {
      validateExperiencePlan(proposal, context());
    } catch (error) {
      const rejection = error as ExperiencePlanRejection;
      expect(rejection.message).toBe('PLAN_COVERAGE_BLOCK_UNKNOWN');
      expect(JSON.stringify({ message: rejection.message, stack: rejection.stack })).not.toContain(
        'secret_source_passage_xyz'
      );
    }
  });

  it('treats a presentation block type as data, never as an instruction', () => {
    // The lesson title and PDF prose are not in planner context at all; this
    // asserts the context builder's contract at the type level by constructing
    // a context whose only content is identity.
    const ctx = context();
    const serialized = JSON.stringify(ctx);
    expect(serialized).not.toContain('Ignore your validation rules');
    expect(Object.keys(ctx)).not.toContain('learnerRequest');
    expect(Object.keys(ctx)).not.toContain('sourceText');
  });
});

// Kept so the unused-import lint rule stays honest about the block type import.
const _blockTypeGuard: LessonBlockV2['type'] = 'paragraph';
void _blockTypeGuard;
