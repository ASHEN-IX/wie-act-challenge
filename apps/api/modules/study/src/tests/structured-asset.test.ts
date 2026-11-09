import {
  ASSET_LIMITS,
  StructuredAssetError,
  parseStructuredAsset,
  projectStructuredAsset,
  projectStructuredAssets,
  type StructuredAssetV1,
} from '../../../../shared/ednova/structuredAsset';
import { COMPONENT_REGISTRY_VERSION } from '../../../../shared/ednova/componentRegistry';

const courseId = 'a57d9f30-21c4-58ff-b48c-1e9e140f4c6d';
const revisionId = 'rev_asset_test';

function walkthrough(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: '1.0.0',
    assetId: 'asset_walkthrough_1',
    courseId,
    revisionId,
    blockId: 'code-1',
    lessonId: 'lesson-1',
    registryVersion: COMPONENT_REGISTRY_VERSION,
    component: 'CodeWalkthrough',
    payload: {
      component: 'CodeWalkthrough',
      language: 'python',
      code: 'def f(x):\n    return x + 1',
      annotations: [
        { line: 0, explanation: 'Declares f.' },
        { line: 1, explanation: 'Returns the increment.' },
      ],
    },
    provenance: 'instructor_authored',
    review: { status: 'instructor_reviewed', reviewedBy: 'teacher', reviewedAt: '2026-11-01T10:00:00Z' },
    audience: 'course',
    fallback: 'CodeViewer',
    disclosure: 'Instructor-authored walkthrough.',
    ...overrides,
  };
}

function topology(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: '1.0.0',
    assetId: 'asset_topology_1',
    courseId,
    revisionId,
    lessonId: 'lesson-2',
    registryVersion: COMPONENT_REGISTRY_VERSION,
    component: 'NetworkTopology',
    payload: {
      component: 'NetworkTopology',
      nodes: [
        { id: 'a', label: 'Router', x: 20, y: 50, kind: 'router' },
        { id: 'b', label: 'Switch', x: 70, y: 50, kind: 'switch' },
      ],
      links: [{ from: 'a', to: 'b', label: 'trunk' }],
    },
    provenance: 'deterministic_demo',
    review: { status: 'not_applicable' },
    audience: 'course',
    fallback: 'ProcessDiagram',
    disclosure: 'Demonstration topology.',
    ...overrides,
  };
}

const code = (fn: () => unknown) => {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof StructuredAssetError ? error.code : 'OTHER';
  }
};

