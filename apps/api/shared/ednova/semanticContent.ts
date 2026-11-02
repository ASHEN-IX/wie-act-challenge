/** Deterministic semantic extraction over verified source passages.
 *
 * This module does not infer a topic from similar wording. Blocks and spans
 * carry evidence only when their structure is explicit in the source text.
 * A missing association is represented as unmapped, never guessed. */

export const SEMANTIC_PROJECTION_VERSION = '2.0.0' as const;

export type SemanticBlockType =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'quote'
  | 'code'
  | 'math'
  | 'table'
  | 'media'
  | 'diagram'
  | 'callout';

export interface SemanticEvidence {
  chunkId: string;
  documentId: string;
  pageNumber: number | null;
  /** One-based line range within the verified chunk. */
  lineStart: number;
  lineEnd: number;
}

interface SemanticBlockBase {
  id: string;
  order: number;
  evidence: SemanticEvidence;
}

// Distribute over the discriminated union so each block variant keeps its own
// required fields instead of collapsing to fields shared by every variant.
type BlockInput<T> = T extends unknown ? Omit<T, 'id' | 'evidence' | 'order'> : never;

export type SemanticBlock =
  | (SemanticBlockBase & { type: 'heading'; level: 1 | 2 | 3 | 4; text: string })
  | (SemanticBlockBase & { type: 'paragraph'; text: string })
  | (SemanticBlockBase & { type: 'list'; ordered: boolean; items: string[] })
  | (SemanticBlockBase & { type: 'quote'; text: string })
  | (SemanticBlockBase & { type: 'code'; language: string; code: string; caption?: string })
  | (SemanticBlockBase & {
      type: 'math';
      expression: string;
      notation: 'latex' | 'plain';
      caption?: string;
    })
  | (SemanticBlockBase & {
      type: 'table';
      caption: string;
      columns: string[];
      rows: string[][];
    })
  | (SemanticBlockBase & {
      type: 'media';
      mediaType: 'image' | 'audio' | 'video';
      /** A source reference, never an executable URL. Render only through an
       * approved media resolver. */
      sourceRef?: string;
      alt: string;
      caption?: string;
    })
  | (SemanticBlockBase & {
      type: 'diagram';
      title: string;
      description: string;
      steps: Array<{ id: string; label: string; detail?: string }>;
    })
  | (SemanticBlockBase & SemanticChartBlock)
  | (SemanticBlockBase & {
      type: 'callout';
      kind: 'definition' | 'theorem' | 'example' | 'proof' | 'exercise' | 'note';
      title?: string;
      text: string;
    });

export interface SemanticPassage {
  chunkId: string;
  documentId: string;
  pageNumber: number | null;
  text: string;
  sectionId: string;
}

export type MappingStatus = 'exact' | 'inferred_review_required' | 'unmapped';

export interface SemanticMapping {
  chunkId: string;
  documentId: string;
  pageNumber: number | null;
  topicId: string | null;
  subtopicId: string | null;
  status: MappingStatus;
  /** Explicit source markers are required before a mapping can be exact. */
  method: 'artifact_metadata' | 'source_marker' | 'legacy_unmapped';
  note?: string;
}

export interface SemanticChapter {
  id: string;
  title: string;
  /** Only blocks whose evidence shares this chapter's explicit source marker. */
  blocks: SemanticBlock[];
}

export interface SemanticProjection {
  schemaVersion: typeof SEMANTIC_PROJECTION_VERSION;
  extraction: 'deterministic';
  passages: Array<SemanticPassage & { blocks: SemanticBlock[] }>;
  chapters: SemanticChapter[];
  mappings: SemanticMapping[];
  uncertainties: string[];
}

export interface SemanticDiagramBlock {
  type: 'diagram';
  title: string;
  description: string;
  steps: Array<{ id: string; label: string; detail?: string }>;
}

