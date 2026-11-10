import { parsePublishedExperiencePlan } from '../shared/ednova/publishedExperiencePlan';
import { projectExperiencePlan } from '../modules/study/src/services/experiencePlanning';
import { validateExperiencePlan } from '../shared/ednova/experiencePlanValidator';
import { experienceContextFingerprint } from '../shared/ednova/experiencePlan';
import { COMPONENT_REGISTRY_VERSION } from '../shared/ednova/componentRegistry';

const courseId = 'a57d9f30-21c4-58ff-b48c-1e9e140f4c6d';
const fp = experienceContextFingerprint({
  courseId,
  revisionId: 'r',
  contentHash: 'sha256:' + 'b'.repeat(64),
  lessonId: 'l',
  mode: 'guided',
  blockIds: ['h1']
});
const ctx = {
  courseId,
  revisionId: 'r',
  contentHash: 'sha256:' + 'b'.repeat(64),
  lessonId: 'l',
  mode: 'guided',
  contextFingerprint: fp,
  allowedPlanners: [{ implementation: 'mock_experience_planner', version: '1.0.0' }],
  blocks: [
    {
      blockId: 'h1',
      blockType: 'heading',
      render: 'primary',
      hasEvidence: true,
      hasSourceRegion: false,
      isReviewedFormula: false,
      hasStructuredFixture: false
    }
  ],
  assets: []
} as never;

const proposal = {
  schemaVersion: '1.0.0',
  planId: 'p',
  claims: {
    courseId,
    revisionId: 'r',
    contentHash: 'sha256:' + 'b'.repeat(64),
    lessonId: 'l',
    mode: 'guided',
    registryVersion: COMPONENT_REGISTRY_VERSION,
    presentationSchemaVersion: '1.0.0',
    contextFingerprint: fp
  },
  planner: { implementation: 'mock_experience_planner', version: '1.0.0' },
  placements: [
    {
      placementId: 'p-1',
      kind: 'canonical',
      block: { lessonId: 'l', blockId: 'h1' },
      component: 'SectionHeading',
      componentVersion: '1.0.0',
      group: 'none',
      disclosure: 'expanded',
      fallback: 'ConceptExplanation'
    }
  ],
  notes: []
};

const plan = validateExperiencePlan(proposal as never, ctx);
const projected = projectExperiencePlan(plan);
console.log('keys:', Object.keys(projected).sort().join(','));
console.log(
  'canonical[0] keys:',
  Object.keys((projected as never as { canonical: object[] }).canonical[0])
    .sort()
    .join(',')
);
console.log(
  'disclosure:',
  JSON.stringify((projected as never as { disclosure: unknown }).disclosure)
);
try {
  parsePublishedExperiencePlan(projected, ['h1']);
  console.log('PARSE: OK');
} catch (e) {
  console.log('PARSE FAIL:', (e as Error).message);
}
