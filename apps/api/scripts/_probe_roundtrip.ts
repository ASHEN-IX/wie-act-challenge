import {
  parseExperiencePlanProposal,
  experienceContextFingerprint,
  type ExperiencePlanValidationContext,
} from '../shared/ednova/experiencePlan';
import { validateExperiencePlan } from '../shared/ednova/experiencePlanValidator';
import { projectExperiencePlan } from '../modules/study/src/services/experiencePlanning';
import { COMPONENT_REGISTRY_VERSION } from '../shared/ednova/componentRegistry';

const courseId = '0123456789abcdef01234567';
const ctx = {
  courseId, revisionId: 'rev_x', contentHash: 'sha256:' + 'b'.repeat(64), lessonId: 'lesson-1', mode: 'guided',
  contextFingerprint: experienceContextFingerprint({ courseId, revisionId: 'rev_x', contentHash: 'sha256:'+'b'.repeat(64), lessonId: 'lesson-1', mode: 'guided', blockIds: ['h1'] }),
  allowedPlanners: [{ implementation: 'mock_experience_planner', version: '1.0.0' }],
  blocks: [{ blockId: 'h1', blockType: 'heading', render: 'primary', hasEvidence: true, hasSourceRegion: false, isReviewedFormula: false, hasStructuredFixture: false }],
  assets: [],
} as ExperiencePlanValidationContext;

const proposal = {
  schemaVersion: '1.0.0', planId: 'p',
  claims: { courseId: ctx.courseId, revisionId: ctx.revisionId, contentHash: ctx.contentHash, lessonId: ctx.lessonId, mode: ctx.mode,
    registryVersion: COMPONENT_REGISTRY_VERSION, presentationSchemaVersion: '1.0.0', contextFingerprint: ctx.contextFingerprint },
  planner: { implementation: 'mock_experience_planner', version: '1.0.0' },
  placements: [{ placementId: 'p-1', kind: 'canonical', block: { lessonId: 'lesson-1', blockId: 'h1' }, component: 'SectionHeading',
    componentVersion: '1.0.0', group: 'none', disclosure: 'expanded', fallback: 'ConceptExplanation' }],
  notes: [],
};

const plan = validateExperiencePlan(proposal as never, ctx);
const projected = projectExperiencePlan(plan);
console.log('projected keys:', Object.keys(projected).sort().join(','));
try {
  parseExperiencePlanProposal(projected);
  console.log('ROUNDTRIP: OK');
} catch (e) {
  console.log('ROUNDTRIP: FAIL ->', (e as Error).message);
}
