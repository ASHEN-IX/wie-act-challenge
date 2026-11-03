import type { LessonBlockV2 } from '../../../../shared/ednova/learningDocumentV2';
import {
  PRESENTATION_DISCLOSURES,
  PRESENTATION_SCHEMA_VERSION,
  buildPublishedPresentation,
  parsePublishedPresentation,
  policyForBlock,
  type PresentationBuildInput,
} from '../../../../shared/ednova/presentationDocument';

const courseId = '0123456789abcdef01234567';
const revisionId = 'rev_formula_test';
const contentHash = 'sha256:' + 'a'.repeat(64);
const documentId = 'doc-1';

const evidence = [{ chunkId: 'chunk-1', documentId, pageNumber: 3, lineStart: 1, lineEnd: 2 }];
const sourceMeta = {
  regionId: 'region_1',
  page: 3,
  bbox: [10, 20, 30, 40] as [number, number, number, number],
  extractionMethod: 'text' as const,
  confidence: 0.9,
  reviewRequired: false,
  issues: [],
};

const paragraph: LessonBlockV2 = {
  type: 'paragraph',
  id: 'p1',
  text: 'Deterministic extracted paragraph.',
  evidence: ['chunk-1'],
  provenance: evidence,
};
const reviewedMath: LessonBlockV2 = {
  type: 'math',
  id: 'm1',
  expression: 'S_n = \\sum_{p=0}^{n} u_p',
  notation: 'latex',
  evidence: ['chunk-1'],
  provenance: evidence,
  sourceMeta,
  review: {
    state: 'corrected',
    originalExpression: 'S_n = \\sum u_p',
    modelExpression: 'S_n = \\sum_{p=0}^{n} u_p',
    reviewer: 'instructor-1',
  },
};
const unreviewedMath: LessonBlockV2 = {
  type: 'math',
  id: 'm2',
  expression: 'dt < +inf',
  notation: 'plain',
  evidence: ['chunk-1'],
  provenance: evidence,
  sourceMeta,
};
const mediaWithoutSource: LessonBlockV2 = {
  type: 'media',
  id: 'img1',
  mediaType: 'image',
  alt: 'Diagram of the band split',
  evidence: ['chunk-1'],
};

function input(overrides: Partial<PresentationBuildInput> = {}): PresentationBuildInput {
  return {
    courseId,
    revisionId,
    contentHash,
    canonicalContentHash: contentHash,
    title: 'Discrete Structures',
    summary: 'A published revision.',
    objectives: [
      { objectiveId: 'obj-1', statement: 'Apply summation identities.', bloomLevel: 'apply' },
    ],
    chapters: [
      {
        id: 'chapter-1',
        title: 'Summations',
        summary: 'Chapter summary.',
        lessons: [
          {
            id: 'lesson-1',
            title: 'Closed forms',
            summary: 'Lesson summary.',
            blocks: [paragraph, reviewedMath, unreviewedMath, mediaWithoutSource],
          },
        ],
      },
    ],
    sources: [
      {
        documentId,
        contentHash,
        pageNumber: null,
        href: `/api/v1/study/courses/${courseId}/revisions/${revisionId}/sources/${documentId}`,
      },
    ],
    warnings: ['Extraction fidelity is unverified.'],
    ...overrides,
  };
}

