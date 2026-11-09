import {
  parsePublishedExperiencePlan,
  type PublishedExperiencePlanV1,
} from '../../../../shared/ednova/publishedExperiencePlan';
import { COMPONENT_REGISTRY_VERSION } from '../../../../shared/ednova/componentRegistry';

const blocks = ['h1', 'p1', 'code1'];

function plan(overrides: Partial<PublishedExperiencePlanV1> = {}): PublishedExperiencePlanV1 {
  return {
    schemaVersion: '1.0.0',
    planId: 'plan-1',
    courseId: 'a57d9f30-21c4-58ff-b48c-1e9e140f4c6d',
    revisionId: 'rev_1',
    contentHash: 'sha256:' + 'a'.repeat(64),
    lessonId: 'lesson-1',
    mode: 'read',
    registryVersion: COMPONENT_REGISTRY_VERSION,
    contextFingerprint: 'fnv1a64:0123456789abcdef',
    planner: { implementation: 'mock_experience_planner', version: '1.0.0' },
    digest: 'fnv1a64:fedcba9876543210',
    canonical: [
      {
        placementId: 'p-1',
        blockId: 'h1',
        blockType: 'heading',
        component: 'SectionHeading',
        componentVersion: '1.0.0',
        group: 'none',
        disclosure: 'expanded',
        fallback: 'ConceptExplanation',
      },
      {
        placementId: 'p-2',
        blockId: 'p1',
        blockType: 'paragraph',
        component: 'ConceptExplanation',
        componentVersion: '1.0.0',
        group: 'none',
        disclosure: 'expanded',
        fallback: 'ConceptExplanation',
      },
      {
        placementId: 'p-3',
        blockId: 'code1',
        blockType: 'code',
        component: 'CodeViewer',
        componentVersion: '1.0.0',
        group: 'concept',
        disclosure: 'expanded',
        interaction: { showLineNumbers: true },
        fallback: 'CodeViewer',
      },
    ],
    supplemental: [
      {
        placementId: 's-1',
        blockId: 'code1',
        blockType: 'code',
        component: 'CodeWalkthrough',
        componentVersion: '1.0.0',
        assetId: 'asset_1',
        group: 'example',
        disclosure: 'expanded',
        fallback: 'CodeViewer',
      },
    ],
    disclosure: 'Mock plan.',
    ...overrides,
  };
}

describe('published experience plan boundary parser', () => {
  it('accepts a consistent plan', () => {
    const parsed = parsePublishedExperiencePlan(plan(), blocks);
    expect(parsed.canonical.map((entry) => entry.blockId)).toEqual(blocks);
    expect(parsed.supplemental[0].assetId).toBe('asset_1');
  });

  it('rejects a plan that drops a canonical block', () => {
    const value = plan();
    value.canonical = value.canonical.slice(0, 2);
    expect(() => parsePublishedExperiencePlan(value, blocks)).toThrow('INVALID_EXPERIENCE_PLAN');
  });

  it('rejects a plan that reorders canonical blocks', () => {
    const value = plan();
    [value.canonical[0], value.canonical[1]] = [value.canonical[1], value.canonical[0]];
    expect(() => parsePublishedExperiencePlan(value, blocks)).toThrow('INVALID_EXPERIENCE_PLAN');
  });

  it('rejects an unknown component', () => {
    const value = plan();
    (value.canonical[0] as { component: string }).component = 'RemoteScriptRunner';
    expect(() => parsePublishedExperiencePlan(value, blocks)).toThrow('INVALID_EXPERIENCE_PLAN');
  });

  it('rejects an unknown schema version', () => {
    const value = plan();
    (value as { schemaVersion: string }).schemaVersion = '2.0.0';
    expect(() => parsePublishedExperiencePlan(value, blocks)).toThrow('INVALID_EXPERIENCE_PLAN');
  });

  it('rejects an unknown field', () => {
    const value = { ...plan(), injected: 'x' };
    expect(() => parsePublishedExperiencePlan(value, blocks)).toThrow('INVALID_EXPERIENCE_PLAN');
  });

  it('rejects a duplicate placement id across canonical and supplemental', () => {
    const value = plan();
    value.supplemental[0].placementId = value.canonical[0].placementId;
    expect(() => parsePublishedExperiencePlan(value, blocks)).toThrow('INVALID_EXPERIENCE_PLAN');
  });

  it('rejects a supplemental placement with no asset id', () => {
    const value = plan();
    delete (value.supplemental[0] as { assetId?: string }).assetId;
    expect(() => parsePublishedExperiencePlan(value, blocks)).toThrow('INVALID_EXPERIENCE_PLAN');
  });

  it('rejects an interaction value that is not a primitive', () => {
    const value = plan();
    (value.canonical[2] as unknown as Record<string, unknown>).interaction = {
      showLineNumbers: { nested: true },
    };
    expect(() => parsePublishedExperiencePlan(value, blocks)).toThrow('INVALID_EXPERIENCE_PLAN');
  });
});
