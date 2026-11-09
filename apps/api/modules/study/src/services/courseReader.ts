import { CourseRevision } from '../models';
import { getPublishedCourseContext } from './coursePublication';
import { verifyRevisionArtifact, type SourcePassage } from './revisionSources';
import {
  parseLearningDocument,
  type LearningBlock,
  type LearningDocument,
} from '../../../../shared/ednova/learningDocument';
import {
  parseReadingDocumentV2,
  type CanonicalDocumentV1,
  type EvidenceSpan,
  type LessonBlockV2,
  type ReadingDocumentV2,
} from '../../../../shared/ednova/learningDocumentV2';
import {
  extractSemanticBlocks,
  projectSemanticContent,
  sourceMappingMarker,
  type SemanticBlock,
} from '../../../../shared/ednova/semanticContent';
import { parseCanonicalDocument } from '../../../../shared/ednova/canonicalDocument';
import { activityDigest } from './activityIdentity';

/**
 * A deterministic reading projection. The published revision and its verified
 * source artifact remain the authority. Extraction currently supplies original
 * chunks but not trusted topic-to-chunk mappings, so canonical passages stay in
 * source order and AI summaries appear separately from source prose.
 */
export const LEARNING_DOCUMENT_VERSION = '2.0.0' as const;
export const LEGACY_LEARNING_DOCUMENT_VERSION = '1.0.0' as const;

export class LearningDocumentVersionError extends Error {
  readonly status = 422;
}

