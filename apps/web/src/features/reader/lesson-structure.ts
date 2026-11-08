/**
 * Presentation-only structuring of one reader section into learnable steps.
 *
 * Extracted PDFs arrive as one block per printed line, with page furniture
 * (running headers, page numbers, tables of contents) mixed into the lesson and
 * real headings stored as ordinary paragraphs. This module never changes or
 * drops source text from the canonical document: it regroups what is already
 * there so a learner can take it one concept at a time. Anything it hides as
 * page furniture is counted in `omitted` and stays in the original source.
 */
import type { LessonBlockV2 } from "@ednova/shared/ednova/learningDocumentV2";

type Paragraph = Extract<LessonBlockV2, { type: "paragraph" }>;
type Callout = Extract<LessonBlockV2, { type: "callout" }>;

export type ConceptKind =
  | "definition"
  | "theorem"
  | "proposition"
  | "lemma"
  | "corollary"
  | "example"
  | "exercise"
  | "remark"
  | "proof"
  | "note";

export type StepItem =
  | { kind: "prose"; id: string; text: string; block: Paragraph; reviewRequired: boolean }
  | { kind: "bullets"; id: string; items: string[]; block: Paragraph }
  | { kind: "block"; id: string; block: LessonBlockV2 }
  | {
      kind: "concept";
      id: string;
      conceptKind: ConceptKind;
      title: string;
      text: string;
      block: Callout;
      body: StepItem[];
    };

export type StepConcept = { id: string; kind: ConceptKind; title: string; text: string };

export type LessonStep = {
  id: string;
  title: string;
  /** Larger unit the step belongs to, e.g. "I · Suites de fonctions". */
  group: string | null;
  items: StepItem[];
  concepts: StepConcept[];
  counts: Record<"definitions" | "results" | "examples" | "exercises" | "formulas", number>;
  minutes: number;
};

export type StructuredLesson = { steps: LessonStep[]; omitted: number };

// PDF extraction leaves stray control characters (e.g. U+0001 bullets).
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/g;
export const clean = (value: string) => value.replace(CONTROL, "").replace(/[ \t]{2,}/g, " ").trim();

const CONCEPT_KINDS: Record<string, ConceptKind> = {
  definition: "definition",
  theorem: "theorem",
  proposition: "proposition",
  lemma: "lemma",
  corollary: "corollary",
  example: "example",
  exercise: "exercise",
  remark: "remark",
  proof: "proof",
  note: "note",
};
const RESULT_KINDS = new Set<ConceptKind>(["theorem", "proposition", "lemma", "corollary"]);
const RECALL_KINDS = new Set<ConceptKind>(["definition", "theorem", "proposition", "lemma", "corollary"]);
export const isRecallKind = (kind: ConceptKind) => RECALL_KINDS.has(kind);

const SENTENCE_END = /[.!?…»”):]\s*$/u;
const NEW_PARAGRAPH = /^(?:[•▪◦‣]|[➊➋➌➍➎➀➁➂➃➄]|\(\w{1,4}\)|\d{1,2}[.)]\s)/u;
const BULLET = /^\s*[•▪◦‣]\s*/u;
const TOC_LEADER = /(?:\.\s?){6,}/;
const PAGE_NUMBER = /^(?:page\s*)?\d{1,3}$/i;
const L1 = /^([IVX]{1,5})\s*[|｜]\s*(\S.{1,100})$/u;
const L2 = /^(\p{Lu})\s*[–—-]\s*(\S.{1,100})$/u;
const GENERIC_HEADING = /^(course source|untitled.*)$/i;
const MIN_STEP_CHARS = 280;
const LONG_STEP_CHARS = 6500;

const normalizeFurniture = (text: string) => text.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();

function weight(items: StepItem[]): number {
  return items.reduce((total, item) => {
    switch (item.kind) {
      case "prose": return total + item.text.length;
      case "bullets": return total + item.items.join(" ").length;
      case "concept": return total + item.text.length + 120 + weight(item.body);
      default: return total + 160;
    }
  }, 0);
}