export interface SemanticChartBlock {
  type: 'chart';
  title: string;
  caption?: string;
  kind: 'bar' | 'line';
  categories: string[];
  series: Array<{
    label: string;
    values: number[];
    color?: 'primary' | 'secondary' | 'accent';
  }>;
  yLabel?: string;
}

export interface ExplicitPassageMapping {
  chunkId: string;
  documentId: string;
  pageNumber: number | null;
  topicId: string | null;
  subtopicId: string | null;
  status: 'exact' | 'inferred_review_required';
}

const mediaExtension = /\.(png|jpe?g|gif|webp|svg|mp3|wav|ogg|mp4|webm)(?:[?#].*)?$/i;

function evidence(
  passage: SemanticPassage,
  lineStart: number,
  lineEnd = lineStart,
): SemanticEvidence {
  return {
    chunkId: passage.chunkId,
    documentId: passage.documentId,
    pageNumber: passage.pageNumber,
    lineStart,
    lineEnd,
  };
}

function tableCells(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return null;
  const cells = trimmed
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
  const divider = cells.every((cell) => /^:?-{3,}:?$/.test(cell));
  return cells.length >= 2 && !divider ? cells : null;
}

function isTableDivider(line: string): boolean {
  return /^\|?(\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?$/.test(line.trim());
}

function mediaReference(
  line: string,
): { sourceRef: string; alt: string; mediaType: 'image' | 'audio' | 'video' } | null {
  const markdown = line.match(/^!\[([^\]]{0,500})\]\(([^)\s]{1,2048})\)$/);
  if (markdown && mediaExtension.test(markdown[2]))
    return { sourceRef: markdown[2], alt: markdown[1] || 'Source image', mediaType: 'image' };
  const html = line.match(/^<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*\balt=["']([^"']*)["'][^>]*>$/i);
  if (html && mediaExtension.test(html[1]))
    return { sourceRef: html[1], alt: html[2] || 'Source image', mediaType: 'image' };
  return null;
}

function mediaCaption(line: string): string | null {
  const match = line.match(
    /^(?:\*\*(?:Image|Figure|Table|Diagram):\s*(.{1,500})\*\*|(?:Image|Figure|Table|Diagram):\s*(.{1,500}))$/i,
  );
  return (match?.[1] || match?.[2])?.trim() || null;
}

function splitDiagramStep(value: string): { label: string; detail?: string } | null {
  const separator = value.indexOf(':');
  if (separator < 1) return null;
  const label = value.slice(0, separator).trim().slice(0, 300);
  const detail = value.slice(separator + 1).trim().slice(0, 1000);
  return label ? { label, ...(detail ? { detail } : {}) } : null;
}

function parseDiagram(source: string): SemanticDiagramBlock | null {
  let title = '';
  let description = '';
  const steps: SemanticDiagramBlock['steps'] = [];
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const directive = /^(title|description|step):\s*(.+)$/i.exec(line);
    if (!directive) return null;
    const [, name, value] = directive;
    if (name.toLowerCase() === 'title') title = value.trim().slice(0, 500);
    else if (name.toLowerCase() === 'description')
      description = value.trim().slice(0, 2000);
    else {
      const step = splitDiagramStep(value);
      if (!step || steps.length >= 60) return null;
      steps.push({ id: `step-${steps.length + 1}`, ...step });
    }
  }
  return title && description && steps.length ? { type: 'diagram', title, description, steps } : null;
}

