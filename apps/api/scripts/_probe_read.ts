import mongoose from 'mongoose';
import { ExperiencePlanRecord } from '../modules/study/src/models/ExperiencePlanRecord';
import { loadAcceptedPlan, storeAcceptedPlan } from '../modules/study/src/services/experiencePlanStore';
import { experienceContextFingerprint, type ExperiencePlanValidationContext } from '../shared/ednova/experiencePlan';
import { validateExperiencePlan } from '../shared/ednova/experiencePlanValidator';
import { COMPONENT_REGISTRY_VERSION } from '../shared/ednova/componentRegistry';

const URI = process.env.M48_MONGO || 'mongodb://127.0.0.1:27017';
const DB = `test_probe_read_${process.pid}`;
const courseId = '0123456789abcdef01234567';

function ctx(): ExperiencePlanValidationContext {
  return {
    courseId, revisionId: 'rev_p', contentHash: 'sha256:' + 'b'.repeat(64), lessonId: 'lesson-1', mode: 'guided',
    contextFingerprint: experienceContextFingerprint({ courseId, revisionId: 'rev_p', contentHash: 'sha256:'+'b'.repeat(64), lessonId: 'lesson-1', mode: 'guided', blockIds: ['h1'] }),
    allowedPlanners: [{ implementation: 'mock_experience_planner', version: '1.0.0' }],
    blocks: [{ blockId: 'h1', blockType: 'heading', render: 'primary', hasEvidence: true, hasSourceRegion: false, isReviewedFormula: false, hasStructuredFixture: false }],
    assets: [],
  } as unknown as ExperiencePlanValidationContext;
}

async function main() {
  await mongoose.connect(URI + '/' + DB);
  const c = ctx();
  const proposal = {
    schemaVersion: '1.0.0', planId: 'p',
    claims: { courseId: c.courseId, revisionId: c.revisionId, contentHash: c.contentHash, lessonId: c.lessonId, mode: c.mode,
      registryVersion: COMPONENT_REGISTRY_VERSION, presentationSchemaVersion: '1.0.0', contextFingerprint: c.contextFingerprint },
    planner: { implementation: 'mock_experience_planner', version: '1.0.0' },
    placements: [{ placementId: 'p-1', kind: 'canonical', block: { lessonId: 'lesson-1', blockId: 'h1' }, component: 'SectionHeading',
      componentVersion: '1.0.0', group: 'none', disclosure: 'expanded', fallback: 'ConceptExplanation' }],
    notes: [],
  };
  const plan = validateExperiencePlan(proposal as never, c);
  const stored = await storeAcceptedPlan({ plan, generatedBy: 'a', contextFingerprint: c.contextFingerprint, mode: 'guided' });
  console.log('stored:', JSON.stringify(stored));

  const read = await loadAcceptedPlan({
    courseId: c.courseId, revisionId: c.revisionId, lessonId: c.lessonId, mode: 'guided',
    contentHash: c.contentHash, contextFingerprint: c.contextFingerprint, validationContext: c,
  });
  console.log('loadAcceptedPlan ->', read.status, (read as {code?:string}).code ?? (read as {reason?:string}).reason ?? '');
  const rec = await ExperiencePlanRecord.findOne({ courseId }).lean();
  // eslint-disable-next-line no-console
  console.log('stored plan keys:', Object.keys((rec as never as {plan: object}).plan).sort().join(','));
  // eslint-disable-next-line no-console
  console.log('stored canonical[0]:', JSON.stringify((rec as never as {plan: {canonical: object[]}}).plan.canonical[0]));
  const records = await ExperiencePlanRecord.countDocuments({ courseId });
  console.log('records in db:', records);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
void main().catch((e) => { console.error(e); process.exitCode = 1; });
