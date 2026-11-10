import { parseCanonicalDocument } from '../../../../shared/ednova/canonicalDocument';
import { canonicalUnitsForIndex } from '../services/revisionSources';
import { withExtractionReview } from '../services/courseDraft';
import { activityDigest } from '../services/activityIdentity';

const span = {
  chunkId: 'chk_source',
  documentId: 'doc_course',
  pageNumber: 1,
  lineStart: 3,
  lineEnd: 6
};

function fixture() {
  return {
    schemaVersion: '1.0.0',
    courseId: '9fc0fd30-b00a-55fb-a19f-a23a3f1d5514',
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
                verification: 'source_backed'
              },
              {
                id: 'blk_table',
                type: 'table',
                columns: ['n', 'u_n'],
                rows: [['1', '0.5']],
                evidence: [span]
              }
            ]
          }
        ]
      }
    ]
  };
}

describe('canonical course document', () => {
  test('accepts a chapter-sized lesson with hundreds of blocks and source spans', () => {
    const document: any = fixture();
    const lesson = document.chapters[0].lessons[0];
    lesson.blocks = Array.from({ length: 464 }, (_, i) => ({
      id: `blk_${i}`,
      type: 'paragraph',
      text: `Paragraph ${i}`,
      evidence: [span],
      regionId: `region_${i}`,
      extractionMethod: 'text',
      confidence: 1
    }));
    lesson.source_spans = Array.from({ length: 544 }, () => span);
    expect(parseCanonicalDocument(document).chapters[0].lessons[0].blocks).toHaveLength(464);
  });

  test('still rejects a lesson beyond the hard block bound', () => {
    const document: any = fixture();
    document.chapters[0].lessons[0].blocks = Array.from({ length: 2001 }, (_, i) => ({
      id: `blk_${i}`,
      type: 'paragraph',
      text: 'x',
      evidence: [span]
    }));
    expect(() => parseCanonicalDocument(document)).toThrow('INVALID_CANONICAL_DOCUMENT');
  });

  test('accepts real region paragraphs and extraction metadata while rejecting event handlers', () => {
    const document: any = fixture();
    document.chapters[0].lessons[0].blocks.push({
      id: 'blk_region',
      type: 'paragraph',
      text: 'Source paragraph',
      evidence: [span],
      regionId: 'region_text',
      extractionMethod: 'text',
      confidence: 1,
      bbox: [72, 72, 400, 100],
      page: 1,
      reviewRequired: false,
      issues: []
    });
    expect(() => parseCanonicalDocument(document)).not.toThrow();
    document.chapters[0].lessons[0].blocks[2].onclick = 'alert(1)';
    expect(() => parseCanonicalDocument(document)).toThrow();
  });
  test('preserves the complete body, blocks and spans', () => {
    const document = parseCanonicalDocument(fixture());
    const lesson = document.chapters[0].lessons[0];
    expect(lesson.blocks[0]).toMatchObject({
      type: 'source_lesson',
      text: 'First complete paragraph.\n\nSecond complete paragraph.'
    });
    expect(lesson.blocks[1]).toMatchObject({ type: 'table', rows: [['1', '0.5']] });
    expect(lesson.source_spans).toEqual([span]);
  });

  test('rejects unknown versions and executable source content', () => {
    expect(() => parseCanonicalDocument({ ...fixture(), schemaVersion: '2.0.0' })).toThrow();
    const invalid: any = fixture();
    invalid.chapters[0].lessons[0].blocks[0] = {
      ...invalid.chapters[0].lessons[0].blocks[0],
      html: '<script>alert(1)</script>'
    };
    expect(() => parseCanonicalDocument(invalid)).toThrow();
  });

  test('is deterministic and leaves legacy documents additive', () => {
    expect(parseCanonicalDocument(fixture())).toEqual(parseCanonicalDocument(fixture()));
    expect(() => parseCanonicalDocument(null)).toThrow();
  });

  test('validates explicit extraction review and bounded table cells', () => {
    const reviewed = {
      ...fixture(),
      quality: {
        schemaVersion: '1.0.0',
        sourceIntegrity: 'verified',
        extractionCompleteness: 'partial',
        structuralValidity: 'valid',
        semanticFidelity: 'review_required',
        humanReview: 'required',
        publicationState: 'review_required',
        reviewRegionIds: ['region_math'],
        counts: { regions: 1, reviewRequired: 1, types: { math: 1 } }
      },
      extractionReview: {
        acknowledged: true,
        acknowledgedAt: '2026-11-02T12:00:00.000Z'
      }
    };
    expect(parseCanonicalDocument(reviewed).extractionReview).toEqual(reviewed.extractionReview);
    const invalid: any = fixture();
    invalid.chapters[0].lessons[0].blocks[1].rows = [['too', 'many', 'cells']];
    expect(() => parseCanonicalDocument(invalid)).toThrow();
  });

  test('review acknowledgement changes the canonical digest deterministically', () => {
    const canonical = {
      ...fixture(),
      quality: {
        schemaVersion: '1.0.0',
        sourceIntegrity: 'verified',
        extractionCompleteness: 'partial',
        structuralValidity: 'valid',
        semanticFidelity: 'review_required',
        humanReview: 'required',
        publicationState: 'review_required',
        reviewRegionIds: ['region_math'],
        counts: { regions: 1, reviewRequired: 1, types: { math: 1 } }
      }
    };
    const acknowledged = withExtractionReview(canonical, new Date('2026-11-02T12:00:00.000Z'));
    expect(parseCanonicalDocument(acknowledged).extractionReview).toEqual({
      acknowledged: true,
      acknowledgedAt: '2026-11-02T12:00:00.000Z'
    });
    expect(activityDigest(acknowledged)).not.toBe(activityDigest(canonical));
  });

  test('derives review-stage retrieval units with canonical block links', () => {
    const document = fixture();
    const source = document.chapters[0].lessons[0].blocks[0];
    source.text = Array.from(
      { length: 4 },
      (_, index) => `Paragraph ${index + 1} ` + 'x'.repeat(700)
    ).join('\n\n');
    const units = canonicalUnitsForIndex(document);
    expect(units).toHaveLength(2);
    expect(units.every((unit) => unit.blockIds[0] === 'blk_source')).toBe(true);
    expect(units.every((unit) => unit.chunkIds[0] === 'chk_source')).toBe(true);
    expect(units.every((unit) => unit.lessonId === 'sub_1')).toBe(true);
    expect(units.every((unit) => unit.text.length <= 2_000)).toBe(true);
  });
});