function parseChart(source: string): SemanticChartBlock | null {
  const lines = source.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 4) return null;
  const header = /^columns:\s*(.+)$/i.exec(lines[0]);
  const title = /^title:\s*(.+)$/i.exec(lines[1]);
  const kind = /^kind:\s*(bar|line)$/i.exec(lines[2]);
  if (!header || !title || !kind) return null;
  const columns = header[1].split('|').map((cell) => cell.trim());
  if (columns.length < 2 || columns.length > 4) return null;
  const categories: string[] = [];
  const values = columns.slice(1).map(() => [] as number[]);
  for (const row of lines.slice(3)) {
    const cells = row.split('|').map((cell) => cell.trim());
    if (cells.length !== columns.length || !cells[0] || cells[0].length > 120) return null;
    const numbers = cells.slice(1).map((cell) => Number(cell));
    if (numbers.some((number) => !Number.isFinite(number) || Math.abs(number) > 1e12)) return null;
    categories.push(cells[0]);
    numbers.forEach((number, index) => values[index].push(number));
  }
  if (!categories.length || categories.length > 30) return null;
  return {
    type: 'chart',
    title: title[1].trim().slice(0, 300),
    kind: kind[1].toLowerCase() as 'bar' | 'line',
    categories,
    series: columns.slice(1).map((label, index) => ({
      label: label.slice(0, 120),
      values: values[index],
      ...(index === 0 ? { color: 'primary' as const } : {}),
    })),
  };
}

/** Extract only structures that are clear in the uploaded text. An ambiguous
 * table or markup fragment stays visible as a paragraph. */
