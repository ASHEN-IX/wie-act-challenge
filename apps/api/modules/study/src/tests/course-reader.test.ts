import type { LessonBlockV2 } from '../../../../shared/ednova/learningDocumentV2';
import { parseReadingDocumentV2 } from '../../../../shared/ednova/learningDocumentV2';
import { parseLearningDocument } from '../../../../shared/ednova/learningDocument';
import { canonicalBlocks, sourceBlocks } from '../services/courseReader';

describe('universal learning source adapter', () => {
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
