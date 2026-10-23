/**
 * LearningObjective schema validator (F01).
 *
 * Python mirror: `study-partner-ai/models/learning_objective.py`. Rules MUST
 * stay identical on both sides.
 *
 * Depends on BLOOM-01 (shared/bloom/taxonomy.js) for enums and verb map.
 * Follows the {valid, errors} contract used by shared/ai-messaging/payloadSchemas.js
 * rather than throwing — callers decide what to do with a rejection (e.g. log + 400).
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { BLOOM_LEVELS, KNOWLEDGE_TYPES, VERB_MAP } = require('../../../../shared/bloom/taxonomy');

const TEXT_MAX_CHARS = 200;
const VERB_START_MAX_WORDS = 3; // verb must appear within the first N words of text

// Explicit denylist of vague/non-measurable phrasings. Extend deliberately —
// keep it a finite, reviewable list rather than a fuzzy heuristic.
const NON_MEASURABLE_PHRASES = [
  'know',
  'be familiar with',
  'understand',
  'learn about',
  'be aware of',
  'grasp'
];

function startsWithVerbNearby(text: string, verb: string): boolean {
  const words = text.trim().split(/\s+/).slice(0, VERB_START_MAX_WORDS);
  const normalizedVerb = verb.trim().toLowerCase();
  return words.some((w) => w.toLowerCase().replace(/[^a-z]/g, '') === normalizedVerb);
}

function containsNonMeasurablePhrase(text: string): string | null {
  const lower = text.toLowerCase();
  return NON_MEASURABLE_PHRASES.find((phrase) => lower.startsWith(phrase)) || null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * @param {object} payload
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateLearningObjective(payload: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { valid: false, errors: ['payload must be an object'] };
  }

  const { objectiveId, topicId, knowledgeType, bloomLevel, verb, text } = payload as Record<
    string,
    unknown
  >;

  if (typeof objectiveId !== 'string' || !objectiveId.trim()) {
    errors.push('objectiveId must be a non-empty string');
  }

  if (typeof topicId !== 'string' || !topicId.trim()) {
    errors.push('topicId must be a non-empty string');
  }

  if (!KNOWLEDGE_TYPES.includes(knowledgeType)) {
    errors.push(`knowledgeType must be one of: ${KNOWLEDGE_TYPES.join(', ')}`);
  }

  const bloomLevelValid = BLOOM_LEVELS.includes(bloomLevel);
  if (!bloomLevelValid) {
    errors.push(`bloomLevel must be one of: ${BLOOM_LEVELS.join(', ')}`);
  }

  // verb-vs-level check only makes sense once bloomLevel itself is valid
  if (bloomLevelValid && typeof bloomLevel === 'string') {
    const allowedVerbs = VERB_MAP[bloomLevel] || [];
    if (typeof verb !== 'string' || !allowedVerbs.includes(verb)) {
      errors.push(`verb must be one of: ${allowedVerbs.join(', ')} for bloomLevel "${bloomLevel}"`);
    }
  }

  if (typeof text !== 'string' || !text.trim()) {
    errors.push('text must be a non-empty string');
  } else {
    if (text.length > TEXT_MAX_CHARS) {
      errors.push(`text exceeds ${TEXT_MAX_CHARS} chars`);
    }

    const vaguePhrase = containsNonMeasurablePhrase(text);
    if (vaguePhrase) {
      errors.push(`text uses a non-measurable phrasing: "${vaguePhrase}"`);
    }

    if (typeof verb === 'string' && verb.trim() && !startsWithVerbNearby(text, verb)) {
      errors.push(`verb "${verb}" must appear at/near the start of text`);
    }
  }

  return { valid: errors.length === 0, errors };
}

const LIMITS = {
  TEXT_MAX_CHARS,
  VERB_START_MAX_WORDS
};

export { validateLearningObjective, LIMITS, NON_MEASURABLE_PHRASES };

module.exports = {
  validateLearningObjective,
  LIMITS,
  NON_MEASURABLE_PHRASES
};
