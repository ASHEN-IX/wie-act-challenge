/**
 * Canonical Bloom's Taxonomy constants (BLOOM-01 — Shared Taxonomy Constants).
 *
 * Python mirror: `study-partner-ai/bloom/taxonomy.py`. Values MUST stay
 * identical on both sides — parity is covered by contract tests against
 * docs/contracts/bloom-fixture.json.
 */

export const BLOOM_LEVELS = Object.freeze([
  'remember',
  'understand',
  'apply',
  'analyze',
  'evaluate',
  'create'
] as const);

export type BloomLevel = (typeof BLOOM_LEVELS)[number];

export const KNOWLEDGE_TYPES = Object.freeze([
  'factual',
  'conceptual',
  'procedural',
  'metacognitive'
] as const);

export type KnowledgeType = (typeof KNOWLEDGE_TYPES)[number];

export const VERB_MAP = Object.freeze({
  remember: Object.freeze(['Define', 'List']),
  understand: Object.freeze(['Explain', 'Summarize']),
  apply: Object.freeze(['Solve', 'Implement']),
  analyze: Object.freeze(['Compare', 'Diagnose']),
  evaluate: Object.freeze(['Justify', 'Critique']),
  create: Object.freeze(['Design', 'Compose'])
});

export const UNLOCK_THRESHOLD = 0.7;

/**
 * Returns the next Bloom level in progression order, or null if `level`
 * is already the highest level ('create') or not a recognized level.
 */
export function nextLevel(level: string): string | null {
  const idx = (BLOOM_LEVELS as readonly string[]).indexOf(level);
  if (idx === -1 || idx === BLOOM_LEVELS.length - 1) return null;
  return BLOOM_LEVELS[idx + 1];
}

/** Retain the CommonJS property name through TypeScript's generated exports. */
export const unlockThreshold = UNLOCK_THRESHOLD;
