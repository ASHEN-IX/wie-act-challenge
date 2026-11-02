import type {
  EvidenceSpan,
  LearningBlockV1,
  LessonBlockV2,
  ReadingDocumentV2,
} from './learningDocumentV2';

type SourceBlock = LearningBlockV1 & {
  provenance?: EvidenceSpan[];
};

function span({
  chunkId,
  documentId,
  pageNumber,
  lineStart,
  lineEnd,
}: EvidenceSpan): EvidenceSpan {
  return { chunkId, documentId, pageNumber, lineStart, lineEnd };
}

/** The v1 parser remains the block-safety authority. V2 only augments blocks
 * with source span metadata and validates the resulting whole-document shape. */
export function sourceBackedBlocks(
  value: unknown,
  evidence: EvidenceSpan,
): LessonBlockV2[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { blocks?: unknown }).blocks))
    return [];
  return (value as { blocks: SourceBlock[] }).blocks.map((block) => {
    const provenance = block.provenance?.map(span) || [span(evidence)];
    if (block.type === 'code' || block.type === 'math' || block.type === 'media') {
      return {
        ...block,
        evidence: block.evidence || [evidence.chunkId],
        provenance,
      } as LessonBlockV2;
    }
    return { ...block, provenance } as LessonBlockV2;
  });
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ':' + stableJson((value as Record<string, unknown>)[key]))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}

export type { ReadingDocumentV2 };
