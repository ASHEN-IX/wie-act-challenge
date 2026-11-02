/** EdNova reading-document v2 (Phase 2).
 *
 * V1 remains the published artifact contract. This projection adds source
 * spans, semantic block evidence and explicit mapping uncertainty. It is a
 * browser-safe view, never an authorization grant and never executable HTML. */

export type EvidenceSpan = {
  chunkId: string;
  documentId: string;
  pageNumber: number | null;
  lineStart: number;
  lineEnd: number;
};

export type ChartSeries = {
  label: string;
  values: number[];
  color?: 'primary' | 'secondary' | 'accent';
};

export type LessonChart = {
  type: 'chart';
  id: string;
  title: string;
  caption?: string;
  kind: 'bar' | 'line';
  categories: string[];
  series: ChartSeries[];
  yLabel?: string;
  evidence: string[];
  provenance?: EvidenceSpan[];
};

export type LessonBlockV2 =
  | ((LearningBlockV1 & { provenance?: EvidenceSpan[] }) & { chart?: never })
  | LessonChart;

export type LearningBlockV1 =
  | { type: 'heading'; id: string; level: 1 | 2 | 3 | 4; text: string }
  | { type: 'paragraph'; id: string; text: string; evidence: string[] }
  | { type: 'list'; id: string; ordered: boolean; items: string[]; evidence: string[] }
  | { type: 'quote'; id: string; text: string; evidence: string[] }
  | { type: 'code'; id: string; language: string; code: string; caption?: string; evidence?: string[] }
  | { type: 'math'; id: string; expression: string; notation: 'latex' | 'plain'; caption?: string; evidence?: string[] }
  | {
      type: 'table';
      id: string;
      caption?: string;
      columns: string[];
      rows: string[][];
      evidence: string[];
    }
  | { type: 'media'; id: string; mediaType: 'image' | 'audio' | 'video'; src?: string; alt: string; caption?: string; evidence?: string[] }
  | { type: 'diagram'; id: string; title: string; description: string; steps: Array<{ id: string; label: string; detail?: string }>; evidence?: string[] }
  | { type: 'callout'; id: string; kind: string; title?: string; text: string; evidence: string[] };

export type ReadingDocumentV2 = {
  schemaVersion: '2.0.0';
  courseId: string;
  revisionId: string;
  contentHash: string;
  title: string;
  /** Canonical material is separate from generated summaries and experiences. */
  canonical: {
    extraction: 'deterministic';
    projectionVersion: '2.0.0';
    passages: Array<{
      chunkId: string;
      documentId: string;
      pageNumber: number | null;
      sectionId: string;
      blocks: LessonBlockV2[];
    }>;
    mappings: Array<{
      chunkId: string;
      documentId: string;
      pageNumber: number | null;
      topicId: string | null;
      subtopicId: string | null;
      status: 'exact' | 'inferred_review_required' | 'unmapped';
      method: 'artifact_metadata' | 'source_marker' | 'legacy_unmapped';
      note?: string;
    }>;
  };
  generated: {
    summary: string;
    objectives: Array<{ objectiveId: string; statement: string; bloomLevel: string }>;
    outline: Array<{
      id: string;
      title: string;
      summary: string;
      objectives: Array<{ objectiveId: string; statement: string; bloomLevel: string }>;
    }>;
  };
  sections: Array<{
    id: string;
    title: string;
    summary: string;
    blocks: LessonBlockV2[];
    evidence: Array<{ chunkId: string; documentId: string; pageNumber: number | null }>;
    mappingStatus: 'exact' | 'inferred_review_required' | 'unmapped';
  }>;
  sources: Array<{ documentId: string; contentHash: string; pageNumber: number | null; href: string }>;
  warnings: string[];
};

/** Persisted canonical source model. It is versioned separately from browser
 * projections so stored courses can evolve without breaking old readers. */
export type CanonicalDocumentV1 = {
  schemaVersion: '1.0.0';
  courseId: string;
  title: string;
  provenance: { content: 'extracted'; structure: 'deterministic' };
  verification: 'source_text_unverified';
  chapters: Array<{
    id: string;
    title: string;
    lessons: Array<{
      id: string;
      title: string;
      summary: string;
      source_spans: EvidenceSpan[];
      blocks: Array<Record<string, unknown>>;
    }>;
  }>;
};

const fail = (): never => { throw new Error('INVALID_LEARNING_DOCUMENT_V2'); };
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exact = (
  value: unknown,
  keys: string[],
): Record<string, unknown> => {
  if (!isRecord(value) || Object.keys(value).some((key) => !keys.includes(key))) fail();
  return value as Record<string, unknown>;
};
const str = (value: unknown, max: number) => {
  if (typeof value !== 'string' || value.length > max) fail();
  return value as string;
};
const optional = <T>(value: unknown, check: (v: unknown) => T): T | undefined =>
  value === undefined ? undefined : check(value);