export function extractSemanticBlocks(passage: SemanticPassage): SemanticBlock[] {
  // A declaration marker governs the document but is not instructional text.
  // Strip it here so every caller observes the same source order.
  const declaration = sourceMappingMarker(passage.text);
  // Keep the marker's newline so every following block reports its original
  // line number. Removing both lines would shift all evidence by one.
  const sourceText = declaration ? passage.text.replace(/^\uFEFF?[^\n]*/, '') : passage.text;
  const lines = sourceText.replace(/\r\n?/g, '\n').split('\n');
  const blocks: SemanticBlock[] = [];
  const push = (
    block: BlockInput<SemanticBlock>,
    lineStart: number,
    lineEnd = lineStart,
  ) => {
    const order = blocks.length + 1;
    blocks.push({
      ...block,
      id: `${passage.chunkId}-block-${order}`,
      order,
      evidence: evidence(passage, lineStart, lineEnd),
    } as SemanticBlock);
  };
  let paragraph: Array<{ text: string; line: number }> = [];
  let list: Array<{ text: string; line: number }> = [];
  let ordered = false;
  let quote: Array<{ text: string; line: number }> = [];
  let code: { language: string; lines: string[]; start: number } | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    push(
      { type: 'paragraph', text: paragraph.map((line) => line.text).join(' ').replace(/\s+/g, ' ').trim().slice(0, 8000) },
      paragraph[0].line,
      paragraph.at(-1)!.line,
    );
    paragraph = [];
  };
  const flushList = () => {
    if (list.length)
      push(
        { type: 'list', ordered, items: list.map((item) => item.text.slice(0, 1200)) },
        list[0].line,
        list.at(-1)!.line,
      );
    list = [];
  };
  const flushQuote = () => {
    if (quote.length)
      push(
        { type: 'quote', text: quote.map((line) => line.text).join('\n').slice(0, 4000) },
        quote[0].line,
        quote.at(-1)!.line,
      );
    quote = [];
  };
  const flushCode = () => {
    if (code) {
      const value = code.lines.join('\n').trim().slice(0, 20_000);
      const structured: SemanticDiagramBlock | SemanticChartBlock | null =
        code.language === 'ednova-diagram'
          ? parseDiagram(value)
          : code.language === 'ednova-chart'
            ? parseChart(value)
            : null;
      if (structured)
        push(structured, code.start, code.start + code.lines.length + 1);
      else if (value)
        push(
          { type: 'code', language: code.language, code: value },
          code.start,
          code.start + code.lines.length + 1,
        );
    }
    code = null;
  };
  const flush = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index].replace(/\s+$/, '');
    const trimmed = raw.trim();
    const line = index + 1;
    if (code) {
      if (/^```/.test(trimmed)) flushCode();
      else code.lines.push(raw);
      continue;
    }
    const fence = trimmed.match(/^```([\w+#.-]{0,24})$/);
    if (fence) {
      flush();
      code = { language: fence[1] || 'text', lines: [], start: line };
      continue;
    }
    const heading = raw.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flush();
      push(
        {
          type: 'heading',
          level: Math.min(4, heading[1].length) as 1 | 2 | 3 | 4,
          text: heading[2].trim().slice(0, 500),
        },
        line,
      );
      continue;
    }
    const formula = trimmed.match(/^\$\$\s*([^$\n]{1,600})\s*\$\$$/);
    if (formula) {
      flush();
      push({ type: 'math', expression: formula[1].trim(), notation: 'latex' }, line);
      continue;
    }
    const columns = tableCells(raw);
    const divider = index + 1 < lines.length && isTableDivider(lines[index + 1]);
    if (
      columns &&
      divider
    ) {
      flush();
      const start = line;
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && tableCells(lines[index])) {
        const cells = tableCells(lines[index])!;
        if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) break;
        if (cells.length !== columns.length) break;
        rows.push(cells);
        index += 1;
      }
      if (rows.length > 0 && rows.every((row) => row.length === columns.length) && columns.length <= 20) {
        push(
          {
            type: 'table',
            caption: 'Table from source',
            columns: columns.map((cell) => cell.slice(0, 300)),
            rows: rows.slice(0, 100).map((row) => row.map((cell) => cell.slice(0, 1200))),
          },
          start,
          index,
        );
      } else {
        // Malformed widths remain readable and are never silently dropped.
        flush();
        for (let row = start - 1; row <= index; row += 1) {
          paragraph.push({ text: lines[row].trim(), line: row + 1 });
        }
        flushParagraph();
      }
      continue;
    }
    const unordered = raw.match(/^\s*[-*+]\s+(.+)$/);
    const numbered = raw.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || numbered) {
      flushParagraph();
      flushQuote();
      const nextOrdered = Boolean(numbered);
      if (list.length && ordered !== nextOrdered) flushList();
      ordered = nextOrdered;
      list.push({ text: (unordered?.[1] || numbered?.[1] || '').trim(), line });
      continue;
    }
    if (/^\s*>\s?/.test(raw)) {
      flushParagraph();
      flushList();
      quote.push({ text: raw.replace(/^\s*>\s?/, '').trim(), line });
      continue;
    }
    const media = mediaReference(trimmed);
    if (media && !/^(?:https?:)?\/\//i.test(media.sourceRef) && !media.sourceRef.startsWith('data:')) {
      flush();
      const previousLine = lines[index - 1]?.trim() || '';
      const caption = mediaCaption(previousLine);
      if (caption) {
        // Remove the preceding caption paragraph, which has just been flushed.
        const last = blocks.at(-1);
        if (last?.type === 'paragraph' && last.text === caption) blocks.pop();
      }
      push(
        { type: 'media', mediaType: media.mediaType, sourceRef: media.sourceRef, alt: media.alt.slice(0, 500), ...(caption ? { caption } : {}) },
        line,
      );
      continue;
    }
    if (!trimmed) {
      flush();
      continue;
    }
    flushList();
    flushQuote();
    paragraph.push({ text: trimmed, line });
  }
  flush();
  flushCode();
  return blocks;
}

function markerKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 96);
}

/** A source marker is an explicit first-line declaration such as
 * `[[ednova:topic=normalization/subtopic=keys]]`. It is safe only when the
 * same chunk is byte-verified. Free-form prose is never used as a marker. */
export function sourceMappingMarker(text: string): {
  chapter: string;
  topicId: string | null;
  subtopicId: string | null;
} | null {
  const first = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0]?.trim();
  const match = first?.match(/^\[\[ednova:topic=([^\]/\s]{1,96})(?:\/subtopic=([^\]\s]{1,96}))?\]\]$/);
  if (!match) return null;
  return {
    chapter: match[2] ? `${match[1]} / ${match[2]}` : match[1],
    topicId: match[1],
    subtopicId: match[2] || null,
  };
}

