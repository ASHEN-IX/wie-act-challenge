import {
  extractSemanticBlocks,
  projectSemanticContent,
  sourceMappingMarker,
  type SemanticPassage
} from '../../../../shared/ednova/semanticContent';
import {
  migrateReadingDocumentV1,
  parseReadingDocumentV2
} from '../../../../shared/ednova/learningDocumentV2';
import {
  validatePlannedExperience,
  validatePlannerRequest
} from '../../../../shared/ednova/experiencePlanner';
import { PHASE2_CORPUS, corpusPassages } from '../../../../fixtures/ednova-phase2-corpus';

const passage = (text: string, pageNumber: number | null = 2): SemanticPassage => ({
  chunkId: 'chunk-1',
  documentId: 'doc-1',
  pageNumber,
  sectionId: 'section_1',
  text
});

describe('semantic content projection', () => {
  it('preserves source order and page/line evidence for mixed structures', () => {
    const result = extractSemanticBlocks(passage(PHASE2_CORPUS.networking));
    expect(result.map((block) => block.type)).toEqual(['heading', 'list', 'table']);
    expect(result[0].evidence).toMatchObject({ pageNumber: 2, lineStart: 2 });
    expect(result[1].type === 'list' && result[1].items).toEqual([
      'The client sends SYN.',
      'The server replies SYN-ACK.',
      'The client sends ACK.'
    ]);
  });

  it('keeps formulas, code and tables in their source position', () => {
    const blocks = extractSemanticBlocks(passage(PHASE2_CORPUS.mathematics));
    expect(blocks.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
      'math',
      'paragraph',
      'table'
    ]);
    expect(blocks[2]).toMatchObject({
      type: 'math',
      expression: 'ax^2 + bx + c = 0',
      notation: 'latex'
    });
    expect(blocks[4]).toMatchObject({
      type: 'table',
      columns: ['Discriminant', 'Real solutions'],
      rows: [
        ['Positive', 'Two'],
        ['Zero', 'One'],
        ['Negative', 'None']
      ]
    });
    const programming = extractSemanticBlocks(passage(PHASE2_CORPUS.programming));
    expect(programming[0]).toMatchObject({ type: 'heading', text: 'Binary search' });
    expect(programming[1]).toMatchObject({
      type: 'code',
      language: 'python'
    });
    expect(programming[1].type === 'code' && programming[1].code).toContain('while low <= high:');
  });

  it('keeps malformed tables as text and does not activate markup', () => {
    const blocks = extractSemanticBlocks(passage(PHASE2_CORPUS.malformed));
    expect(blocks.some((block) => block.type === 'table')).toBe(false);
    expect(blocks.map((block) => ('text' in block ? block.text : '')).join(' ')).toContain(
      '| incomplete |'
    );
    expect(blocks.some((block) => block.type === 'media')).toBe(false);
  });

  it('extracts explicit charts, diagram steps and media captions', () => {
    const blocks = extractSemanticBlocks(passage(PHASE2_CORPUS.mixed));
    expect(blocks.find((block) => block.type === 'chart')).toMatchObject({
      type: 'chart',
      kind: 'line',
      categories: ['8', '64'],
      series: [
        { label: 'Search steps', values: [3, 6] },
        { label: 'Linear steps', values: [8, 64] }
      ]
    });
    expect(blocks.find((block) => block.type === 'diagram')).toMatchObject({
      type: 'diagram',
      title: 'Request boundary',
      steps: [
        { label: 'Authenticate', detail: 'Verify identity at the API boundary.' },
        { label: 'Authorize', detail: 'Check access to the exact course revision.' },
        { label: 'Process', detail: 'Run deterministic extraction in the worker.' }
      ]
    });
    const science = extractSemanticBlocks(passage(PHASE2_CORPUS.science));
    expect(science.find((block) => block.type === 'media')).toMatchObject({
      type: 'media',
      caption: 'A chloroplast contains the thylakoid membranes where light reactions begin.'
    });
  });

  it('maps only explicit source declarations as exact', () => {
    const marked = passage(
      '[[ednova:topic=programming/subtopic=binary-search]]\n# Search\nBinary search halves the interval.'
    );
    const projection = projectSemanticContent([marked]);
    expect(projection.mappings[0]).toMatchObject({
      topicId: 'programming',
      subtopicId: 'binary-search',
      status: 'exact',
      method: 'source_marker'
    });
    expect(projection.chapters[0].blocks[0]).toMatchObject({
      type: 'heading',
      text: 'Search'
    });
    expect(projection.chapters[0].blocks[0].evidence.lineStart).toBe(2);
    expect(sourceMappingMarker('Search on binary trees.')).toBeNull();
  });

  it('does not accept a mapping whose document or page differs from the source', () => {
    const projection = projectSemanticContent(
      [passage('Safe content.', 4)],
      [
        {
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          pageNumber: 9,
          topicId: 'topic-a',
          subtopicId: 'sub-a',
          status: 'exact'
        }
      ]
    );
    expect(projection.mappings[0]).toMatchObject({
      status: 'inferred_review_required',
      topicId: null,
      subtopicId: null
    });
  });

  it('retains source order and uncertainty when imported legacy content has no mapping', () => {
    const projection = projectSemanticContent(corpusPassages());
    expect(projection.passages.map((item) => item.chunkId)).toEqual(
      corpusPassages().map((item) => item.chunkId)
    );
    expect(projection.mappings.filter((mapping) => mapping.status === 'unmapped')).toHaveLength(1);
    expect(projection.uncertainties.join(' ')).toContain('no explicit topic association');
  });
});