function compact(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function blockNumber(sectionId: string): () => string {
  let index = 0;
  return () => `${sectionId}-block-${++index}`;
}

function semanticToLearningBlock(
  block: SemanticBlock,
  sectionId: string,
  chunkId: string,
): LearningBlock | Extract<LessonBlockV2, { type: 'chart' }> {
  const id = `${sectionId}-${block.type}-${block.order}`;
  switch (block.type) {
    case 'heading':
      return { type: 'heading', id, level: block.level, text: block.text };
    case 'paragraph':
      return { type: 'paragraph', id, text: block.text, evidence: [chunkId] };
    case 'list':
      return { type: 'list', id, ordered: block.ordered, items: block.items, evidence: [chunkId] };
    case 'quote':
      return { type: 'quote', id, text: block.text, evidence: [chunkId] };
    case 'code':
      return { type: 'code', id, language: block.language, code: block.code };
    case 'math':
      return { type: 'math', id, expression: block.expression, notation: block.notation };
    case 'table':
      return { type: 'table', id, caption: block.caption, columns: block.columns, rows: block.rows, evidence: [chunkId] };
    case 'media':
      // A source-relative reference is never an authorized renderer URL.
      return { type: 'media', id, mediaType: block.mediaType, alt: block.alt, ...(block.caption ? { caption: block.caption } : {}) };
    case 'diagram':
      return { type: 'diagram', id, title: block.title, description: block.description, steps: block.steps };
    case 'chart':
      return {
        type: 'chart',
        id,
        title: block.title,
        ...(block.caption ? { caption: block.caption } : {}),
        kind: block.kind,
        categories: block.categories,
        series: block.series,
        ...(block.yLabel ? { yLabel: block.yLabel } : {}),
        evidence: [chunkId],
      };
    case 'callout':
      return { type: 'callout', id, kind: block.kind, title: block.title, text: block.text, evidence: [chunkId] };
  }
}

function sourceSemanticBlocks(passage: SourcePassage): LessonBlockV2[] {
  return extractSemanticBlocks({
    chunkId: passage.chunkId,
    documentId: passage.documentId,
    pageNumber: passage.pageNumber,
    sectionId: passage.sectionId,
    text: passage.text,
  }).map((block) => {
    const converted = semanticToLearningBlock(block, `source-${passage.chunkId}`, passage.chunkId);
    const provenance = [block.evidence];
    return {
      ...converted,
      ...(converted.type === 'heading' ? {} : { evidence: [passage.chunkId] }),
      provenance,
    } as LessonBlockV2;
  });
}

/** Convert only explicitly structured text to blocks. Raw HTML is kept as text
 * and is escaped by React; nothing from an upload is interpreted as markup. */
export function sourceBlocks(
  source: string,
  sectionId: string,
  chunkId: string,
): LessonBlockV2[] {
  return extractSemanticBlocks({ chunkId, documentId: chunkId, pageNumber: null, sectionId, text: source })
    .filter((block) => !(block.type === 'paragraph' && block.evidence.lineStart === 1 && block.text.startsWith('[[ednova:')))
    .map((block) => semanticToLearningBlock(block, sectionId, chunkId) as LessonBlockV2);
}

type TopicRecord = {
  id?: string;
  title?: string;
  description?: string;
  subtopics?: Array<{
    id?: string;
    title?: string;
    summary?: string;
    source_spans?: Array<{
      chunkId?: string;
      documentId?: string;
      pageNumber?: number | null;
      lineStart?: number;
      lineEnd?: number;
    }>;
    structured_blocks?: Array<Record<string, unknown>>;
    learning_objectives?: Array<{
      id?: string;
      objectiveId?: string;
      statement?: string;
      text?: string;
      bloomLevel?: string;
    }>;
  }>;
};

function lineEvidence(
  passage: SourcePassage,
  lineStart = 1,
  lineEnd = Math.max(1, passage.text.split(/\r?\n/).length),
): EvidenceSpan {
  return {
    chunkId: passage.chunkId,
    documentId: passage.documentId,
    pageNumber: passage.pageNumber,
    lineStart,
    lineEnd: Math.max(lineStart, Math.min(lineEnd, 100_000)),
  };
}

function validatedSpans(
  subtopic: NonNullable<NonNullable<TopicRecord['subtopics']>[number]>,
  passages: SourcePassage[],
): EvidenceSpan[] {
  const byChunk = new Map(passages.map((passage) => [passage.chunkId, passage]));
  return (subtopic.source_spans || []).flatMap((span) => {
    const passage = typeof span.chunkId === 'string' ? byChunk.get(span.chunkId) : undefined;
    if (
      !passage ||
      passage.documentId !== span.documentId ||
      passage.pageNumber !== span.pageNumber ||
      !Number.isSafeInteger(span.lineStart) ||
      !Number.isSafeInteger(span.lineEnd) ||
      Number(span.lineStart) < 1 ||
      Number(span.lineEnd) < Number(span.lineStart)
    )
      return [];
    return [lineEvidence(passage, Number(span.lineStart), Number(span.lineEnd))];
  });
}

function v1BlocksToV2(blocks: LearningBlock[]): LessonBlockV2[] {
  return blocks.map((block) => ({ ...block } as LessonBlockV2));
}

function sourceV2Section(passages: SourcePassage[]): ReadingDocumentV2['sections'][number] {
  const evidence = passages.map((passage) => ({
    chunkId: passage.chunkId,
    documentId: passage.documentId,
    pageNumber: passage.pageNumber,
  }));
  const blocks: LessonBlockV2[] = [];
  for (const passage of passages) {
    blocks.push({
      type: 'heading',
      id: `source-${passage.documentId}-${passage.chunkId}`,
      level: 2,
      text: passage.pageNumber ? `Source page ${passage.pageNumber}` : 'Course source',
      provenance: [lineEvidence(passage, 1, 1)],
    });
    const semantic = sourceSemanticBlocks(passage);
    blocks.push(...semantic);
  }
  return {
    id: 'course-source',
    title: 'Original course material',
    summary: compact(passages.map((passage) => passage.text).join(' '), 700),
    blocks: blocks.length
      ? blocks
      : [
          {
            type: 'paragraph',
            id: 'source-empty',
            text: 'The preserved source contains no readable extracted passages.',
            evidence: ['source-empty'],
          },
        ],
    evidence,
    mappingStatus: 'unmapped',
  };
}

export function canonicalBlocks(
  blocks: Array<Record<string, unknown>>,
  mediaContext?: { courseId: string; revisionId: string },
): LessonBlockV2[] {
  return blocks.flatMap((block, index): LessonBlockV2[] => {
    if (block.type === 'source_lesson') {
      const text = compact(block.text, 1_000_000);
      if (!text) return [];
      // Batch 2 projects source regions after the complete source lesson. The
      // reader displays those exact regions so prose is not shown twice.
      if (blocks.some((candidate) => typeof candidate.regionId === 'string')) return [];
      const id = String(block.id || `canonical-${index}`);
      const evidence = canonicalSpans(block.evidence);
      const chunkId = evidence[0]?.chunkId || 'canonical';
      return sourceBlocks(text, id, chunkId).map((item, blockIndex) => ({
        ...item,
        id: `${id}-${blockIndex + 1}`,
        ...(item.type === 'heading'
          ? {}
          : { evidence: 'evidence' in item && item.evidence?.length ? item.evidence : [chunkId] }),
        // The lesson span list is complete on the canonical source block, but
        // the V2 per-block contract intentionally keeps a bounded provenance
        // sample. Every projected block still names its exact source chunk.
        ...(evidence.length ? { provenance: evidence.slice(0, 8) } : {}),
      })) as unknown as LessonBlockV2[];
    }
    if (block.type === 'callout' && typeof block.text === 'string') {
      return [{
        type: 'callout' as const,
        id: compact(block.id, 128) || `canonical-callout-${index}`,
        kind: compact(block.kind, 40) || 'note',
        ...(typeof block.title === 'string' ? { title: compact(block.title, 500) } : {}),
        text: compact(block.text, 8_000),
        evidence: [],
      }];
    }
    const id = compact(block.id, 128) || `canonical-${index}`;
    const evidenceIds = canonicalSpans(block.evidence)
      .map((span) => span.chunkId)
      .slice(0, 128);
    const semanticTypes = new Set([
      'definition', 'theorem', 'proposition', 'lemma', 'corollary',
      'proof', 'example', 'exercise', 'solution', 'remark',
    ]);
    if (semanticTypes.has(String(block.type))) {
      const text = compact(block.text, 8_000);
      if (!text) return [];
      const shape = {
        type: 'callout',
        id,
        kind: String(block.type).slice(0, 40),
        title: compact(block.title, 500) || String(block.type).replace(/^./, (c) => c.toUpperCase()),
        text,
        evidence: evidenceIds,
        provenance: canonicalSpans(block.evidence).slice(0, 8),
        ...sourceMetaShape(block),
      };
      try { return parseReadingDocumentBlock(shape); } catch { return []; }
    }
    const shape = canonicalBlockShape(block, id, evidenceIds, mediaContext);
    if (!shape) return [];
    try {
      return parseReadingDocumentBlock(shape);
    } catch {
      const fallback = compact(block.text || block.expression || block.code || block.alt, 8_000);
      return fallback
        ? [{ type: 'paragraph' as const, id, text: fallback, evidence: evidenceIds }]
        : [];
    }
  });
}

function sourceMetaShape(block: Record<string, unknown>) {
  const bbox = Array.isArray(block.bbox) && block.bbox.length === 4 && block.bbox.every((value) => typeof value === 'number' && Number.isFinite(value))
    ? block.bbox as [number, number, number, number]
    : null;
  if (typeof block.regionId !== 'string' || !bbox) return {};
  const method = ['text', 'ocr', 'image', 'vector'].includes(String(block.extractionMethod))
    ? block.extractionMethod as 'text' | 'ocr' | 'image' | 'vector'
    : 'text';
  return {
    sourceMeta: {
      regionId: block.regionId.slice(0, 128),
      page: Number.isSafeInteger(block.page) && Number(block.page) > 0 ? Number(block.page) : null,
      bbox,
      extractionMethod: method,
      confidence: typeof block.confidence === 'number' && Number.isFinite(block.confidence)
        ? Math.max(0, Math.min(1, block.confidence))
        : block.reviewRequired === true ? 0 : 1,
      reviewRequired: block.reviewRequired === true,
      issues: Array.isArray(block.issues)
        ? block.issues.filter((issue): issue is string => typeof issue === 'string').slice(0, 16)
        : [],
    },
  };
}

function canonicalSpans(value: unknown): EvidenceSpan[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const span = entry as Record<string, unknown>;
    if (
      typeof span.chunkId !== 'string' ||
      typeof span.documentId !== 'string' ||
      !Number.isSafeInteger(span.lineStart) ||
      !Number.isSafeInteger(span.lineEnd)
    )
      return [];
    return [{
      chunkId: span.chunkId.slice(0, 128),
      documentId: span.documentId.slice(0, 128),
      pageNumber: Number.isSafeInteger(span.pageNumber) ? (span.pageNumber as number) : null,
      lineStart: span.lineStart as number,
      lineEnd: span.lineEnd as number,
    }];
  });
}