const nullableInt = (value: unknown) => {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || (value as number) < 1) fail();
  return value as number;
};
const list = <T>(value: unknown, check: (v: unknown) => T, max: number) => {
  if (!Array.isArray(value) || value.length > max) fail();
  return (value as unknown[]).map(check);
};

const evidenceSpan = (value: unknown) => {
  const v = exact(value, ['chunkId', 'documentId', 'pageNumber', 'lineStart', 'lineEnd']);
  const start = v.lineStart;
  const end = v.lineEnd;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || (start as number) < 1 || (end as number) < (start as number)) fail();
  return { chunkId: str(v.chunkId, 128), documentId: str(v.documentId, 128), pageNumber: nullableInt(v.pageNumber), lineStart: start as number, lineEnd: end as number };
};
const evidence = (value: unknown) => list(value, (v) => str(v, 128), 128);
const sourceEvidence = (value: unknown) => {
  const v = exact(value, ['chunkId', 'documentId', 'pageNumber']);
  return { chunkId: str(v.chunkId, 128), documentId: str(v.documentId, 128), pageNumber: nullableInt(v.pageNumber) };
};

const base = (value: unknown, keys: string[]) => {
  const v = exact(value, keys);
  str(v.id, 128);
  return v;
};

function block(value: unknown): LessonBlockV2 {
  if (!isRecord(value) || typeof (value as Record<string, unknown>).type !== 'string') fail();
  const type = (value as Record<string, unknown>).type as string;
  if (type === 'heading') {
    const v = base(value, ['type', 'id', 'level', 'text', 'provenance']);
    if (!Number.isInteger(v.level) || (v.level as number) < 1 || (v.level as number) > 4) fail();
    return { type, id: str(v.id, 128), level: v.level as 1 | 2 | 3 | 4, text: str(v.text, 500), ...(v.provenance !== undefined ? { provenance: list(v.provenance, evidenceSpan, 8) } : {}) };
  }
  if (type === 'paragraph' || type === 'quote' || type === 'callout') {
    const keys = type === 'callout' ? ['type', 'id', 'kind', 'title', 'text', 'evidence', 'provenance'] : ['type', 'id', 'text', 'evidence', 'provenance'];
    const v = base(value, keys);
    const result: Record<string, unknown> = { type, id: str(v.id, 128), text: str(v.text, type === 'quote' ? 4000 : 8000), evidence: evidence(v.evidence) };
    if (type === 'callout') { result.kind = str(v.kind, 40); if (v.title !== undefined) result.title = str(v.title, 500); }
    if (v.provenance !== undefined) result.provenance = list(v.provenance, evidenceSpan, 8);
    return result as LessonBlockV2;
  }
  if (type === 'list') {
    const v = base(value, ['type', 'id', 'ordered', 'items', 'evidence', 'provenance']);
    if (typeof v.ordered !== 'boolean') fail();
    return { type, id: str(v.id, 128), ordered: v.ordered as boolean, items: list(v.items, (x) => str(x, 1200), 80), evidence: evidence(v.evidence), ...(v.provenance !== undefined ? { provenance: list(v.provenance, evidenceSpan, 8) } : {}) };
  }
  if (type === 'code') {
    const v = base(value, ['type', 'id', 'language', 'code', 'caption', 'evidence', 'provenance']);
    return { type, id: str(v.id, 128), language: str(v.language, 24), code: str(v.code, 20000), ...(v.caption !== undefined ? { caption: str(v.caption, 500) } : {}), ...(v.evidence !== undefined ? { evidence: evidence(v.evidence) } : {}), ...(v.provenance !== undefined ? { provenance: list(v.provenance, evidenceSpan, 8) } : {}) } as LessonBlockV2;
  }
  if (type === 'math') {
    const v = base(value, ['type', 'id', 'expression', 'notation', 'caption', 'evidence', 'provenance']);
    if (v.notation !== 'latex' && v.notation !== 'plain') fail();
    return { type, id: str(v.id, 128), expression: str(v.expression, 600), notation: v.notation, ...(v.caption !== undefined ? { caption: str(v.caption, 500) } : {}), ...(v.evidence !== undefined ? { evidence: evidence(v.evidence) } : {}), ...(v.provenance !== undefined ? { provenance: list(v.provenance, evidenceSpan, 8) } : {}) } as LessonBlockV2;
  }
  if (type === 'table') {
    const v = base(value, ['type', 'id', 'caption', 'columns', 'rows', 'evidence', 'provenance']);
    const columns = list(v.columns, (x) => str(x, 300), 20);
    const rows = list(v.rows, (row: unknown) => list(row, (x) => str(x, 1200), 20), 100);
    if (rows.some((row) => row.length !== columns.length)) fail();
    return { type, id: str(v.id, 128), columns, rows, evidence: evidence(v.evidence), ...(v.caption !== undefined ? { caption: str(v.caption, 500) } : {}), ...(v.provenance !== undefined ? { provenance: list(v.provenance, evidenceSpan, 8) } : {}) };
  }
  if (type === 'media') {
    const v = base(value, ['type', 'id', 'mediaType', 'src', 'alt', 'caption', 'evidence', 'provenance']);
    if (v.mediaType !== 'image' && v.mediaType !== 'audio' && v.mediaType !== 'video') fail();
    return { type, id: str(v.id, 128), mediaType: v.mediaType, alt: str(v.alt, 500), ...(v.src !== undefined ? { src: str(v.src, 2048) } : {}), ...(v.caption !== undefined ? { caption: str(v.caption, 500) } : {}), ...(v.evidence !== undefined ? { evidence: evidence(v.evidence) } : {}), ...(v.provenance !== undefined ? { provenance: list(v.provenance, evidenceSpan, 8) } : {}) } as LessonBlockV2;
  }
  if (type === 'diagram') {
    const v = base(value, ['type', 'id', 'title', 'description', 'steps', 'evidence', 'provenance']);
    const steps = list(v.steps, (step) => {
      const s = exact(step, ['id', 'label', 'detail']);
      return { id: str(s.id, 128), label: str(s.label, 300), ...(s.detail !== undefined ? { detail: str(s.detail, 1000) } : {}) };
    }, 60);
    return { type, id: str(v.id, 128), title: str(v.title, 500), description: str(v.description, 2000), steps, ...(v.evidence !== undefined ? { evidence: evidence(v.evidence) } : {}), ...(v.provenance !== undefined ? { provenance: list(v.provenance, evidenceSpan, 8) } : {}) };
  }
  if (type === 'chart') {
    const v = base(value, ['type', 'id', 'title', 'caption', 'kind', 'categories', 'series', 'yLabel', 'evidence', 'provenance']);
    if (v.kind !== 'bar' && v.kind !== 'line') fail();
    const categories = list(v.categories, (x) => str(x, 120), 30);
    const series = list(v.series, (entry) => {
      const s = exact(entry, ['label', 'values', 'color']);
      const values = list(s.values, (x) => {
        if (typeof x !== 'number' || !Number.isFinite(x) || Math.abs(x) > 1e12) fail();
        return x as number;
      }, 30);
      if (values.length !== categories.length) fail();
      if (s.color !== undefined && !['primary', 'secondary', 'accent'].includes(String(s.color))) fail();
      return { label: str(s.label, 120), values, ...(s.color !== undefined ? { color: s.color as ChartSeries['color'] } : {}) };
    }, 3);
    return { type, id: str(v.id, 128), title: str(v.title, 300), kind: v.kind as 'bar' | 'line', categories, series, evidence: evidence(v.evidence), ...(v.caption !== undefined ? { caption: str(v.caption, 300) } : {}), ...(v.yLabel !== undefined ? { yLabel: str(v.yLabel, 100) } : {}), ...(v.provenance !== undefined ? { provenance: list(v.provenance, evidenceSpan, 8) } : {}) };
  }
  return fail();
}