describe('versioned reading migration', () => {
  it('migrates strict v1 content without pretending to know topic mappings', () => {
    const migrated = migrateReadingDocumentV1({
      schemaVersion: '1.0.0',
      courseId: '01020ca1-fc51-5c10-92c0-16c54abb997f',
      revisionId: 'rev-1',
      contentHash: 'sha256:' + 'b'.repeat(64),
      title: 'Legacy',
      generated: { summary: '', objectives: [], outline: [] },
      sections: [
        {
          id: 'legacy-topic',
          title: 'Legacy topic',
          summary: '',
          blocks: [
            {
              type: 'paragraph',
              id: 'p-1',
              text: 'Legacy source',
              evidence: ['chunk-1']
            }
          ],
          evidence: []
        },
        {
          id: 'course-source',
          title: 'Original course material',
          summary: '',
          blocks: [
            {
              type: 'paragraph',
              id: 'source-p',
              text: 'Original text',
              evidence: ['chunk-1']
            }
          ],
          evidence: []
        }
      ],
      sources: [],
      warnings: []
    });
    expect(migrated.schemaVersion).toBe('2.0.0');
    expect(migrated.sections[0].mappingStatus).toBe('unmapped');
    expect(migrated.canonical.mappings[0]).toMatchObject({
      chunkId: 'chunk-1',
      status: 'unmapped'
    });
    expect(migrated.warnings.join(' ')).toContain('migrated from reading v1');
  });

  it('rejects unknown v2 fields and versions', () => {
    expect(() => parseReadingDocumentV2({ schemaVersion: '3.0.0' })).toThrow();
  });
});

describe('experience planner boundary', () => {
  const document = parseReadingDocumentV2({
    schemaVersion: '2.0.0',
    courseId: '01020ca1-fc51-5c10-92c0-16c54abb997f',
    revisionId: 'rev-1',
    contentHash: 'sha256:' + 'b'.repeat(64),
    title: 'Planner demo',
    canonical: {
      extraction: 'deterministic',
      projectionVersion: '2.0.0',
      passages: [],
      mappings: [
        {
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          pageNumber: 2,
          topicId: 'network',
          subtopicId: 'handshake',
          status: 'exact',
          method: 'source_marker'
        }
      ]
    },
    generated: { summary: '', objectives: [], outline: [] },
    sections: [
      {
        id: 'network',
        title: 'Network',
        summary: '',
        blocks: [{ type: 'paragraph', id: 'p', text: 'Source', evidence: ['chunk-1'] }],
        evidence: [],
        mappingStatus: 'exact'
      }
    ],
    sources: [],
    warnings: []
  });
  const request = validatePlannerRequest({
    schemaVersion: '1.0.0',
    courseId: '01020ca1-fc51-5c10-92c0-16c54abb997f',
    revisionId: 'rev-1',
    lesson: { topicId: 'network', subtopicId: 'handshake', title: 'Handshake' },
    sourceReferences: [
      { chunkId: 'chunk-1', documentId: 'doc-1', pageNumber: 2, lineStart: 1, lineEnd: 12 }
    ],
    learnerRequest: 'Show me the handshake with a diagram.',
    availableComponents: ['diagram_walkthrough', 'explanation'],
    constraints: {
      maxComponents: 2,
      maxDataPoints: 12,
      allowMedia: false,
      allowCharts: false,
      locale: 'en'
    }
  });
  it('accepts a bounded trusted component configuration', () => {
    const plan = validatePlannedExperience(
      {
        schemaVersion: '1.0.0',
        planner: 'trusted_component_config',
        components: [
          {
            type: 'diagram_walkthrough',
            title: 'Connection sequence',
            steps: ['SYN', 'SYN-ACK', 'ACK'],
            sourceChunkIds: ['chunk-1']
          }
        ],
        uncertainty: []
      },
      request,
      document
    );
    expect(plan.components[0].type).toBe('diagram_walkthrough');
  });

  it('rejects executable fields, unavailable components and foreign sources', () => {
    const base = {
      schemaVersion: '1.0.0',
      planner: 'trusted_component_config',
      components: [
        {
          type: 'explanation',
          title: 'Safe',
          text: 'Render as text',
          sourceChunkIds: ['chunk-1']
        }
      ],
      uncertainty: []
    };
    expect(() =>
      validatePlannedExperience(
        {
          ...base,
          components: [{ ...base.components[0], html: '<script>alert(1)</script>' }]
        },
        request,
        document
      )
    ).toThrow();
    expect(() =>
      validatePlannedExperience(
        {
          ...base,
          components: [{ ...base.components[0], sourceChunkIds: ['foreign'] }]
        },
        request,
        document
      )
    ).toThrow();
    expect(() =>
      validatePlannedExperience(
        {
          ...base,
          components: [{ ...base.components[0], type: 'script_runner' }]
        },
        request,
        document
      )
    ).toThrow();
  });
});