function canonicalBlockShape(
  block: Record<string, unknown>,
  id: string,
  evidenceIds: string[],
  mediaContext?: { courseId: string; revisionId: string },
): Record<string, unknown> | null {
  const base = { id, evidence: evidenceIds, provenance: canonicalSpans(block.evidence).slice(0, 8), ...sourceMetaShape(block) };
  switch (block.type) {
    case 'heading':
      return typeof block.text === 'string'
        ? { ...base, type: 'heading', level: Number.isInteger(block.level) ? block.level : 2, text: compact(block.text, 500) }
        : null;
    case 'math':
      return typeof block.expression === 'string'
        ? { ...base, type: 'math', expression: compact((block.reviewedFormula as any)?.expression || block.expression, 8000), notation: block.reviewedFormula || block.notation === 'latex' ? 'latex' : 'plain', ...(block.reviewedFormula ? {review:{state:(block.reviewedFormula as any).state,originalExpression:block.expression,modelExpression:(block.reviewedFormula as any).originalModelLatex,reviewer:(block.reviewedFormula as any).reviewer}} : {}) }
        : null;
    case 'paragraph':
      return typeof block.text === 'string'
        ? { ...base, type: 'paragraph', text: compact(block.text, 8_000) }
        : null;
    case 'table':
      return Array.isArray(block.columns) && Array.isArray(block.rows)
        ? {
            ...base,
            type: 'table',
            columns: block.columns.slice(0, 20).map(String),
            rows: block.rows.slice(0, 100).filter(Array.isArray).map((row) => row.slice(0, 20).map(String)),
            ...(typeof block.caption === 'string' ? { caption: compact(block.caption, 500) } : {}),
          }
        : null;
    case 'code':
      return typeof block.code === 'string'
        ? { ...base, type: 'code', language: compact(block.language, 24) || 'text', code: compact(block.code, 20_000) }
        : null;
    case 'media':
      if (typeof block.alt !== 'string') return null;
      const span = canonicalSpans(block.evidence)[0];
      const regionId = compact(block.sourceRegionId || block.regionId, 128);
      const src = mediaContext && span && regionId
        ? `/api/v1/study/courses/${encodeURIComponent(mediaContext.courseId)}/revisions/${encodeURIComponent(mediaContext.revisionId)}/sources/${encodeURIComponent(span.documentId)}/regions/${encodeURIComponent(regionId)}`
        : undefined;
      return {
        ...base,
        type: 'media',
        mediaType: ['image', 'audio', 'video'].includes(String(block.mediaType)) ? block.mediaType : 'image',
        alt: compact(block.alt, 500),
        ...(src ? { src } : {}),
      };
    default:
      return null;
  }
}