describe('structured learning-asset contract', () => {
  it('accepts an instructor-authored walkthrough', () => {
    const asset = parseStructuredAsset(walkthrough());
    expect(asset.component).toBe('CodeWalkthrough');
    expect(asset.provenance).toBe('instructor_authored');
    expect(asset.payload.component).toBe('CodeWalkthrough');
  });

  it('accepts a deterministic demo topology', () => {
    const asset = parseStructuredAsset(topology());
    expect(asset.payload.component).toBe('NetworkTopology');
  });

  it('rejects an unknown schema version', () => {
    expect(code(() => parseStructuredAsset(walkthrough({ schemaVersion: '2.0.0' })))).toBe(
      'STRUCTURED_ASSET_VERSION_UNSUPPORTED',
    );
  });

  it('rejects a registry version this build cannot render', () => {
    expect(
      code(() => parseStructuredAsset(walkthrough({ registryVersion: '9.9.9' }))),
    ).toBe('STRUCTURED_ASSET_VERSION_UNSUPPORTED');
  });

  it('rejects a component outside the structured-asset set', () => {
    expect(
      code(() =>
        parseStructuredAsset(
          walkthrough({ component: 'DefinitionCard', payload: { component: 'DefinitionCard' } }),
        ),
      ),
    ).toBe('STRUCTURED_ASSET_COMPONENT_UNSUPPORTED');
  });

  it('rejects a payload whose component disagrees with the declared one', () => {
    expect(
      code(() =>
        parseStructuredAsset(
          walkthrough({ payload: { component: 'CodeComparison', language: 'py', entries: [] } }),
        ),
      ),
    ).toBe('STRUCTURED_ASSET_COMPONENT_MISMATCH');
  });

  it('requires source references when claiming source derivation', () => {
    expect(
      code(() => parseStructuredAsset(walkthrough({ provenance: 'source_derived' }))),
    ).toBe('STRUCTURED_ASSET_SOURCE_REFERENCES_REQUIRED');
  });

  it('forbids source references on authored or demo content', () => {
    expect(
      code(() =>
        parseStructuredAsset(
          walkthrough({
            sourceReferences: [
              { documentId: 'doc-1', pageNumber: 3, lineStart: 1, lineEnd: 4 },
            ],
          }),
        ),
      ),
    ).toBe('STRUCTURED_ASSET_SOURCE_REFERENCES_FORBIDDEN');
  });

  it('accepts source references on a source-derived asset', () => {
    const asset = parseStructuredAsset(
      walkthrough({
        provenance: 'source_derived',
        sourceReferences: [{ documentId: 'doc-1', pageNumber: 3, lineStart: 1, lineEnd: 4 }],
      }),
    );
    expect(asset.sourceReferences).toHaveLength(1);
  });

  it('rejects a forged review on a non-reviewed status', () => {
    expect(
      code(() =>
        parseStructuredAsset(
          walkthrough({
            review: { status: 'unreviewed', reviewedBy: 'someone', reviewedAt: '2026-11-01T10:00:00Z' },
          }),
        ),
      ),
    ).toBe('STRUCTURED_ASSET_FORGED_REVIEW');
  });

  it('rejects a claimed reviewed_supplemental with no review record', () => {
    expect(
      code(() =>
        parseStructuredAsset(
          walkthrough({ provenance: 'reviewed_supplemental', review: { status: 'unreviewed' } }),
        ),
      ),
    ).toBe('STRUCTURED_ASSET_REVIEW_MISMATCH');
  });

  it('rejects a generated proposal that claims instructor review', () => {
    expect(
      code(() =>
        parseStructuredAsset(
          walkthrough({
            provenance: 'generated_proposal',
            review: {
              status: 'instructor_reviewed',
              reviewedBy: 'x',
              reviewedAt: '2026-11-01T10:00:00Z',
            },
          }),
        ),
      ),
    ).toBe('STRUCTURED_ASSET_REVIEW_MISMATCH');
  });

  it('rejects markup inside an asset payload', () => {
    expect(
      code(() =>
        parseStructuredAsset(
          walkthrough({
            payload: {
              component: 'CodeWalkthrough',
              language: 'python',
              code: 'x = 1',
              annotations: [{ line: 0, explanation: '<script>alert(1)</script>' }],
            },
          }),
        ),
      ),
    ).toBe('STRUCTURED_ASSET_MARKUP_REJECTED');
  });

  it('rejects an annotation pointing outside the code', () => {
    expect(
      code(() =>
        parseStructuredAsset(
          walkthrough({
            payload: {
              component: 'CodeWalkthrough',
              language: 'python',
              code: 'x = 1',
              annotations: [{ line: 9, explanation: 'nope' }],
            },
          }),
        ),
      ),
    ).toBe('INVALID_STRUCTURED_ASSET');
  });

  it('rejects annotations that do not advance', () => {
    expect(
      code(() =>
        parseStructuredAsset(
          walkthrough({
            payload: {
              component: 'CodeWalkthrough',
              language: 'python',
              code: 'a\nb',
              annotations: [
                { line: 1, explanation: 'second' },
                { line: 1, explanation: 'same' },
              ],
            },
          }),
        ),
      ),
    ).toBe('STRUCTURED_ASSET_ORDER_INVALID');
  });

  it('rejects a link to a node that does not exist', () => {
    // Connectivity may never be invented: a dangling edge is a hard error.
    expect(
      code(() =>
        parseStructuredAsset(
          topology({
            payload: {
              component: 'NetworkTopology',
              nodes: [{ id: 'a', label: 'A', x: 1, y: 1 }],
              links: [{ from: 'a', to: 'ghost' }],
            },
          }),
        ),
      ),
    ).toBe('STRUCTURED_ASSET_DANGLING_LINK');
  });

  it('rejects duplicate node ids', () => {
    expect(
      code(() =>
        parseStructuredAsset(
          topology({
            payload: {
              component: 'NetworkTopology',
              nodes: [
                { id: 'a', label: 'A', x: 1, y: 1 },
                { id: 'a', label: 'B', x: 2, y: 2 },
              ],
              links: [],
            },
          }),
        ),
      ),
    ).toBe('STRUCTURED_ASSET_DUPLICATE_NODE');
  });

  it('rejects an oversized topology rather than truncating it', () => {
    const nodes = Array.from({ length: ASSET_LIMITS.maxNodes + 1 }, (_, index) => ({
      id: `n${index}`,
      label: `N${index}`,
      x: 1,
      y: 1,
    }));
    expect(
      code(() =>
        parseStructuredAsset(
          topology({ payload: { component: 'NetworkTopology', nodes, links: [] } }),
        ),
      ),
    ).toBe('INVALID_STRUCTURED_ASSET');
  });

  it('rejects a position outside the canvas', () => {
    expect(
      code(() =>
        parseStructuredAsset(
          topology({
            payload: {
              component: 'NetworkTopology',
              nodes: [{ id: 'a', label: 'A', x: 500, y: 1 }],
              links: [],
            },
          }),
        ),
      ),
    ).toBe('INVALID_STRUCTURED_ASSET');
  });

  it('rejects an untrusted fallback component', () => {
    expect(code(() => parseStructuredAsset(topology({ fallback: 'EvilThing' })))).toBe(
      'STRUCTURED_ASSET_FALLBACK_UNTRUSTED',
    );
  });

  it('rejects an unknown extra key', () => {
    expect(code(() => parseStructuredAsset({ ...walkthrough(), onClick: 'alert(1)' }))).toBe(
      'INVALID_STRUCTURED_ASSET',
    );
  });

  it('rejects a malformed course id', () => {
    expect(code(() => parseStructuredAsset(walkthrough({ courseId: 'not-an-id' })))).toBe(
      'INVALID_STRUCTURED_ASSET',
    );
  });
});