/** Merge one-line-per-block extraction into flowing paragraphs. */
function mergeProse(blocks: LessonBlockV2[], omitted: { n: number }): StepItem[] {
  // Running headers/footers repeat on every page; real sentences do not.
  const counts = new Map<string, number>();
  for (const block of blocks)
    if (block.type === "paragraph") {
      const key = normalizeFurniture(clean(block.text));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  const isFurniture = (text: string) =>
    !text ||
    PAGE_NUMBER.test(text) ||
    TOC_LEADER.test(text) ||
    (text.length <= 90 && (counts.get(normalizeFurniture(text)) ?? 0) >= 3);

  const out: StepItem[] = [];
  let run: { texts: string[]; first: Paragraph; evidence: Set<string>; review: boolean; closed: boolean } | null = null;
  const flush = () => {
    if (!run) return;
    const text = run.texts.reduce((acc, part) => (/[-‐]$/.test(acc) && /^\p{Ll}/u.test(part) ? acc.slice(0, -1) + part : `${acc} ${part}`)).trim();
    const block: Paragraph = { ...run.first, text, evidence: [...run.evidence] };
    if (BULLET.test(text)) {
      const item = text.replace(BULLET, "");
      const previous = out[out.length - 1];
      if (previous?.kind === "bullets") previous.items.push(item);
      else out.push({ kind: "bullets", id: run.first.id, items: [item], block });
    } else out.push({ kind: "prose", id: run.first.id, text, block, reviewRequired: run.review });
    run = null;
  };

  for (const block of blocks) {
    if (block.type === "heading" && GENERIC_HEADING.test(clean(block.text))) { omitted.n += 1; continue; }
    if (block.type === "heading" && !clean(block.text)) { omitted.n += 1; continue; }
    if (block.type === "callout" && /learning objective/i.test(block.title ?? "")) { omitted.n += 1; continue; }
    if (block.type !== "paragraph") {
      flush();
      out.push({ kind: "block", id: block.id, block });
      continue;
    }
    const text = clean(block.text);
    if (isFurniture(text)) { omitted.n += 1; continue; }
    const review = Boolean(block.sourceMeta?.reviewRequired);
    const heading = text.length <= 110 && (L1.test(text) || L2.test(text));
    if (run && !run.closed && !heading && !(SENTENCE_END.test(run.texts[run.texts.length - 1]) && /^[\p{Lu}•▪◦‣]/u.test(text)) && !NEW_PARAGRAPH.test(text)) {
      run.texts.push(text);
      block.evidence.forEach((e) => run!.evidence.add(e));
      run.review ||= review;
    } else {
      flush();
      run = { texts: [text], first: block, evidence: new Set(block.evidence), review, closed: heading };
    }
  }
  flush();
  return out;
}

const conceptKindOf = (block: Callout): ConceptKind => CONCEPT_KINDS[block.kind.toLowerCase()] ?? "note";

const LABELS = /^(d[ée]finition|th[ée]or[èe]me|proposition|lemme|lemma|corollaire|corollary|exemple|example|exercice|exercise|remarque|remark|preuve|proof|theorem)$/i;
const SENTENCE_START = /^(On|Soit|Soient|Si|Toute|Tout|Toutes|Tous|Pour|Une|Un|Il|Elle|Les|La|Le|L’|Dans|Sur|Alors|Considérons|Notons|Let|If|For|Every|Any|The|A|An|We)(?:$|(?=[’']))/u;

/**
 * The extractor labels a definition "Definition" and leaves the printed title
 * ("Définition 8.1 : Convergence simple") at the start of its text. Move it into
 * the title so the card reads as a named concept instead of repeating itself.
 */
export function splitConceptTitle(title: string, text: string): { title: string; text: string } {
  const head = /^(\p{L}+)\s+(\d+(?:\.\d+)*)\s*(?::\s*)?/u.exec(text);
  if (!head || !LABELS.test(head[1])) return { title, text };
  const label = `${head[1]} ${head[2]}`;
  const rest = text.slice(head[0].length);
  const words = rest.split(" ");
  for (let i = 1; i <= Math.min(8, words.length - 1); i += 1) {
    if (SENTENCE_START.test(words[i])) {
      const name = words.slice(0, i).join(" ").trim();
      return { title: name ? `${label} : ${name}` : label, text: words.slice(i).join(" ").trim() };
    }
  }
  return { title: label, text: rest.trim() };
}

/** Attach the statement that follows a title-only "Exercice"/"Exemple" callout. */
function groupConcepts(items: StepItem[]): StepItem[] {
  const out: StepItem[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item.kind !== "block" || item.block.type !== "callout") { out.push(item); continue; }
    const callout = item.block;
    const conceptKind = conceptKindOf(callout);
    let text = clean(callout.text);
    let title = clean(callout.title ?? "") || conceptKind[0].toUpperCase() + conceptKind.slice(1);
    if (!/\d/.test(title)) ({ title, text } = splitConceptTitle(title, text));
    const body: StepItem[] = [];
    const titleOnly = text.length < 40 || text.toLowerCase() === title.toLowerCase();
    if (titleOnly && (conceptKind === "exercise" || conceptKind === "example")) {
      let sentences = 0;
      while (i + 1 < items.length && body.length < 14) {
        const next = items[i + 1];
        if (next.kind === "concept" || (next.kind === "block" && next.block.type === "callout")) break;
        if (conceptKind === "exercise") {
          if (next.kind === "prose" || next.kind === "bullets") { if (sentences >= 1) break; sentences += 1; }
          else if (sentences === 0 && next.kind !== "block") break;
        }
        body.push(next);
        i += 1;
      }
    }
    out.push({ kind: "concept", id: callout.id, conceptKind, title, text: titleOnly ? "" : text, block: callout, body });
  }
  return out;
}

type Marker = { level: 1 | 2; title: string; group?: string };

function markerOf(item: StepItem): Marker | null {
  if (item.kind === "block" && item.block.type === "heading") {
    const text = clean(item.block.text);
    if (text && !GENERIC_HEADING.test(text) && item.block.level <= 2) return { level: 2, title: text };
    return null;
  }
  if (item.kind !== "prose" || item.text.length > 110) return null;
  const l1 = L1.exec(item.text);
  if (l1) return { level: 1, title: l1[2].trim(), group: `${l1[1]} · ${l1[2].trim()}` };
  const l2 = L2.exec(item.text);
  if (l2) return { level: 2, title: l2[2].trim() };
  return null;
}

const slug = (text: string) =>
  text.normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40) || "part";

function summarize(items: StepItem[]) {
  const concepts: StepConcept[] = [];
  const counts = { definitions: 0, results: 0, examples: 0, exercises: 0, formulas: 0 };
  let chars = 0;
  const walk = (list: StepItem[]) => {
    for (const item of list) {
      if (item.kind === "concept") {
        concepts.push({ id: item.id, kind: item.conceptKind, title: item.title, text: item.text });
        if (item.conceptKind === "definition") counts.definitions += 1;
        else if (RESULT_KINDS.has(item.conceptKind)) counts.results += 1;
        else if (item.conceptKind === "example") counts.examples += 1;
        else if (item.conceptKind === "exercise") counts.exercises += 1;
        chars += item.text.length;
        walk(item.body);
      } else if (item.kind === "prose") chars += item.text.length;
      else if (item.kind === "bullets") chars += item.items.join(" ").length;
      else if (item.kind === "block" && item.block.type === "math") { counts.formulas += 1; chars += 120; }
    }
  };
  walk(items);
  return { concepts, counts, minutes: Math.max(1, Math.round(chars / 1100)) };
}

/** Split an oversized step at a paragraph/concept boundary. */
function splitLong(title: string, group: string | null, items: StepItem[]) {
  if (weight(items) <= LONG_STEP_CHARS) return [{ title, group, items }];
  const parts: StepItem[][] = [[]];
  let size = 0;
  for (const item of items) {
    const w = weight([item]);
    const boundary = item.kind === "concept" || item.kind === "prose";
    if (size > LONG_STEP_CHARS * 0.6 && boundary) { parts.push([]); size = 0; }
    parts[parts.length - 1].push(item);
    size += w;
  }
  return parts.map((part, i) => ({ title: parts.length > 1 ? `${title} (${i + 1}/${parts.length})` : title, group, items: part }));
}

export function structureLesson(blocks: LessonBlockV2[], fallbackTitle: string): StructuredLesson {
  const omitted = { n: 0 };
  const items = groupConcepts(mergeProse(blocks, omitted));

  const raw: Array<{ title: string; group: string | null; items: StepItem[] }> = [];
  let group: string | null = null;
  let current: { title: string; group: string | null; items: StepItem[] } = { title: fallbackTitle, group: null, items: [] };
  const close = () => { if (current.items.length) raw.push(current); };
  for (const item of items) {
    const marker = markerOf(item);
    if (!marker) { current.items.push(item); continue; }
    if (marker.level === 1) {
      close();
      group = marker.group ?? marker.title;
      current = { title: marker.title, group, items: [] };
    } else {
      // An H1 immediately followed by an H2 gives the step the H2's title.
      if (current.items.length) { raw.push(current); }
      current = { title: marker.title, group, items: [] };
    }
  }
  close();

  // Fold tiny steps (title pages, lone epigraphs) into the next one so a
  // learner is never handed a screen with a single sentence on it.
  const folded: typeof raw = [];
  let carry: StepItem[] = [];
  raw.forEach((step, index) => {
    const merged = { ...step, items: [...carry, ...step.items] };
    if (weight(step.items) < MIN_STEP_CHARS && index < raw.length - 1) { carry = merged.items; return; }
    carry = [];
    folded.push(merged);
  });

  const sized = (folded.length ? folded : [{ title: fallbackTitle, group: null, items }]).flatMap((s) =>
    splitLong(s.title, s.group, s.items),
  );
  const steps = sized
    .filter((s) => s.items.length)
    .map((s, index): LessonStep => ({
      id: `step-${index + 1}-${slug(s.title)}`,
      title: s.title,
      group: s.group,
      items: s.items,
      ...summarize(s.items),
    }));
  return { steps, omitted: omitted.n };
}
