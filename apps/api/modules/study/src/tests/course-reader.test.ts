import type { LessonBlockV2 } from '../../../../shared/ednova/learningDocumentV2';
import { parseReadingDocumentV2 } from '../../../../shared/ednova/learningDocumentV2';
import { parseLearningDocument } from '../../../../shared/ednova/learningDocument';
import { canonicalBlocks, sourceBlocks } from '../services/courseReader';

describe('universal learning source adapter', () => {
  it('accepts a chapter section with hundreds of blocks, as produced by real PDFs', () => {
    const blocks: LessonBlockV2[] = Array.from({ length: 470 }, (_, i) => ({
      type: 'paragraph' as const, id: `blk_${i}`, text: `Paragraph ${i}`, evidence: ['chunk'],
    }));
    const document = (sectionBlocks: LessonBlockV2[]) => ({
      schemaVersion: '2.0.0',
      courseId: 'a'.repeat(24),
      revisionId: 'rev_test',
      contentHash: 'sha256:' + 'a'.repeat(64),
      title: 'Long chapter',
      canonical: { extraction: 'deterministic', projectionVersion: '2.0.0', passages: [], mappings: [] },
      generated: { summary: '', objectives: [], outline: [] },
      sections: [{ id: 'chapter', title: 'Chapter', summary: '', blocks: sectionBlocks, evidence: [], mappingStatus: 'exact' }],
      sources: [],
      warnings: [],
    });
    expect(parseReadingDocumentV2(document(blocks)).sections[0].blocks).toHaveLength(470);
    const tooMany = Array.from({ length: 5001 }, (_, i) => ({
      type: 'paragraph' as const, id: `b_${i}`, text: 'x', evidence: ['chunk'],
    }));
    expect(() => parseReadingDocumentV2(document(tooMany))).toThrow('INVALID_LEARNING_DOCUMENT_V2');
  });

  it('turns explicit text structure into typed blocks without interpreting HTML', () => {
    const blocks = sourceBlocks(
      [
        '# Dependency theory',
        '',
        'Normalization <script>alert(1)</script> protects integrity.',
        '',
        '- atomic values',
        '- full dependency',
        '',
        '```sql',
        'SELECT * FROM enrolment;',
        '```',
      ].join('\n'),
      'section-1',
      'chunk-1',
    );
    expect(blocks.map((block) => block.type)).toEqual(['heading', 'paragraph', 'list', 'code']);
    expect(JSON.stringify(blocks)).toContain('<script>alert(1)</script>');
    const code = blocks.find(
      (value): value is Extract<LessonBlockV2, { type: 'code' }> => value.type === 'code',
    );
    expect(code).toMatchObject({
      language: 'sql',
      code: 'SELECT * FROM enrolment;',
    });
  });

  it('keeps unknown content as text and validates provenance ids', () => {
    const blocks: LessonBlockV2[] = sourceBlocks('<img src=x onerror=alert(1)>', 's-2', 'c-2');
    expect(blocks[0]).toMatchObject({ type: 'paragraph', evidence: ['c-2'] });
    expect(blocks[0]).not.toHaveProperty('type', 'media');
  });

  it('rejects an unknown schema version at the browser boundary', () => {
    expect(() =>
      parseLearningDocument({
        schemaVersion: '2.0.0',
        courseId: 'a'.repeat(24),
        revisionId: 'rev-1',
        contentHash: 'sha256:' + 'a'.repeat(64),
        title: 'Course',
        generated: { summary: '', objectives: [], outline: [] },
        sections: [],
        sources: [],
        warnings: [],
      }),
    ).toThrow();
  });

  it('is deterministic for mixed content so renderer fixtures stay stable', () => {
    const first = sourceBlocks(
      '## Compare\n\n$$a^2 + b^2 = c^2$$\n\n| Name | Value |\n| --- | --- |\n| x | 1 |',
      'mixed',
      'chunk-mixed',
    );
    const second = sourceBlocks(
      '## Compare\n\n$$a^2 + b^2 = c^2$$\n\n| Name | Value |\n| --- | --- |\n| x | 1 |',
      'mixed',
      'chunk-mixed',
    );
    expect(first).toEqual(second);
    expect(first[0]).toMatchObject({ type: 'heading', id: 'mixed-heading-1' });
    expect(first.at(-1)).toMatchObject({ type: 'table', evidence: ['chunk-mixed'] });
  });

  it('projects canonical lessons with many spans through the bounded V2 contract', () => {
    const spans = Array.from({ length: 12 }, (_, index) => ({
      chunkId: `chunk-${index + 1}`,
      documentId: 'doc-course',
      pageNumber: Math.floor(index / 2) + 1,
      lineStart: 1,
      lineEnd: 4,
    }));
    const blocks = canonicalBlocks([
      {
        id: 'source-lesson',
        type: 'source_lesson',
        text: '## Complete lesson\n\nA complete educational paragraph is retained here.',
        evidence: spans,
      },
      {
        id: 'typed-table',
        type: 'table',
        columns: ['n', 'u_n'],
        rows: [['1', '0.5']],
        evidence: spans,
      },
      {
        id: 'typed-math',
        type: 'math',
        expression: 'S_n = \\sum_{p=0}^n u_p',
        notation: 'latex',
        evidence: spans,
      },
    ]);
    expect(blocks.find((block) => block.type === 'paragraph')).toMatchObject({
      provenance: expect.any(Array),
    });
    expect(
      (blocks.find((block) => block.type === 'paragraph') as { provenance?: unknown[] }).provenance,
    ).toHaveLength(8);
    expect(blocks.find((block) => block.type === 'table')).toMatchObject({
      rows: [['1', '0.5']],
    });
    expect(blocks.find((block) => block.type === 'math')).toMatchObject({
      expression: 'S_n = \\sum_{p=0}^n u_p',
    });
    expect(() =>
      parseReadingDocumentV2({
        schemaVersion: '2.0.0',
        courseId: 'a'.repeat(24),
        revisionId: 'rev_test',
        contentHash: 'sha256:' + 'a'.repeat(64),
        title: 'Canonical course',
        canonical: { extraction: 'deterministic', projectionVersion: '2.0.0', passages: [], mappings: [] },
        generated: { summary: '', objectives: [], outline: [] },
        sections: [{ id: 'chapter', title: 'Chapter', summary: '', blocks, evidence: [], mappingStatus: 'exact' }],
        sources: [],
        warnings: [],
      }),
    ).not.toThrow();
  });

  it('projects source regions and authorized media without duplicating source prose', () => {
    const meta = {
      regionId: 'region_' + 'a'.repeat(20),
      page: 2,
      bbox: [122.92, 105.72, 463.08, 392.31],
      extractionMethod: 'vector' as const,
      confidence: 0,
      reviewRequired: true,
      issues: [],
    };
    const blocks = canonicalBlocks([
      {
        id: 'source-lesson',
        type: 'source_lesson',
        text: 'The same source paragraph must not render twice.',
        evidence: [{ chunkId: 'chunk-1', documentId: 'doc_1', pageNumber: 2, lineStart: 1, lineEnd: 1 }],
      },
      {
        id: 'paragraph',
        type: 'paragraph',
        text: 'The same source paragraph must not render twice.',
        evidence: [{ chunkId: 'chunk-1', documentId: 'doc_1', pageNumber: 2, lineStart: 1, lineEnd: 1 }],
        regionId: meta.regionId,
        page: meta.page,
        bbox: meta.bbox,
        extractionMethod: meta.extractionMethod,
        confidence: meta.confidence,
        reviewRequired: meta.reviewRequired,
        issues: meta.issues,
      },
      {
        id: 'definition',
        type: 'definition',
        title: 'Definition',
        text: 'A definition from the source.',
        evidence: [{ chunkId: 'chunk-2', documentId: 'doc_1', pageNumber: 3, lineStart: 1, lineEnd: 1 }],
        ...meta,
        regionId: 'region_' + 'b'.repeat(20),
      },
      {
        id: 'figure',
        type: 'media',
        mediaType: 'image',
        alt: 'Figure on page 2',
        sourceRegionId: meta.regionId,
        evidence: [{ chunkId: 'chunk-1', documentId: 'doc_1', pageNumber: 2, lineStart: 1, lineEnd: 1 }],
        ...meta,
      },
    ],
    { courseId: 'a'.repeat(24), revisionId: 'rev_test' });
    expect(blocks.map((block) => block.type)).toEqual(['paragraph', 'callout', 'media']);
    expect(blocks[0]).toMatchObject({ sourceMeta: meta });
    expect(blocks[0].provenance).toEqual([
      { chunkId: 'chunk-1', documentId: 'doc_1', pageNumber: 2, lineStart: 1, lineEnd: 1 },
    ]);
    expect(blocks[2]).toMatchObject({
      type: 'media',
      src: `/api/v1/study/courses/${'a'.repeat(24)}/revisions/rev_test/sources/doc_1/regions/${meta.regionId}`,
    });
  });

  it('rejects executable fields rather than stripping them', () => {
    const valid = {
      schemaVersion: '1.0.0',
      courseId: 'a'.repeat(24),
      revisionId: 'rev-1',
      contentHash: 'sha256:' + 'a'.repeat(64),
      title: 'Course',
      generated: { summary: '', objectives: [], outline: [] },
      sections: [
        {
          id: 'topic-1',
          title: 'Topic',
          summary: '',
          blocks: [
            {
              type: 'paragraph',
              id: 'p-1',
              text: 'Safe canonical text',
              evidence: ['chunk-1'],
              dangerouslySetInnerHTML: '<script>alert(1)</script>',
            },
          ],
          evidence: [],
        },
      ],
      sources: [],
      warnings: [],
    };
    expect(() => parseLearningDocument(valid)).toThrow();
  });
});

describe('immutable reviewed formula projection', () => {
  it('renders the frozen correction while keeping original extraction and proposal separate', () => {
    const blocks = canonicalBlocks([{id:'math',type:'math',regionId:'region_x',page:1,bbox:[1,2,30,40],expression:'source',notation:'plain',evidence:[{chunkId:'chunk',documentId:'doc',pageNumber:1,lineStart:1,lineEnd:1}],reviewedFormula:{expression:'x^{2}',state:'corrected',originalModelLatex:'x_2',reviewer:'instructor'}}]);
    expect(blocks[0]).toMatchObject({type:'math',notation:'latex',expression:'x^{2}',review:{state:'corrected',originalExpression:'source',modelExpression:'x_2',reviewer:'instructor'}});
  });
});
