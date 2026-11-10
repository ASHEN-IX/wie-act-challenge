/** Batch 4 M4.1 performance measurement.
 *
 * Measures the bounded work this milestone adds: context construction, schema
 * parsing, capability resolution, validation, and worst-case malformed input.
 * No model, no network, no database.
 */
import { performance } from 'node:perf_hooks';
import {
  experienceContextFingerprint,
  parseExperiencePlanProposal,
  type ExperiencePlanValidationContext
} from '../shared/ednova/experiencePlan';
import { validateExperiencePlan } from '../shared/ednova/experiencePlanValidator';
import {
  planMockExperience,
  type MockPlannerContext
} from '../shared/ednova/mockExperiencePlanner';

const courseId = 'a57d9f30-21c4-58ff-b48c-1e9e140f4c6d';
const revisionId = 'rev_perf';
const contentHash = 'sha256:' + 'a'.repeat(64);

function build(blockCount: number): ExperiencePlanValidationContext {
  const blocks = Array.from({ length: blockCount }, (_, index) => {
    const kind = index % 3 === 0 ? 'paragraph' : index % 3 === 1 ? 'heading' : 'math';
    // A math block is either reviewed (primary) or unreviewed (source-faithful
    // with a region). A primary unreviewed formula is not a legal context.
    return {
      blockId: `b-${index}`,
      blockType: kind as never,
      render: (kind === 'math' ? 'source_faithful' : 'primary') as 'primary' | 'source_faithful',
      hasEvidence: true,
      hasSourceRegion: kind === 'math',
      isReviewedFormula: false,
      hasStructuredFixture: false
    };
  });
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
      blockIds: blocks.map((block) => block.blockId)
    }),
    allowedPlanners: [{ implementation: 'mock_experience_planner', version: '1.0.0' }],
    blocks,
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

function time(label: string, iterations: number, run: () => void) {
  for (let index = 0; index < Math.min(iterations, 50); index += 1) run();
  const samples: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now();
    run();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const mean = samples.reduce((total, value) => total + value, 0) / samples.length;
  console.log(
    `${label.padEnd(46)} n=${String(iterations).padStart(4)}  ` +
      `mean=${mean.toFixed(3)}ms  p50=${samples[Math.floor(iterations * 0.5)].toFixed(3)}ms  ` +
      `p95=${samples[Math.floor(iterations * 0.95)].toFixed(3)}ms  ` +
      `max=${samples[samples.length - 1].toFixed(3)}ms`
  );
}

for (const blockCount of [20, 100, 400]) {
  const ctx = build(blockCount);
  const result = planMockExperience('valid_mathematics', plannerContext(ctx));
  if (!result.ok) throw new Error('planner failed');
  const proposal = result.proposal;

  console.log(`\n--- ${blockCount} canonical blocks ---`);
  time('context fingerprint', 200, () =>
    experienceContextFingerprint({
      courseId,
      revisionId,
      contentHash,
      lessonId: 'lesson-1',
      mode: 'read',
      blockIds: ctx.blocks.map((block) => block.blockId)
    })
  );
  time('schema parse only', 200, () => parseExperiencePlanProposal(proposal));
  time('full validation', 200, () => validateExperiencePlan(proposal, ctx));

  const bytes = JSON.stringify(proposal).length;
  console.log(`proposal size                            ${bytes} bytes`);

  const missing = {
    ...proposal,
    placements: proposal.placements.slice(0, -1)
  };
  time('worst-case rejection (missing block)', 200, () => {
    try {
      validateExperiencePlan(missing, ctx);
    } catch {
      /* expected */
    }
  });

  const oversized = {
    ...proposal,
    placements: Array.from({ length: 400 }, (_, index) => ({
      ...proposal.placements[0],
      placementId: `p-${index}`
    }))
  };
  time('worst-case rejection (oversized)', 200, () => {
    try {
      validateExperiencePlan(oversized, ctx);
    } catch {
      /* expected */
    }
  });
}

console.log('\n--- bounds ---');
const limits = require('../shared/ednova/experiencePlan').EXPERIENCE_PLAN_LIMITS;
console.log(JSON.stringify(limits, null, 2));
