/** Strict validation for the additive canonical content document. */
import type { CanonicalDocumentV1, EvidenceSpan } from './learningDocumentV2';

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_CANONICAL_DOCUMENT');
  return value as Record<string, unknown>;
};
const text = (value: unknown, max: number) => {
  if (typeof value !== 'string' || !value || value.length > max) throw new Error('INVALID_CANONICAL_DOCUMENT');
  return value;
};
const spans = (value: unknown): EvidenceSpan[] => {
  if (!Array.isArray(value) || value.length > 400) throw new Error('INVALID_CANONICAL_DOCUMENT');
  return value.map((entry) => {
    const span = record(entry);
    const start = span.lineStart, end = span.lineEnd;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || (start as number) < 1 || (end as number) < (start as number)) throw new Error('INVALID_CANONICAL_DOCUMENT');
    return {
      chunkId: text(span.chunkId, 128), documentId: text(span.documentId, 128),
      pageNumber: span.pageNumber === null ? null : text(String(span.pageNumber), 8) ? Number(span.pageNumber) : null,
      lineStart: start as number, lineEnd: end as number,
    };
  });
};

const safeBlock = (value: unknown): Record<string, unknown> => {
  const block = record(value);
  if (Object.keys(block).some((key) => /html|script|url/i.test(key) || /^on[a-z]/i.test(key)))
    throw new Error('INVALID_CANONICAL_DOCUMENT');
  if (typeof block.type !== 'string' || !['source_lesson', 'paragraph', 'heading', 'math', 'table', 'media', 'code', 'callout', 'definition', 'theorem', 'proposition', 'lemma', 'corollary', 'proof', 'example', 'exercise', 'solution', 'remark'].includes(block.type))
    throw new Error('INVALID_CANONICAL_DOCUMENT');
  if (block.type === 'table') {
    if (!Array.isArray(block.columns) || block.columns.length > 20) throw new Error('INVALID_CANONICAL_DOCUMENT');
    const columns = block.columns;
    if (!Array.isArray(block.rows) || block.rows.length > 100) throw new Error('INVALID_CANONICAL_DOCUMENT');
    if (columns.some((cell) => typeof cell !== 'string' || cell.length > 300)) throw new Error('INVALID_CANONICAL_DOCUMENT');
    if (block.rows.some((row) => !Array.isArray(row) || row.length !== columns.length || row.some((cell) => typeof cell !== 'string' || cell.length > 1200)))
      throw new Error('INVALID_CANONICAL_DOCUMENT');
    if (block.text !== undefined && (typeof block.text !== 'string' || block.text.length > 8000))
      throw new Error('INVALID_CANONICAL_DOCUMENT');
  }
  return block;
};

const quality = (value: unknown): CanonicalDocumentV1['quality'] => {
  if (value === undefined) return undefined;
  const v = record(value);
  const counts = record(v.counts);
  const types = record(counts.types);
  if (
    v.schemaVersion !== '1.0.0' ||
    !['verified', 'unavailable'].includes(String(v.sourceIntegrity)) ||
    !['complete', 'partial'].includes(String(v.extractionCompleteness)) ||
    !['valid', 'invalid'].includes(String(v.structuralValidity)) ||
    !['deterministic_unverified', 'review_required'].includes(String(v.semanticFidelity)) ||
    !['required', 'not_requested'].includes(String(v.humanReview)) ||
    !['review_required', 'ready_for_instructor_review'].includes(String(v.publicationState)) ||
    !Number.isSafeInteger(counts.regions) ||
    !Number.isSafeInteger(counts.reviewRequired) ||
    !Array.isArray(v.reviewRegionIds)
  ) throw new Error('INVALID_CANONICAL_DOCUMENT');
  return {
    schemaVersion: '1.0.0',
    sourceIntegrity: v.sourceIntegrity as 'verified' | 'unavailable',
    extractionCompleteness: v.extractionCompleteness as 'complete' | 'partial',
    structuralValidity: v.structuralValidity as 'valid' | 'invalid',
    semanticFidelity: v.semanticFidelity as 'deterministic_unverified' | 'review_required',
    humanReview: v.humanReview as 'required' | 'not_requested',
    publicationState: v.publicationState as 'review_required' | 'ready_for_instructor_review',
    reviewRegionIds: v.reviewRegionIds.map((id) => text(id, 128)).slice(0, 500),
    counts: {
      regions: counts.regions as number,
      reviewRequired: counts.reviewRequired as number,
      types: Object.fromEntries(Object.entries(types).map(([key, count]) => {
        if (!Number.isSafeInteger(count) || (count as number) < 0) throw new Error('INVALID_CANONICAL_DOCUMENT');
        return [key.slice(0, 80), count as number];
      })),
    },
  };
};

const extractionReview = (value: unknown): CanonicalDocumentV1['extractionReview'] => {
  if (value === undefined) return undefined;
  const v = record(value);
  if (v.acknowledged !== true || typeof v.acknowledgedAt !== 'string' || !Number.isFinite(Date.parse(v.acknowledgedAt)))
    throw new Error('INVALID_CANONICAL_DOCUMENT');
  return { acknowledged: true, acknowledgedAt: v.acknowledgedAt };
};

export function parseCanonicalDocument(value: unknown): CanonicalDocumentV1 {
  const v = record(value);
  if (v.schemaVersion !== '1.0.0') throw new Error('INVALID_CANONICAL_DOCUMENT');
  if (!Array.isArray(v.chapters) || v.chapters.length > 500) throw new Error('INVALID_CANONICAL_DOCUMENT');
  const provenance = record(v.provenance);
  if (provenance.content !== 'extracted' || provenance.structure !== 'deterministic' || v.verification !== 'source_text_unverified') throw new Error('INVALID_CANONICAL_DOCUMENT');
  const validatedQuality = quality(v.quality);
  const validatedReview = extractionReview(v.extractionReview);
  return {
    schemaVersion: '1.0.0', courseId: text(v.courseId, 64), title: text(v.title, 500),
    provenance: { content: 'extracted', structure: 'deterministic' }, verification: 'source_text_unverified',
    ...(validatedQuality ? { quality: validatedQuality } : {}),
    ...(validatedReview ? { extractionReview: validatedReview } : {}),
    chapters: v.chapters.map((entry) => {
      const chapter = record(entry);
      if (!Array.isArray(chapter.lessons) || chapter.lessons.length > 200) throw new Error('INVALID_CANONICAL_DOCUMENT');
      return {
        id: text(chapter.id, 128), title: text(chapter.title, 500),
        lessons: chapter.lessons.map((entry) => {
          const lesson = record(entry);
          if (!Array.isArray(lesson.blocks) || lesson.blocks.length > 400) throw new Error('INVALID_CANONICAL_DOCUMENT');
          return {
            id: text(lesson.id, 128), title: text(lesson.title, 500), summary: String(lesson.summary || '').slice(0, 2000),
            source_spans: spans(lesson.source_spans),
            blocks: lesson.blocks.map(safeBlock),
          };
        }),
      };
    }),
  };
}