function parseReadingDocumentBlock(value: unknown): LessonBlockV2[] {
  const probe = {
    schemaVersion: '2.0.0', courseId: '00c180a3-7613-594f-947a-320f302cf5cc', revisionId: 'canonical',
    contentHash: 'sha256:' + '0'.repeat(64), title: 'Canonical',
    canonical: { extraction: 'deterministic', projectionVersion: '2.0.0', passages: [], mappings: [] },
    generated: { summary: '', objectives: [], outline: [] },
    sections: [{ id: 'canonical', title: 'Canonical', summary: '', blocks: [value], evidence: [], mappingStatus: 'exact' }],
    sources: [], warnings: [],
  };
  return parseReadingDocumentV2(probe).sections[0].blocks;
}

function legacySections(artifact: Awaited<ReturnType<typeof verifyRevisionArtifact>>, topics: TopicRecord[]): ReadingDocumentV2['sections'] {
  const passages = artifact.passages;
  const sections: ReadingDocumentV2['sections'] = topics.map((topic, index) => {
    const id = compact(topic.id, 128) || `topic-${index + 1}`;
    const generatedBlocks: LearningBlock[] = [];
    const guidance = compact(topic.description, 2_000);
    if (guidance)
      generatedBlocks.push({
        type: 'callout',
        id: `${id}-guidance`,
        kind: 'note',
        title: 'Lesson guidance',
        text: guidance,
        evidence: [],
      });
    const mapped = new Map<string, LessonBlockV2[]>();
    const sectionSpanKeys = new Set<string>();
    let uncertain = false;
    for (const [subIndex, subtopic] of (topic.subtopics || []).entries()) {
      const subtopicId = compact(subtopic.id, 128) || `${id}-subtopic-${subIndex + 1}`;
      const spans = validatedSpans(subtopic, passages);
      for (const span of spans) sectionSpanKeys.add(span.chunkId);
      if (spans.length) {
        const semantic = passages
          .filter((passage) => spans.some((span) => span.chunkId === passage.chunkId))
          .flatMap((passage) => {
            const chunkSpans = spans.filter((span) => span.chunkId === passage.chunkId);
            return sourceSemanticBlocks(passage)
              .filter((block) => {
                const provenance = block.provenance || [];
                return provenance.every((span) =>
                  chunkSpans.some(
                    (allowed) =>
                      allowed.documentId === span.documentId &&
                      allowed.pageNumber === span.pageNumber &&
                      span.lineStart >= allowed.lineStart &&
                      span.lineEnd <= allowed.lineEnd,
                  ),
                );
              })
              .map((block) => ({ ...block, id: `${subtopicId}-${block.id}` }));
          });
        if (semantic.length) mapped.set(subtopicId, semantic);
        else uncertain = true;
      }
      const name = compact(subtopic.title, 500);
      const summary = compact(subtopic.summary, 1_600);
      if (name)
        generatedBlocks.push({
          type: 'heading',
          id: `${id}-subtopic-${subIndex + 1}`,
          level: 2,
          text: name,
        });
      if (summary)
        generatedBlocks.push({
          type: 'callout',
          id: `${id}-summary-${subIndex + 1}`,
          kind: 'note',
          title: 'Study outline',
          text: summary,
          evidence: [],
        });
      for (const [objectiveIndex, objective] of (subtopic.learning_objectives || []).entries()) {
        const statement = compact(objective.statement || objective.text, 2_000);
        if (statement)
          generatedBlocks.push({
            type: 'callout',
            id: `${id}-objective-${subIndex + 1}-${objectiveIndex + 1}`,
            kind: 'note',
            title: 'Learning objective',
            text: statement,
            evidence: [],
          });
      }
    }
    if (!generatedBlocks.length)
      generatedBlocks.push({
        type: 'paragraph',
        id: `${id}-outline-empty`,
        text: 'This topic has no reviewed reading notes yet.',
        evidence: ['outline'],
      });
    const mappedBlocks = [...mapped.values()].flat();
    const mappedChunkIds = new Set(
      passages
        .filter(
          (passage) =>
            sourceMappingMarker(passage.text)?.topicId === id ||
            sectionSpanKeys.has(passage.chunkId),
        )
        .map((passage) => passage.chunkId),
    );
    return {
      id,
      title: compact(topic.title, 500) || `Topic ${index + 1}`,
      summary: guidance,
      blocks: [...v1BlocksToV2(generatedBlocks), ...mappedBlocks],
      evidence: passages
        .filter((passage) => mappedChunkIds.has(passage.chunkId))
        .map((passage) => ({
          chunkId: passage.chunkId,
          documentId: passage.documentId,
          pageNumber: passage.pageNumber,
        })),
      mappingStatus: uncertain ? 'inferred_review_required' : mappedBlocks.length ? 'exact' : 'unmapped',
    };
  });
  return sections;
}