const objective = (value: unknown) => {
  const v = exact(value, ['objectiveId', 'statement', 'bloomLevel']);
  return { objectiveId: str(v.objectiveId, 128), statement: str(v.statement, 2000), bloomLevel: str(v.bloomLevel, 40) };
};

export function parseReadingDocumentV2(value: unknown): ReadingDocumentV2 {
  const v = exact(value, ['schemaVersion', 'courseId', 'revisionId', 'contentHash', 'title', 'canonical', 'generated', 'sections', 'sources', 'warnings']);
  if (v.schemaVersion !== '2.0.0') fail();
  if (typeof v.courseId !== 'string' || !/^[a-f0-9]{24}$/.test(v.courseId)) fail();
  if (typeof v.contentHash !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(v.contentHash)) fail();
  const canonical = exact(v.canonical, ['extraction', 'projectionVersion', 'passages', 'mappings']);
  if (canonical.extraction !== 'deterministic' || canonical.projectionVersion !== '2.0.0') fail();
  const passages = list(canonical.passages, (entry) => {
    const p = exact(entry, ['chunkId', 'documentId', 'pageNumber', 'sectionId', 'blocks']);
    return { chunkId: str(p.chunkId, 128), documentId: str(p.documentId, 128), pageNumber: nullableInt(p.pageNumber), sectionId: str(p.sectionId, 128), blocks: list(p.blocks, block, 400) };
  }, 2000);
  const mappings = list(canonical.mappings, (entry) => {
    const m = exact(entry, ['chunkId', 'documentId', 'pageNumber', 'topicId', 'subtopicId', 'status', 'method', 'note']);
    if (!['exact', 'inferred_review_required', 'unmapped'].includes(String(m.status))) fail();
    if (!['artifact_metadata', 'source_marker', 'legacy_unmapped'].includes(String(m.method))) fail();
    return { chunkId: str(m.chunkId, 128), documentId: str(m.documentId, 128), pageNumber: nullableInt(m.pageNumber), topicId: m.topicId === null ? null : str(m.topicId, 128), subtopicId: m.subtopicId === null ? null : str(m.subtopicId, 128), status: m.status as 'exact' | 'inferred_review_required' | 'unmapped', method: m.method as 'artifact_metadata' | 'source_marker' | 'legacy_unmapped', ...(m.note !== undefined ? { note: str(m.note, 500) } : {}) };
  }, 2000);
  const generated = exact(v.generated, ['summary', 'objectives', 'outline']);
  const sections = list(v.sections, (entry) => {
    const s = exact(entry, ['id', 'title', 'summary', 'blocks', 'evidence', 'mappingStatus']);
    if (!['exact', 'inferred_review_required', 'unmapped'].includes(String(s.mappingStatus))) fail();
    return { id: str(s.id, 128), title: str(s.title, 500), summary: str(s.summary, 700), blocks: list(s.blocks, block, 400), evidence: list(s.evidence, sourceEvidence, 128), mappingStatus: s.mappingStatus as 'exact' | 'inferred_review_required' | 'unmapped' };
  }, 500);
  if (!sections.length) fail();
  const sources = list(v.sources, (entry) => {
    const s = exact(entry, ['documentId', 'contentHash', 'pageNumber', 'href']);
    if (typeof s.contentHash !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(s.contentHash)) fail();
    return { documentId: str(s.documentId, 128), contentHash: s.contentHash as string, pageNumber: nullableInt(s.pageNumber), href: str(s.href, 2048) };
  }, 32);
  return {
    schemaVersion: '2.0.0', courseId: v.courseId as string, revisionId: str(v.revisionId, 128), contentHash: v.contentHash as string, title: str(v.title, 200),
    canonical: { extraction: 'deterministic', projectionVersion: '2.0.0', passages, mappings },
    generated: { summary: str(generated.summary, 2000), objectives: list(generated.objectives, objective, 500), outline: list(generated.outline, (entry) => { const o = exact(entry, ['id', 'title', 'summary', 'objectives']); return { id: str(o.id, 128), title: str(o.title, 500), summary: str(o.summary, 2000), objectives: list(o.objectives, objective, 100) }; }, 100) },
    sections, sources, warnings: list(v.warnings, (x) => str(x, 2000), 20),
  };
}