/** Mapping markers are metadata, not visible lesson content. A marker is valid
 * only as the entire first line, so ordinary bracket prose stays intact. */
export function withoutSourceMarker(text: string): string {
  return sourceMappingMarker(text) ? text.replace(/^\uFEFF?[^\n]*/, '') : text;
}

export function projectSemanticContent(
  passages: SemanticPassage[],
  explicitMappings: ExplicitPassageMapping[] = [],
): SemanticProjection {
  const explicit = new Map(explicitMappings.map((mapping) => [mapping.chunkId, mapping]));
  const projected = passages.map((passage) => ({
    ...passage,
    blocks: extractSemanticBlocks({ ...passage, text: withoutSourceMarker(passage.text) }),
  }));
  const mappings: SemanticMapping[] = passages.map((passage) => {
    const supplied = explicit.get(passage.chunkId);
    if (supplied) {
      const valid =
        supplied.documentId === passage.documentId &&
        supplied.pageNumber === passage.pageNumber &&
        supplied.status !== 'inferred_review_required';
      return {
        chunkId: passage.chunkId,
        documentId: passage.documentId,
        pageNumber: passage.pageNumber,
        topicId: valid ? supplied.topicId : null,
        subtopicId: valid ? supplied.subtopicId : null,
        status: valid && supplied.topicId ? 'exact' : 'inferred_review_required',
        method: 'artifact_metadata',
        ...(!valid ? { note: 'Explicit mapping did not match the verified passage.' } : {}),
      };
    }
    const marker = sourceMappingMarker(passage.text);
    if (marker)
      return {
        chunkId: passage.chunkId,
        documentId: passage.documentId,
        pageNumber: passage.pageNumber,
        topicId: marker.topicId,
        subtopicId: marker.subtopicId,
        status: 'exact',
        method: 'source_marker',
      };
    return {
      chunkId: passage.chunkId,
      documentId: passage.documentId,
      pageNumber: passage.pageNumber,
      topicId: null,
      subtopicId: null,
      status: 'unmapped',
      method: 'legacy_unmapped',
      note: 'No exact topic association is recorded in the verified artifact.',
    };
  });
  const byChapter = new Map<string, SemanticBlock[]>();
  for (const [index, passage] of passages.entries()) {
    const mapping = mappings[index];
    if (mapping.status !== 'exact') continue;
    const marker = sourceMappingMarker(passage.text);
    if (!marker) continue;
    const existing = byChapter.get(marker.chapter) || [];
    // The marker is explanatory metadata; keep it visible in the source passage
    // but omit it from the composed lesson block stream.
    existing.push(...projected[index].blocks.filter((block) => !(block.type === 'paragraph' && block.evidence.lineStart === 1 && block.text.startsWith('[[ednova:'))));
    byChapter.set(marker.chapter, existing);
  }
  const uncertainties = [
    ...(mappings.some((mapping) => mapping.status === 'unmapped')
      ? ['Some verified passages have no explicit topic association. They remain available in source order and are not assigned to a lesson.']
      : []),
    ...(mappings.some((mapping) => mapping.status === 'inferred_review_required')
      ? ['A proposed source mapping needs instructor review and is not presented as exact.']
      : []),
    ...(projected.some((passage) => passage.blocks.some((block) => block.type === 'media'))
      ? ['Source media references are recorded without being fetched; only approved server media can be rendered.']
      : []),
  ];
  return {
    schemaVersion: SEMANTIC_PROJECTION_VERSION,
    extraction: 'deterministic',
    passages: projected,
    chapters: [...byChapter.entries()].map(([title, blocks]) => ({
      id: `chapter-${markerKey(title)}`,
      title,
      blocks,
    })),
    mappings,
    uncertainties,
  };
}
