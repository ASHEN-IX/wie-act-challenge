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
  if (Object.keys(block).some((key) => /html|script|url|on[A-Z]/i.test(key)))
    throw new Error('INVALID_CANONICAL_DOCUMENT');
  if (typeof block.type !== 'string' || !['source_lesson', 'heading', 'math', 'table', 'media', 'code', 'callout'].includes(block.type))
    throw new Error('INVALID_CANONICAL_DOCUMENT');
  return block;
};

export function parseCanonicalDocument(value: unknown): CanonicalDocumentV1 {
  const v = record(value);
  if (v.schemaVersion !== '1.0.0') throw new Error('INVALID_CANONICAL_DOCUMENT');
  if (!Array.isArray(v.chapters) || v.chapters.length > 500) throw new Error('INVALID_CANONICAL_DOCUMENT');
  const provenance = record(v.provenance);
  if (provenance.content !== 'extracted' || provenance.structure !== 'deterministic' || v.verification !== 'source_text_unverified') throw new Error('INVALID_CANONICAL_DOCUMENT');
  return {
    schemaVersion: '1.0.0', courseId: text(v.courseId, 64), title: text(v.title, 500),
    provenance: { content: 'extracted', structure: 'deterministic' }, verification: 'source_text_unverified',
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
