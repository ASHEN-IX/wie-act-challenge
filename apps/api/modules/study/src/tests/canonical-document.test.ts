import { parseCanonicalDocument } from '../../../../shared/ednova/canonicalDocument';
import { canonicalUnitsForIndex } from '../services/revisionSources';

const span = {
  chunkId: 'chk_source',
  documentId: 'doc_course',
  pageNumber: 1,
  lineStart: 3,
  lineEnd: 6,
};

function fixture() {
  return {
    schemaVersion: '1.0.0',
    courseId: '64a000000000000000000001',
    title: 'Course',
    provenance: { content: 'extracted', structure: 'deterministic' },
    verification: 'source_text_unverified',
    chapters: [
      {
        id: 'topic_1',
        title: 'Chapter 3',
        lessons: [
          {
            id: 'sub_1',
            title: '3.1 Séries numériques',
            summary: 'Short outline only',
            source_spans: [span],
            blocks: [
              {
                id: 'blk_source',
                type: 'source_lesson',
                text: 'First complete paragraph.\n\nSecond complete paragraph.',
                evidence: [span],
                provenance: 'extracted',
                verification: 'source_backed',
              },
              {
                id: 'blk_table',
                type: 'table',
                columns: ['n', 'u_n'],
                rows: [['1', '0.5']],
                evidence: [span],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe('canonical course document', () => {
  test('preserves the complete body, blocks and spans', () => {
    const document = parseCanonicalDocument(fixture());
    const lesson = document.chapters[0].lessons[0];
    expect(lesson.blocks[0]).toMatchObject({
      type: 'source_lesson',
      text: 'First complete paragraph.\n\nSecond complete paragraph.',
    });
    expect(lesson.blocks[1]).toMatchObject({ type: 'table', rows: [['1', '0.5']] });
    expect(lesson.source_spans).toEqual([span]);
  });

  test('rejects unknown versions and executable source content', () => {
    expect(() =>
      parseCanonicalDocument({ ...fixture(), schemaVersion: '2.0.0' }),
    ).toThrow();
    const invalid: any = fixture();
    invalid.chapters[0].lessons[0].blocks[0] = {
      ...invalid.chapters[0].lessons[0].blocks[0],
      html: '<script>alert(1)</script>',
    };
    expect(() => parseCanonicalDocument(invalid)).toThrow();
  });

  test('is deterministic and leaves legacy documents additive', () => {
    expect(parseCanonicalDocument(fixture())).toEqual(parseCanonicalDocument(fixture()));
    expect(() => parseCanonicalDocument(null)).toThrow();
  });

  test('derives review-stage retrieval units with canonical block links', () => {
    const document = fixture();
    const source = document.chapters[0].lessons[0].blocks[0];
    source.text = Array.from({ length: 4 }, (_, index) => `Paragraph ${index + 1} ` + 'x'.repeat(700)).join('\n\n');
    const units = canonicalUnitsForIndex(document);
    expect(units).toHaveLength(2);
    expect(units.every((unit) => unit.blockIds[0] === 'blk_source')).toBe(true);
    expect(units.every((unit) => unit.chunkIds[0] === 'chk_source')).toBe(true);
    expect(units.every((unit) => unit.lessonId === 'sub_1')).toBe(true);
    expect(units.every((unit) => unit.text.length <= 2_000)).toBe(true);
  });
});