/** Explicit migration boundary for old v1 reading projections. */
export function migrateReadingDocumentV1(value: {
  schemaVersion: '1.0.0'; courseId: string; revisionId: string; contentHash: string; title: string;
  generated: ReadingDocumentV2['generated']; sections: LearningDocumentV1Section[];
  sources: ReadingDocumentV2['sources']; warnings: string[];
}): ReadingDocumentV2 {
  const sourceSection = value.sections.find((section) => section.id === 'course-source');
  const passages = (sourceSection?.blocks || []).flatMap((entry, index) =>
    entry.type === 'paragraph' || entry.type === 'list' || entry.type === 'quote' || entry.type === 'code' || entry.type === 'math' || entry.type === 'table'
      ? entry.evidence?.[0] ? [{ chunkId: entry.evidence[0], documentId: value.sources[0]?.documentId || '', pageNumber: null, sectionId: 'v1-source', blocks: [entry as LessonBlockV2] }] : []
      : []
  );
  const deduped = new Map(passages.map((passage) => [passage.chunkId, passage]));
  return {
    schemaVersion: '2.0.0', courseId: value.courseId, revisionId: value.revisionId, contentHash: value.contentHash, title: value.title,
    canonical: { extraction: 'deterministic', projectionVersion: '2.0.0', passages: [...deduped.values()], mappings: [...deduped.keys()].map((chunkId) => ({ chunkId, documentId: value.sources[0]?.documentId || '', pageNumber: null, topicId: null, subtopicId: null, status: 'unmapped', method: 'legacy_unmapped', note: 'Migrated from a v1 reading projection; topic association is unknown.' })) },
    generated: value.generated,
    sections: value.sections.filter((section) => section.id !== 'course-source').map((section) => ({ ...section, mappingStatus: 'unmapped' as const })),
    sources: value.sources, warnings: [...value.warnings, 'This course was migrated from reading v1. Source material remains in its original order; exact topic mapping was not recorded.'],
  };
}

export type LearningDocumentV1Section = {
  id: string; title: string; summary: string; blocks: LessonBlockV2[];
  evidence: Array<{ chunkId: string; documentId: string; pageNumber: number | null }>;
};