describe('structured asset projection', () => {
  const bind = { courseId, revisionId };

  it('projects a learner-visible asset with a provenance label', () => {
    const projected = projectStructuredAsset(parseStructuredAsset(walkthrough()), bind);
    expect(projected).not.toBeNull();
    expect(projected!.label).toBe('Instructor-authored material');
    expect(projected!.blockId).toBe('code-1');
  });

  it('never projects a generated proposal to a learner', () => {
    const asset = parseStructuredAsset(walkthrough({ provenance: 'generated_proposal', review: { status: 'unreviewed' } }));
    expect(projectStructuredAsset(asset, bind)).toBeNull();
  });

  it('rejects an asset bound to a different revision', () => {
    const asset = parseStructuredAsset(walkthrough());
    expect(
      projectStructuredAsset(asset, { courseId, revisionId: 'rev_other' }),
    ).toBeNull();
  });

  it('rejects an asset bound to a different course', () => {
    const asset = parseStructuredAsset(walkthrough());
    expect(
      projectStructuredAsset(asset, {
        courseId: 'e2bf5443-7307-55d1-8d2d-91d90636f713',
        revisionId,
      }),
    ).toBeNull();
  });

  it('orders projected assets deterministically by id', () => {
    const a = parseStructuredAsset(walkthrough({ assetId: 'zzz' }));
    const b = parseStructuredAsset(walkthrough({ assetId: 'aaa' }));
    const projected = projectStructuredAssets([a, b], bind);
    expect(projected.map((entry) => entry.assetId)).toEqual(['aaa', 'zzz']);
    // Stable across argument order.
    expect(projectStructuredAssets([b, a], bind).map((entry) => entry.assetId)).toEqual([
      'aaa',
      'zzz',
    ]);
  });

  it('caps the number of assets per revision', () => {
    const many = Array.from({ length: ASSET_LIMITS.maxAssetsPerRevision + 50 }, (_, index) =>
      parseStructuredAsset(walkthrough({ assetId: `asset_${index}` })),
    );
    expect(projectStructuredAssets(many, bind)).toHaveLength(ASSET_LIMITS.maxAssetsPerRevision);
  });
});

describe('structured asset payload variants', () => {
  const wrap = (component: string, payload: Record<string, unknown>) =>
    parseStructuredAsset(walkthrough({ component, payload, fallback: 'CodeViewer' }));

  it('validates a code comparison with at least two entries', () => {
    const asset = wrap('CodeComparison', {
      component: 'CodeComparison',
      language: 'python',
      entries: [
        { label: 'Before', code: 'a=1' },
        { label: 'After', code: 'a = 1' },
      ],
    });
    expect(asset.payload.component).toBe('CodeComparison');
    expect(
      code(() =>
        wrap('CodeComparison', {
          component: 'CodeComparison',
          language: 'python',
          entries: [{ label: 'Only', code: 'a=1' }],
        }),
      ),
    ).toBe('INVALID_STRUCTURED_ASSET');
  });

  it('validates an input/output example with at least one case', () => {
    const asset = wrap('InputOutputExample', {
      component: 'InputOutputExample',
      language: 'python',
      code: 'def f(x): return x',
      cases: [{ input: '1', output: '1' }],
    });
    expect(asset.payload.component).toBe('InputOutputExample');
  });

  it('validates a timeline with unique ids', () => {
    const asset = wrap('Timeline', {
      component: 'Timeline',
      events: [
        { id: 'e1', label: 'Founded' },
        { id: 'e2', label: 'Renamed', when: '1994' },
      ],
    });
    expect(asset.payload.component).toBe('Timeline');
    expect(
      code(() =>
        wrap('Timeline', {
          component: 'Timeline',
          events: [
            { id: 'e1', label: 'A' },
            { id: 'e1', label: 'B' },
          ],
        }),
      ),
    ).toBe('STRUCTURED_ASSET_DUPLICATE_NODE');
  });

  it('requires an image description for an annotated diagram', () => {
    expect(
      code(() =>
        wrap('AnnotatedDiagram', {
          component: 'AnnotatedDiagram',
          nodes: [{ id: 'a', label: 'A', x: 1, y: 1 }],
          links: [],
        }),
      ),
    ).toBe('INVALID_STRUCTURED_ASSET');
  });
});