export type PublishedReadingBundle = {
  context: Awaited<ReturnType<typeof getPublishedCourseContext>>;
  revision: any;
  artifact: Awaited<ReturnType<typeof verifyRevisionArtifact>>;
  canonical: CanonicalDocumentV1 | null;
};

/**
 * Single authorization and provenance boundary for every published reading
 * projection. Presentation, reading and any later learner surface must load
 * through this function so revision pinning, checksum and formula-projection
 * guarantees cannot drift between surfaces.
 */
export async function loadPublishedReading(
  actor: string,
  courseId: string,
  revisionId?: string,
): Promise<PublishedReadingBundle> {
  const context = await getPublishedCourseContext(actor, courseId, revisionId);
  const revision = await CourseRevision.findOne({
    courseId,
    revisionTag: context.revisionId,
    status: { $in: ['published', 'deprecated'] },
    activationState: 'committed',
    revokedAt: { $exists: false },
  }).lean();
  if (!revision) throw new LearningDocumentVersionError('Published revision unavailable');
  const artifact = await verifyRevisionArtifact(revision);
  const storedCanonical = revision.contentDocument
    ? parseCanonicalDocument(revision.contentDocument)
    : null;
  if (
    storedCanonical &&
    revision.contentDocumentHash !== activityDigest(revision.contentDocument)
  )
    throw new LearningDocumentVersionError('Canonical content checksum mismatch');
  if (storedCanonical && revision.formulaPublication?.sourceDraftId && revision.contentDocumentHash!==revision.formulaPublication.projectionHash) throw new LearningDocumentVersionError('Frozen reviewed representation checksum mismatch');
  if (storedCanonical && !revision.formulaPublication?.sourceDraftId) for (const c of storedCanonical.chapters) for (const l of c.lessons) for (const b of l.blocks) delete (b as any).reviewedFormula;
  return { context, revision, artifact, canonical: storedCanonical };
}