describe('published presentation contract', () => {
  it('projects canonical blocks without adding, reordering or reinterpreting them', () => {
    const document = buildPublishedPresentation(input());
    expect(document.schemaVersion).toBe(PRESENTATION_SCHEMA_VERSION);
    expect(document.chapters[0].lessons[0].blocks.map((entry) => entry.id)).toEqual([
      'p1',
      'm1',
      'm2',
      'img1',
    ]);
    expect(document.chapters[0].lessons[0].blocks.map((entry) => entry.render)).toEqual([
      'primary',
      'primary',
      'source_faithful',
      'source_faithful',
    ]);
    expect(document.fallback).toEqual({
      readerHref: `/courses/${courseId}/learn?revisionId=${revisionId}`,
      schemaVersion: '2.0.0',
      deterministic: true,
    });
  });

  it('counts reviewed formulas separately and never claims semantic verification', () => {
    const document = buildPublishedPresentation(input());
    expect(document.verification).toEqual({
      status: 'partially_reviewed',
      math: { total: 2, reviewed: 1, sourceFallback: 1 },
      disclosure: PRESENTATION_DISCLOSURES.partially_reviewed,
    });
    expect(document.verification.disclosure).toContain('not semantically verified');
    expect(document.verification.disclosure).not.toContain('is verified');
  });

  it('reports no_math and fully reviewed revisions with the fixed disclosure vocabulary', () => {
    const noMath = buildPublishedPresentation(
      input({
        chapters: [
          {
            id: 'chapter-1',
            title: 'Summations',
            summary: '',
            lessons: [
              { id: 'lesson-1', title: 'Closed forms', summary: '', blocks: [paragraph] },
            ],
          },
        ],
      }),
    );
    expect(noMath.verification.status).toBe('no_math');
    expect(noMath.verification.math).toEqual({ total: 0, reviewed: 0, sourceFallback: 0 });
    expect(noMath.verification.disclosure).toBe(PRESENTATION_DISCLOSURES.no_math);

    const allReviewed = buildPublishedPresentation(
      input({
        chapters: [
          {
            id: 'chapter-1',
            title: 'Summations',
            summary: '',
            lessons: [
              { id: 'lesson-1', title: 'Closed forms', summary: '', blocks: [reviewedMath] },
            ],
          },
        ],
      }),
    );
    expect(allReviewed.verification.status).toBe('reviewed');
    expect(allReviewed.verification.disclosure).toBe(PRESENTATION_DISCLOSURES.reviewed);
    expect(allReviewed.verification.disclosure).toContain(
      'Instructor review is not independent mathematical verification.',
    );
  });

  it('is deterministic for identical input', () => {
    expect(JSON.stringify(buildPublishedPresentation(input()))).toBe(
      JSON.stringify(buildPublishedPresentation(input())),
    );
  });

  it('fails closed on an unknown version, an extra key or free-text disclosure', () => {
    const document = JSON.parse(JSON.stringify(buildPublishedPresentation(input())));
    expect(() => parsePublishedPresentation({ ...document, schemaVersion: '0.9.0' })).toThrow(
      'INVALID_PRESENTATION_DOCUMENT',
    );
    expect(() => parsePublishedPresentation({ ...document, verificationOverride: true })).toThrow(
      'INVALID_PRESENTATION_DOCUMENT',
    );
    expect(() =>
      parsePublishedPresentation({
        ...document,
        verification: { ...document.verification, disclosure: 'Everything is verified.' },
      }),
    ).toThrow('INVALID_PRESENTATION_DOCUMENT');
  });

  it('refuses to relabel an unreviewed formula as primary presentation', () => {
    const document = buildPublishedPresentation(input());
    const tampered = JSON.parse(JSON.stringify(document));
    tampered.chapters[0].lessons[0].blocks[2].render = 'primary';
    tampered.chapters[0].lessons[0].blocks[2].reason = 'extracted_content';
    expect(() => parsePublishedPresentation(tampered)).toThrow('INVALID_PRESENTATION_DOCUMENT');
    expect(policyForBlock(unreviewedMath)).toEqual({
      render: 'source_faithful',
      reason: 'unreviewed_formula',
    });
  });

  it('rejects foreign reader links, non-study source links and markup-shaped blocks', () => {
    const document = JSON.parse(JSON.stringify(buildPublishedPresentation(input())));
    document.fallback.readerHref = '/courses/ffffffffffffffffffffffff/learn';
    expect(() => parsePublishedPresentation(document)).toThrow('INVALID_PRESENTATION_DOCUMENT');

    const foreignSource = JSON.parse(JSON.stringify(buildPublishedPresentation(input())));
    foreignSource.sources[0].href = 'https://files.example.com/source.pdf';
    expect(() => parsePublishedPresentation(foreignSource)).toThrow(
      'INVALID_PRESENTATION_DOCUMENT',
    );

    const markup = JSON.parse(JSON.stringify(buildPublishedPresentation(input())));
    markup.chapters[0].lessons[0].blocks[0].block.onClick = 'alert(1)';
    expect(() => parsePublishedPresentation(markup)).toThrow('INVALID_PRESENTATION_DOCUMENT');
  });
});