export async function getLearningDocument(
  actor: string,
  courseId: string,
  revisionId?: string,
): Promise<ReadingDocumentV2> {
  const { context, revision, artifact, canonical: storedCanonical } =
    await loadPublishedReading(actor, courseId, revisionId);
  const passages = artifact.passages;
  const topics = (revision.topics || []) as TopicRecord[];
  const generatedSummary = compact(
    revision.summary || topics.map((topic) => topic.description).filter(Boolean).join(' '),
    2_000,
  );
  const sections: ReadingDocumentV2['sections'] = storedCanonical
    ? storedCanonical.chapters.map((chapter, index) => {
        const blocks: LessonBlockV2[] = [];
        for (const lesson of chapter.lessons) {
          blocks.push({ type: 'heading', id: `${lesson.id}-title`, level: 2, text: lesson.title });
          blocks.push(...canonicalBlocks(
            lesson.blocks as Array<Record<string, unknown>>,
            { courseId, revisionId: context.revisionId },
          ));
        }
        return {
          id: compact(chapter.id, 128) || `topic-${index + 1}`,
          title: compact(chapter.title, 500) || `Topic ${index + 1}`,
          summary: compact(chapter.lessons.map((lesson) => lesson.summary).join(' '), 700),
          blocks: blocks.length ? blocks : [{ type: 'paragraph', id: `${chapter.id}-empty`, text: 'This chapter has no readable source prose.', evidence: ['outline'] }],
          // The stored lesson keeps every span. Section evidence is a bounded
          // navigation sample under the V2 contract; block provenance remains
          // the precise source pointer for each projected passage.
          evidence: chapter.lessons
            .flatMap((lesson) => lesson.source_spans)
            .slice(0, 128)
            .map((span) => ({ chunkId: span.chunkId, documentId: span.documentId, pageNumber: span.pageNumber })),
          mappingStatus: chapter.lessons.some((lesson) => lesson.source_spans.length) ? 'exact' : 'unmapped',
        };
      })
    : legacySections(artifact, topics);
  sections.push(sourceV2Section(passages));
  const projection = projectSemanticContent(
    passages.map((passage) => ({
      chunkId: passage.chunkId,
      documentId: passage.documentId,
      pageNumber: passage.pageNumber,
      sectionId: passage.sectionId,
      text: passage.text,
    })),
  );
  const canonical: ReadingDocumentV2['canonical'] = {
    extraction: 'deterministic',
    projectionVersion: '2.0.0',
    passages: projection.passages.map((passage) => ({
      chunkId: passage.chunkId,
      documentId: passage.documentId,
      pageNumber: passage.pageNumber,
      sectionId: passage.sectionId,
      blocks: storedCanonical
        ? [
            {
              type: 'paragraph',
              id: `${passage.chunkId}-canonical-summary`,
              text: passage.text.slice(0, 8_000),
              evidence: [passage.chunkId],
            },
          ]
        : sourceSemanticBlocks({
            ...artifact.passages.find((item) => item.chunkId === passage.chunkId)!,
          }),
    })),
    mappings: projection.mappings,
  };
  const qualityWarnings = storedCanonical?.quality?.publicationState === 'review_required'
    ? ['Extraction fidelity needs review. Source linkage does not establish mathematical correctness.']
    : [];
  const document = {
    schemaVersion: LEARNING_DOCUMENT_VERSION,
    courseId,
    revisionId: context.revisionId,
    contentHash: context.contentHash,
    title: compact(context.title, 200),
    canonical,
    generated: {
      summary: generatedSummary,
      objectives: context.topics.flatMap((topic) => topic.objectives),
      outline: topics.map((topic, index) => ({
        id: compact(topic.id, 128) || `topic-${index + 1}`,
        title: compact(topic.title, 500) || `Topic ${index + 1}`,
        summary: compact(topic.description, 2_000),
        objectives: (topic.subtopics || []).flatMap((subtopic) =>
          (subtopic.learning_objectives || []).flatMap((objective) => {
            const statement = compact(objective.statement || objective.text, 2_000);
            return statement
              ? [
                  {
                    objectiveId:
                      compact(objective.id || objective.objectiveId, 128) ||
                      `objective-${index + 1}`,
                    statement,
                    bloomLevel: compact(objective.bloomLevel, 40) || 'understand',
                  },
                ]
              : [];
          }),
        ),
      })),
    },
    sections,
    sources: artifact.metadata.documents.map((source) => ({
      documentId: source.documentId,
      contentHash: source.contentHash,
      pageNumber: null,
      href: `/api/v1/study/courses/${encodeURIComponent(courseId)}/revisions/${encodeURIComponent(context.revisionId)}/sources/${encodeURIComponent(source.documentId)}`,
    })),
    warnings: passages.some((passage) => passage.extractionMethod === 'ocr' && passage.reviewRequired)
      ? ['Some pages came from low-confidence OCR. Check the original source before relying on exact wording.', ...qualityWarnings]
      : storedCanonical
        ? ['Source provenance is bound to the preserved document. Extraction fidelity, including symbols and layout, is unverified.', ...qualityWarnings]
      : qualityWarnings.length ? qualityWarnings : [],
  };
  return parseReadingDocumentV2(document);
}
